import { useLocation, Routes, Route } from 'react-router-dom';
import { lazy, Suspense, useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCustomDomainDetection } from '@/hooks/useCustomDomainDetection';
import { useAuth } from '@/hooks/useAuth';
// useEffect is already imported above
import { CartProvider } from '@/components/storefront/cart/CartContext';
import { StorefrontLayoutWithSlug } from '@/components/storefront/StorefrontLayoutWithSlug';
import { Eye, EyeOff, LogIn, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import logoMorphews from '@/assets/logo-morphews.png';
import { loginSchema } from '@/lib/validations';
import { supabase } from '@/integrations/supabase/client';
import { useWhiteLabelBySlug } from '@/hooks/useWhiteLabel';

// Import storefront components
const StorefrontHome = lazy(() => import('@/components/storefront/StorefrontHome').then(m => ({ default: m.StorefrontHome })));
const StorefrontProducts = lazy(() => import('@/components/storefront/StorefrontProducts').then(m => ({ default: m.StorefrontProducts })));
const StorefrontCategory = lazy(() => import('@/components/storefront/StorefrontCategory').then(m => ({ default: m.StorefrontCategory })));
const StorefrontProductPage = lazy(() => import('@/components/storefront/StorefrontProductPage').then(m => ({ default: m.StorefrontProductPage })));
const StorefrontCart = lazy(() => import('@/components/storefront/StorefrontCart').then(m => ({ default: m.StorefrontCart })));
const StorefrontCheckout = lazy(() => import('@/components/storefront/StorefrontCheckout').then(m => ({ default: m.StorefrontCheckout })));
const StorefrontPage = lazy(() => import('@/components/storefront/StorefrontPage').then(m => ({ default: m.StorefrontPage })));
const StorefrontOrderConfirmed = lazy(() => import('@/components/storefront/StorefrontOrderConfirmed').then(m => ({ default: m.StorefrontOrderConfirmed })));
const StorefrontPixPayment = lazy(() => import('@/components/storefront/StorefrontPixPayment').then(m => ({ default: m.StorefrontPixPayment })));

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
  </div>
);

/**
 * Component that handles custom domain routing.
 * 
 * Behavior:
 * - Storefront domains: Always render storefront (public shop)
 * - White-label domains: 
 *   - If user is NOT logged in and accessing /login: show branded login
 *   - If user IS logged in: render normal app (children)
 *   - If user is NOT logged in and accessing other routes: let normal routing handle it
 * 
 * The key insight is that white-label domains should only override the LOGIN experience,
 * not the entire app. After authentication, users get the normal dashboard.
 */
export function CustomDomainRedirect({ children }: { children: React.ReactNode }) {
  const { isCustomDomain, storefrontSlug, whiteLabelSlug, domainType, isLoading } = useCustomDomainDetection();
  const { user, isLoading: isAuthLoading } = useAuth();
  const location = useLocation();

  // Redirect sales.morphews.com to main login
  useEffect(() => {
    if (window.location.hostname === 'sales.morphews.com') {
      window.location.href = 'https://morphews.com/login';
    }
  }, []);

  // While loading domain detection, show loader
  if (isLoading) {
    return <PageLoader />;
  }

  // Block render if redirecting from sales.morphews.com
  if (window.location.hostname === 'sales.morphews.com') {
    return <PageLoader />;
  }

  // Handle STOREFRONT custom domains - these always show the store
  if (isCustomDomain && domainType === 'storefront' && storefrontSlug) {
    return (
      <Suspense fallback={<PageLoader />}>
        <CustomDomainStorefront slug={storefrontSlug} />
      </Suspense>
    );
  }

  // Handle WHITE-LABEL custom domains
  // For white-label, we want to:
  // 1. Show branded login when NOT authenticated and on /login
  // 2. Let everything else pass through to normal routing
  // This way authenticated users get the normal dashboard
  if (isCustomDomain && domainType === 'white-label' && whiteLabelSlug) {
    // If user is authenticated, just render normal app
    // They'll get the dashboard like normal
    if (user) {
      return <>{children}</>;
    }
    
    // Still checking auth? Show loader
    if (isAuthLoading) {
      return <PageLoader />;
    }

    // User NOT authenticated - show branded login for login path
    // For other paths, let normal routing handle redirect to login
    if (location.pathname === '/login' || location.pathname === `/${whiteLabelSlug}/login`) {
      return (
        <Suspense fallback={<PageLoader />}>
          <WhiteLabelLoginPage slug={whiteLabelSlug} />
        </Suspense>
      );
    }
    
    // For root path on custom domain, redirect to login
    if (location.pathname === '/') {
      // Let children handle - it will likely redirect to login via ProtectedRoute
      return <>{children}</>;
    }
  }

  // Not a custom domain OR not a special case - render children (normal routing)
  return <>{children}</>;
}

/**
 * Renders the storefront for a custom domain
 */
function CustomDomainStorefront({ slug }: { slug: string }) {
  return (
    <CartProvider>
      <Routes>
        <Route path="/" element={<StorefrontLayoutWithSlug slug={slug} />}>
          <Route index element={<StorefrontHome />} />
          <Route path="produtos" element={<StorefrontProducts />} />
          <Route path="categoria/:categorySlug" element={<StorefrontCategory />} />
          <Route path="produto/:productId" element={<StorefrontProductPage />} />
          <Route path="carrinho" element={<StorefrontCart />} />
          <Route path="checkout" element={<StorefrontCheckout />} />
          <Route path="pagina/:pageSlug" element={<StorefrontPage />} />
          <Route path="pedido-confirmado" element={<StorefrontOrderConfirmed />} />
          <Route path="pix-pagamento" element={<StorefrontPixPayment />} />
        </Route>
        {/* Fallback */}
        <Route path="*" element={<StorefrontLayoutWithSlug slug={slug} />}>
          <Route path="*" element={<StorefrontHome />} />
        </Route>
      </Routes>
    </CartProvider>
  );
}
/**
 * White-label branded login page for custom domains
 */
function WhiteLabelLoginPage({ slug }: { slug: string }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signIn, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const { data: config, isLoading: isLoadingConfig } = useWhiteLabelBySlug(slug);

  // Set favicon
  useEffect(() => {
    if (config?.favicon_url) {
      const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement || document.createElement('link');
      link.type = 'image/x-icon';
      link.rel = 'shortcut icon';
      link.href = config.favicon_url;
      document.getElementsByTagName('head')[0].appendChild(link);
    }
  }, [config?.favicon_url]);

  // Set page title
  useEffect(() => {
    if (config?.brand_name) {
      document.title = `Login | ${config.brand_name}`;
    }
    return () => { document.title = 'Morphews CRM'; };
  }, [config?.brand_name]);

  // Redirect if user becomes authenticated
  useEffect(() => {
    const checkAndRedirect = async () => {
      if (user) {
        const { data: tempReset } = await supabase
          .from('temp_password_resets')
          .select('id')
          .eq('email', user.email?.toLowerCase() || '')
          .is('used_at', null)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (tempReset) {
          navigate('/force-password-change', { replace: true });
          return;
        }

        const redirect = searchParams.get('redirect');
        navigate(redirect || '/', { replace: true });
      }
    };
    checkAndRedirect();
  }, [user, navigate, searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      const fieldErrors: { email?: string; password?: string } = {};
      result.error.errors.forEach((err) => {
        if (err.path[0] === 'email') fieldErrors.email = err.message;
        if (err.path[0] === 'password') fieldErrors.password = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);
    
    try {
      const { error } = await signIn(email.trim(), password);

      if (error) {
        toast({
          title: 'Erro ao fazer login',
          description: error.message === 'Invalid login credentials' 
            ? 'Email ou senha incorretos'
            : error.message,
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      toast({
        title: 'Login realizado com sucesso!',
        description: config?.brand_name 
          ? `Bem-vindo ao ${config.brand_name}` 
          : 'Bem-vindo!',
      });
      
      // Navigate to dashboard on same domain
      setTimeout(() => navigate('/', { replace: true }), 100);
    } catch (err) {
      console.error('Login error:', err);
      toast({
        title: 'Erro ao fazer login',
        description: 'Ocorreu um erro inesperado. Tente novamente.',
        variant: 'destructive',
      });
      setIsLoading(false);
    }
  };

  if (isLoadingConfig) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!config) {
    // No config found, fall back to standard login route
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Configuração não encontrada</h1>
          <p className="text-muted-foreground">Este domínio não está configurado corretamente.</p>
        </div>
      </div>
    );
  }

  const logoUrl = config.logo_url || logoMorphews;
  const brandName = config.brand_name || 'CRM';
  const primaryColor = config.primary_color || '#9b87f5';
  const backgroundImage = config.login_background_url;

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {backgroundImage && <div className="absolute inset-0 bg-black/50" />}
      
      <div className="w-full max-w-md relative z-10">
        <div className="bg-card rounded-2xl shadow-card p-8 animate-fade-in">
          <div className="text-center mb-8">
            <img src={logoUrl} alt={brandName} className="h-12 w-auto mx-auto object-contain" />
            <p className="text-muted-foreground mt-4">Entre na sua conta para continuar</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                autoComplete="email"
                className={errors.email ? 'border-destructive' : ''}
              />
              {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className={`pr-10 ${errors.password ? 'border-destructive' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
            </div>

            <Button
              type="submit"
              className="w-full gap-2 hover:opacity-90 transition-opacity"
              style={{ backgroundColor: primaryColor, borderColor: primaryColor }}
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
              Entrar
            </Button>
          </form>
        </div>

        <p className="text-center text-sm mt-6" style={{ color: backgroundImage ? 'white' : undefined }}>
          <span className={backgroundImage ? '' : 'text-muted-foreground'}>
            Não tem acesso? Fale com o administrador.
          </span>
        </p>
      </div>
    </div>
  );
}
