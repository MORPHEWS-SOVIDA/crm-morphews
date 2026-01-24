import { Link } from 'react-router-dom';
import { Search, ShoppingCart, Menu, User, Heart, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetTrigger, SheetClose } from '@/components/ui/sheet';
import { getTemplateStyles } from './templateUtils';
import type { StorefrontCategory } from '@/hooks/ecommerce/useStorefrontCategories';

interface TemplatedHeaderProps {
  templateSlug?: string | null;
  storeName: string;
  logoUrl?: string | null;
  categories?: StorefrontCategory[];
  storefrontSlug: string;
  cartItemCount?: number;
  primaryColor?: string;
  showSearch?: boolean;
  announcementText?: string;
}

export function TemplatedHeader({
  templateSlug,
  storeName,
  logoUrl,
  categories = [],
  storefrontSlug,
  cartItemCount = 0,
  primaryColor,
  showSearch = true,
  announcementText,
}: TemplatedHeaderProps) {
  const styles = getTemplateStyles(templateSlug);

  return (
    <>
      {/* Announcement Bar */}
      {announcementText && (
        <div 
          className="py-2 text-center text-sm text-white"
          style={{ backgroundColor: primaryColor || '#1a1a1a' }}
        >
          {announcementText}
        </div>
      )}

      <header className={`sticky top-0 z-50 bg-background ${styles.header}`}>
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16 md:h-20">
            {/* Mobile Menu */}
            <Sheet>
              <SheetTrigger asChild className="md:hidden">
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80">
                <div className="flex flex-col gap-6 mt-8">
                  <Link to={`/loja/${storefrontSlug}`} className="text-lg font-semibold">
                    Início
                  </Link>
                  <Link to={`/loja/${storefrontSlug}/produtos`} className="text-lg">
                    Todos os Produtos
                  </Link>
                  {categories.map(cat => (
                    <Link 
                      key={cat.id} 
                      to={`/loja/${storefrontSlug}/categoria/${cat.slug}`}
                      className="text-lg"
                    >
                      {cat.name}
                    </Link>
                  ))}
                </div>
              </SheetContent>
            </Sheet>

            {/* Logo */}
            <Link to={`/loja/${storefrontSlug}`} className="flex-shrink-0">
              {logoUrl ? (
                <img 
                  src={logoUrl} 
                  alt={storeName} 
                  className={styles.headerLogo}
                />
              ) : (
                <span 
                  className="text-xl font-bold"
                  style={{ color: primaryColor }}
                >
                  {storeName}
                </span>
              )}
            </Link>

            {/* Desktop Navigation */}
            <nav className={`hidden md:flex items-center ${styles.nav}`}>
              <Link 
                to={`/loja/${storefrontSlug}`}
                className="hover:text-primary transition-colors"
              >
                Início
              </Link>
              <Link 
                to={`/loja/${storefrontSlug}/produtos`}
                className="hover:text-primary transition-colors"
              >
                Produtos
              </Link>
              {categories.slice(0, 4).map(cat => (
                <Link 
                  key={cat.id}
                  to={`/loja/${storefrontSlug}/categoria/${cat.slug}`}
                  className="hover:text-primary transition-colors"
                >
                  {cat.name}
                </Link>
              ))}
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-2 md:gap-4">
              {/* Search (Desktop) */}
              {showSearch && (
                <div className="hidden md:flex items-center">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Buscar..."
                      className="pl-9 w-48 lg:w-64 h-9"
                    />
                  </div>
                </div>
              )}

              {/* Search (Mobile) */}
              <Button variant="ghost" size="icon" className="md:hidden">
                <Search className="h-5 w-5" />
              </Button>

              {/* Wishlist */}
              <Button variant="ghost" size="icon" className="hidden md:flex">
                <Heart className="h-5 w-5" />
              </Button>

              {/* Cart */}
              <Link to={`/loja/${storefrontSlug}/carrinho`}>
                <Button variant="ghost" size="icon" className="relative">
                  <ShoppingCart className="h-5 w-5" />
                  {cartItemCount > 0 && (
                    <Badge 
                      className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {cartItemCount}
                    </Badge>
                  )}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
