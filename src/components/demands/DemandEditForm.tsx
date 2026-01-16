import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { MultiSelect } from '@/components/MultiSelect';
import { useUpdateDemand, useAddDemandAssignee, useRemoveDemandAssignee } from '@/hooks/useDemands';
import { useUsers } from '@/hooks/useUsers';
import { useAssignDemandLabel, useDemandLabels, useRemoveDemandLabel } from '@/hooks/useDemandDetails';
import { useToast } from '@/hooks/use-toast';
import { URGENCY_CONFIG, type DemandUrgency, type DemandWithRelations } from '@/types/demand';

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

  const userOptions = useMemo(
    () => (users || []).map(u => ({ value: u.user_id, label: `${u.first_name} ${u.last_name}` })),
    [users]
  );

  const labelOptions = useMemo(
    () => (labels || []).map(l => ({ value: l.id, label: l.name })),
    [labels]
  );

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

      onSaved();
    } catch (err) {
      toast({
        title: 'Erro ao salvar alterações',
        description: err instanceof Error ? err.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    }
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
    </div>
  );
}
