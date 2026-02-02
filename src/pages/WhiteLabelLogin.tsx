import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams, useParams } from 'react-router-dom';
import { Eye, EyeOff, LogIn, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import logoMorphews from '@/assets/logo-morphews.png';
import { loginSchema } from '@/lib/validations';
import { supabase } from '@/integrations/supabase/client';
import { useWhiteLabelBySlug } from '@/hooks/useWhiteLabel';

// Reserved slugs that should not be treated as white label pages
const RESERVED_SLUGS = [
  'login', 'forgot-password', 'reset-password', 'force-password-change', 'setup',
  'planos', 'secretaria-whatsapp', '2026', 'para', 'checkout', 'signup-success',
  'auth', 'legal', 'lp', 'helper', 'pagamento-sucesso', 'pagamento-cancelado',
  'c', 'pay', 'pix-pagamento', 'pagamento-confirmado', 'quiz', 'pagar', 't',
  'parceiro', 'convite-parceiros', 'rede', 'implementador', 'pv2', 'entrar',
  'white-admin', 'loja', 'dashboard-kanban', 'leads', 'sales', 'vendas',
  'produtos', 'expedicao', 'whatsapp', 'instagram', 'team', 'settings',
  'onboarding', 'integrations', 'demandas', 'sac', 'financial', 'receptivo',
  'ai-bots', 'fiscal', 'super-admin', 'cadastro', 'ecommerce', 'afiliado',
  'sales-landing', 'cobrar', 'produtos-custos', 'combos', 'notas-compra',
  'romaneio', 'fechamento', 'entregas', 'relatorios', 'nps', 'api-docs',
];

export default function WhiteLabelLogin() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signIn, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  // Check if slug is reserved
  const isReservedSlug = slug ? RESERVED_SLUGS.includes(slug.toLowerCase()) : false;

  // Fetch white label config by slug
  const { data: config, isLoading: isLoadingConfig } = useWhiteLabelBySlug(isReservedSlug ? undefined : slug);

  // Set favicon dynamically
  useEffect(() => {
    if (config?.favicon_url) {
      const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement || document.createElement('link');
      link.type = 'image/x-icon';
      link.rel = 'shortcut icon';
      link.href = config.favicon_url;
      document.getElementsByTagName('head')[0].appendChild(link);
    }
  }, [config?.favicon_url]);

  // Set page title dynamically
  useEffect(() => {
    if (config?.brand_name) {
      document.title = `Login | ${config.brand_name}`;
    }
    return () => {
      document.title = 'Morphews CRM';
    };
  }, [config?.brand_name]);

  // If user is already logged in, check for temp password then redirect
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
        const plan = searchParams.get('plan');
        if (redirect) {
          const url = plan ? `${redirect}?plan=${plan}` : redirect;
          navigate(url, { replace: true });
        } else {
          navigate('/', { replace: true });
        }
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
      
      setTimeout(() => {
        const redirect = searchParams.get('redirect');
        const plan = searchParams.get('plan');
        if (redirect) {
          const url = plan ? `${redirect}?plan=${plan}` : redirect;
          navigate(url, { replace: true });
        } else {
          navigate('/', { replace: true });
        }
      }, 100);
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

  // Show loading while fetching config
  if (isLoadingConfig) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // If slug doesn't match any config, redirect to default login
  if (!config && slug) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Página não encontrada</h1>
          <p className="text-muted-foreground mb-4">Esta página de login não existe.</p>
          <Link to="/login" className="text-primary hover:underline">
            Ir para o login padrão
          </Link>
        </div>
      </div>
    );
  }

  // Determine styles based on config
  const logoUrl = config?.logo_url || logoMorphews;
  const brandName = config?.brand_name || 'Morphews CRM';
  const primaryColor = config?.primary_color || '#9b87f5';
  const backgroundImage = config?.login_background_url;

  // Generate button style with primary color
  const buttonStyle = {
    backgroundColor: primaryColor,
    borderColor: primaryColor,
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        backgroundColor: backgroundImage ? 'transparent' : undefined,
        backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Overlay for better readability when there's a background image */}
      {backgroundImage && (
        <div className="absolute inset-0 bg-black/50" />
      )}
      
      <div className="w-full max-w-md relative z-10">
        <div className="bg-card rounded-2xl shadow-card p-8 animate-fade-in">
          {/* Logo */}
          <div className="text-center mb-8">
            <img 
              src={logoUrl} 
              alt={brandName} 
              className="h-12 w-auto mx-auto object-contain" 
            />
            <p className="text-muted-foreground mt-4">
              Entre na sua conta para continuar
            </p>
          </div>

          {/* Form */}
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

            <div className="flex justify-end">
              <Link
                to="/forgot-password"
                className="text-sm hover:underline"
                style={{ color: primaryColor }}
              >
                Esqueceu a senha?
              </Link>
            </div>

            <Button
              type="submit"
              className="w-full gap-2 hover:opacity-90 transition-opacity"
              style={buttonStyle}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LogIn className="w-4 h-4" />
              )}
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
