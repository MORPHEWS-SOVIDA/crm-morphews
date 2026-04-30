import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Plus, Pencil, Tags } from 'lucide-react';
import { RegistryShell } from './RegistryShell';
import {
  useFinancialSuppliers, useCreateFinancialSupplier, useUpdateFinancialSupplier, useToggleFinancialSupplier,
  useFinancialEntities, useFinancialCategoriesV2, useCostCentersV2,
  type FinancialSupplier, type SupplierInput,
} from '@/hooks/useFinancialV2';

const empty: SupplierInput = {
  name: '', trade_name: '', person_type: 'PJ', cnpj: '', cpf: '',
  email: '', phone: '', pix_key: '', pix_key_type: '',
  bank_name: '', bank_agency: '', bank_account: '', bank_account_type: '',
  default_category_id: null, default_cost_center_id: null, entity_id: null, notes: '',
};

export function SuppliersTab() {
  const { data, isLoading } = useFinancialSuppliers();
  const { data: entities } = useFinancialEntities();
  const { data: cats } = useFinancialCategoriesV2(true);
  const { data: ccs } = useCostCentersV2(true);
  const createM = useCreateFinancialSupplier();
  const updateM = useUpdateFinancialSupplier();
  const toggleM = useToggleFinancialSupplier();

  const [search, setSearch] = useState('');
  const [personFilter, setPersonFilter] = useState<string>('all');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FinancialSupplier | null>(null);
  const [form, setForm] = useState<SupplierInput>(empty);

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();
    return (data ?? []).filter(s => {
      if (personFilter !== 'all' && s.person_type !== personFilter) return false;
      if (entityFilter !== 'all' && s.entity_id !== entityFilter) return false;
      if (!term) return true;
      return (s.name + ' ' + (s.trade_name ?? '') + ' ' + (s.cnpj ?? '') + ' ' + (s.cpf ?? '') + ' ' + (s.email ?? '')).toLowerCase().includes(term);
    });
  }, [data, search, personFilter, entityFilter]);

  const openCreate = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (s: FinancialSupplier) => {
    setEditing(s);
    setForm({
      name: s.name, trade_name: s.trade_name ?? '', person_type: s.person_type ?? 'PJ',
      cnpj: s.cnpj ?? '', cpf: s.cpf ?? '', email: s.email ?? '', phone: s.phone ?? '',
      pix_key: s.pix_key ?? '', pix_key_type: s.pix_key_type ?? '',
      bank_name: s.bank_name ?? '', bank_agency: s.bank_agency ?? '', bank_account: s.bank_account ?? '',
      bank_account_type: s.bank_account_type ?? '',
      default_category_id: s.default_category_id, default_cost_center_id: s.default_cost_center_id,
      entity_id: s.entity_id, notes: s.notes ?? '',
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
        title="Fornecedores"
        count={filtered.length}
        search={search}
        onSearchChange={setSearch}
        isLoading={isLoading}
        hasItems={filtered.length > 0}
        empty={data?.length ? 'Nada encontrado.' : 'Cadastre seu primeiro fornecedor (PF ou PJ).'}
        filters={
          <>
            <Select value={personFilter} onValueChange={setPersonFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="PF">Pessoa física</SelectItem>
                <SelectItem value="PJ">Pessoa jurídica</SelectItem>
              </SelectContent>
            </Select>
            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as entidades</SelectItem>
                {entities?.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </>
        }
        actions={<Button size="sm" onClick={openCreate}><Plus className="w-4 h-4 mr-1" />Novo fornecedor</Button>}
      >
        <div className="grid gap-2">
          {filtered.map(s => (
            <div key={s.id} className="flex items-center gap-3 p-3 border rounded-md">
              <Tags className="w-4 h-4 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{s.name}</span>
                  {s.person_type && <Badge variant="outline">{s.person_type}</Badge>}
                  {!s.is_active && <Badge variant="secondary">inativo</Badge>}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {[s.cnpj || s.cpf, s.email, s.phone, s.pix_key && `PIX: ${s.pix_key}`].filter(Boolean).join(' · ') || '—'}
                </div>
              </div>
              <Switch checked={s.is_active} onCheckedChange={v => toggleM.mutate({ id: s.id, is_active: v })} aria-label="ativo" />
              <Button size="icon" variant="ghost" onClick={() => openEdit(s)}><Pencil className="w-4 h-4" /></Button>
            </div>
          ))}
        </div>
      </RegistryShell>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar fornecedor' : 'Novo fornecedor'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2"><Label>Nome *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div>
                <Label>Tipo</Label>
                <Select value={form.person_type ?? 'PJ'} onValueChange={v => setForm({ ...form, person_type: v as 'PF' | 'PJ' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PF">Pessoa física</SelectItem>
                    <SelectItem value="PJ">Pessoa jurídica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Razão social</Label><Input value={form.trade_name ?? ''} onChange={e => setForm({ ...form, trade_name: e.target.value })} /></div>
              <div>
                <Label>{form.person_type === 'PF' ? 'CPF' : 'CNPJ'}</Label>
                <Input
                  value={(form.person_type === 'PF' ? form.cpf : form.cnpj) ?? ''}
                  onChange={e => setForm(form.person_type === 'PF' ? { ...form, cpf: e.target.value, cnpj: '' } : { ...form, cnpj: e.target.value, cpf: '' })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>E-mail</Label><Input type="email" value={form.email ?? ''} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Telefone</Label><Input value={form.phone ?? ''} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo de PIX</Label>
                <Select value={form.pix_key_type ?? '__none'} onValueChange={v => setForm({ ...form, pix_key_type: v === '__none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">— nenhum —</SelectItem>
                    <SelectItem value="cpf">CPF</SelectItem>
                    <SelectItem value="cnpj">CNPJ</SelectItem>
                    <SelectItem value="email">E-mail</SelectItem>
                    <SelectItem value="phone">Telefone</SelectItem>
                    <SelectItem value="random">Chave aleatória</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Chave PIX</Label><Input value={form.pix_key ?? ''} onChange={e => setForm({ ...form, pix_key: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Banco</Label><Input value={form.bank_name ?? ''} onChange={e => setForm({ ...form, bank_name: e.target.value })} /></div>
              <div><Label>Agência</Label><Input value={form.bank_agency ?? ''} onChange={e => setForm({ ...form, bank_agency: e.target.value })} /></div>
              <div><Label>Conta</Label><Input value={form.bank_account ?? ''} onChange={e => setForm({ ...form, bank_account: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Categoria padrão</Label>
                <Select value={form.default_category_id ?? '__none'} onValueChange={v => setForm({ ...form, default_category_id: v === '__none' ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">— nenhuma —</SelectItem>
                    {cats?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Centro de custo padrão</Label>
                <Select value={form.default_cost_center_id ?? '__none'} onValueChange={v => setForm({ ...form, default_cost_center_id: v === '__none' ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">— nenhum —</SelectItem>
                    {ccs?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Entidade padrão</Label>
                <Select value={form.entity_id ?? '__none'} onValueChange={v => setForm({ ...form, entity_id: v === '__none' ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">— nenhuma —</SelectItem>
                    {entities?.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Observações</Label><Textarea value={form.notes ?? ''} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button disabled={!form.name || createM.isPending || updateM.isPending} onClick={submit}>
              {editing ? 'Salvar' : 'Criar fornecedor'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
