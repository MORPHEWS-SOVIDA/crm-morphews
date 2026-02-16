import { useState } from 'react';
import { Instagram, ExternalLink, RefreshCw, CheckCircle2, AlertCircle, Loader2, Copy, Webhook } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export default function InstagramDMs() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  const WEBHOOK_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID || 'rriizlxqfpfpdflgxjtj'}.supabase.co/functions/v1/sendpulse-webhook`;

  // Fetch Instagram instances from DB
  const { data: instagramInstances, isLoading, refetch } = useQuery({
    queryKey: ['instagram-instances', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .select('id, name, is_connected, channel_type, instagram_username, created_at, distribution_mode')
        .eq('organization_id', profile.organization_id)
        .eq('channel_type', 'instagram')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.organization_id,
  });

  // Count conversations
  const { data: conversationCount } = useQuery({
    queryKey: ['instagram-conv-count', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return 0;
      const { count } = await supabase
        .from('whatsapp_conversations')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', profile.organization_id)
        .in('instance_id', (instagramInstances || []).map(i => i.id));
      return count || 0;
    },
    enabled: !!profile?.organization_id && (instagramInstances || []).length > 0,
  });

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(WEBHOOK_URL);
    toast.success('URL do webhook copiada!');
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Instagram DMs</h1>
            <p className="text-muted-foreground mt-1">
              Integração via SendPulse — DMs do Instagram no inbox unificado
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Atualizar
            </Button>
            <Button onClick={() => navigate('/whatsapp')}>
              <ExternalLink className="h-4 w-4 mr-1" />
              Abrir Inbox
            </Button>
          </div>
        </div>

        {/* Webhook Setup Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Webhook className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Configuração do Webhook (SendPulse)</CardTitle>
            </div>
            <CardDescription>
              Configure este URL no painel do SendPulse em Chatbots → Bot Settings → Webhooks → Incoming messages
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono break-all">
                {WEBHOOK_URL}
              </code>
              <Button variant="outline" size="sm" onClick={copyWebhookUrl}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Cole este URL no SendPulse para que as DMs do Instagram cheguem automaticamente ao seu inbox.
            </p>
          </CardContent>
        </Card>

        {/* Status */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (instagramInstances || []).length === 0 ? (
          <Card className="max-w-2xl mx-auto">
            <CardContent className="pt-8 pb-8 text-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center mx-auto mb-6">
                <Instagram className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-3">
                Aguardando primeira mensagem
              </h2>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Configure o webhook no SendPulse (acima) e envie uma mensagem de teste pelo Instagram.
                A instância será criada automaticamente ao receber a primeira DM.
              </p>
              <Badge variant="secondary" className="text-sm">
                <AlertCircle className="h-3 w-3 mr-1" />
                Nenhuma instância Instagram ativa
              </Badge>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(instagramInstances || []).map(instance => (
              <Card key={instance.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
                        <Instagram className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-sm">{instance.name}</CardTitle>
                        {instance.instagram_username && (
                          <CardDescription className="text-xs">@{instance.instagram_username}</CardDescription>
                        )}
                      </div>
                    </div>
                    <Badge variant={instance.is_connected ? 'default' : 'secondary'} className="text-xs">
                      {instance.is_connected ? (
                        <><CheckCircle2 className="h-3 w-3 mr-1" />Ativo</>
                      ) : (
                        <><AlertCircle className="h-3 w-3 mr-1" />Inativo</>
                      )}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Provider: SendPulse • Modo: {instance.distribution_mode || 'manual'}
                  </p>
                  <Button 
                    variant="outline" size="sm" className="w-full"
                    onClick={() => navigate('/whatsapp')}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Ver conversas no Inbox
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Stats */}
        {(instagramInstances || []).length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
            <Card className="text-center">
              <CardContent className="pt-4 pb-4">
                <p className="text-2xl font-bold text-foreground">{conversationCount || 0}</p>
                <p className="text-sm text-muted-foreground">Conversas Instagram</p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="pt-4 pb-4">
                <h3 className="font-semibold text-foreground mb-1">Bot de IA</h3>
                <p className="text-sm text-muted-foreground">Seus bots atendem no Instagram também</p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="pt-4 pb-4">
                <h3 className="font-semibold text-foreground mb-1">Auto-link de Leads</h3>
                <p className="text-sm text-muted-foreground">DMs vinculam a leads por @username</p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
}
