import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
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
  DialogClose
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Plus, Loader2, Pencil, Trash2, ChevronDown, Clock, MessageSquare, Info, HelpCircle, Image, Mic, FileIcon, Bot, AlertTriangle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { 
  useNonPurchaseMessageTemplates, 
  useCreateMessageTemplate, 
  useUpdateMessageTemplate,
  useDeleteMessageTemplate,
  type MessageTemplateFormData
} from '@/hooks/useNonPurchaseMessageTemplates';
import { useEvolutionInstances } from '@/hooks/useEvolutionInstances';
import { useAIBots } from '@/hooks/useAIBots';
import { useAuth } from '@/hooks/useAuth';
import { MediaUploader } from '@/components/scheduled-messages/MediaUploader';

interface MessageTemplatesManagerProps {
  reasonId: string;
  reasonName: string;
}

interface TemplateFormData {
  whatsapp_instance_id: string;
  fallback_instance_id_1: string;
  fallback_instance_id_2: string;
  delay_minutes: number;
  message_template: string;
  send_start_hour: number | null;
  send_end_hour: number | null;
  use_business_hours: boolean;
  media_type: 'image' | 'audio' | 'document' | null;
  media_url: string | null;
  media_filename: string | null;
  // Bot fallback
  fallback_bot_enabled: boolean;
  fallback_bot_id: string | null;
  fallback_timeout_minutes: number;
}

const initialFormData: TemplateFormData = {
  whatsapp_instance_id: '',
  fallback_instance_id_1: '',
  fallback_instance_id_2: '',
  delay_minutes: 0,
  message_template: '',
  send_start_hour: null,
  send_end_hour: null,
  use_business_hours: false,
  media_type: null,
  media_url: null,
  media_filename: null,
  fallback_bot_enabled: false,
  fallback_bot_id: null,
  fallback_timeout_minutes: 30,
};

const VARIABLES = [
  { key: '{{nome}}', label: 'Nome completo do lead' },
  { key: '{{primeiro_nome}}', label: 'Primeiro nome do lead' },
  { key: '{{vendedor}}', label: 'Nome do vendedor' },
  { key: '{{produto}}', label: 'Produto de interesse' },
  { key: '{{marca_do_produto}}', label: 'Marca do produto' },
];

export function MessageTemplatesManager({ reasonId, reasonName }: MessageTemplatesManagerProps) {
  const { data: templates = [], isLoading } = useNonPurchaseMessageTemplates(reasonId);
  const { instances: evolutionInstances = [], isLoading: instancesLoading } = useEvolutionInstances();
  const { data: bots = [] } = useAIBots();
  const { profile } = useAuth();
  
  const createTemplate = useCreateMessageTemplate();
  const updateTemplate = useUpdateMessageTemplate();
  const deleteTemplate = useDeleteMessageTemplate();

  const [isOpen, setIsOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [formData, setFormData] = useState<TemplateFormData>(initialFormData);

  // Filter only WhatsApp instances (not archived)
  const instances = useMemo(() => 
    (evolutionInstances || []).filter(i => !i.deleted_at && i.channel_type !== 'instagram'),
    [evolutionInstances]
  );

  const activeBots = bots.filter(b => b.is_active);

  // Check if selected instance has compatible distribution mode
  const selectedInstance = instances.find(i => i.id === formData.whatsapp_instance_id);
  const instanceDistMode = (selectedInstance as any)?.distribution_mode;
  const isDistributionModeCompatible = instanceDistMode === 'manual' || instanceDistMode === 'auto';

  const formatDelay = (minutes: number) => {
    if (minutes === 0) return 'Imediato';
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}min`;
  };

  const handleCreate = async () => {
    if (!formData.message_template.trim()) {
      return;
    }

    // Build fallback instance IDs array
    const fallbackIds: string[] = [];
    if (formData.fallback_instance_id_1) fallbackIds.push(formData.fallback_instance_id_1);
    if (formData.fallback_instance_id_2) fallbackIds.push(formData.fallback_instance_id_2);

    await createTemplate.mutateAsync({
      non_purchase_reason_id: reasonId,
      whatsapp_instance_id: formData.whatsapp_instance_id || null,
      fallback_instance_ids: fallbackIds.length > 0 ? fallbackIds : null,
      delay_minutes: formData.delay_minutes,
      message_template: formData.message_template.trim(),
      send_start_hour: formData.use_business_hours ? formData.send_start_hour : null,
      send_end_hour: formData.use_business_hours ? formData.send_end_hour : null,
      position: templates.length,
      media_type: formData.media_type,
      media_url: formData.media_url,
      media_filename: formData.media_filename,
      fallback_bot_enabled: formData.fallback_bot_enabled,
      fallback_bot_id: formData.fallback_bot_id,
      fallback_timeout_minutes: formData.fallback_timeout_minutes,
    });

    setFormData(initialFormData);
    setIsCreateOpen(false);
  };

  const handleUpdate = async () => {
    if (!editingId || !formData.message_template.trim()) return;

    // Build fallback instance IDs array
    const fallbackIds: string[] = [];
    if (formData.fallback_instance_id_1) fallbackIds.push(formData.fallback_instance_id_1);
    if (formData.fallback_instance_id_2) fallbackIds.push(formData.fallback_instance_id_2);

    await updateTemplate.mutateAsync({
      id: editingId,
      data: {
        whatsapp_instance_id: formData.whatsapp_instance_id || null,
        fallback_instance_ids: fallbackIds.length > 0 ? fallbackIds : null,
        delay_minutes: formData.delay_minutes,
        message_template: formData.message_template.trim(),
        send_start_hour: formData.use_business_hours ? formData.send_start_hour : null,
        send_end_hour: formData.use_business_hours ? formData.send_end_hour : null,
        media_type: formData.media_type,
        media_url: formData.media_url,
        media_filename: formData.media_filename,
        fallback_bot_enabled: formData.fallback_bot_enabled,
        fallback_bot_id: formData.fallback_bot_id,
        fallback_timeout_minutes: formData.fallback_timeout_minutes,
      },
    });

    setEditingId(null);
    setFormData(initialFormData);
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    await deleteTemplate.mutateAsync(deleteConfirmId);
    setDeleteConfirmId(null);
  };

  const openEdit = (template: typeof templates[0]) => {
    const fallbackIds = template.fallback_instance_ids || [];
    setFormData({
      whatsapp_instance_id: template.whatsapp_instance_id || '',
      fallback_instance_id_1: fallbackIds[0] || '',
      fallback_instance_id_2: fallbackIds[1] || '',
      delay_minutes: template.delay_minutes,
      message_template: template.message_template,
      send_start_hour: template.send_start_hour,
      send_end_hour: template.send_end_hour,
      use_business_hours: template.send_start_hour !== null,
      media_type: template.media_type || null,
      media_url: template.media_url || null,
      media_filename: template.media_filename || null,
      fallback_bot_enabled: template.fallback_bot_enabled ?? false,
      fallback_bot_id: template.fallback_bot_id || null,
      fallback_timeout_minutes: template.fallback_timeout_minutes ?? 30,
    });
    setEditingId(template.id);
  };

  const getInstanceName = (instanceId: string | null) => {
    if (!instanceId) return 'Nenhuma';
    const instance = instances.find(i => i.id === instanceId);
    return instance?.name || 'Instância não encontrada';
  };

  const getBotName = (botId: string | null) => {
    if (!botId) return null;
    const bot = bots.find(b => b.id === botId);
    return bot?.name || null;
  };

  const getMediaIcon = (type: string | null) => {
    if (type === 'image') return <Image className="w-3 h-3" />;
    if (type === 'audio') return <Mic className="w-3 h-3" />;
    if (type === 'document') return <FileIcon className="w-3 h-3" />;
    return null;
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-between text-xs h-7 px-2">
          <span className="flex items-center gap-1">
            <MessageSquare className="w-3 h-3" />
            Mensagens Automáticas ({templates.length})
          </span>
          <div className="flex items-center gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <HelpCircle className="w-3 h-3 text-blue-500" />
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-xs p-3 text-xs">
                  <p className="font-semibold mb-1">Variáveis disponíveis:</p>
                  <ul className="space-y-1 text-muted-foreground">
                    <li><code className="bg-muted px-1 rounded">{'{{nome}}'}</code> - Nome completo</li>
                    <li><code className="bg-muted px-1 rounded">{'{{primeiro_nome}}'}</code> - Primeiro nome</li>
                    <li><code className="bg-muted px-1 rounded">{'{{vendedor}}'}</code> - Nome do vendedor</li>
                    <li><code className="bg-muted px-1 rounded">{'{{produto}}'}</code> - Produto de interesse</li>
                    <li><code className="bg-muted px-1 rounded">{'{{marca_do_produto}}'}</code> - Marca</li>
                  </ul>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </div>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2 space-y-2">
        {isLoading ? (
          <div className="flex justify-center py-2">
            <Loader2 className="w-4 h-4 animate-spin" />
          </div>
        ) : (
          <>
            {templates.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">
                Nenhuma mensagem configurada
              </p>
            ) : (
              <div className="space-y-1">
                {templates.map((template, index) => (
                  <div 
                    key={template.id}
                    className="flex items-start gap-2 p-2 rounded bg-background border text-xs"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 mb-1">
                        <Badge variant="outline" className="text-[10px] px-1 py-0">
                          {index + 1}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px] px-1 py-0">
                          <Clock className="w-2 h-2 mr-0.5" />
                          {formatDelay(template.delay_minutes)}
                        </Badge>
                        {template.send_start_hour !== null && (
                          <Badge variant="secondary" className="text-[10px] px-1 py-0">
                            {template.send_start_hour}h-{template.send_end_hour}h
                          </Badge>
                        )}
                        {template.media_type && (
                          <Badge variant="secondary" className="text-[10px] px-1 py-0">
                            {getMediaIcon(template.media_type)}
                          </Badge>
                        )}
                        {template.fallback_bot_enabled && template.fallback_bot_id && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="secondary" className="text-[10px] px-1 py-0 bg-purple-500/20 text-purple-700">
                                  <Bot className="w-2 h-2 mr-0.5" />
                                  {template.fallback_timeout_minutes}min
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs">
                                Robô assume após {template.fallback_timeout_minutes} min: {getBotName(template.fallback_bot_id) || 'Bot'}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                      <p className="text-muted-foreground truncate">
                        {template.message_template.substring(0, 60)}...
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => openEdit(template)}
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive"
                        onClick={() => setDeleteConfirmId(template.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              className="w-full h-7 text-xs"
              onClick={() => {
                setFormData(initialFormData);
                setIsCreateOpen(true);
              }}
            >
              <Plus className="w-3 h-3 mr-1" />
              Adicionar Mensagem
            </Button>
          </>
        )}

        {/* Create/Edit Dialog */}
        <Dialog 
          open={isCreateOpen || !!editingId} 
          onOpenChange={(open) => {
            if (!open) {
              setIsCreateOpen(false);
              setEditingId(null);
              setFormData(initialFormData);
            }
          }}
        >
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingId ? 'Editar Mensagem' : 'Nova Mensagem Automática'}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Instance Chain - Primary + 2 Fallbacks */}
              <div className="space-y-3 p-3 bg-muted/50 rounded-lg border">
                <div className="flex items-center gap-2 mb-2">
                  <Label className="text-sm font-medium">Cadeia de Instâncias WhatsApp</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs p-3 text-xs">
                        <p className="font-semibold mb-1">Sistema de Fallback:</p>
                        <p className="text-muted-foreground">
                          Se a instância primária estiver offline ou falhar, o sistema tentará automaticamente enviar pela Reserva 1. 
                          Se também falhar, tentará pela Reserva 2.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                {/* Primary Instance */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Instância Principal</Label>
                  <Select
                    value={formData.whatsapp_instance_id || '__none__'}
                    onValueChange={(value) => setFormData(prev => ({ 
                      ...prev, 
                      whatsapp_instance_id: value === '__none__' ? '' : value 
                    }))}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Selecione a instância" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Nenhuma (configurar depois)</SelectItem>
                      {instances.map((instance) => (
                        <SelectItem key={instance.id} value={instance.id}>
                          {instance.name}{instance.phone_number ? ` • ${instance.phone_number}` : ''} {instance.is_connected ? '🟢' : '🔴'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Fallback Instance 1 */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-500/20 text-amber-600 text-[10px] font-bold">1</span>
                    Reserva 1 (se a principal falhar)
                  </Label>
                  <Select
                    value={formData.fallback_instance_id_1 || '__none__'}
                    onValueChange={(value) => setFormData(prev => ({ 
                      ...prev, 
                      fallback_instance_id_1: value === '__none__' ? '' : value 
                    }))}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Selecione (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Nenhuma</SelectItem>
                      {instances
                        .filter(i => i.id !== formData.whatsapp_instance_id)
                        .map((instance) => (
                          <SelectItem key={instance.id} value={instance.id}>
                            {instance.name}{instance.phone_number ? ` • ${instance.phone_number}` : ''} {instance.is_connected ? '🟢' : '🔴'}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Fallback Instance 2 */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-orange-500/20 text-orange-600 text-[10px] font-bold">2</span>
                    Reserva 2 (se a reserva 1 falhar)
                  </Label>
                  <Select
                    value={formData.fallback_instance_id_2 || '__none__'}
                    onValueChange={(value) => setFormData(prev => ({ 
                      ...prev, 
                      fallback_instance_id_2: value === '__none__' ? '' : value 
                    }))}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Selecione (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Nenhuma</SelectItem>
                      {instances
                        .filter(i => i.id !== formData.whatsapp_instance_id && i.id !== formData.fallback_instance_id_1)
                        .map((instance) => (
                          <SelectItem key={instance.id} value={instance.id}>
                            {instance.name}{instance.phone_number ? ` • ${instance.phone_number}` : ''} {instance.is_connected ? '🟢' : '🔴'}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Enviar após (minutos)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    value={formData.delay_minutes}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      delay_minutes: parseInt(e.target.value) || 0 
                    }))}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">
                    = {formatDelay(formData.delay_minutes)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  0 = imediato, 60 = 1 hora, 120 = 2 horas
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="use_business_hours"
                    checked={formData.use_business_hours}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      use_business_hours: e.target.checked,
                      send_start_hour: e.target.checked ? 8 : null,
                      send_end_hour: e.target.checked ? 20 : null,
                    }))}
                    className="rounded"
                  />
                  <Label htmlFor="use_business_hours">Restringir horário de envio</Label>
                </div>
                
                {formData.use_business_hours && (
                  <div className="flex items-center gap-2 ml-6">
                    <Input
                      type="number"
                      min="0"
                      max="23"
                      value={formData.send_start_hour ?? 8}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        send_start_hour: parseInt(e.target.value) || 0 
                      }))}
                      className="w-16"
                    />
                    <span>até</span>
                    <Input
                      type="number"
                      min="0"
                      max="23"
                      value={formData.send_end_hour ?? 20}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        send_end_hour: parseInt(e.target.value) || 0 
                      }))}
                      className="w-16"
                    />
                    <span className="text-sm text-muted-foreground">horas</span>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Mensagens fora do horário serão enviadas no próximo horário disponível.
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
                  placeholder="Olá {{primeiro_nome}}, tudo bem?"
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
                  Anexe uma imagem, documento ou grave um áudio para enviar junto com a mensagem.
                </p>
              </div>

              {/* Bot Fallback Section */}
              <div className="space-y-3 pt-2 border-t">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base flex items-center gap-2">
                      <Bot className="w-4 h-4 text-purple-500" />
                      Fallback para Robô IA
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Se nenhum vendedor assumir a conversa, um robô pode atender automaticamente.
                    </p>
                  </div>
                  <Switch
                    checked={formData.fallback_bot_enabled}
                    onCheckedChange={(checked) => setFormData(prev => ({
                      ...prev,
                      fallback_bot_enabled: checked,
                      fallback_bot_id: checked ? prev.fallback_bot_id : null,
                    }))}
                  />
                </div>

                {formData.fallback_bot_enabled && (
                  <div className="space-y-3 pl-2 border-l-2 border-purple-500/30">
                    {/* Warning about distribution mode */}
                    {formData.whatsapp_instance_id && !isDistributionModeCompatible && (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          A instância selecionada está com "Robô de IA" como modo de distribuição. 
                          Dois robôs podem responder a mesma conversa. Altere o modo da instância 
                          para "Pendentes" ou "Distribuição Automática" para usar esta funcionalidade.
                        </AlertDescription>
                      </Alert>
                    )}

                    {!formData.whatsapp_instance_id && (
                      <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          Selecione uma instância WhatsApp para validar a compatibilidade do modo de distribuição.
                        </AlertDescription>
                      </Alert>
                    )}

                    <div className="space-y-2">
                      <Label>Tempo de espera antes do robô assumir</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="1"
                          value={formData.fallback_timeout_minutes}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            fallback_timeout_minutes: parseInt(e.target.value) || 30
                          }))}
                          className="w-24"
                        />
                        <span className="text-sm text-muted-foreground">minutos</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Robô que deve assumir</Label>
                      <Select
                        value={formData.fallback_bot_id || '__none__'}
                        onValueChange={(value) => setFormData(prev => ({
                          ...prev,
                          fallback_bot_id: value === '__none__' ? null : value
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o robô" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Nenhum (desativado)</SelectItem>
                          {activeBots.map((bot) => (
                            <SelectItem key={bot.id} value={bot.id}>
                              {bot.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {activeBots.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          Nenhum robô ativo encontrado. Crie um robô em "Robôs IA".
                        </p>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
                      <strong>Como funciona:</strong> Após a mensagem ser enviada, se nenhum vendedor 
                      assumir ou responder em <strong>{formData.fallback_timeout_minutes} minutos</strong>, 
                      o robô selecionado começará a atender o cliente automaticamente.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancelar</Button>
              </DialogClose>
              <Button 
                onClick={editingId ? handleUpdate : handleCreate}
                disabled={createTemplate.isPending || updateTemplate.isPending || !formData.message_template.trim()}
              >
                {(createTemplate.isPending || updateTemplate.isPending) && (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                )}
                {editingId ? 'Salvar' : 'Criar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover mensagem?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta mensagem automática será removida do fluxo.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Remover
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CollapsibleContent>
    </Collapsible>
  );
}
