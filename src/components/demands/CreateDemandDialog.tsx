import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDemandColumns } from '@/hooks/useDemandBoards';
import { useCreateDemand } from '@/hooks/useDemands';
import { useUsers } from '@/hooks/useUsers';
import { URGENCY_CONFIG, type DemandUrgency } from '@/types/demand';
import { MultiSelect } from '@/components/MultiSelect';

interface CreateDemandDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardId: string;
  leadId?: string;
}

export function CreateDemandDialog({ open, onOpenChange, boardId, leadId }: CreateDemandDialogProps) {
  const { data: columns } = useDemandColumns(boardId);
  const { data: users } = useUsers();
  const createDemand = useCreateDemand();

  const [form, setForm] = useState({
    title: '',
    description: '',
    column_id: '',
    urgency: 'medium' as DemandUrgency,
    assignee_ids: [] as string[],
  });

  // Auto-select first column
  const columnId = form.column_id || columns?.[0]?.id || '';

  const handleSubmit = async () => {
    if (!form.title.trim() || !columnId) return;

    await createDemand.mutateAsync({
      board_id: boardId,
      column_id: columnId,
      title: form.title,
      description: form.description || undefined,
      urgency: form.urgency,
      assignee_ids: form.assignee_ids.length > 0 ? form.assignee_ids : undefined,
      lead_id: leadId,
    });

    setForm({
      title: '',
      description: '',
      column_id: '',
      urgency: 'medium',
      assignee_ids: [],
    });
    onOpenChange(false);
  };

  const userOptions = users?.map(u => ({
    value: u.id,
    label: `${u.first_name} ${u.last_name}`,
  })) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova Demanda</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Título *</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Título da demanda..."
            />
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Descreva a demanda em detalhes..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Coluna</Label>
              <Select value={columnId} onValueChange={(v) => setForm(prev => ({ ...prev, column_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {columns?.map(col => (
                    <SelectItem key={col.id} value={col.id}>
                      <div className="flex items-center gap-2">
                        {col.color && (
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: col.color }} />
                        )}
                        {col.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                  {(Object.keys(URGENCY_CONFIG) as DemandUrgency[]).map(key => (
                    <SelectItem key={key} value={key}>
                      <span className={URGENCY_CONFIG[key].color}>
                        {URGENCY_CONFIG[key].label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={!form.title.trim() || !columnId || createDemand.isPending}
          >
            Criar Demanda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
