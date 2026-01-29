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
      const { data: { session: adminSession } } = await supabase.auth.getSession();
      if (!adminSession) {
        throw new Error('Você precisa estar logado como admin');
      }

      console.log('[Impersonation] Admin session found, calling edge function...');

      // Call the impersonation edge function
      const { data, error } = await supabase.functions.invoke<ImpersonationResult>('admin-impersonate', {
        body: { targetUserId },
      });

      console.log('[Impersonation] Edge function response:', { data, error });

      if (error) {
        console.error('[Impersonation] Edge function error:', error);
        throw new Error(error.message || 'Erro na função de impersonação');
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
