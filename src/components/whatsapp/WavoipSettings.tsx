import { useState } from 'react';
import { Phone, PhoneCall, Users, Loader2, AlertTriangle, ExternalLink, Check, X, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCallQueue, useUserCallAvailability, useWavoip } from '@/hooks/useWavoip';
import { useOrgHasFeature } from '@/hooks/usePlanFeatures';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

interface WavoipSettingsProps {
  instanceId: string;
  instanceName: string;
  wavoipEnabled: boolean;
  onUpdate?: () => void;
}

/**
 * Component for managing Wavoip settings on an instance
 */
export function WavoipSettings({ 
  instanceId, 
  instanceName, 
  wavoipEnabled,
  onUpdate,
}: WavoipSettingsProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [showQueueDialog, setShowQueueDialog] = useState(false);
  const [showTokenDialog, setShowTokenDialog] = useState(false);
  const queryClient = useQueryClient();

  // Fetch instance token
  const { data: instanceData, isLoading: loadingInstance } = useQuery({
    queryKey: ['wavoip-instance-token', instanceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .select('wavoip_device_token')
        .eq('id', instanceId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!instanceId,
  });

  // Fetch users with phone permission
  const { data: phoneUsers, isLoading: loadingPhoneUsers } = useQuery({
    queryKey: ['instance-phone-users', instanceId],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from('whatsapp_instance_users')
        .select('id, user_id')
        .eq('instance_id', instanceId)
        .eq('can_use_phone', true);

      if (error) throw error;

      const userIds = (rows || []).map((r) => r.user_id);
      if (userIds.length === 0) return [];

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, avatar_url')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      const byUserId = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      return (rows || []).map((r: any) => ({
        ...r,
        profiles: byUserId.get(r.user_id) || null,
      }));
    },
    enabled: !!instanceId && wavoipEnabled,
  });

  const handleToggleWavoip = async (enabled: boolean) => {
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('whatsapp_instances')
        .update({ wavoip_enabled: enabled })
        .eq('id', instanceId);

      if (error) throw error;

      if (enabled) {
        toast.success('Chamadas habilitadas! Configure o token do Wavoip.');
        setShowTokenDialog(true);
      } else {
        toast.success('Chamadas desabilitadas');
      }
      
      queryClient.invalidateQueries({ queryKey: ['whatsapp-instances'] });
      queryClient.invalidateQueries({ queryKey: ['wavoip-instance-config'] });
      queryClient.invalidateQueries({ queryKey: ['instance-phone-users'] });
      queryClient.invalidateQueries({ queryKey: ['wavoip-instance-token'] });
      onUpdate?.();
    } catch (error: any) {
      toast.error('Erro ao atualizar configuração');
      console.error(error);
    } finally {
      setIsUpdating(false);
    }
  };

  const hasToken = !!instanceData?.wavoip_device_token;

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4 p-3 bg-background rounded-lg border">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center",
              wavoipEnabled && hasToken ? "bg-green-100 text-green-600" : 
              wavoipEnabled ? "bg-amber-100 text-amber-600" : 
              "bg-muted text-muted-foreground"
            )}>
              <Phone className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium text-sm">Habilitar Chamadas</p>
              <p className="text-xs text-muted-foreground">
                {wavoipEnabled && hasToken ? 'Chamadas habilitadas via Wavoip' : 
                 wavoipEnabled ? 'Configure o token do Wavoip' : 
                 'Chamadas desabilitadas'}
              </p>
            </div>
          </div>
          <Switch
            checked={wavoipEnabled}
            onCheckedChange={handleToggleWavoip}
            disabled={isUpdating}
          />
        </div>

        {wavoipEnabled && (
          <>
            {/* Token Status */}
            <div 
              className={cn(
                "p-3 rounded-lg border cursor-pointer transition-colors",
                hasToken 
                  ? "bg-green-50 border-green-200 hover:bg-green-100 dark:bg-green-950/30 dark:border-green-800" 
                  : "bg-amber-50 border-amber-200 hover:bg-amber-100 dark:bg-amber-950/30 dark:border-amber-800"
              )}
              onClick={() => setShowTokenDialog(true)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {hasToken ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                  )}
                  <div>
                    <p className="text-sm font-medium">
                      {hasToken ? 'Token Wavoip Configurado' : 'Token Wavoip Pendente'}
                    </p>
                    {hasToken && (
                      <p className="text-xs text-muted-foreground font-mono">
                        {instanceData.wavoip_device_token?.substring(0, 20)}...
                      </p>
                    )}
                  </div>
                </div>
                <Button variant="ghost" size="sm">
                  {hasToken ? 'Alterar' : 'Configurar'}
                </Button>
              </div>
            </div>

            {/* Users with phone permission */}
            {hasToken && (
              <div className="p-3 bg-background rounded-lg border space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Usuários com Acesso
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Habilite a permissão "Telefone" na tabela acima
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowQueueDialog(true)}
                  >
                    Ver Fila
                  </Button>
                </div>
                
                <PhoneUsersPreview users={phoneUsers} isLoading={loadingPhoneUsers} />
              </div>
            )}
          </>
        )}
      </div>

      <WavoipTokenDialog
        open={showTokenDialog}
        onOpenChange={setShowTokenDialog}
        instanceId={instanceId}
        instanceName={instanceName}
        currentToken={instanceData?.wavoip_device_token}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ['wavoip-instance-token', instanceId] });
          queryClient.invalidateQueries({ queryKey: ['wavoip-instance-config', instanceId] });
          onUpdate?.();
        }}
      />

      <CallQueueDialog
        open={showQueueDialog}
        onOpenChange={setShowQueueDialog}
        instanceId={instanceId}
        instanceName={instanceName}
      />
    </>
  );
}

/**
 * Dialog for configuring Wavoip device token
 */
interface WavoipTokenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instanceId: string;
  instanceName: string;
  currentToken?: string | null;
  onSaved?: () => void;
}

function WavoipTokenDialog({
  open,
  onOpenChange,
  instanceId,
  instanceName,
  currentToken,
  onSaved,
}: WavoipTokenDialogProps) {
  const [token, setToken] = useState(currentToken || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  // Update local state when currentToken changes
  useState(() => {
    if (currentToken) setToken(currentToken);
  });

  const handleSave = async () => {
    if (!token.trim()) {
      toast.error('Cole o token do dispositivo Wavoip');
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('whatsapp_instances')
        .update({ wavoip_device_token: token.trim() })
        .eq('id', instanceId);

      if (error) throw error;

      toast.success('Token Wavoip salvo com sucesso! 📞');
      onSaved?.();
      onOpenChange(false);
    } catch (error: any) {
      toast.error('Erro ao salvar token');
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('whatsapp_instances')
        .update({ wavoip_device_token: null })
        .eq('id', instanceId);

      if (error) throw error;

      setToken('');
      setTestResult(null);
      toast.success('Token removido');
      onSaved?.();
    } catch (error: any) {
      toast.error('Erro ao remover token');
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!token.trim()) {
      toast.error('Preencha o token primeiro');
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    toast.info('🧪 Testando conexão com Wavoip...');

    try {
      // Test via our backend function
      const { data, error } = await supabase.functions.invoke('wavoip-test-connection', {
        body: { deviceToken: token.trim() },
      });

      if (error) throw error;

      if (data?.ok) {
        setTestResult('success');
        toast.success('✅ Token válido! Conexão com Wavoip funcionando.');
      } else {
        setTestResult('error');
        toast.error(data?.error || 'Token inválido ou sem conexão');
      }
    } catch (error: any) {
      console.error('Erro ao testar:', error);
      setTestResult('error');
      toast.error('Erro ao testar conexão. Verifique o token.');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-green-600" />
            Configurar Wavoip - {instanceName}
          </DialogTitle>
          <DialogDescription>
            Configure o token do dispositivo Wavoip para habilitar chamadas
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Instructions */}
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
              ℹ️ Como obter o token:
            </p>
            <ol className="text-xs text-blue-700 dark:text-blue-300 space-y-1.5 list-decimal list-inside">
              <li>
                Acesse{' '}
                <a 
                  href="https://app.wavoip.com/devices" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="underline font-medium inline-flex items-center gap-1"
                >
                  app.wavoip.com/devices
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>Clique em "Novo Dispositivo"</li>
              <li>Dê um nome (ex: "{instanceName}")</li>
              <li>Copie o TOKEN gerado</li>
              <li>Cole aqui neste campo</li>
            </ol>
          </div>

          {/* Token Input */}
          <div className="space-y-2">
            <Label htmlFor="wavoip-token">Wavoip Device Token</Label>
            <div className="flex gap-2">
              <Input
                id="wavoip-token"
                type="text"
                placeholder="Cole o token do dispositivo Wavoip aqui"
                value={token}
                onChange={(e) => {
                  setToken(e.target.value);
                  setTestResult(null);
                }}
                className="font-mono text-sm"
              />
              {token && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClear}
                  disabled={isSaving}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Token Preview */}
          {token && (
            <div className={cn(
              "flex items-center gap-2 p-3 rounded-lg border",
              testResult === 'success' ? "bg-green-50 border-green-200 dark:bg-green-950/30" :
              testResult === 'error' ? "bg-red-50 border-red-200 dark:bg-red-950/30" :
              "bg-muted"
            )}>
              <div className="flex-1">
                <p className="text-xs font-mono break-all text-muted-foreground">
                  {token.substring(0, 40)}{token.length > 40 ? '...' : ''}
                </p>
              </div>
              {testResult === 'success' && <Check className="h-4 w-4 text-green-600" />}
              {testResult === 'error' && <X className="h-4 w-4 text-red-600" />}
            </div>
          )}

          {/* Test Button */}
          {token && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={isTesting || !token.trim()}
              className="w-full"
            >
              {isTesting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Testando...
                </>
              ) : (
                '🧪 Testar Conexão Wavoip'
              )}
            </Button>
          )}

          {/* Important note */}
          <div className="text-xs text-muted-foreground bg-muted p-3 rounded-lg">
            <p className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Importante:</strong> O Wavoip é um serviço separado. 
                Cada instância precisa de seu próprio token de dispositivo.
                A Evolution API continua gerenciando apenas as mensagens.
              </span>
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !token.trim()}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Salvar Token
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Preview of users with phone permission
 */
function PhoneUsersPreview({ users, isLoading }: { users: any[] | undefined; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-xs">Carregando...</span>
      </div>
    );
  }

  const totalUsers = users?.length || 0;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {totalUsers === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nenhum usuário com permissão de telefone. Habilite na coluna "Telefone" acima.
        </p>
      ) : (
        <>
          {/* Avatar stack */}
          <div className="flex -space-x-2">
            {users?.slice(0, 5).map((entry) => (
              <Avatar key={entry.id} className="h-8 w-8 border-2 border-background">
                <AvatarImage src={(entry.profiles as any)?.avatar_url} />
                <AvatarFallback className="text-xs">
                  {(entry.profiles as any)?.first_name?.[0] || 'U'}
                </AvatarFallback>
              </Avatar>
            ))}
            {totalUsers > 5 && (
              <div className="h-8 w-8 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs font-medium">
                +{totalUsers - 5}
              </div>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            <span className="text-primary font-medium">{totalUsers}</span>
            <span> usuário(s) com permissão</span>
          </div>
        </>
      )}
    </div>
  );
}

interface CallQueueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instanceId: string;
  instanceName: string;
}

/**
 * Dialog for viewing the call queue
 */
function CallQueueDialog({ 
  open, 
  onOpenChange, 
  instanceId, 
  instanceName 
}: CallQueueDialogProps) {
  const { callQueue, isLoading } = useCallQueue(instanceId);
  const { isInQueue, isAvailable, setAvailable, queuePosition } = useUserCallAvailability(instanceId);
  const { profile } = useAuth();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PhoneCall className="h-5 w-5 text-green-600" />
            Fila de Chamadas
          </DialogTitle>
          <DialogDescription>
            Gerencie quem recebe chamadas em "{instanceName}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current user status */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={profile?.avatar_url || undefined} />
                    <AvatarFallback>
                      {profile?.first_name?.[0] || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-sm">Você</p>
                    {isInQueue ? (
                      <div className="flex items-center gap-1">
                        <Badge variant={isAvailable ? "default" : "secondary"} className="text-xs">
                          {isAvailable ? 'Disponível' : 'Ocupado'}
                        </Badge>
                        {queuePosition !== undefined && (
                          <span className="text-xs text-muted-foreground">
                            #{queuePosition + 1} na fila
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Não está na fila
                      </span>
                    )}
                  </div>
                </div>
                <Switch
                  checked={isAvailable}
                  onCheckedChange={setAvailable}
                />
              </div>
            </CardContent>
          </Card>

          {/* Queue list */}
          <div>
            <h4 className="text-sm font-medium mb-2">Ordem de distribuição</h4>
            <ScrollArea className="h-[200px]">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : callQueue && callQueue.length > 0 ? (
                <div className="space-y-2">
                  {callQueue.map((entry, index) => (
                    <div
                      key={entry.id}
                      className={cn(
                        "flex items-center justify-between p-2 rounded-lg border",
                        entry.is_available ? "bg-green-50 border-green-200" : "bg-muted"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground w-5">
                          #{index + 1}
                        </span>
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={(entry.profiles as any)?.avatar_url} />
                          <AvatarFallback className="text-xs">
                            {(entry.profiles as any)?.first_name?.[0] || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">
                            {(entry.profiles as any)?.first_name} {(entry.profiles as any)?.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {entry.calls_received} chamadas
                          </p>
                        </div>
                      </div>
                      <div className={cn(
                        "w-2.5 h-2.5 rounded-full",
                        entry.is_available ? "bg-green-500" : "bg-muted-foreground/30"
                      )} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Nenhum usuário na fila</p>
                  <p className="text-xs">Ative seu status acima para entrar</p>
                </div>
              )}
            </ScrollArea>
          </div>

          <div className="text-xs text-muted-foreground bg-muted p-3 rounded-lg">
            <p className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>
                As chamadas são distribuídas em ordem (round-robin). 
                Após receber uma chamada, você vai para o final da fila.
              </span>
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Floating availability toggle for the user
 */
export function WavoipAvailabilityToggle({ instanceId }: { instanceId: string }) {
  const { data: hasWavoipFeature = false } = useOrgHasFeature("wavoip_calls");
  const { isAvailable, setAvailable } = useUserCallAvailability(instanceId);
  const { wavoipStatus } = useWavoip(instanceId);

  // Don't show if Wavoip feature is not enabled OR wavoip is not available on this instance
  if (!hasWavoipFeature || wavoipStatus !== 'available') {
    return null;
  }

  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium",
      isAvailable 
        ? "bg-green-100 text-green-700 border border-green-200" 
        : "bg-muted text-muted-foreground border"
    )}>
      <Phone className="h-3.5 w-3.5" />
      <span>{isAvailable ? 'Disponível' : 'Indisponível'}</span>
      <Switch
        checked={isAvailable}
        onCheckedChange={setAvailable}
        className="scale-75"
      />
    </div>
  );
}
