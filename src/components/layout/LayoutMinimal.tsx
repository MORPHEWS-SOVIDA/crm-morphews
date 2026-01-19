import { ReactNode, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useMyPermissions } from '@/hooks/useUserPermissions';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  LogOut, 
  Menu, 
  Truck, 
  Scale,
  User
} from 'lucide-react';
import logoMorphews from '@/assets/logo-morphews.png';

interface LayoutMinimalProps {
  children: ReactNode;
}

/**
 * Layout minimal sem sidebar para usuários que preferem
 * interface limpa (ex: expedição, motoboy)
 */
export function LayoutMinimal({ children }: LayoutMinimalProps) {
  const { user, profile, signOut } = useAuth();
  const { data: permissions } = useMyPermissions();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  
  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const canSeeDeliveries = permissions?.deliveries_view_own || permissions?.deliveries_view_all;

  return (
    <div className="min-h-screen bg-background">
      {/* Minimal Header for mobile users */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b">
        <div className="flex items-center justify-between p-3">
          <img src={logoMorphews} alt="Morphews" className="h-6 w-auto" />
          
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <div className="flex flex-col h-full">
                {/* User Info */}
                {user && (
                  <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-xl mb-4">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/20 text-primary">
                        {profile?.first_name?.[0] || user.email?.[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {profile ? `${profile.first_name} ${profile.last_name}` : user.email}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Entregador
                      </p>
                    </div>
                  </div>
                )}

                {/* Quick Links */}
                <nav className="flex-1 space-y-1">
                  {canSeeDeliveries && (
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-3"
                      onClick={() => {
                        navigate('/minhas-entregas');
                        setIsOpen(false);
                      }}
                    >
                      <Truck className="w-5 h-5" />
                      Minhas Entregas
                    </Button>
                  )}
                  
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3"
                    onClick={() => {
                      navigate('/legal');
                      setIsOpen(false);
                    }}
                  >
                    <Scale className="w-5 h-5" />
                    Termos e Privacidade
                  </Button>
                </nav>

                {/* Sign Out */}
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-3 mt-4 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={handleSignOut}
                >
                  <LogOut className="w-5 h-5" />
                  Sair
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>
      
      <main className="min-h-[calc(100vh-57px)]">
        <div className="p-4">
          {children}
        </div>
      </main>
    </div>
  );
}
