import { useState } from 'react';
import { Instagram, Lock, Plus, ExternalLink, RefreshCw, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useEvolutionInstances } from '@/hooks/useEvolutionInstances';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export default function InstagramDMs() {
  const navigate = useNavigate();
  const { 
    instances, isLoading, refetch,
    createInstagramInstance, getInstagramOAuthUrl,
    archiveInstance, logoutInstance,
  } = useEvolutionInstances();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [instanceName, setInstanceName] = useState('');

  const instagramInstances = (instances || []).filter(
    i => i.channel_type === 'instagram' && !i.deleted_at
  );

  const handleCreate = async () => {
    if (!instanceName.trim()) {
      toast.error('Digite um nome para a instância');
      return;
    }
    try {
      await createInstagramInstance.mutateAsync({ name: instanceName.trim() });
      setShowCreateDialog(false);
      setInstanceName('');
    } catch {}
  };

  const handleReconnect = async (instanceId: string) => {
    try {
      await getInstagramOAuthUrl.mutateAsync(instanceId);
    } catch {}
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Instagram DMs</h1>
            <p className="text-muted-foreground mt-1">
              Gerencie suas contas do Instagram e veja conversas no inbox unificado
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Atualizar
            </Button>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Conectar Instagram
            </Button>
          </div>
        </div>

        {/* Connected Instances */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : instagramInstances.length === 0 ? (
          <Card className="max-w-2xl mx-auto">
            <CardContent className="pt-8 pb-8 text-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center mx-auto mb-6">
                <Instagram className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-3">
                Conecte sua conta do Instagram
              </h2>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Conecte sua conta do Instagram Professional (Business ou Creator) para receber e responder DMs 
                diretamente no CRM, vincular a leads e usar bots de IA.
              </p>
              <Button onClick={() => setShowCreateDialog(true)} size="lg">
                <Instagram className="h-5 w-5 mr-2" />
                Conectar Instagram
              </Button>
              <p className="text-xs text-muted-foreground mt-4">
                Requer conta Instagram Business/Creator vinculada a uma Facebook Page.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {instagramInstances.map(instance => (
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
                    <Badge variant={instance.is_connected ? 'default' : 'destructive'} className="text-xs">
                      {instance.is_connected ? (
                        <><CheckCircle2 className="h-3 w-3 mr-1" />Conectado</>
                      ) : (
                        <><AlertCircle className="h-3 w-3 mr-1" />Desconectado</>
                      )}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" size="sm" className="flex-1"
                      onClick={() => navigate('/whatsapp')}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Ver no Inbox
                    </Button>
                    {!instance.is_connected && (
                      <Button 
                        variant="default" size="sm" className="flex-1"
                        onClick={() => handleReconnect(instance.id)}
                        disabled={getInstagramOAuthUrl.isPending}
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Reconectar
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="ghost" size="sm" className="flex-1 text-xs text-muted-foreground"
                      onClick={() => {
                        if (confirm('Deseja desconectar esta instância?')) {
                          logoutInstance.mutate(instance.id);
                        }
                      }}
                    >
                      Desconectar
                    </Button>
                    <Button 
                      variant="ghost" size="sm" className="flex-1 text-xs text-destructive"
                      onClick={() => {
                        if (confirm('Deseja arquivar esta instância?')) {
                          archiveInstance.mutate(instance.id);
                        }
                      }}
                    >
                      Arquivar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {[
            { title: 'Inbox Unificado', desc: 'WhatsApp + Instagram no mesmo chat' },
            { title: 'Bot de IA', desc: 'Seus bots atendem no Instagram também' },
            { title: 'Vincular a Leads', desc: 'Associe DMs aos leads do funil automaticamente' },
          ].map((feature, i) => (
            <Card key={i} className="text-center">
              <CardContent className="pt-4 pb-4">
                <h3 className="font-semibold text-foreground mb-1">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Create Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Conectar conta do Instagram</DialogTitle>
              <DialogDescription>
                Dê um nome para esta conexão. Depois de criar, você será redirecionado para autorizar pelo Facebook.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="ig-name">Nome da instância</Label>
                <Input
                  id="ig-name"
                  placeholder="Ex: Instagram Principal"
                  value={instanceName}
                  onChange={e => setInstanceName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                />
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">Pré-requisitos:</p>
                <p>• Conta Instagram Business ou Creator</p>
                <p>• Vinculada a uma Facebook Page</p>
                <p>• Permissões de mensagem ativadas nas configurações do Instagram</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleCreate} 
                disabled={createInstagramInstance.isPending || !instanceName.trim()}
              >
                {createInstagramInstance.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Criando...</>
                ) : (
                  <><Instagram className="h-4 w-4 mr-1" />Criar e Conectar</>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
