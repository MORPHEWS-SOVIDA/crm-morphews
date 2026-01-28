import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Check, LogIn, UserPlus, Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useInvitationByCode,
  useAcceptInvitation,
  partnerTypeLabels,
  partnerTypeColors,
  formatCommission,
} from '@/hooks/ecommerce/usePartners';

export default function PartnerInvitePage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  
  const { data: invitation, isLoading: invitationLoading, error: invitationError } = useInvitationByCode(code || null);
  const acceptInvitation = useAcceptInvitation();
  
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ email: string } | null>(null);
  const [authTab, setAuthTab] = useState<'login' | 'signup'>('signup');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [signupForm, setSignupForm] = useState({ 
    name: '', 
    email: '', 
    password: '', 
    confirmPassword: '' 
  });

  const hasAutoAcceptedRef = useRef(false);

  const normalizeEmail = (email?: string | null) => (email || '').trim().toLowerCase();

  const acceptNow = async () => {
    if (!code) return;
    if (!invitation) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Segurança: só permite aceitar se o email logado for o mesmo do convite
    if (normalizeEmail(user.email) !== normalizeEmail(invitation.email)) {
      toast.error('Você está logado com um e-mail diferente do convite.');
      return;
    }

    acceptInvitation.mutate(code, {
      onSuccess: () => {
        toast.success('Convite aceito com sucesso!');
        setTimeout(() => {
          navigate('/parceiro');
        }, 500);
      },
      onError: (error: Error) => {
        // Permite tentar novamente manualmente
        hasAutoAcceptedRef.current = false;
        toast.error(error.message);
      },
    });
  };

  // Check if user is already logged in
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setIsLoggedIn(true);
        setCurrentUser({ email: user.email || '' });
      }
    };
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setIsLoggedIn(true);
        setCurrentUser({ email: session.user.email || '' });
      } else {
        setIsLoggedIn(false);
        setCurrentUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Pre-fill signup form with invitation data
  useEffect(() => {
    if (invitation) {
      setSignupForm(prev => ({
        ...prev,
        name: invitation.name,
        email: invitation.email,
      }));
      setLoginForm(prev => ({
        ...prev,
        email: invitation.email,
      }));
    }
  }, [invitation]);

  // Auto-accept after the user becomes logged in (avoids getting stuck with "cadastro já existe")
  useEffect(() => {
    if (!isLoggedIn || !invitation || !code) return;
    if (acceptInvitation.isPending) return;
    if (hasAutoAcceptedRef.current) return;

    hasAutoAcceptedRef.current = true;
    void acceptNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, invitation, code]);

  const handleLogin = async () => {
    if (!loginForm.email || !loginForm.password) {
      toast.error('Preencha e-mail e senha');
      return;
    }

    setIsAuthLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginForm.email,
        password: loginForm.password,
      });

      if (error) throw error;
      toast.success('Login realizado!');

      // Tentar aceitar imediatamente (caso o usuário seja redirecionado e perca o contexto)
      void acceptNow();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleSignup = async () => {
    if (!signupForm.name || !signupForm.email || !signupForm.password) {
      toast.error('Preencha todos os campos');
      return;
    }

    if (signupForm.password !== signupForm.confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }

    if (signupForm.password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    setIsAuthLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: signupForm.email,
        password: signupForm.password,
        options: {
          data: {
            full_name: signupForm.name,
          },
          emailRedirectTo: window.location.href,
        },
      });

      if (error) throw error;
      toast.success('Conta criada! Verifique seu e-mail se necessário.');

      // Se a sessão já foi criada (auto-confirm), tenta aceitar agora
      void acceptNow();
    } catch (error) {
      const msg = (error as Error).message || '';
      const normalized = msg.toLowerCase();
      if (normalized.includes('already registered') || normalized.includes('já está cadastrado')) {
        setAuthTab('login');
        toast.error('Este e-mail já tem conta. Faça login na aba “Já tenho conta” para aceitar o convite.');
        return;
      }
      toast.error(msg);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleAcceptInvitation = async () => {
    // Reset para permitir tentativa manual
    hasAutoAcceptedRef.current = true;
    await acceptNow();
  };

  // Loading state
  if (invitationLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Carregando convite...</p>
        </div>
      </div>
    );
  }

  // Error or not found
  if (!invitation || invitationError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Convite não encontrado</h2>
            <p className="text-muted-foreground mb-4">
              Este convite pode ter expirado, já foi utilizado ou não existe.
            </p>
            <Button variant="outline" onClick={() => navigate('/')}>
              Voltar ao início
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 p-4 flex items-center justify-center">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Convite de Parceiro</CardTitle>
          <CardDescription>
            Você foi convidado para ser parceiro da organização
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Invitation Details */}
          <div className="p-4 bg-muted rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Organização</span>
              <span className="font-medium">{invitation.organization?.name || 'Morphews'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Tipo de Parceria</span>
              <Badge className={partnerTypeColors[invitation.partner_type]}>
                {partnerTypeLabels[invitation.partner_type]}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Comissão</span>
              <span className="font-medium">
                {formatCommission(invitation.commission_type, invitation.commission_value)}
              </span>
            </div>
            {(invitation.responsible_for_refunds || invitation.responsible_for_chargebacks) && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Responsabilidade</span>
                <span className="text-xs text-amber-600 dark:text-amber-400">
                  {invitation.responsible_for_refunds && invitation.responsible_for_chargebacks
                    ? 'Estornos e chargebacks'
                    : invitation.responsible_for_refunds
                    ? 'Estornos'
                    : 'Chargebacks'}
                </span>
              </div>
            )}
          </div>

          <Separator />

          {/* Auth / Accept Section */}
          {isLoggedIn ? (
            <div className="space-y-4">
              <div className="text-center">
                <Check className="h-12 w-12 text-green-500 mx-auto mb-2" />
                <p className="font-medium">Você está logado como</p>
                <p className="text-muted-foreground">{currentUser?.email}</p>
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={handleAcceptInvitation}
                disabled={acceptInvitation.isPending}
              >
                {acceptInvitation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Aceitando...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Aceitar Convite
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-center text-sm text-muted-foreground">
                Para aceitar o convite, faça login ou crie uma conta
              </p>

              <Tabs value={authTab} onValueChange={(v) => setAuthTab(v as 'login' | 'signup')}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="signup" className="gap-2">
                    <UserPlus className="h-4 w-4" />
                    Criar Conta
                  </TabsTrigger>
                  <TabsTrigger value="login" className="gap-2">
                    <LogIn className="h-4 w-4" />
                    Já tenho conta
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="signup" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Nome Completo</Label>
                    <Input
                      value={signupForm.name}
                      onChange={(e) => setSignupForm((p) => ({ ...p, name: e.target.value }))}
                      placeholder="Seu nome"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>E-mail</Label>
                    <Input
                      type="email"
                      value={signupForm.email}
                      onChange={(e) => setSignupForm((p) => ({ ...p, email: e.target.value }))}
                      placeholder="seu@email.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Senha</Label>
                    <Input
                      type="password"
                      value={signupForm.password}
                      onChange={(e) => setSignupForm((p) => ({ ...p, password: e.target.value }))}
                      placeholder="Mínimo 6 caracteres"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Confirmar Senha</Label>
                    <Input
                      type="password"
                      value={signupForm.confirmPassword}
                      onChange={(e) => setSignupForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                      placeholder="Repita a senha"
                    />
                  </div>
                  <Button
                    className="w-full"
                    onClick={handleSignup}
                    disabled={isAuthLoading}
                  >
                    {isAuthLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Criar Conta e Aceitar'
                    )}
                  </Button>
                </TabsContent>

                <TabsContent value="login" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>E-mail</Label>
                    <Input
                      type="email"
                      value={loginForm.email}
                      onChange={(e) => setLoginForm((p) => ({ ...p, email: e.target.value }))}
                      placeholder="seu@email.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Senha</Label>
                    <Input
                      type="password"
                      value={loginForm.password}
                      onChange={(e) => setLoginForm((p) => ({ ...p, password: e.target.value }))}
                      placeholder="Sua senha"
                    />
                  </div>
                  <Button
                    className="w-full"
                    onClick={handleLogin}
                    disabled={isAuthLoading}
                  >
                    {isAuthLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Entrar e Aceitar'
                    )}
                  </Button>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
