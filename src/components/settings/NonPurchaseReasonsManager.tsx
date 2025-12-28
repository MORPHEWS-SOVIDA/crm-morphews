import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  DialogTrigger,
  DialogFooter,
  DialogClose
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
} from '@/components/ui/alert-dialog';
import { Plus, Loader2, Pencil, Trash2, GripVertical, Clock, Webhook, Users } from 'lucide-react';
import { 
  useNonPurchaseReasons, 
  useCreateNonPurchaseReason, 
  useUpdateNonPurchaseReason,
  useDeleteNonPurchaseReason 
} from '@/hooks/useNonPurchaseReasons';
import { useFunnelStages } from '@/hooks/useFunnelStages';
import { useTenant } from '@/hooks/useTenant';
import { toast } from '@/hooks/use-toast';

interface ReasonFormData {
  name: string;
  target_stage_id: string;
  followup_hours: number;
  webhook_url: string;
  followup_webhook_url: string;
  lead_visibility: 'assigned_only' | 'all_sellers';
}

const initialFormData: ReasonFormData = {
  name: '',
  target_stage_id: '',
  followup_hours: 0,
  webhook_url: '',
  followup_webhook_url: '',
  lead_visibility: 'assigned_only',
};

export function NonPurchaseReasonsManager() {
  const { data: reasons = [], isLoading } = useNonPurchaseReasons();
  const { data: stages = [] } = useFunnelStages();
  const { tenantId } = useTenant();
  
  const createReason = useCreateNonPurchaseReason();
  const updateReason = useUpdateNonPurchaseReason();
  const deleteReason = useDeleteNonPurchaseReason();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingReason, setEditingReason] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ReasonFormData>(initialFormData);

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast({ title: 'Digite um nome', variant: 'destructive' });
      return;
    }
    if (!tenantId) {
      toast({ title: 'Organização não encontrada', variant: 'destructive' });
      return;
    }

    try {
      await createReason.mutateAsync({
        organization_id: tenantId,
        name: formData.name.trim(),
        target_stage_id: formData.target_stage_id || null,
        followup_hours: formData.followup_hours || 0,
        webhook_url: formData.webhook_url.trim() || null,
        followup_webhook_url: formData.followup_webhook_url.trim() || null,
        lead_visibility: formData.lead_visibility,
        is_active: true,
        position: reasons.length,
      });
      setFormData(initialFormData);
      setIsCreateOpen(false);
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleUpdate = async (id: string) => {
    if (!formData.name.trim()) {
      toast({ title: 'Digite um nome', variant: 'destructive' });
      return;
    }

    try {
      await updateReason.mutateAsync({
        id,
        updates: {
          name: formData.name.trim(),
          target_stage_id: formData.target_stage_id || null,
          followup_hours: formData.followup_hours || 0,
          webhook_url: formData.webhook_url.trim() || null,
          followup_webhook_url: formData.followup_webhook_url.trim() || null,
          lead_visibility: formData.lead_visibility,
        },
      });
      toast({ title: 'Motivo atualizado!' });
      setEditingReason(null);
      setFormData(initialFormData);
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteReason.mutateAsync(id);
      setDeleteConfirmId(null);
    } catch (error) {
      // Error handled in hook
    }
  };

  const openEditDialog = (reason: typeof reasons[0]) => {
    setFormData({
      name: reason.name,
      target_stage_id: reason.target_stage_id || '',
      followup_hours: reason.followup_hours || 0,
      webhook_url: reason.webhook_url || '',
      followup_webhook_url: reason.followup_webhook_url || '',
      lead_visibility: reason.lead_visibility as 'assigned_only' | 'all_sellers',
    });
    setEditingReason(reason.id);
  };

  const getStageLabel = (stageId: string | null) => {
    if (!stageId) return 'Nenhuma';
    const stage = stages.find(s => s.id === stageId);
    return stage?.name || 'Etapa não encontrada';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Create Button */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogTrigger asChild>
          <Button onClick={() => setFormData(initialFormData)}>
            <Plus className="w-4 h-4 mr-2" />
            Adicionar Motivo
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo Motivo de Não Compra</DialogTitle>
          </DialogHeader>
          <ReasonForm 
            formData={formData} 
            setFormData={setFormData} 
            stages={stages} 
          />
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={handleCreate} disabled={createReason.isPending}>
              {createReason.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* List */}
      {reasons.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          Nenhum motivo cadastrado. Clique em "Adicionar Motivo" para começar.
        </div>
      ) : (
        <div className="space-y-2">
          {reasons.map((reason) => (
            <div 
              key={reason.id} 
              className="flex items-center gap-3 p-4 rounded-lg bg-muted/50 border"
            >
              <GripVertical className="w-4 h-4 text-muted-foreground cursor-move" />
              
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{reason.name}</div>
                <div className="flex flex-wrap gap-2 mt-1 text-xs text-muted-foreground">
                  {reason.target_stage_id && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-primary/10 text-primary">
                      → {getStageLabel(reason.target_stage_id)}
                    </span>
                  )}
                  {reason.followup_hours > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-500/10 text-blue-600">
                      <Clock className="w-3 h-3" />
                      {reason.followup_hours}h
                    </span>
                  )}
                  {reason.webhook_url && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-green-500/10 text-green-600">
                      <Webhook className="w-3 h-3" />
                      Webhook
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 text-amber-600">
                    <Users className="w-3 h-3" />
                    {reason.lead_visibility === 'all_sellers' ? 'Todos' : 'Vendedor'}
                  </span>
                </div>
              </div>

              {/* Edit Dialog */}
              <Dialog open={editingReason === reason.id} onOpenChange={(open) => !open && setEditingReason(null)}>
                <DialogTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8"
                    onClick={() => openEditDialog(reason)}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Editar Motivo</DialogTitle>
                  </DialogHeader>
                  <ReasonForm 
                    formData={formData} 
                    setFormData={setFormData} 
                    stages={stages} 
                  />
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline">Cancelar</Button>
                    </DialogClose>
                    <Button onClick={() => handleUpdate(reason.id)} disabled={updateReason.isPending}>
                      {updateReason.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                      Salvar
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => setDeleteConfirmId(reason.id)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover motivo?</AlertDialogTitle>
            <AlertDialogDescription>
              O motivo será desativado e não aparecerá mais nas opções. Leads já classificados com este motivo permanecerão inalterados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface ReasonFormProps {
  formData: ReasonFormData;
  setFormData: React.Dispatch<React.SetStateAction<ReasonFormData>>;
  stages: Array<{ id: string; name: string; stage_type: string }>;
}

function ReasonForm({ formData, setFormData, stages }: ReasonFormProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nome do Motivo *</Label>
        <Input
          id="name"
          placeholder="Ex: Preço alto"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
        />
      </div>

      <div className="space-y-2">
        <Label>Mover para Etapa do Funil</Label>
        <Select 
          value={formData.target_stage_id} 
          onValueChange={(value) => setFormData(prev => ({ ...prev, target_stage_id: value }))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione uma etapa (opcional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Nenhuma (manter atual)</SelectItem>
            {stages.map((stage) => (
              <SelectItem key={stage.id} value={stage.id}>
                {stage.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Ao classificar com este motivo, o lead será movido automaticamente para esta etapa.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="followup_hours">Horas para Follow-up</Label>
        <Input
          id="followup_hours"
          type="number"
          min="0"
          placeholder="0"
          value={formData.followup_hours || ''}
          onChange={(e) => setFormData(prev => ({ ...prev, followup_hours: parseInt(e.target.value) || 0 }))}
        />
        <p className="text-xs text-muted-foreground">
          Após esse tempo, o lead aparecerá na lista de follow-up do vendedor.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="webhook_url">Webhook ao Cadastrar</Label>
        <Input
          id="webhook_url"
          type="url"
          placeholder="https://..."
          value={formData.webhook_url}
          onChange={(e) => setFormData(prev => ({ ...prev, webhook_url: e.target.value }))}
        />
        <p className="text-xs text-muted-foreground">
          Chamado imediatamente quando o lead for classificado com este motivo.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="followup_webhook_url">Webhook no Follow-up</Label>
        <Input
          id="followup_webhook_url"
          type="url"
          placeholder="https://..."
          value={formData.followup_webhook_url}
          onChange={(e) => setFormData(prev => ({ ...prev, followup_webhook_url: e.target.value }))}
        />
        <p className="text-xs text-muted-foreground">
          Chamado quando chegar a hora do follow-up.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Visibilidade do Lead</Label>
        <Select 
          value={formData.lead_visibility} 
          onValueChange={(value: 'assigned_only' | 'all_sellers') => 
            setFormData(prev => ({ ...prev, lead_visibility: value }))
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="assigned_only">
              Apenas o vendedor responsável
            </SelectItem>
            <SelectItem value="all_sellers">
              Todos os vendedores da equipe
            </SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Define quem poderá ver o lead após ser classificado com este motivo.
        </p>
      </div>
    </div>
  );
}
