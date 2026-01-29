import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle, XCircle, Network } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface NetworkInfo {
  id: string;
  name: string;
  description: string | null;
  photo_url: string | null;
  organization_id: string;
}

export default function NetworkInviteAccept() {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [network, setNetwork] = useState<NetworkInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!inviteCode) {
      setError('Código de convite inválido');
      setLoading(false);
      return;
    }

    const fetchNetwork = async () => {
      try {
        // Fetch network info without join to organizations (RLS blocks anonymous access to organizations)
        const { data, error: fetchError } = await supabase
          .from('affiliate_networks')
          .select('id, name, description, photo_url, organization_id')
          .eq('invite_code', inviteCode)
          .eq('is_active', true)
          .single();

        if (fetchError || !data) {
          console.error('Error fetching network:', fetchError);
          setError('Rede não encontrada ou inativa');
          return;
        }

        setNetwork(data as NetworkInfo);
      } catch (err) {
        console.error('Network fetch error:', err);
        setError('Erro ao carregar informações da rede');
      } finally {
        setLoading(false);
      }
    };

    fetchNetwork();
  }, [inviteCode]);

  const handleJoin = async () => {
    if (!user || !network || !inviteCode) return;

    setJoining(true);
    try {
      const { data, error: joinError } = await supabase.rpc('join_affiliate_network', {
        p_invite_code: inviteCode,
        p_email: user.email || '',
        p_name: profile?.first_name 
          ? `${profile.first_name} ${profile.last_name || ''}`.trim()
          : user.email?.split('@')[0] || 'Afiliado',
      });

      if (joinError) throw joinError;
      
      const result = data as { success: boolean; error?: string; network_name?: string; reactivated?: boolean };
      
      if (!result.success) {
        throw new Error(result.error || 'Erro ao entrar na rede');
      }

      setSuccess(true);
      toast.success(result.reactivated 
        ? 'Você foi reativado na rede!' 
        : 'Você entrou na rede com sucesso!'
      );
    } catch (err: any) {
      setError(err.message || 'Erro ao entrar na rede');
    } finally {
      setJoining(false);
    }
  };

  const handleLoginRedirect = () => {
    // Save the current URL to redirect back after login
    sessionStorage.setItem('redirectAfterLogin', window.location.pathname);
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30 p-4">
      <Card className="w-full max-w-md">
        {error ? (
          <CardContent className="py-12 text-center">
            <XCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Ops!</h2>
            <p className="text-muted-foreground">{error}</p>
            <Button className="mt-6" onClick={() => navigate('/')}>
              Voltar ao início
            </Button>
          </CardContent>
        ) : success ? (
          <CardContent className="py-12 text-center">
            <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Bem-vindo à rede!</h2>
            <p className="text-muted-foreground mb-6">
              Você agora faz parte da rede <strong>{network?.name}</strong>.
              Acesse seu painel para ver os checkouts disponíveis.
            </p>
            <Button onClick={() => navigate('/ecommerce')}>
              Ir para o painel
            </Button>
          </CardContent>
        ) : (
          <>
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={network?.photo_url || undefined} alt={network?.name} />
                  <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                    {network?.name?.substring(0, 2).toUpperCase() || 'RD'}
                  </AvatarFallback>
                </Avatar>
              </div>
              <CardTitle className="text-2xl">{network?.name}</CardTitle>
              <CardDescription>
                {network?.description || 'Você foi convidado para participar desta rede de afiliados'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <Network className="h-8 w-8 mx-auto text-primary mb-2" />
                <p className="text-sm text-muted-foreground">
                  Ao entrar, você terá acesso aos checkouts exclusivos desta rede
                  e poderá ganhar comissões por suas vendas.
                </p>
              </div>

              {user ? (
                <Button className="w-full" size="lg" onClick={handleJoin} disabled={joining}>
                  {joining && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Entrar na Rede
                </Button>
              ) : (
                <div className="space-y-3">
                  <Button className="w-full" size="lg" onClick={handleLoginRedirect}>
                    Fazer login para entrar
                  </Button>
                  <p className="text-xs text-center text-muted-foreground">
                    Não tem conta?{' '}
                    <Button variant="link" className="p-0 h-auto" onClick={() => {
                      sessionStorage.setItem('redirectAfterLogin', window.location.pathname);
                      navigate('/register');
                    }}>
                      Criar conta
                    </Button>
                  </p>
                </div>
              )}
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
