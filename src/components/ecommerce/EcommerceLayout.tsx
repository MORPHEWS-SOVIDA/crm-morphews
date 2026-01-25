import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { cn } from '@/lib/utils';
import { 
  Store, 
  FileText, 
  ShoppingCart, 
  Mail, 
  Users, 
  Factory, 
  Wallet,
  ShoppingBag,
  Settings
} from 'lucide-react';

import { CreditCard } from 'lucide-react';

const navItems = [
  { path: '/ecommerce/lojas', label: 'Lojas', icon: Store },
  { path: '/ecommerce/landings', label: 'Landings', icon: FileText },
  { path: '/ecommerce/checkouts', label: 'Checkouts', icon: CreditCard },
  { path: '/ecommerce/vendas', label: 'Vendas', icon: ShoppingBag },
  { path: '/ecommerce/carrinhos', label: 'Carrinhos', icon: ShoppingCart },
  { path: '/ecommerce/emails', label: 'E-mails', icon: Mail },
  { path: '/ecommerce/afiliados', label: 'Afiliados', icon: Users },
  { path: '/ecommerce/industrias', label: 'Indústrias', icon: Factory },
  { path: '/ecommerce/carteira', label: 'Carteira', icon: Wallet },
];

interface EcommerceLayoutProps {
  children: ReactNode;
  title: string;
  description?: string;
}

export function EcommerceLayout({ children, title, description }: EcommerceLayoutProps) {
  const location = useLocation();

  return (
    <Layout>
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar Navigation */}
        <nav className="lg:w-48 shrink-0">
          <div className="lg:sticky lg:top-4">
            <div className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                      isActive 
                        ? "bg-primary text-primary-foreground" 
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">{title}</h1>
            {description && (
              <p className="text-muted-foreground">{description}</p>
            )}
          </div>
          {children}
        </div>
      </div>
    </Layout>
  );
}
