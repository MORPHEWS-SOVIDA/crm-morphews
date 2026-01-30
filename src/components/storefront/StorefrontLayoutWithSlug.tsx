import { Outlet, Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, Menu, Search, X, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { usePublicStorefront, type StorefrontData } from '@/hooks/ecommerce/usePublicStorefront';
import { useCart } from './cart/CartContext';

/**
 * Version of StorefrontLayout that receives slug as prop instead of URL params.
 * Used for custom domain routing where the URL doesn't contain /loja/:slug
 */
export function StorefrontLayoutWithSlug({ slug }: { slug: string }) {
  const { data: storefront, isLoading, error } = usePublicStorefront(slug);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !storefront) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Loja não encontrada</h1>
          <p className="text-muted-foreground">
            A loja que você está procurando não existe ou está inativa.
          </p>
        </div>
      </div>
    );
  }

  const pageTitle = storefront.meta_title || storefront.name;
  const pageDescription = storefront.meta_description || `Loja oficial ${storefront.name}`;

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        {storefront.favicon_url && <link rel="icon" href={storefront.favicon_url} />}
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        {storefront.logo_url && <meta property="og:image" content={storefront.logo_url} />}
      </Helmet>
      <div className="min-h-screen flex flex-col">
        <StorefrontHeaderCustomDomain storefront={storefront} />
        <main className="flex-1">
          <Outlet context={{ storefront }} />
        </main>
        <StorefrontFooterCustomDomain storefront={storefront} />
      </div>
    </>
  );
}

function StorefrontHeaderCustomDomain({ storefront }: { storefront: StorefrontData }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { items } = useCart();
  const cartCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const headerConfig = storefront.header_config as {
    showSearch?: boolean;
    showCart?: boolean;
    showCategories?: boolean;
    menuStyle?: 'horizontal' | 'dropdown';
    stickyHeader?: boolean;
  } || {};

  const desktopLogo = storefront.logo_url;
  const mobileLogo = storefront.logo_mobile_url || storefront.logo_url;

  // Use root paths since we're on a custom domain (no /loja/:slug prefix)
  const basePath = '';

  return (
    <header 
      className={`border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50 ${headerConfig.stickyHeader !== false ? 'sticky top-0' : ''}`}
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            {desktopLogo ? (
              <>
                <img src={desktopLogo} alt={storefront.name} className="h-8 hidden md:block" />
                <img src={mobileLogo || desktopLogo} alt={storefront.name} className="h-8 md:hidden" />
              </>
            ) : (
              <span 
                className="text-xl font-bold"
                style={{ color: storefront.primary_color }}
              >
                {storefront.name}
              </span>
            )}
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            {headerConfig.showCategories !== false && storefront.categories.length > 0 && (
              headerConfig.menuStyle === 'dropdown' ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="gap-1">
                      Categorias <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {storefront.categories.filter(c => !c.parent_id).map(cat => (
                      <DropdownMenuItem key={cat.id} asChild>
                        <Link to={`/categoria/${cat.slug}`}>
                          {cat.name}
                        </Link>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                storefront.categories.filter(c => !c.parent_id).slice(0, 5).map(cat => (
                  <Link 
                    key={cat.id}
                    to={`/categoria/${cat.slug}`}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {cat.name}
                  </Link>
                ))
              )
            )}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {headerConfig.showSearch !== false && (
              <>
                {searchOpen ? (
                  <div className="hidden md:flex items-center gap-2">
                    <Input 
                      placeholder="Buscar produtos..." 
                      className="w-64"
                      autoFocus
                    />
                    <Button variant="ghost" size="icon" onClick={() => setSearchOpen(false)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="hidden md:flex"
                    onClick={() => setSearchOpen(true)}
                  >
                    <Search className="h-5 w-5" />
                  </Button>
                )}
              </>
            )}

            {headerConfig.showCart !== false && (
              <Link to="/carrinho">
                <Button variant="ghost" size="icon" className="relative">
                  <ShoppingCart className="h-5 w-5" />
                  {cartCount > 0 && (
                    <Badge 
                      className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                      style={{ backgroundColor: storefront.primary_color }}
                    >
                      {cartCount}
                    </Badge>
                  )}
                </Button>
              </Link>
            )}

            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80">
                <nav className="flex flex-col gap-4 mt-8">
                  {storefront.categories.filter(c => !c.parent_id).map(cat => (
                    <Link 
                      key={cat.id}
                      to={`/categoria/${cat.slug}`}
                      className="text-lg"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {cat.name}
                    </Link>
                  ))}
                  <hr />
                  {storefront.pages.map(page => (
                    <Link 
                      key={page.id}
                      to={`/pagina/${page.slug}`}
                      className="text-muted-foreground"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {page.title}
                    </Link>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}

function StorefrontFooterCustomDomain({ storefront }: { storefront: StorefrontData }) {
  const footerConfig = storefront.footer_config as {
    showNewsletter?: boolean;
    showSocial?: boolean;
    showPaymentMethods?: boolean;
  } || {};

  return (
    <footer className="border-t bg-muted/30 mt-auto">
      <div className="container mx-auto px-4 py-12">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            {storefront.logo_url ? (
              <img src={storefront.logo_url} alt={storefront.name} className="h-8 mb-4" />
            ) : (
              <h3 
                className="text-xl font-bold mb-4"
                style={{ color: storefront.primary_color }}
              >
                {storefront.name}
              </h3>
            )}
            {storefront.whatsapp_number && (
              <p className="text-sm text-muted-foreground">
                WhatsApp: {storefront.whatsapp_number}
              </p>
            )}
          </div>

          <div>
            <h4 className="font-semibold mb-4">Institucional</h4>
            <nav className="flex flex-col gap-2">
              {storefront.pages.map(page => (
                <Link 
                  key={page.id}
                  to={`/pagina/${page.slug}`}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  {page.title}
                </Link>
              ))}
            </nav>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Categorias</h4>
            <nav className="flex flex-col gap-2">
              {storefront.categories.filter(c => !c.parent_id).slice(0, 6).map(cat => (
                <Link 
                  key={cat.id}
                  to={`/categoria/${cat.slug}`}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  {cat.name}
                </Link>
              ))}
            </nav>
          </div>

          {footerConfig.showPaymentMethods !== false && (
            <div>
              <h4 className="font-semibold mb-4">Formas de Pagamento</h4>
              <div className="flex flex-wrap gap-2">
                {(storefront.payment_methods_display || ['pix', 'credit_card', 'boleto']).map(method => (
                  <Badge key={method} variant="outline" className="text-xs">
                    {method === 'pix' && 'PIX'}
                    {method === 'credit_card' && 'Cartão'}
                    {method === 'boleto' && 'Boleto'}
                    {method === 'debit_card' && 'Débito'}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="border-t mt-8 pt-8 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} {storefront.name}. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  );
}
