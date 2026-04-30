import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Plus, Pencil } from 'lucide-react';
import { RegistryShell } from './RegistryShell';
import {
  useFinancialEntities, useCreateFinancialEntity, useUpdateFinancialEntity, useToggleFinancialEntity,
  type FinancialEntity, type FinancialEntityType, type EntityInput,
} from '@/hooks/useFinancialV2';

const TYPES: { v: FinancialEntityType; label: string }[] = [
  { v: 'cnpj', label: 'CNPJ' }, { v: 'cpf', label: 'CPF' },
  { v: 'projeto', label: 'Projeto' }, { v: 'imovel', label: 'Imóvel' },
  { v: 'familia', label: 'Família' }, { v: 'carteira', label: 'Carteira' },
  { v: 'centro_operacional', label: 'Centro operacional' }, { v: 'outro', label: 'Outro' },
];

const empty: EntityInput = {
  name: '', entity_type: 'cnpj', document: '', legal_name: '',
  trade_name: '', responsible_name: '', phone: '', email: '', notes: '',
};

export function EntitiesTab() {
  const { data, isLoading } = useFinancialEntities();
  const createM = useCreateFinancialEntity();
  const updateM = useUpdateFinancialEntity();
  const toggleM = useToggleFinancialEntity();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [editing, setEditing] = useState<FinancialEntity | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<EntityInput>(empty);

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();
    return (data ?? []).filter(e => {
      if (typeFilter !== 'all' && e.entity_type !== typeFilter) return false;
      if (!term) return true;
      return (e.name + ' ' + (e.document ?? '') + ' ' + (e.legal_name ?? '') + ' ' + (e.trade_name ?? '')).toLowerCase().includes(term);
    });
  }, [data, search, typeFilter]);

  const openCreate = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (e: FinancialEntity) => {
    setEditing(e);
    setForm({
      name: e.name, entity_type: e.entity_type,
      document: e.document ?? '', legal_name: e.legal_name ?? '',
      trade_name: e.trade_name ?? '', responsible_name: e.responsible_name ?? '',
      phone: e.phone ?? '', email: e.email ?? '', notes: e.notes ?? '',
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
        title="Entidades financeiras"
        count={filtered.length}
        search={search}
        onSearchChange={setSearch}
        isLoading={isLoading}
        hasItems={filtered.length > 0}
        empty={data?.length ? 'Nada encontrado.' : 'Cadastre sua primeira entidade (CNPJ, CPF, projeto, imóvel...).'}
        filters={
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {TYPES.map(t => <SelectItem key={t.v} value={t.v}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        }
        actions={<Button size="sm" onClick={openCreate}><Plus className="w-4 h-4 mr-1" />Nova entidade</Button>}
      >
        <div className="grid gap-2">
          {filtered.map(e => (
            <div key={e.id} className="flex items-center gap-3 p-3 border rounded-md">
              <div className="w-3 h-3 rounded-full" style={{ background: e.color || 'hsl(var(--muted))' }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{e.name}</span>
                  <Badge variant="outline">{TYPES.find(t => t.v === e.entity_type)?.label ?? e.entity_type}</Badge>
                  {!e.is_active && <Badge variant="secondary">inativa</Badge>}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {[e.document, e.legal_name, e.responsible_name, e.phone, e.email].filter(Boolean).join(' · ') || '—'}
                </div>
              </div>
              <Switch
                checked={e.is_active}
                onCheckedChange={v => toggleM.mutate({ id: e.id, is_active: v })}
                aria-label="ativo"
              />
              <Button size="icon" variant="ghost" onClick={() => openEdit(e)}><Pencil className="w-4 h-4" /></Button>
            </div>
          ))}
        </div>
      </RegistryShell>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{editing ? 'Editar entidade' : 'Nova entidade'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nome (apelido) *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div>
                <Label>Tipo</Label>
                <Select value={form.entity_type} onValueChange={(v: FinancialEntityType) => setForm({ ...form, entity_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TYPES.map(t => <SelectItem key={t.v} value={t.v}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Documento</Label><Input value={form.document ?? ''} onChange={e => setForm({ ...form, document: e.target.value })} /></div>
              <div><Label>Nome fantasia</Label><Input value={form.trade_name ?? ''} onChange={e => setForm({ ...form, trade_name: e.target.value })} /></div>
            </div>
            <div><Label>Razão social / nome legal</Label><Input value={form.legal_name ?? ''} onChange={e => setForm({ ...form, legal_name: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Responsável</Label><Input value={form.responsible_name ?? ''} onChange={e => setForm({ ...form, responsible_name: e.target.value })} /></div>
              <div><Label>Telefone</Label><Input value={form.phone ?? ''} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>E-mail</Label><Input type="email" value={form.email ?? ''} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            </div>
            <div><Label>Observações</Label><Textarea value={form.notes ?? ''} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button disabled={!form.name || createM.isPending || updateM.isPending} onClick={submit}>
              {editing ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
