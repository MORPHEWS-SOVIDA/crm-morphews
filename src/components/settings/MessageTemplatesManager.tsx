import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Badge } from '@/components/ui/badge';
import { Plus, Loader2, Pencil, Trash2, ChevronDown, Clock, MessageSquare, Info, HelpCircle } from 'lucide-react';
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
import { useWhatsAppInstances } from '@/hooks/useWhatsAppInstances';

interface MessageTemplatesManagerProps {
  reasonId: string;
  reasonName: string;
}

interface TemplateFormData {
  whatsapp_instance_id: string;
  delay_minutes: number;
  message_template: string;
  send_start_hour: number | null;
  send_end_hour: number | null;
  use_business_hours: boolean;
}

const initialFormData: TemplateFormData = {
  whatsapp_instance_id: '',
  delay_minutes: 0,
  message_template: '',
  send_start_hour: null,
  send_end_hour: null,
  use_business_hours: false,
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
  const { data: instances = [] } = useWhatsAppInstances();
  
  const createTemplate = useCreateMessageTemplate();
  const updateTemplate = useUpdateMessageTemplate();
  const deleteTemplate = useDeleteMessageTemplate();

  const [isOpen, setIsOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [formData, setFormData] = useState<TemplateFormData>(initialFormData);

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

    await createTemplate.mutateAsync({
      non_purchase_reason_id: reasonId,
      whatsapp_instance_id: formData.whatsapp_instance_id || null,
      delay_minutes: formData.delay_minutes,
      message_template: formData.message_template.trim(),
      send_start_hour: formData.use_business_hours ? formData.send_start_hour : null,
      send_end_hour: formData.use_business_hours ? formData.send_end_hour : null,
      position: templates.length,
    });

    setFormData(initialFormData);
    setIsCreateOpen(false);
  };

  const handleUpdate = async () => {
    if (!editingId || !formData.message_template.trim()) return;

    await updateTemplate.mutateAsync({
      id: editingId,
      data: {
        whatsapp_instance_id: formData.whatsapp_instance_id || null,
        delay_minutes: formData.delay_minutes,
        message_template: formData.message_template.trim(),
        send_start_hour: formData.use_business_hours ? formData.send_start_hour : null,
        send_end_hour: formData.use_business_hours ? formData.send_end_hour : null,
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
    setFormData({
      whatsapp_instance_id: template.whatsapp_instance_id || '',
      delay_minutes: template.delay_minutes,
      message_template: template.message_template,
      send_start_hour: template.send_start_hour,
      send_end_hour: template.send_end_hour,
      use_business_hours: template.send_start_hour !== null,
    });
    setEditingId(template.id);
  };

  const getInstanceName = (instanceId: string | null) => {
    if (!instanceId) return 'Nenhuma';
    const instance = instances.find(i => i.id === instanceId);
    return instance?.name || 'Instância não encontrada';
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
                    <SelectItem value="__none__">Nenhuma (configurar depois)</SelectItem>
                    {instances.map((instance) => (
                      <SelectItem key={instance.id} value={instance.id}>
                        {instance.name} {instance.is_connected ? '🟢' : '🔴'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
