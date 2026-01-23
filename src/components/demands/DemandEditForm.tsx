import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { MultiSelect } from '@/components/MultiSelect';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useUpdateDemand, useAddDemandAssignee, useRemoveDemandAssignee } from '@/hooks/useDemands';
import { useUsers } from '@/hooks/useUsers';
import { useAssignDemandLabel, useDemandLabels, useRemoveDemandLabel } from '@/hooks/useDemandDetails';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { notifyDemandUpdate } from '@/lib/demand-notifications';
import { URGENCY_CONFIG, type DemandUrgency, type DemandWithRelations } from '@/types/demand';
import { MessageSquare } from 'lucide-react';

function toLocalDateTimeInputValue(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalDateTimeInputValue(value: string) {
  if (!value) return null;
  const d = new Date(value);
  return d.toISOString();
}

interface DemandEditFormProps {
  demand: DemandWithRelations;
  onCancel: () => void;
  onSaved: () => void;
}

export function DemandEditForm({ demand, onCancel, onSaved }: DemandEditFormProps) {
  const { toast } = useToast();
  const { profile } = useAuth();
  const updateDemand = useUpdateDemand();
  const addAssignee = useAddDemandAssignee();
  const removeAssignee = useRemoveDemandAssignee();

  const { data: users } = useUsers();

  const { data: labels } = useDemandLabels();
  const assignLabel = useAssignDemandLabel();
  const removeLabel = useRemoveDemandLabel();

  const [form, setForm] = useState(() => ({
    title: demand.title || '',
    description: demand.description || '',
    urgency: demand.urgency as DemandUrgency,
    due_at: toLocalDateTimeInputValue(demand.due_at),
    assignee_ids: (demand.assignees || []).map(a => a.user_id),
    label_ids: (demand.labels || []).map(l => l.id),
  }));

  const [showNotifyDialog, setShowNotifyDialog] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<string[]>([]);

  const userOptions = useMemo(
    () => (users || []).map(u => ({ value: u.user_id, label: `${u.first_name} ${u.last_name}` })),
    [users]
  );

  const labelOptions = useMemo(
    () => (labels || []).map(l => ({ value: l.id, label: l.name })),
    [labels]
  );

  // Detecta o que mudou para exibir no dialog
  const detectChanges = (): string[] => {
    const changes: string[] = [];
    if (form.title !== demand.title) changes.push('Título');
    if (form.description !== (demand.description || '')) changes.push('Descrição');
    if (form.urgency !== demand.urgency) changes.push('Urgência');
    if (form.due_at !== toLocalDateTimeInputValue(demand.due_at)) changes.push('Data de entrega');
    
    const currentAssigneeIds = (demand.assignees || []).map(a => a.user_id).sort().join(',');
    const newAssigneeIds = form.assignee_ids.sort().join(',');
    if (currentAssigneeIds !== newAssigneeIds) changes.push('Responsáveis');
    
    const currentLabelIds = (demand.labels || []).map(l => l.id).sort().join(',');
    const newLabelIds = form.label_ids.sort().join(',');
    if (currentLabelIds !== newLabelIds) changes.push('Etiquetas');
    
    return changes;
  };

  const handleSave = async () => {
    try {
      await updateDemand.mutateAsync({
        id: demand.id,
        title: form.title,
        description: form.description || null,
        urgency: form.urgency,
        due_at: fromLocalDateTimeInputValue(form.due_at),
      });

      // Reconcile assignees
      const currentAssignees = demand.assignees || [];
      const desiredAssigneeIds = new Set(form.assignee_ids);

      const toRemove = currentAssignees.filter(a => !desiredAssigneeIds.has(a.user_id));
      const toAdd = form.assignee_ids.filter(uid => !currentAssignees.some(a => a.user_id === uid));

      await Promise.all([
        ...toRemove.map(a => removeAssignee.mutateAsync({ assigneeId: a.id, demandId: demand.id })),
        ...toAdd.map(userId => addAssignee.mutateAsync({ demandId: demand.id, userId })),
      ]);

      // Reconcile labels
      const currentLabelIds = new Set((demand.labels || []).map(l => l.id));
      const desiredLabelIds = new Set(form.label_ids);

      const labelsToRemove = [...currentLabelIds].filter(id => !desiredLabelIds.has(id));
      const labelsToAdd = [...desiredLabelIds].filter(id => !currentLabelIds.has(id));

      await Promise.all([
        ...labelsToRemove.map(labelId => removeLabel.mutateAsync({ demandId: demand.id, labelId })),
        ...labelsToAdd.map(labelId => assignLabel.mutateAsync({ demandId: demand.id, labelId })),
      ]);

      // Verificar se há envolvidos para notificar
      const allAssigneeIds = form.assignee_ids.length > 0 ? form.assignee_ids : (demand.assignees || []).map(a => a.user_id);
      const changes = detectChanges();
      
      if (allAssigneeIds.length > 0 && changes.length > 0) {
        setPendingChanges(changes);
        setShowNotifyDialog(true);
      } else {
        onSaved();
      }
    } catch (err) {
      toast({
        title: 'Erro ao salvar alterações',
        description: err instanceof Error ? err.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    }
  };

  const handleNotifyConfirm = async () => {
    const allAssigneeIds = form.assignee_ids.length > 0 ? form.assignee_ids : (demand.assignees || []).map(a => a.user_id);
    const updaterName = profile ? `${profile.first_name} ${profile.last_name}`.trim() : 'Alguém';
    
    try {
      await notifyDemandUpdate(
        demand.organization_id,
        demand.id,
        allAssigneeIds,
        updaterName,
        pendingChanges.join(', ')
      );
      toast({ title: 'Notificação enviada!', description: 'Os envolvidos foram notificados por WhatsApp.' });
    } catch (err) {
      console.error('Failed to send update notification:', err);
    }
    
    setShowNotifyDialog(false);
    onSaved();
  };

  const handleNotifySkip = () => {
    setShowNotifyDialog(false);
    onSaved();
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Título</Label>
          <Input
            value={form.title}
            onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
          />
        </div>

        <div className="space-y-2">
          <Label>Urgência</Label>
          <Select
            value={form.urgency}
            onValueChange={(v) => setForm(prev => ({ ...prev, urgency: v as DemandUrgency }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(URGENCY_CONFIG) as DemandUrgency[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {URGENCY_CONFIG[key].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Descrição</Label>
        <Textarea
          value={form.description}
          onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
          rows={4}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Data de entrega</Label>
          <Input
            type="datetime-local"
            value={form.due_at}
            onChange={(e) => setForm(prev => ({ ...prev, due_at: e.target.value }))}
          />
        </div>

        <div className="space-y-2">
          <Label>Responsáveis</Label>
          <MultiSelect
            options={userOptions}
            selected={form.assignee_ids}
            onChange={(ids) => setForm(prev => ({ ...prev, assignee_ids: ids }))}
            placeholder="Selecione responsáveis..."
          />
        </div>
      </div>

      {labelOptions.length > 0 && (
        <div className="space-y-2">
          <Label>Etiquetas</Label>
          <MultiSelect
            options={labelOptions}
            selected={form.label_ids}
            onChange={(ids) => setForm(prev => ({ ...prev, label_ids: ids }))}
            placeholder="Selecione etiquetas..."
          />
          <p className="text-xs text-muted-foreground">
            Você pode adicionar/remover etiquetas aqui (salve para aplicar).
          </p>
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          onClick={handleSave}
          disabled={updateDemand.isPending || addAssignee.isPending || removeAssignee.isPending || assignLabel.isPending || removeLabel.isPending}
        >
          Salvar alterações
        </Button>
      </div>

      {/* Dialog de confirmação de notificação */}
      <AlertDialog open={showNotifyDialog} onOpenChange={setShowNotifyDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-green-600" />
              Notificar envolvidos?
            </AlertDialogTitle>
            <AlertDialogDescription>
              A demanda foi alterada com sucesso. Deseja notificar os envolvidos por WhatsApp sobre as seguintes alterações?
              <div className="mt-2 p-2 bg-muted rounded-md">
                <strong>Alterações:</strong> {pendingChanges.join(', ')}
              </div>
              <div className="mt-2 text-xs">
                {form.assignee_ids.length > 0 
                  ? `${form.assignee_ids.length} pessoa(s) será(ão) notificada(s).`
                  : `${(demand.assignees || []).length} pessoa(s) será(ão) notificada(s).`
                }
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleNotifySkip}>
              Não notificar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleNotifyConfirm} className="bg-green-600 hover:bg-green-700">
              <MessageSquare className="h-4 w-4 mr-2" />
              Sim, notificar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
