import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Plus, Pencil, Star, Landmark } from 'lucide-react';
import { RegistryShell } from './RegistryShell';
import {
  useFinancialBankAccounts, useCreateFinancialBankAccount, useUpdateFinancialBankAccount,
  useToggleFinancialBankAccount, useSetDefaultBankAccount, useFinancialEntities,
  type FinancialBankAccount, type BankAccountInput,
} from '@/hooks/useFinancialV2';

const ACCOUNT_TYPES = [
  { v: 'corrente', label: 'Corrente' },
  { v: 'poupanca', label: 'Poupança' },
  { v: 'pagamento', label: 'Pagamento' },
  { v: 'investimento', label: 'Investimento' },
  { v: 'caixa', label: 'Dinheiro / cofre' },
  { v: 'gateway', label: 'Gateway' },
  { v: 'cartao', label: 'Cartão' },
];

const fmt = (cents: number | null | undefined) =>
  ((cents ?? 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const empty: BankAccountInput = {
  name: '', entity_id: null, bank_name: '', bank_code: '',
  agency: '', account_number: '', account_type: 'corrente',
  initial_balance_cents: 0, balance_date: null, color: '', notes: '',
  is_default: false,
};

export function BanksTab() {
  const { data: banks, isLoading } = useFinancialBankAccounts(true);
  const { data: entities } = useFinancialEntities();
  const createM = useCreateFinancialBankAccount();
  const updateM = useUpdateFinancialBankAccount();
  const toggleM = useToggleFinancialBankAccount();
  const setDefault = useSetDefaultBankAccount();

  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FinancialBankAccount | null>(null);
  const [form, setForm] = useState<BankAccountInput>(empty);
  const [initialReais, setInitialReais] = useState('0');

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();
    return (banks ?? []).filter(b => {
      if (entityFilter === 'none' && b.entity_id != null) return false;
      if (entityFilter !== 'all' && entityFilter !== 'none' && b.entity_id !== entityFilter) return false;
      if (!term) return true;
      return (b.name + ' ' + (b.bank_name ?? '') + ' ' + (b.account_number ?? '')).toLowerCase().includes(term);
    });
  }, [banks, search, entityFilter]);

  const openCreate = () => { setEditing(null); setForm(empty); setInitialReais('0'); setOpen(true); };
  const openEdit = (b: FinancialBankAccount) => {
    setEditing(b);
    setForm({
      name: b.name, entity_id: b.entity_id, bank_name: b.bank_name ?? '',
      bank_code: b.bank_code ?? '', agency: b.agency ?? '', account_number: b.account_number ?? '',
      account_type: b.account_type, initial_balance_cents: b.initial_balance_cents ?? 0,
      balance_date: b.balance_date, color: b.color ?? '', notes: b.notes ?? '',
      is_default: b.is_default,
    });
    setInitialReais(((b.initial_balance_cents ?? 0) / 100).toFixed(2));
    setOpen(true);
  };

  const submit = async () => {
    const payload = {
      ...form,
      initial_balance_cents: Math.round(parseFloat(initialReais || '0') * 100),
    };
    if (editing) await updateM.mutateAsync({ id: editing.id, ...payload });
    else await createM.mutateAsync(payload);
    setOpen(false);
  };

  return (
    <>
      <RegistryShell
        title="Contas bancárias"
        count={filtered.length}
        search={search}
        onSearchChange={setSearch}
        isLoading={isLoading}
        hasItems={filtered.length > 0}
        empty={banks?.length ? 'Nada encontrado.' : 'Crie a primeira conta para registrar pagamentos.'}
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
        actions={<Button size="sm" onClick={openCreate}><Plus className="w-4 h-4 mr-1" />Nova conta</Button>}
      >
        <div className="grid gap-2">
          {filtered.map(b => {
            const ent = entities?.find(e => e.id === b.entity_id);
            return (
              <div key={b.id} className="flex items-center gap-3 p-3 border rounded-md">
                <Landmark className="w-4 h-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{b.name}</span>
                    <Badge variant="outline">{ACCOUNT_TYPES.find(t => t.v === b.account_type)?.label ?? b.account_type}</Badge>
                    {b.is_default && <Badge>padrão</Badge>}
                    {!b.is_active && <Badge variant="secondary">inativa</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {[b.bank_name, b.agency && `ag ${b.agency}`, b.account_number && `cc ${b.account_number}`, ent?.name]
                      .filter(Boolean).join(' · ') || '—'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm">{fmt(b.current_balance_cents)}</div>
                  <div className="text-[10px] text-muted-foreground">inicial {fmt(b.initial_balance_cents)}</div>
                </div>
                <Button
                  size="icon"
                  variant={b.is_default ? 'default' : 'ghost'}
                  onClick={() => setDefault.mutate(b.id)}
                  title="Marcar como padrão"
                >
                  <Star className="w-4 h-4" />
                </Button>
                <Switch checked={b.is_active} onCheckedChange={v => toggleM.mutate({ id: b.id, is_active: v })} aria-label="ativo" />
                <Button size="icon" variant="ghost" onClick={() => openEdit(b)}><Pencil className="w-4 h-4" /></Button>
              </div>
            );
          })}
        </div>
      </RegistryShell>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? 'Editar conta' : 'Nova conta bancária'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Apelido *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Itaú PJ MORPHEWS" /></div>
              <div>
                <Label>Entidade vinculada</Label>
                <Select value={form.entity_id ?? '__none'} onValueChange={v => setForm({ ...form, entity_id: v === '__none' ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">— sem entidade —</SelectItem>
                    {entities?.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Banco</Label><Input value={form.bank_name ?? ''} onChange={e => setForm({ ...form, bank_name: e.target.value })} /></div>
              <div><Label>Código</Label><Input value={form.bank_code ?? ''} onChange={e => setForm({ ...form, bank_code: e.target.value })} /></div>
              <div>
                <Label>Tipo</Label>
                <Select value={form.account_type ?? 'corrente'} onValueChange={v => setForm({ ...form, account_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ACCOUNT_TYPES.map(t => <SelectItem key={t.v} value={t.v}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Agência</Label><Input value={form.agency ?? ''} onChange={e => setForm({ ...form, agency: e.target.value })} /></div>
              <div><Label>Conta</Label><Input value={form.account_number ?? ''} onChange={e => setForm({ ...form, account_number: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Saldo inicial (R$)</Label>
                <Input type="number" step="0.01" value={initialReais} onChange={e => setInitialReais(e.target.value)} disabled={!!editing} />
              </div>
              <div>
                <Label>Data do saldo inicial</Label>
                <Input type="date" value={form.balance_date ?? ''} onChange={e => setForm({ ...form, balance_date: e.target.value || null })} disabled={!!editing} />
              </div>
              <div>
                <Label>Cor</Label>
                <Input type="color" value={form.color || '#888888'} onChange={e => setForm({ ...form, color: e.target.value })} />
              </div>
            </div>
            <div><Label>Observações</Label><Textarea value={form.notes ?? ''} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button disabled={!form.name || createM.isPending || updateM.isPending} onClick={submit}>
              {editing ? 'Salvar' : 'Criar conta'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
