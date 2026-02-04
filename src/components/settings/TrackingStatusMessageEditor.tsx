import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Loader2, Info, Image, Mic, FileIcon } from 'lucide-react';
import { useWhatsAppInstances } from '@/hooks/useWhatsAppInstances';
import { useAuth } from '@/hooks/useAuth';
import { MediaUploader } from '@/components/scheduled-messages/MediaUploader';

interface TrackingStatusMessageEditorProps {
  isOpen: boolean;
  onClose: () => void;
  statusLabel: string;
  currentConfig: {
    whatsapp_instance_id: string | null;
    message_template: string | null;
    media_type: 'image' | 'audio' | 'document' | null;
    media_url: string | null;
    media_filename: string | null;
  };
  onSave: (data: {
    whatsapp_instance_id: string | null;
    message_template: string | null;
    media_type: 'image' | 'audio' | 'document' | null;
    media_url: string | null;
    media_filename: string | null;
  }) => Promise<void>;
  isSaving: boolean;
}

const VARIABLES = [
  { key: '{{nome}}', label: 'Nome completo do cliente' },
  { key: '{{primeiro_nome}}', label: 'Primeiro nome do cliente' },
  { key: '{{vendedor}}', label: 'Nome do vendedor' },
  { key: '{{produto}}', label: 'Nome do produto' },
  { key: '{{marca}}', label: 'Marca do produto' },
  { key: '{{link_rastreio}}', label: 'Link de rastreio' },
  { key: '{{codigo_rastreio}}', label: 'Código de rastreio' },
  { key: '{{transportadora}}', label: 'Nome da transportadora' },
  { key: '{{numero_venda}}', label: 'Número da venda' },
  { key: '{{valor}}', label: 'Valor total da venda' },
];

export function TrackingStatusMessageEditor({
  isOpen,
  onClose,
  statusLabel,
  currentConfig,
  onSave,
  isSaving,
}: TrackingStatusMessageEditorProps) {
  const { data: instances = [] } = useWhatsAppInstances();
  const { profile } = useAuth();
  
  const [formData, setFormData] = useState({
    whatsapp_instance_id: currentConfig.whatsapp_instance_id || '',
    message_template: currentConfig.message_template || '',
    media_type: currentConfig.media_type,
    media_url: currentConfig.media_url,
    media_filename: currentConfig.media_filename,
  });

  const handleSave = async () => {
    await onSave({
      whatsapp_instance_id: formData.whatsapp_instance_id || null,
      message_template: formData.message_template.trim() || null,
      media_type: formData.media_type,
      media_url: formData.media_url,
      media_filename: formData.media_filename,
    });
    onClose();
  };

  const handleClearMessage = async () => {
    await onSave({
      whatsapp_instance_id: null,
      message_template: null,
      media_type: null,
      media_url: null,
      media_filename: null,
    });
    onClose();
  };

  const getMediaIcon = (type: string | null) => {
    if (type === 'image') return <Image className="w-3 h-3" />;
    if (type === 'audio') return <Mic className="w-3 h-3" />;
    if (type === 'document') return <FileIcon className="w-3 h-3" />;
    return null;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Mensagem Automática: {statusLabel}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground">
            Configure uma mensagem automática para ser enviada ao cliente quando este status for ativado.
          </div>

          <div className="space-y-2">
            <Label>Instância WhatsApp</Label>
            <Select
              value={formData.whatsapp_instance_id || '__none__'}
              onValueChange={(value) => setFormData(prev => ({ 
                ...prev, 
                whatsapp_instance_id: value === '__none__' ? '' : value 
              }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a instância" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Nenhuma (desativado)</SelectItem>
                {instances.map((instance) => (
                  <SelectItem key={instance.id} value={instance.id}>
                    {instance.name}{instance.phone_number ? ` • ${instance.phone_number}` : ''} {instance.is_connected ? '🟢' : '🔴'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Selecione por qual instância a mensagem será enviada
            </p>
          </div>

          <div className="space-y-2">
            <Label>Mensagem</Label>
            <Textarea
              value={formData.message_template}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                message_template: e.target.value 
              }))}
              placeholder="Olá {{primeiro_nome}}, seu pedido foi entregue! 🎉 Como foi a experiência?"
              className="min-h-[120px]"
            />
            
            <div className="p-2 bg-muted rounded-lg">
              <div className="flex items-center gap-1 text-xs font-medium mb-2">
                <Info className="w-3 h-3" />
                Variáveis disponíveis
              </div>
              <div className="flex flex-wrap gap-1">
                {VARIABLES.map((v) => (
                  <Button
                    key={v.key}
                    variant="outline"
                    size="sm"
                    className="h-6 text-xs px-2"
                    onClick={() => setFormData(prev => ({
                      ...prev,
                      message_template: prev.message_template + v.key
                    }))}
                    title={v.label}
                  >
                    {v.key}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Media Upload Section */}
          <div className="space-y-2">
            <Label>Mídia (opcional)</Label>
            {profile?.organization_id && (
              <MediaUploader
                mediaType={formData.media_type}
                mediaUrl={formData.media_url}
                mediaFilename={formData.media_filename}
                onMediaChange={(data) => setFormData(prev => ({
                  ...prev,
                  media_type: data.media_type,
                  media_url: data.media_url,
                  media_filename: data.media_filename,
                }))}
                organizationId={profile.organization_id}
              />
            )}
            <p className="text-xs text-muted-foreground">
              Anexe uma imagem, documento ou grave um áudio para enviar junto com a mensagem
            </p>
          </div>

          {/* Preview */}
          {(formData.message_template || formData.media_type) && (
            <div className="space-y-2">
              <Label className="text-xs">Prévia</Label>
              <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                {formData.media_type && (
                  <div className="flex items-center gap-1 mb-2">
                    <Badge variant="secondary" className="text-[10px] px-1 py-0">
                      {getMediaIcon(formData.media_type)}
                      <span className="ml-1">{formData.media_filename}</span>
                    </Badge>
                  </div>
                )}
                <p className="text-sm whitespace-pre-wrap">
                  {formData.message_template || '(sem mensagem de texto)'}
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {currentConfig.message_template && (
            <Button
              variant="outline"
              onClick={handleClearMessage}
              disabled={isSaving}
              className="text-destructive"
            >
              Remover Mensagem
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={onClose} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Salvar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
