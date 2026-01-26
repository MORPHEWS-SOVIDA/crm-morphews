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
      // Get current admin session to save for later
      const { data: { session: adminSession } } = await supabase.auth.getSession();
      if (!adminSession) {
        throw new Error('Você precisa estar logado como admin');
      }

      // Call the impersonation edge function
      const { data, error } = await supabase.functions.invoke<ImpersonationResult>('admin-impersonate', {
        body: { targetUserId },
      });

      if (error) throw error;
      if (!data?.success) throw new Error('Falha ao gerar link de impersonação');

      // Save admin session and impersonation data to localStorage
      const impersonationData = {
        targetUser: data.targetUser,
        adminUser: data.adminUser,
        adminToken: adminSession.access_token,
      };
      localStorage.setItem('impersonation_data', JSON.stringify(impersonationData));

      // Sign in as the target user using the OTP token hash
      const { error: signInError } = await supabase.auth.verifyOtp({
        email: data.email,
        token_hash: data.tokenHash,
        type: 'magiclink',
      });

      if (signInError) {
        // Clear impersonation data if login fails
        localStorage.removeItem('impersonation_data');
        throw signInError;
      }

      toast.success(`Logado como ${data.targetUser.name}`);
      
      // Reload page to apply new session
      window.location.href = '/';
      
      return true;

    } catch (error: any) {
      console.error('Impersonation error:', error);
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
