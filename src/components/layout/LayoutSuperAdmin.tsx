import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  LogOut, 
  Home,
  Crown,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface LayoutSuperAdminProps {
  children: ReactNode;
}

/**
 * Layout fullscreen especial para o Super Admin
 * Sem sidebar, máximo espaço para dashboard de controle
 */
export function LayoutSuperAdmin({ children }: LayoutSuperAdminProps) {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  
  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const handleGoHome = () => {
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-purple-950/10">
      {/* Decorative background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
      </div>
      
      {/* Premium Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="flex items-center justify-between px-6 py-3">
          {/* Logo + Title */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-primary rounded-xl blur-lg opacity-50" />
              <div className="relative flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-primary rounded-xl text-white">
                <Crown className="w-5 h-5" />
                <span className="font-bold text-lg tracking-tight">Super Admin</span>
              </div>
            </div>
            
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-full border border-amber-500/30">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
                Modo Administrador Master
              </span>
            </div>
          </div>
          
          {/* User Actions */}
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleGoHome}
              className="gap-2 text-muted-foreground hover:text-foreground"
            >
              <Home className="w-4 h-4" />
              <span className="hidden sm:inline">Voltar ao CRM</span>
            </Button>
            
            <div className="h-6 w-px bg-border" />
            
            {/* User Info */}
            <div className="flex items-center gap-3">
              <div className="hidden md:block text-right">
                <p className="text-sm font-medium leading-none">
                  {profile ? `${profile.first_name} ${profile.last_name}` : user?.email}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Acesso Total
                </p>
              </div>
              
              <Avatar className="h-9 w-9 ring-2 ring-primary/20 ring-offset-2 ring-offset-background">
                <AvatarFallback className="bg-gradient-to-br from-purple-500 to-primary text-white font-semibold">
                  {profile?.first_name?.[0] || user?.email?.[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSignOut}
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>
      
      <main className="relative min-h-[calc(100vh-57px)]">
        <div className="p-4 md:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
