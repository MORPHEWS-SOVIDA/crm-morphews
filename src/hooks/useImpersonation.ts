import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ImpersonationResult {
  success: boolean;
  email: string;
  token: string;
  tokenHash: string;
  targetUser: {
    id: string;
    email: string;
    name: string;
  };
  adminUser: {
    id: string;
    email: string;
  };
}

export function useImpersonation() {
  const [isLoading, setIsLoading] = useState(false);

  const impersonateUser = async (targetUserId: string) => {
    setIsLoading(true);
    
    try {
      console.log('[Impersonation] Starting impersonation for user:', targetUserId);
      
      // Get current admin session to save for later
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession) {
        throw new Error('Você precisa estar logado como admin');
      }

      // Force-refresh token to avoid using a revoked/stale access token
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      const adminSession = refreshData.session ?? currentSession;
      if (refreshError) {
        console.warn('[Impersonation] Token refresh warning, proceeding with current session:', refreshError.message);
      }

      console.log('[Impersonation] Admin session found, calling edge function...');

      // Call edge function directly to guarantee Authorization header forwarding on custom domains
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-impersonate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${adminSession.access_token}`,
        },
        body: JSON.stringify({ targetUserId }),
      });

      const data = (await response.json()) as ImpersonationResult & { error?: string; details?: string };

      console.log('[Impersonation] Edge function response:', { status: response.status, data });

      if (!response.ok) {
        throw new Error(data?.details || data?.error || 'Erro na função de impersonação');
      }
      
      if (!data?.success) {
        console.error('[Impersonation] Edge function returned unsuccessful:', data);
        throw new Error((data as any)?.error || 'Falha ao gerar link de impersonação');
      }

      console.log('[Impersonation] Got token hash, signing in as target user...');

      // Save admin session and impersonation data to localStorage
      const impersonationData = {
        targetUser: data.targetUser,
        adminUser: data.adminUser,
        adminToken: adminSession.access_token,
        adminRefreshToken: adminSession.refresh_token, // Save refresh token too
      };
      localStorage.setItem('impersonation_data', JSON.stringify(impersonationData));

      // Sign in as the target user using the OTP token hash
      // Note: When using token_hash, we should NOT pass the email - the token_hash contains all info
      const { error: signInError } = await supabase.auth.verifyOtp({
        token_hash: data.tokenHash,
        type: 'magiclink',
      });

      if (signInError) {
        // Clear impersonation data if login fails
        console.error('[Impersonation] OTP verification error:', signInError);
        localStorage.removeItem('impersonation_data');
        throw new Error(`Erro ao verificar OTP: ${signInError.message}`);
      }

      console.log('[Impersonation] Successfully signed in as target user, redirecting...');
      toast.success(`Logado como ${data.targetUser.name}`);
      
      // Reload page to apply new session
      window.location.href = '/';
      
      return true;

    } catch (error: any) {
      console.error('[Impersonation] Error:', error);
      toast.error(error.message || 'Erro ao impersonar usuário');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    impersonateUser,
    isLoading,
  };
}
