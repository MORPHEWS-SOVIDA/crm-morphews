import { useEffect, useState } from 'react';
import { AlertTriangle, XCircle, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ImpersonationData {
  targetUser: {
    id: string;
    email: string;
    name: string;
  };
  adminUser: {
    id: string;
    email: string;
  };
  adminToken: string;
}

export function ImpersonationBanner() {
  const [impersonationData, setImpersonationData] = useState<ImpersonationData | null>(null);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Check if we're impersonating
    const data = localStorage.getItem('impersonation_data');
    if (data) {
      try {
        setImpersonationData(JSON.parse(data));
      } catch (e) {
        localStorage.removeItem('impersonation_data');
      }
    }
  }, []);

  const handleExitImpersonation = async () => {
    if (!impersonationData?.adminToken) return;
    
    setIsExiting(true);
    
    try {
      // Restore admin session
      const { error } = await supabase.auth.setSession({
        access_token: impersonationData.adminToken,
        refresh_token: '', // Will force a refresh
      });

      if (error) {
        // If session restore fails, just logout and redirect
        console.error('Error restoring admin session:', error);
        await supabase.auth.signOut();
      }

      // Clear impersonation data
      localStorage.removeItem('impersonation_data');
      
      toast.success('Sessão de admin restaurada');
      
      // Redirect to super-admin
      window.location.href = '/super-admin?tab=all-users';
      
    } catch (error) {
      console.error('Error exiting impersonation:', error);
      toast.error('Erro ao sair da impersonação');
      // Force logout as fallback
      await supabase.auth.signOut();
      localStorage.removeItem('impersonation_data');
      window.location.href = '/login';
    } finally {
      setIsExiting(false);
    }
  };

  if (!impersonationData) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg">
      <div className="container mx-auto px-4 py-2">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white/20 px-3 py-1 rounded-full">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-bold uppercase tracking-wide">Modo Espião</span>
            </div>
            
            <div className="flex items-center gap-2">
              <User className="w-4 h-4" />
              <span className="text-sm">
                Visualizando como: <strong>{impersonationData.targetUser.name}</strong>
              </span>
              <span className="text-xs opacity-75">
                ({impersonationData.targetUser.email})
              </span>
            </div>
          </div>
          
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExitImpersonation}
            disabled={isExiting}
            className="bg-white text-amber-700 hover:bg-white/90 font-semibold"
          >
            <XCircle className="w-4 h-4 mr-2" />
            {isExiting ? 'Saindo...' : 'Sair do Usuário'}
          </Button>
        </div>
      </div>
    </div>
  );
}
