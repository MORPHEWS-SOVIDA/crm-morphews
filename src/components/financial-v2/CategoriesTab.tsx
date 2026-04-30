import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Pencil, ListTree } from 'lucide-react';
import { RegistryShell } from './RegistryShell';
import {
  useFinancialCategoriesV2, useCreateFinancialCategory, useUpdateFinancialCategory, useToggleFinancialCategory,
  type FinancialCategory, type CategoryInput,
} from '@/hooks/useFinancialV2';

const TYPES = [
  { v: 'income', label: 'Receita' },
  { v: 'expense', label: 'Despesa' },
  { v: 'transfer', label: 'Transferência' },
  { v: 'tax', label: 'Imposto' },
  { v: 'fee', label: 'Taxa' },
  { v: 'cost', label: 'Custo' },
  { v: 'investment', label: 'Investimento' },
  { v: 'adjustment', label: 'Ajuste' },
];

const DRE_GROUPS = [
  'receita_bruta','deducoes','receita_liquida','custo_produto','custo_servico',
  'despesa_operacional','despesa_administrativa','despesa_comercial',
  'despesa_financeira','receita_financeira','imposto_lucro','outros',
];

const empty: CategoryInput = {
  name: '', type: 'expense', dre_group: null, code: '', parent_id: null,
  is_fixed: false, affects_dre: true, affects_cashflow: true, position: 0,
};

export function CategoriesTab() {
  const { data, isLoading } = useFinancialCategoriesV2();
  const createM = useCreateFinancialCategory();
  const updateM = useUpdateFinancialCategory();
  const toggleM = useToggleFinancialCategory();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [dreFilter, setDreFilter] = useState<string>('all');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FinancialCategory | null>(null);
  const [form, setForm] = useState<CategoryInput>(empty);

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();
    return (data ?? []).filter(c => {
      if (typeFilter !== 'all' && c.type !== typeFilter) return false;
      if (dreFilter !== 'all' && c.dre_group !== dreFilter) return false;
      if (!term) return true;
      return (c.name + ' ' + (c.code ?? '')).toLowerCase().includes(term);
    });
  }, [data, search, typeFilter, dreFilter]);

  const openCreate = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (c: FinancialCategory) => {
    setEditing(c);
    setForm({
      name: c.name, type: c.type, dre_group: c.dre_group, code: c.code ?? '',
      parent_id: c.parent_id, is_fixed: !!c.is_fixed, affects_dre: c.affects_dre ?? true,
      affects_cashflow: c.affects_cashflow ?? true, position: c.position ?? 0,
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
        title="Categorias financeiras"
        count={filtered.length}
        search={search}
        onSearchChange={setSearch}
        isLoading={isLoading}
        hasItems={filtered.length > 0}
        empty={data?.length ? 'Nada encontrado.' : 'Cadastre as categorias do plano de contas.'}
        filters={
          <>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                {TYPES.map(t => <SelectItem key={t.v} value={t.v}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={dreFilter} onValueChange={setDreFilter}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os grupos DRE</SelectItem>
                {DRE_GROUPS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
          </>
        }
        actions={<Button size="sm" onClick={openCreate}><Plus className="w-4 h-4 mr-1" />Nova categoria</Button>}
      >
        <div className="grid gap-2">
          {filtered.map(c => (
            <div key={c.id} className="flex items-center gap-3 p-3 border rounded-md">
              <ListTree className="w-4 h-4 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {c.code && <span className="text-xs font-mono text-muted-foreground">{c.code}</span>}
                  <span className="font-medium">{c.name}</span>
                  <Badge variant="outline">{TYPES.find(t => t.v === c.type)?.label ?? c.type}</Badge>
                  {c.dre_group && <Badge variant="secondary">{c.dre_group}</Badge>}
                  {c.is_fixed && <Badge variant="outline">fixa</Badge>}
                  {!c.is_active && <Badge variant="secondary">inativa</Badge>}
                </div>
              </div>
              <Switch checked={c.is_active} onCheckedChange={v => toggleM.mutate({ id: c.id, is_active: v })} aria-label="ativo" />
              <Button size="icon" variant="ghost" onClick={() => openEdit(c)}><Pencil className="w-4 h-4" /></Button>
            </div>
          ))}
        </div>
      </RegistryShell>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{editing ? 'Editar categoria' : 'Nova categoria'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2"><Label>Nome *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Código</Label><Input value={form.code ?? ''} onChange={e => setForm({ ...form, code: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo *</Label>
                <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TYPES.map(t => <SelectItem key={t.v} value={t.v}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Grupo DRE</Label>
                <Select value={form.dre_group ?? '__none'} onValueChange={v => setForm({ ...form, dre_group: v === '__none' ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">— nenhum —</SelectItem>
                    {DRE_GROUPS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={!!form.is_fixed} onCheckedChange={v => setForm({ ...form, is_fixed: !!v })} />
                Custo fixo
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={form.affects_dre !== false} onCheckedChange={v => setForm({ ...form, affects_dre: !!v })} />
                Entra no DRE
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={form.affects_cashflow !== false} onCheckedChange={v => setForm({ ...form, affects_cashflow: !!v })} />
                Entra no fluxo de caixa
              </label>
            </div>
            <div>
              <Label>Posição</Label>
              <Input type="number" value={form.position ?? 0} onChange={e => setForm({ ...form, position: Number(e.target.value) })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button disabled={!form.name || createM.isPending || updateM.isPending} onClick={submit}>
              {editing ? 'Salvar' : 'Criar categoria'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
