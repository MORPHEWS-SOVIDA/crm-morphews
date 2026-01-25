import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Truck,
  MessageSquare,
  CheckCircle,
  Settings,
  Loader2,
  Package,
  MapPin,
  AlertTriangle,
  Home,
  ArrowLeft,
  X,
} from 'lucide-react';
import { useCarrierTrackingStatuses, useUpdateCarrierTrackingStatus } from '@/hooks/useCarrierTrackingStatuses';
import { useWhatsAppInstances } from '@/hooks/useWhatsAppInstances';
import { TrackingStatusMessageEditor } from '@/components/settings/TrackingStatusMessageEditor';
import { toast } from 'sonner';

const statusIcons: Record<string, React.ReactNode> = {
  waiting_post: <Package className="w-4 h-4" />,
  posted: <Truck className="w-4 h-4" />,
  in_destination_city: <MapPin className="w-4 h-4" />,
  attempt_1_failed: <AlertTriangle className="w-4 h-4" />,
  attempt_2_failed: <AlertTriangle className="w-4 h-4" />,
  attempt_3_failed: <AlertTriangle className="w-4 h-4" />,
  waiting_pickup: <Home className="w-4 h-4" />,
  returning_to_sender: <ArrowLeft className="w-4 h-4" />,
  delivered: <CheckCircle className="w-4 h-4" />,
};

interface MelhorEnvioTrackingIntegrationProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MelhorEnvioTrackingIntegration({ isOpen, onClose }: MelhorEnvioTrackingIntegrationProps) {
  const { data: statuses = [], isLoading } = useCarrierTrackingStatuses();
  const { data: instances = [] } = useWhatsAppInstances();
  const updateStatus = useUpdateCarrierTrackingStatus();
  
  const [selectedStatus, setSelectedStatus] = useState<typeof statuses[0] | null>(null);
  const [defaultInstanceId, setDefaultInstanceId] = useState<string>('');

  // Count configured statuses
  const configuredCount = statuses.filter(s => s.message_template && s.whatsapp_instance_id && s.is_active).length;
  const totalCount = statuses.length;

  const handleToggleActive = async (status: typeof statuses[0]) => {
    try {
      await updateStatus.mutateAsync({
        id: status.id,
        is_active: !status.is_active,
      });
      toast.success(`Status "${status.label}" ${!status.is_active ? 'ativado' : 'desativado'}`);
    } catch (error) {
      toast.error('Erro ao atualizar status');
    }
  };

  const handleSaveMessage = async (data: {
    whatsapp_instance_id: string | null;
    message_template: string | null;
    media_type: 'image' | 'audio' | 'document' | null;
    media_url: string | null;
    media_filename: string | null;
  }) => {
    if (!selectedStatus) return;
    
    try {
      await updateStatus.mutateAsync({
        id: selectedStatus.id,
        ...data,
      });
      toast.success('Mensagem salva com sucesso!');
    } catch (error) {
      toast.error('Erro ao salvar mensagem');
    }
  };

  const handleApplyDefaultInstance = async () => {
    if (!defaultInstanceId) {
      toast.error('Selecione uma instância padrão');
      return;
    }

    try {
      for (const status of statuses) {
        if (!status.whatsapp_instance_id) {
          await updateStatus.mutateAsync({
            id: status.id,
            whatsapp_instance_id: defaultInstanceId,
          });
        }
      }
      toast.success('Instância padrão aplicada aos status sem instância!');
    } catch (error) {
      toast.error('Erro ao aplicar instância padrão');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-primary" />
            Melhor Envio - Notificações de Rastreio
          </DialogTitle>
          <DialogDescription>
            Configure mensagens automáticas via WhatsApp para cada status de rastreio
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status Overview */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div>
              <p className="text-sm font-medium">Status Configurados</p>
              <p className="text-2xl font-bold">
                {configuredCount}/{totalCount}
              </p>
            </div>
            <Badge variant={configuredCount > 0 ? 'default' : 'secondary'} className="text-sm">
              {configuredCount > 0 ? 'Ativo' : 'Inativo'}
            </Badge>
          </div>

          {/* Default Instance Selector */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Instância WhatsApp Padrão
              </CardTitle>
              <CardDescription className="text-xs">
                Aplique uma instância padrão para todos os status que ainda não têm uma configurada
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Select
                  value={defaultInstanceId || '__none__'}
                  onValueChange={(value) => setDefaultInstanceId(value === '__none__' ? '' : value)}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Selecione a instância padrão" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Selecione...</SelectItem>
                    {instances.map((instance) => (
                      <SelectItem key={instance.id} value={instance.id}>
                        {instance.name}{instance.phone_number ? ` • ${instance.phone_number}` : ''} {instance.is_connected ? '🟢' : '🔴'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button 
                  onClick={handleApplyDefaultInstance}
                  disabled={!defaultInstanceId || updateStatus.isPending}
                  size="sm"
                >
                  Aplicar
                </Button>
              </div>
            </CardContent>
          </Card>

          <Separator />

          {/* Status List */}
          <div className="space-y-2">
            <h3 className="font-medium text-sm flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Mensagens por Status
            </h3>
            
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid gap-2">
                {statuses.map((status) => (
                  <div
                    key={status.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${status.is_active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                        {statusIcons[status.status_key] || <Package className="w-4 h-4" />}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{status.label}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-mono">{status.status_key}</span>
                          {status.message_template && (
                            <Badge variant="secondary" className="text-[10px] px-1">
                              Mensagem configurada
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs gap-1"
                        onClick={() => setSelectedStatus(status)}
                      >
                        <MessageSquare className="w-3 h-3" />
                        {status.message_template ? 'Editar' : 'Configurar'}
                      </Button>
                      
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`active-${status.id}`} className="text-xs text-muted-foreground">
                          Ativo
                        </Label>
                        <Switch
                          id={`active-${status.id}`}
                          checked={status.is_active}
                          onCheckedChange={() => handleToggleActive(status)}
                          disabled={updateStatus.isPending}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Info Box */}
          <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-400">
              <strong>Como funciona:</strong> Quando o Melhor Envio envia um webhook de atualização de rastreio,
              o sistema identifica o status e dispara automaticamente a mensagem configurada para o cliente via WhatsApp.
            </p>
          </div>
        </div>

        {/* Message Editor Dialog */}
        {selectedStatus && (
          <TrackingStatusMessageEditor
            isOpen={true}
            onClose={() => setSelectedStatus(null)}
            statusLabel={selectedStatus.label}
            currentConfig={{
              whatsapp_instance_id: selectedStatus.whatsapp_instance_id,
              message_template: selectedStatus.message_template,
              media_type: selectedStatus.media_type,
              media_url: selectedStatus.media_url,
              media_filename: selectedStatus.media_filename,
            }}
            onSave={handleSaveMessage}
            isSaving={updateStatus.isPending}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// Card component for the integrations list
export function MelhorEnvioTrackingCard({ onClick }: { onClick: () => void }) {
  const { data: statuses = [] } = useCarrierTrackingStatuses();
  const configuredCount = statuses.filter(s => s.message_template && s.whatsapp_instance_id && s.is_active).length;
  const isActive = configuredCount > 0;

  return (
    <Card 
      className="hover:shadow-md transition-shadow cursor-pointer border-dashed border-primary/30"
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-primary" />
            <CardTitle className="text-lg">Melhor Envio - Rastreio</CardTitle>
          </div>
          <Badge 
            variant="secondary"
            className={isActive ? 'bg-green-500 text-white' : ''}
          >
            {isActive ? 'Ativo' : 'Configurar'}
          </Badge>
        </div>
        <CardDescription>
          Notificações de rastreio via WhatsApp
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MessageSquare className="w-4 h-4" />
          <span>{configuredCount} status com mensagem configurada</span>
        </div>
        
        <Button variant="outline" size="sm" className="w-full gap-2">
          <Settings className="w-4 h-4" />
          Configurar Notificações
        </Button>
      </CardContent>
    </Card>
  );
}
