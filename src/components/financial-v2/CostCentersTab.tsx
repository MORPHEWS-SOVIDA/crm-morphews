import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Plus, Pencil, Layers } from 'lucide-react';
import { RegistryShell } from './RegistryShell';
import {
  useCostCentersV2, useCreateCostCenter, useUpdateCostCenter, useToggleCostCenter,
  useFinancialEntities, type CostCenter, type CostCenterInput,
} from '@/hooks/useFinancialV2';

const empty: CostCenterInput = {
  name: '', code: '', description: '', color: '',
  entity_id: null, position: 0,
};

export function CostCentersTab() {
  const { data, isLoading } = useCostCentersV2();
  const { data: entities } = useFinancialEntities();
  const createM = useCreateCostCenter();
  const updateM = useUpdateCostCenter();
  const toggleM = useToggleCostCenter();

  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CostCenter | null>(null);
  const [form, setForm] = useState<CostCenterInput>(empty);

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();
    return (data ?? []).filter(c => {
      if (entityFilter === 'none' && c.entity_id != null) return false;
      if (entityFilter !== 'all' && entityFilter !== 'none' && c.entity_id !== entityFilter) return false;
      if (!term) return true;
      return (c.name + ' ' + (c.code ?? '') + ' ' + (c.description ?? '')).toLowerCase().includes(term);
    });
  }, [data, search, entityFilter]);

  const openCreate = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (c: CostCenter) => {
    setEditing(c);
    setForm({
      name: c.name, code: c.code ?? '', description: c.description ?? '',
      color: c.color ?? '', entity_id: c.entity_id, position: c.position ?? 0,
    });
    setOpen(true);
  };

  const submit = async () => {
    if (editing) await updateM.mutateAsync({ id: editing.id, ...form });
    else await createM.mutateAsync(form);
    setOpen(false);
  };

  return (
    <>
      <RegistryShell
        title="Centros de custo"
        count={filtered.length}
        search={search}
        onSearchChange={setSearch}
        isLoading={isLoading}
        hasItems={filtered.length > 0}
        empty={data?.length ? 'Nada encontrado.' : 'Cadastre os centros de custo da operação.'}
        filters={
          <Select value={entityFilter} onValueChange={setEntityFilter}>
            <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as entidades</SelectItem>
              <SelectItem value="none">Sem entidade</SelectItem>
              {entities?.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
            </SelectContent>
          </Select>
        }
        actions={<Button size="sm" onClick={openCreate}><Plus className="w-4 h-4 mr-1" />Novo centro</Button>}
      >
        <div className="grid gap-2">
          {filtered.map(c => {
            const ent = entities?.find(e => e.id === c.entity_id);
            return (
              <div key={c.id} className="flex items-center gap-3 p-3 border rounded-md">
                <Layers className="w-4 h-4 text-muted-foreground" style={c.color ? { color: c.color } : undefined} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {c.code && <span className="text-xs font-mono text-muted-foreground">{c.code}</span>}
                    <span className="font-medium">{c.name}</span>
                    {ent && <Badge variant="outline">{ent.name}</Badge>}
                    {!c.is_active && <Badge variant="secondary">inativo</Badge>}
                  </div>
                  {c.description && <div className="text-xs text-muted-foreground truncate">{c.description}</div>}
                </div>
                <Switch checked={c.is_active} onCheckedChange={v => toggleM.mutate({ id: c.id, is_active: v })} aria-label="ativo" />
                <Button size="icon" variant="ghost" onClick={() => openEdit(c)}><Pencil className="w-4 h-4" /></Button>
              </div>
            );
          })}
        </div>
      </RegistryShell>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Editar centro' : 'Novo centro de custo'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2"><Label>Nome *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Código</Label><Input value={form.code ?? ''} onChange={e => setForm({ ...form, code: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Entidade</Label>
                <Select value={form.entity_id ?? '__none'} onValueChange={v => setForm({ ...form, entity_id: v === '__none' ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">— nenhuma —</SelectItem>
                    {entities?.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Cor</Label>
                <Input type="color" value={form.color || '#888888'} onChange={e => setForm({ ...form, color: e.target.value })} />
              </div>
            </div>
            <div><Label>Descrição</Label><Textarea value={form.description ?? ''} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <div>
              <Label>Posição</Label>
              <Input type="number" value={form.position ?? 0} onChange={e => setForm({ ...form, position: Number(e.target.value) })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button disabled={!form.name || createM.isPending || updateM.isPending} onClick={submit}>
              {editing ? 'Salvar' : 'Criar centro'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
