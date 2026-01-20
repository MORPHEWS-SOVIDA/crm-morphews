import { ReactNode, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
  Package,
  MessageSquare,
  Users,
  ShoppingCart,
  ClipboardList,
  TicketCheck,
  DollarSign,
  FileText,
} from 'lucide-react';
import logoMorphews from '@/assets/logo-morphews.png';
import { cn } from '@/lib/utils';

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
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  
  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  // Build nav items based on user permissions
  const navItems = [
    { 
      icon: Package, 
      label: 'Expedição', 
      path: '/expedicao', 
      visible: permissions?.expedition_view 
    },
    { 
      icon: Truck, 
      label: 'Minhas Entregas', 
      path: '/minhas-entregas', 
      visible: permissions?.deliveries_view_own || permissions?.deliveries_view_all 
    },
    { 
      icon: Truck, 
      label: 'Todas as Entregas', 
      path: '/todas-entregas', 
      visible: permissions?.deliveries_view_all 
    },
    { 
      icon: Users, 
      label: 'Leads', 
      path: '/leads', 
      visible: permissions?.leads_view 
    },
    { 
      icon: ShoppingCart, 
      label: 'Vendas', 
      path: '/vendas', 
      visible: permissions?.sales_view 
    },
    { 
      icon: ClipboardList, 
      label: 'Pós-Venda', 
      path: '/pos-venda', 
      visible: permissions?.post_sale_view 
    },
    { 
      icon: TicketCheck, 
      label: 'SAC', 
      path: '/sac', 
      visible: permissions?.sac_view 
    },
    { 
      icon: MessageSquare, 
      label: 'WhatsApp', 
      path: '/whatsapp/chat', 
      visible: permissions?.whatsapp_view 
    },
    { 
      icon: DollarSign, 
      label: 'Financeiro', 
      path: '/financeiro', 
      visible: permissions?.reports_view 
    },
    { 
      icon: FileText, 
      label: 'Relatório Expedição', 
      path: '/relatorios/expedicao', 
      visible: permissions?.expedition_report_view 
    },
  ].filter(item => item.visible);

  const handleNavClick = (path: string) => {
    navigate(path);
    setIsOpen(false);
  };

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
                        {permissions?.expedition_view ? 'Expedição' : 'Usuário'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Navigation Links */}
                <nav className="flex-1 space-y-1 overflow-y-auto">
                  {navItems.map((item) => (
                    <Button
                      key={item.path}
                      variant="ghost"
                      className={cn(
                        "w-full justify-start gap-3",
                        location.pathname === item.path && "bg-primary/10 text-primary"
                      )}
                      onClick={() => handleNavClick(item.path)}
                    >
                      <item.icon className="w-5 h-5" />
                      {item.label}
                    </Button>
                  ))}
                  
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3"
                    onClick={() => handleNavClick('/legal')}
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
