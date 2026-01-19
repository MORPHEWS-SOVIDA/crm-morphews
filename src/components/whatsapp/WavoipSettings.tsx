import { useState } from 'react';
import { Phone, PhoneCall, Users, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useCallQueue, useUserCallAvailability, useWavoip } from '@/hooks/useWavoip';
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
  const queryClient = useQueryClient();

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
        toast.success('Chamadas habilitadas! Habilite a permissão de telefone para os usuários na tabela acima.');
      } else {
        toast.success('Chamadas desabilitadas');
      }
      
      queryClient.invalidateQueries({ queryKey: ['whatsapp-instances'] });
      queryClient.invalidateQueries({ queryKey: ['wavoip-instance-config'] });
      queryClient.invalidateQueries({ queryKey: ['instance-phone-users'] });
      onUpdate?.();
    } catch (error: any) {
      toast.error('Erro ao atualizar configuração');
      console.error(error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4 p-3 bg-background rounded-lg border">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center",
              wavoipEnabled ? "bg-green-100 text-green-600" : "bg-muted text-muted-foreground"
            )}>
              <Phone className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium text-sm">Habilitar Chamadas</p>
              <p className="text-xs text-muted-foreground">
                {wavoipEnabled ? 'Usuários com permissão podem fazer e receber chamadas' : 'Chamadas desabilitadas'}
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
      </div>

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
  const { isAvailable, setAvailable } = useUserCallAvailability(instanceId);
  const { wavoipStatus } = useWavoip(instanceId);

  if (wavoipStatus !== 'available') {
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