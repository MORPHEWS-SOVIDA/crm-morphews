import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDemandColumns } from '@/hooks/useDemandBoards';
import { useCreateDemand } from '@/hooks/useDemands';
import { useUsers } from '@/hooks/useUsers';
import { useLeads } from '@/hooks/useLeads';
import { useAssignDemandLabel, useDemandLabels } from '@/hooks/useDemandDetails';
import { URGENCY_CONFIG, type DemandUrgency } from '@/types/demand';
import { MultiSelect } from '@/components/MultiSelect';
import { Check, ChevronsUpDown, User, Tag, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CreateDemandDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardId: string;
  leadId?: string;
}

export function CreateDemandDialog({ open, onOpenChange, boardId, leadId }: CreateDemandDialogProps) {
  const { data: columns } = useDemandColumns(boardId);
  const { data: users } = useUsers();
  const { data: leads } = useLeads();
  const { data: labels } = useDemandLabels();

  const createDemand = useCreateDemand();
  const assignLabel = useAssignDemandLabel();

  const [form, setForm] = useState({
    title: '',
    description: '',
    column_id: '',
    urgency: 'medium' as DemandUrgency,
    assignee_ids: [] as string[],
    label_ids: [] as string[],
    lead_id: leadId || '',
    due_at: '',
  });
  
  const [leadSearchOpen, setLeadSearchOpen] = useState(false);

  // Auto-select first column
  const columnId = form.column_id || columns?.[0]?.id || '';

  // Find selected lead
  const selectedLead = leads?.find(l => l.id === form.lead_id);

  const handleSubmit = async () => {
    if (!form.title.trim() || !columnId) return;

    const created = await createDemand.mutateAsync({
      board_id: boardId,
      column_id: columnId,
      title: form.title,
      description: form.description || undefined,
      urgency: form.urgency,
      assignee_ids: form.assignee_ids.length > 0 ? form.assignee_ids : undefined,
      lead_id: form.lead_id || leadId || undefined,
      due_at: form.due_at ? new Date(form.due_at).toISOString() : undefined,
    });

    if (form.label_ids.length > 0) {
      await Promise.all(
        form.label_ids.map((labelId) => assignLabel.mutateAsync({ demandId: created.id, labelId }))
      );
    }

    setForm({
      title: '',
      description: '',
      column_id: '',
      urgency: 'medium',
      assignee_ids: [],
      label_ids: [],
      lead_id: leadId || '',
      due_at: '',
    });
    onOpenChange(false);
  };

  const handleAddNewLead = () => {
    window.open('/leads/novo', '_blank');
  };

  // IMPORTANT: Demand assignees expect auth user id (profiles.user_id)
  const userOptions = users?.map(u => ({
    value: u.user_id,
    label: `${u.first_name} ${u.last_name}`,
  })) || [];

  const labelOptions = labels?.map(l => ({
    value: l.id,
    label: l.name,
  })) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>Nova Demanda</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 py-4">
          <div className="space-y-4">
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

            {/* Data de Entrega e Cliente/Lead na mesma linha */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data de Entrega</Label>
                <Input
                  type="datetime-local"
                  value={form.due_at}
                  onChange={(e) => setForm(prev => ({ ...prev, due_at: e.target.value }))}
                />
              </div>

              {/* Lead/Cliente selector - only show if not pre-selected */}
              {!leadId && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Cliente/Lead</Label>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm" 
                      onClick={handleAddNewLead}
                      className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Novo Lead
                    </Button>
                  </div>
                  <Popover open={leadSearchOpen} onOpenChange={setLeadSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={leadSearchOpen}
                        className="w-full justify-between"
                      >
                        {selectedLead ? (
                          <span className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            {selectedLead.name}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Selecione um cliente...</span>
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0">
                      <Command>
                        <CommandInput placeholder="Buscar cliente..." />
                        <CommandList>
                          <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                          <CommandGroup>
                            {leads?.slice(0, 50).map((lead) => (
                              <CommandItem
                                key={lead.id}
                                value={lead.name || ''}
                                onSelect={() => {
                                  setForm(prev => ({ ...prev, lead_id: lead.id }));
                                  setLeadSearchOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    form.lead_id === lead.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex flex-col">
                                  <span>{lead.name}</span>
                                  {lead.whatsapp && (
                                    <span className="text-xs text-muted-foreground">{lead.whatsapp}</span>
                                  )}
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>

            {/* Responsáveis e Etiquetas na mesma linha */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Responsáveis</Label>
                <MultiSelect
                  options={userOptions}
                  selected={form.assignee_ids}
                  onChange={(ids) => setForm(prev => ({ ...prev, assignee_ids: ids }))}
                  placeholder="Selecione responsáveis..."
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  Etiquetas
                </Label>
                <MultiSelect
                  options={labelOptions}
                  selected={form.label_ids}
                  onChange={(ids) => setForm(prev => ({ ...prev, label_ids: ids }))}
                  placeholder="Selecione etiquetas..."
                />
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="p-6 pt-0">
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
