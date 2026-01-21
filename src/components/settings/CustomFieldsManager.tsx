import { useState } from 'react';
import { Plus, Trash2, GripVertical, Edit2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  useCustomFieldDefinitions,
  useCreateCustomField,
  useUpdateCustomField,
  useDeleteCustomField,
} from '@/hooks/useLeadCustomFields';

const FIELD_TYPES = [
  { value: 'text', label: 'Texto' },
  { value: 'number', label: 'Número' },
  { value: 'date', label: 'Data' },
  { value: 'boolean', label: 'Sim/Não' },
];

export function CustomFieldsManager() {
  const { data: fields = [], isLoading } = useCustomFieldDefinitions();
  const createField = useCreateCustomField();
  const updateField = useUpdateCustomField();
  const deleteField = useDeleteCustomField();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState('');
  
  const [newField, setNewField] = useState({
    field_label: '',
    field_type: 'text' as 'text' | 'number' | 'date' | 'boolean',
    webhook_alias: '',
  });

  const handleCreate = async () => {
    if (!newField.field_label.trim()) return;
    
    await createField.mutateAsync({
      field_name: newField.field_label,
      field_label: newField.field_label.trim(),
      field_type: newField.field_type,
      webhook_alias: newField.webhook_alias.trim() || undefined,
    });
    
    setNewField({ field_label: '', field_type: 'text', webhook_alias: '' });
    setIsDialogOpen(false);
  };

  const handleStartEdit = (field: { id: string; field_label: string }) => {
    setEditingId(field.id);
    setEditingLabel(field.field_label);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editingLabel.trim()) return;
    
    await updateField.mutateAsync({
      id: editingId,
      field_label: editingLabel.trim(),
    });
    
    setEditingId(null);
    setEditingLabel('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingLabel('');
  };

  const remainingFields = 10 - fields.length;

  return (
    <div className="bg-card rounded-xl p-6 shadow-card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Campos Personalizados</h2>
          <p className="text-sm text-muted-foreground">
            Crie campos extras para armazenar informações específicas dos seus leads
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary">
            {fields.length}/10 campos
          </Badge>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" disabled={remainingFields <= 0}>
                <Plus className="w-4 h-4 mr-1" />
                Novo Campo
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Campo Personalizado</DialogTitle>
                <DialogDescription>
                  Este campo ficará disponível em todos os leads e poderá ser mapeado nas integrações.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Nome do Campo *</Label>
                  <Input
                    placeholder="Ex: Link de Checkout, Afiliado, Cor dos Olhos"
                    value={newField.field_label}
                    onChange={(e) => setNewField(prev => ({ ...prev, field_label: e.target.value }))}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Tipo do Campo</Label>
                  <Select
                    value={newField.field_type}
                    onValueChange={(v) => setNewField(prev => ({ ...prev, field_type: v as any }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FIELD_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Termo para Integração (opcional)</Label>
                  <Input
                    placeholder="Ex: data.subscription.plan.name"
                    value={newField.webhook_alias}
                    onChange={(e) => setNewField(prev => ({ ...prev, webhook_alias: e.target.value }))}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Se este termo vier no webhook, o sistema irá mapear automaticamente para este campo.
                  </p>
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleCreate}
                  disabled={!newField.field_label.trim() || createField.isPending}
                >
                  {createField.isPending ? 'Criando...' : 'Criar Campo'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Carregando...</div>
      ) : fields.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed rounded-lg">
          <p className="text-muted-foreground mb-2">Nenhum campo personalizado criado</p>
          <p className="text-xs text-muted-foreground">
            Crie campos como "Link de Checkout", "Afiliado Responsável", "Indicado Por", etc.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {fields.map((field) => (
            <div
              key={field.id}
              className="flex items-center gap-3 p-3 rounded-lg border bg-background hover:bg-muted/50 transition-colors"
            >
              <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
              
              <div className="flex-1 min-w-0">
                {editingId === field.id ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={editingLabel}
                      onChange={(e) => setEditingLabel(e.target.value)}
                      className="h-8"
                      autoFocus
                    />
                    <Button size="icon" variant="ghost" onClick={handleSaveEdit} className="h-8 w-8">
                      <Check className="w-4 h-4 text-green-600" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={handleCancelEdit} className="h-8 w-8">
                      <X className="w-4 h-4 text-red-600" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{field.field_label}</span>
                    <Badge variant="outline" className="text-xs">
                      {FIELD_TYPES.find(t => t.value === field.field_type)?.label || field.field_type}
                    </Badge>
                  </div>
                )}
                <p className="text-xs text-muted-foreground font-mono">
                  {field.field_name}
                  {(field as any).webhook_alias && (
                    <span className="ml-2 text-blue-600 dark:text-blue-400">
                      → {(field as any).webhook_alias}
                    </span>
                  )}
                </p>
              </div>
              
              {editingId !== field.id && (
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleStartEdit(field)}
                    className="h-8 w-8"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remover campo?</AlertDialogTitle>
                        <AlertDialogDescription>
                          O campo "{field.field_label}" será desativado. Os valores existentes serão mantidos mas não ficarão visíveis.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteField.mutate(field.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Remover
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      <div className="mt-4 p-3 bg-blue-500/10 rounded-lg">
        <p className="text-xs text-blue-700 dark:text-blue-400">
          <strong>💡 Dica:</strong> Campos personalizados podem ser mapeados nas Integrações para receber dados de webhooks externos como checkouts, afiliados, etc.
        </p>
      </div>
    </div>
  );
}
