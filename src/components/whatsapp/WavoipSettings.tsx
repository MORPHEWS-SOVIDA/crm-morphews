import { useState } from 'react';
import { Phone, PhoneCall, Users, Settings, Loader2, Check, X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useCallQueue, useUserCallAvailability, useWavoip } from '@/hooks/useWavoip';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
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

  const handleToggleWavoip = async (enabled: boolean) => {
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('whatsapp_instances')
        .update({ wavoip_enabled: enabled })
        .eq('id', instanceId);

      if (error) throw error;

      toast.success(enabled ? 'Chamadas habilitadas!' : 'Chamadas desabilitadas');
      queryClient.invalidateQueries({ queryKey: ['whatsapp-instances'] });
      queryClient.invalidateQueries({ queryKey: ['wavoip-instance-config'] });
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
      <div className="flex items-center justify-between gap-4 p-3 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center",
            wavoipEnabled ? "bg-green-100 text-green-600" : "bg-muted text-muted-foreground"
          )}>
            <Phone className="h-5 w-5" />
          </div>
          <div>
            <p className="font-medium text-sm">Chamadas via WhatsApp</p>
            <p className="text-xs text-muted-foreground">
              {wavoipEnabled ? 'Habilitado - Usuários podem fazer e receber chamadas' : 'Desabilitado'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {wavoipEnabled && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowQueueDialog(true)}
            >
              <Users className="h-4 w-4 mr-1" />
              Fila
            </Button>
          )}
          <Switch
            checked={wavoipEnabled}
            onCheckedChange={handleToggleWavoip}
            disabled={isUpdating}
          />
        </div>
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

interface CallQueueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instanceId: string;
  instanceName: string;
}

/**
 * Dialog for managing the call queue (round-robin distribution)
 */
function CallQueueDialog({ 
  open, 
  onOpenChange, 
  instanceId, 
  instanceName 
}: CallQueueDialogProps) {
  const { callQueue, isLoading, toggleAvailability, removeFromQueue } = useCallQueue(instanceId);
  const { isInQueue, isAvailable, setAvailable, leaveQueue, queuePosition } = useUserCallAvailability(instanceId);
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
                          <div className="flex items-center gap-1">
                            {entry.is_available ? (
                              <Check className="h-3 w-3 text-green-600" />
                            ) : (
                              <X className="h-3 w-3 text-muted-foreground" />
                            )}
                            <span className="text-xs text-muted-foreground">
                              {entry.calls_received} chamadas
                            </span>
                          </div>
                        </div>
                      </div>
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
  const { isInQueue, isAvailable, setAvailable } = useUserCallAvailability(instanceId);
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
