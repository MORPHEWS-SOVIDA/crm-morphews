import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Loader2, Plus, CheckCircle2, XCircle, Copy, Paperclip,
  AlertTriangle, CalendarDays, CalendarClock, Wallet, Search, FileText, Trash2, Download,
} from 'lucide-react';
import {
  usePayables, usePayablesSummary, useCreatePayable, useDuplicatePayable,
  useRegisterPayment, useCancelTransaction, useFinancialEntities, useFinancialBankAccounts,
  useFinancialCategoriesV2, useCostCentersV2, useFinancialSuppliers,
  useTransactionAttachments, useUploadAttachment, useDeleteAttachment, getAttachmentSignedUrl,
  type PayableRow, type PayableQuickFilter, type PayableFilters, type FinancialTxStatus,
} from '@/hooks/useFinancialV2';

const fmt = (cents: number | null | undefined) =>
  cents == null ? '—' : (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const STATUS_VARIANTS: Record<FinancialTxStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  previsto: 'outline', pendente_aprovacao: 'outline', aprovado: 'secondary',
  realizado: 'default', conciliado: 'default',
  cancelado: 'destructive', estornado: 'destructive', vencido: 'destructive',
  pago_parcial: 'secondary',
};

const QUICK_FILTERS: { key: PayableQuickFilter; label: string }[] = [
  { key: 'overdue', label: 'Vencidas' },
  { key: 'today', label: 'Hoje' },
  { key: 'next7', label: 'Próx. 7 dias' },
  { key: 'next30', label: 'Próx. 30 dias' },
  { key: 'open', label: 'Abertas' },
  { key: 'paid', label: 'Pagas' },
  { key: 'cancelled', label: 'Canceladas' },
  { key: 'all', label: 'Todas' },
];

const today = () => new Date().toISOString().slice(0, 10);
const isOverdue = (r: PayableRow) =>
  r.due_date && r.due_date < today() &&
  !['realizado', 'conciliado', 'cancelado', 'estornado'].includes(r.status);

export function PayablesTab() {
  const [filters, setFilters] = useState<PayableFilters>({ quick: 'open' });

  const { data: rows, isLoading } = usePayables(filters);
  const { data: summary } = usePayablesSummary();
  const { data: entities } = useFinancialEntities();
  const { data: suppliers } = useFinancialSuppliers(true);
  const { data: categories } = useFinancialCategoriesV2(true);
  const { data: ccs } = useCostCentersV2(true);
  const { data: banks } = useFinancialBankAccounts();

  const expenseCats = useMemo(
    () => (categories ?? []).filter(c => c.type === 'expense'),
    [categories]
  );

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [paying, setPaying] = useState<PayableRow | null>(null);
  const [duplicating, setDuplicating] = useState<PayableRow | null>(null);
  const [cancelling, setCancelling] = useState<PayableRow | null>(null);
  const [attachmentsFor, setAttachmentsFor] = useState<PayableRow | null>(null);

  return (
    <div className="space-y-4">
      {/* Cards de indicadores */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <SummaryCard icon={AlertTriangle} label="Vencido" value={summary?.overdue_cents ?? 0} tone="danger" />
        <SummaryCard icon={CalendarClock} label="Hoje" value={summary?.today_cents ?? 0} tone="warn" />
        <SummaryCard icon={CalendarDays} label="Próx. 7 dias" value={summary?.next7_cents ?? 0} />
        <SummaryCard icon={CalendarDays} label="Próx. 30 dias" value={summary?.next30_cents ?? 0} />
        <SummaryCard icon={Wallet} label="Pago no mês" value={summary?.paid_month_cents ?? 0} tone="success" />
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Contas a Pagar {rows && <span className="text-xs font-normal text-muted-foreground">({rows.length})</span>}</CardTitle>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-1" /> Nova conta
            </Button>
          </div>

          {/* Quick filters */}
          <div className="flex flex-wrap gap-1">
            {QUICK_FILTERS.map(f => (
              <Button
                key={f.key}
                size="sm"
                variant={filters.quick === f.key ? 'default' : 'outline'}
                onClick={() => setFilters(p => ({ ...p, quick: f.key }))}
              >
                {f.label}
              </Button>
            ))}
          </div>

          {/* Filtros avançados */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
            <div className="relative col-span-2 md:col-span-2">
              <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                value={filters.search ?? ''}
                onChange={e => setFilters(p => ({ ...p, search: e.target.value || undefined }))}
                placeholder="Pesquisar descrição..."
                className="pl-8"
              />
            </div>
            <FilterSelect
              value={filters.entity_id} onChange={v => setFilters(p => ({ ...p, entity_id: v }))}
              placeholder="Entidade" options={(entities ?? []).map(e => ({ value: e.id, label: e.name }))}
            />
            <FilterSelect
              value={filters.supplier_id} onChange={v => setFilters(p => ({ ...p, supplier_id: v }))}
              placeholder="Fornecedor" options={(suppliers ?? []).map(s => ({ value: s.id, label: s.name }))}
            />
            <FilterSelect
              value={filters.category_id} onChange={v => setFilters(p => ({ ...p, category_id: v }))}
              placeholder="Categoria" options={expenseCats.map(c => ({ value: c.id, label: c.name }))}
            />
            <FilterSelect
              value={filters.cost_center_id} onChange={v => setFilters(p => ({ ...p, cost_center_id: v }))}
              placeholder="Centro custo" options={(ccs ?? []).map(c => ({ value: c.id, label: c.name }))}
            />
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : !rows?.length ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma conta encontrada com esses filtros.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Entidade</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Centro</TableHead>
                    <TableHead className="text-right">Previsto</TableHead>
                    <TableHead className="text-right">Pago</TableHead>
                    <TableHead className="text-right">Δ</TableHead>
                    <TableHead>Banco</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(r => {
                    const overdue = isOverdue(r);
                    const isClosed = ['realizado', 'conciliado', 'cancelado', 'estornado'].includes(r.status);
                    return (
                      <TableRow key={r.id}>
                        <TableCell className={overdue ? 'text-destructive font-medium' : ''}>
                          {r.due_date ?? '—'}
                        </TableCell>
                        <TableCell className="max-w-[260px] truncate">{r.description}</TableCell>
                        <TableCell className="text-xs">{r.entity?.name ?? '—'}</TableCell>
                        <TableCell className="text-xs">{r.supplier?.name ?? '—'}</TableCell>
                        <TableCell className="text-xs">{r.category?.name ?? '—'}</TableCell>
                        <TableCell className="text-xs">{r.cost_center?.name ?? '—'}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{fmt(r.expected_amount_cents)}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{fmt(r.actual_amount_cents)}</TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground">
                          {r.difference_amount_cents != null ? fmt(r.difference_amount_cents) : '—'}
                        </TableCell>
                        <TableCell className="text-xs">{r.bank_account?.name ?? '—'}</TableCell>
                        <TableCell>
                          <Badge variant={overdue ? 'destructive' : STATUS_VARIANTS[r.status]}>
                            {overdue ? 'vencido' : r.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          {!isClosed && (
                            <Button size="icon" variant="ghost" title="Pagar" onClick={() => setPaying(r)}>
                              <CheckCircle2 className="w-4 h-4 text-green-600" />
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" title="Duplicar" onClick={() => setDuplicating(r)}>
                            <Copy className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" title="Anexos" onClick={() => setAttachmentsFor(r)}>
                            <Paperclip className="w-4 h-4" />
                          </Button>
                          {!isClosed && (
                            <Button size="icon" variant="ghost" title="Cancelar" onClick={() => setCancelling(r)}>
                              <XCircle className="w-4 h-4 text-destructive" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <CreatePayableDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <PayDialog payable={paying} onClose={() => setPaying(null)} />
      <DuplicateDialog payable={duplicating} onClose={() => setDuplicating(null)} />
      <CancelDialog payable={cancelling} onClose={() => setCancelling(null)} />
      <AttachmentsDialog payable={attachmentsFor} onClose={() => setAttachmentsFor(null)} />
    </div>
  );
}

// ===================== Subcomponents =====================

function SummaryCard({
  icon: Icon, label, value, tone,
}: { icon: any; label: string; value: number; tone?: 'danger' | 'warn' | 'success' }) {
  const toneCls =
    tone === 'danger' ? 'text-destructive' :
    tone === 'warn' ? 'text-amber-600' :
    tone === 'success' ? 'text-green-600' : '';
  return (
    <Card>
      <CardContent className="p-4 space-y-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Icon className="w-4 h-4" /> {label}
        </div>
        <div className={`text-lg font-bold ${toneCls}`}>{fmt(value)}</div>
      </CardContent>
    </Card>
  );
}

function FilterSelect({
  value, onChange, placeholder, options,
}: {
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  placeholder: string;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value ?? '__all__'} onValueChange={v => onChange(v === '__all__' ? undefined : v)}>
      <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        <SelectItem value="__all__">{placeholder}: todos</SelectItem>
        {options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

// ----- Create -----
function CreatePayableDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreatePayable();
  const { data: entities } = useFinancialEntities();
  const { data: suppliers } = useFinancialSuppliers(true);
  const { data: categories } = useFinancialCategoriesV2(true);
  const { data: ccs } = useCostCentersV2(true);
  const { data: banks } = useFinancialBankAccounts();

  const expenseCats = useMemo(() => (categories ?? []).filter(c => c.type === 'expense'), [categories]);

  const [form, setForm] = useState({
    entity_id: '', supplier_id: '', category_id: '', cost_center_id: '', bank_account_id: '',
    description: '', amount_reais: '', due_date: '', competence_date: '',
    document_number: '', notes: '',
    recurrent: false, months: '1', day: '',
  });

  const reset = () => setForm({
    entity_id: '', supplier_id: '', category_id: '', cost_center_id: '', bank_account_id: '',
    description: '', amount_reais: '', due_date: '', competence_date: '',
    document_number: '', notes: '',
    recurrent: false, months: '1', day: '',
  });

  const canSubmit = form.entity_id && form.description && form.amount_reais && form.due_date;

  return (
    <Dialog open={open} onOpenChange={v => !v && (onClose(), reset())}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Nova conta a pagar</DialogTitle></DialogHeader>
        <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Entidade *">
              <Select value={form.entity_id} onValueChange={v => setForm({ ...form, entity_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {entities?.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Fornecedor">
              <Select value={form.supplier_id || '__none__'} onValueChange={v => setForm({ ...form, supplier_id: v === '__none__' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem fornecedor</SelectItem>
                  {suppliers?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Descrição *">
            <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoria">
              <Select value={form.category_id || '__none__'} onValueChange={v => setForm({ ...form, category_id: v === '__none__' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem categoria</SelectItem>
                  {expenseCats.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Centro de custo">
              <Select value={form.cost_center_id || '__none__'} onValueChange={v => setForm({ ...form, cost_center_id: v === '__none__' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem centro</SelectItem>
                  {ccs?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Valor previsto (R$) *">
              <Input type="number" step="0.01" value={form.amount_reais} onChange={e => setForm({ ...form, amount_reais: e.target.value })} />
            </Field>
            <Field label="Vencimento *">
              <Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
            </Field>
            <Field label="Competência">
              <Input type="date" value={form.competence_date} onChange={e => setForm({ ...form, competence_date: e.target.value })} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Banco previsto">
              <Select value={form.bank_account_id || '__none__'} onValueChange={v => setForm({ ...form, bank_account_id: v === '__none__' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Definir ao pagar</SelectItem>
                  {banks?.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Documento (NF / boleto)">
              <Input value={form.document_number} onChange={e => setForm({ ...form, document_number: e.target.value })} />
            </Field>
          </div>

          <Field label="Observações">
            <Textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </Field>

          {/* Recorrência */}
          <div className="border rounded-md p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox id="rec" checked={form.recurrent} onCheckedChange={v => setForm({ ...form, recurrent: !!v })} />
              <Label htmlFor="rec" className="cursor-pointer">Repetir mensalmente</Label>
            </div>
            {form.recurrent && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Quantidade de meses">
                  <Input type="number" min={1} max={36} value={form.months} onChange={e => setForm({ ...form, months: e.target.value })} />
                </Field>
                <Field label="Dia de vencimento (1-31, opcional)">
                  <Input type="number" min={1} max={31} value={form.day} placeholder="igual ao 1º vencimento"
                    onChange={e => setForm({ ...form, day: e.target.value })} />
                </Field>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => { onClose(); reset(); }}>Cancelar</Button>
          <Button
            disabled={!canSubmit || create.isPending}
            onClick={async () => {
              await create.mutateAsync({
                entity_id: form.entity_id,
                supplier_id: form.supplier_id || null,
                category_id: form.category_id || null,
                cost_center_id: form.cost_center_id || null,
                bank_account_id: form.bank_account_id || null,
                description: form.description,
                expected_amount_cents: Math.round(parseFloat(form.amount_reais) * 100),
                due_date: form.due_date,
                competence_date: form.competence_date || null,
                document_number: form.document_number || null,
                notes: form.notes || null,
                recurrence_months: form.recurrent ? Math.max(1, parseInt(form.months || '1', 10)) : 1,
                recurrence_day: form.recurrent && form.day ? parseInt(form.day, 10) : undefined,
              });
              onClose(); reset();
            }}
          >Criar previsto</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label>{label}</Label>{children}</div>;
}

// ----- Pay -----
function PayDialog({ payable, onClose }: { payable: PayableRow | null; onClose: () => void }) {
  const register = useRegisterPayment();
  const { data: banks } = useFinancialBankAccounts();
  const [actualReais, setActualReais] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');
  const [paidAt, setPaidAt] = useState(today());
  const [diffReason, setDiffReason] = useState('');
  const [diffNotes, setDiffNotes] = useState('');

  // initialize on open
  useMemo(() => {
    if (payable) {
      setActualReais(((payable.expected_amount_cents ?? 0) / 100).toFixed(2));
      setBankAccountId(payable.bank_account_id ?? banks?.find(b => b.is_default)?.id ?? '');
      setPaidAt(today());
      setDiffReason(''); setDiffNotes('');
    }
  }, [payable?.id]);

  if (!payable) return null;
  const expected = payable.expected_amount_cents ?? 0;
  const actual = Math.round(parseFloat(actualReais || '0') * 100);
  const diff = actual - expected;
  const hasDiff = !!actualReais && diff !== 0;
  const canSubmit = !!actualReais && !!bankAccountId && !!paidAt && (!hasDiff || !!diffReason);

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Registrar pagamento</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">{payable.description}</div>
          <Field label="Valor previsto"><Input value={fmt(expected)} disabled /></Field>
          <Field label="Conta bancária *">
            <Select value={bankAccountId} onValueChange={setBankAccountId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {banks?.map(b => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}{b.bank_name ? ` · ${b.bank_name}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data do pagamento *">
              <Input type="date" value={paidAt} onChange={e => setPaidAt(e.target.value)} />
            </Field>
            <Field label="Valor pago (R$) *">
              <Input type="number" step="0.01" value={actualReais} onChange={e => setActualReais(e.target.value)} />
            </Field>
          </div>
          {hasDiff && (
            <>
              <Field label={`Motivo da diferença * (${fmt(diff)})`}>
                <Select value={diffReason} onValueChange={setDiffReason}>
                  <SelectTrigger><SelectValue placeholder="Obrigatório" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desconto">Desconto</SelectItem>
                    <SelectItem value="juros">Juros</SelectItem>
                    <SelectItem value="multa">Multa</SelectItem>
                    <SelectItem value="correcao">Correção</SelectItem>
                    <SelectItem value="pagamento_parcial">Pagamento parcial</SelectItem>
                    <SelectItem value="erro">Erro</SelectItem>
                    <SelectItem value="ajuste_manual">Ajuste manual</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Observação da diferença">
                <Textarea rows={2} value={diffNotes} onChange={e => setDiffNotes(e.target.value)} />
              </Field>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={!canSubmit || register.isPending}
            onClick={async () => {
              await register.mutateAsync({
                transaction_id: payable.id,
                bank_account_id: bankAccountId,
                actual_amount_cents: actual,
                paid_at: new Date(paidAt + 'T12:00:00').toISOString(),
                difference_reason: hasDiff ? diffReason : undefined,
                difference_notes: hasDiff ? (diffNotes || undefined) : undefined,
              });
              onClose();
            }}
          >Confirmar pagamento</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ----- Duplicate -----
function DuplicateDialog({ payable, onClose }: { payable: PayableRow | null; onClose: () => void }) {
  const dup = useDuplicatePayable();
  const [date, setDate] = useState(today());
  useMemo(() => { if (payable) setDate(payable.due_date ?? today()); }, [payable?.id]);
  if (!payable) return null;
  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Duplicar conta</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">{payable.description}</div>
          <Field label="Novo vencimento *">
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={!date || dup.isPending}
            onClick={async () => { await dup.mutateAsync({ source: payable, due_date: date }); onClose(); }}
          >Duplicar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ----- Cancel -----
function CancelDialog({ payable, onClose }: { payable: PayableRow | null; onClose: () => void }) {
  const cancel = useCancelTransaction();
  const [reason, setReason] = useState('');
  useMemo(() => { if (payable) setReason(''); }, [payable?.id]);
  if (!payable) return null;
  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Cancelar conta</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">{payable.description}</div>
          <Field label="Motivo do cancelamento * (mín. 3 caracteres)">
            <Textarea rows={3} value={reason} onChange={e => setReason(e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Voltar</Button>
          <Button
            variant="destructive"
            disabled={reason.trim().length < 3 || cancel.isPending}
            onClick={async () => { await cancel.mutateAsync({ transaction_id: payable.id, reason: reason.trim() }); onClose(); }}
          >Confirmar cancelamento</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ----- Attachments -----
function AttachmentsDialog({ payable, onClose }: { payable: PayableRow | null; onClose: () => void }) {
  const { data: list, isLoading } = useTransactionAttachments(payable?.id);
  const upload = useUploadAttachment();
  const del = useDeleteAttachment();
  const [type, setType] = useState('comprovante');
  const [file, setFile] = useState<File | null>(null);

  if (!payable) return null;

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Anexos · {payable.description}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo">
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="boleto">Boleto</SelectItem>
                  <SelectItem value="nota_fiscal">Nota fiscal</SelectItem>
                  <SelectItem value="comprovante">Comprovante</SelectItem>
                  <SelectItem value="recibo">Recibo</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Arquivo">
              <Input type="file" onChange={e => setFile(e.target.files?.[0] ?? null)} />
            </Field>
          </div>
          <Button
            size="sm"
            disabled={!file || upload.isPending}
            onClick={async () => {
              if (!file) return;
              await upload.mutateAsync({
                transaction_id: payable.id, file, attachment_type: type, entity_id: payable.entity_id,
              });
              setFile(null);
            }}
          >
            {upload.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
            Enviar anexo
          </Button>

          <div className="border rounded-md divide-y">
            {isLoading && <div className="p-3"><Loader2 className="w-4 h-4 animate-spin" /></div>}
            {!isLoading && !list?.length && (
              <p className="p-3 text-sm text-muted-foreground">Nenhum anexo ainda.</p>
            )}
            {list?.map(a => (
              <div key={a.id} className="p-2 flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{a.file_name ?? a.file_url}</div>
                  <div className="text-xs text-muted-foreground">
                    {a.attachment_type} · {new Date(a.uploaded_at).toLocaleString('pt-BR')}
                  </div>
                </div>
                <Button
                  size="icon" variant="ghost" title="Baixar"
                  onClick={async () => {
                    const url = await getAttachmentSignedUrl(a.file_url);
                    window.open(url, '_blank');
                  }}
                ><Download className="w-4 h-4" /></Button>
                <Button
                  size="icon" variant="ghost" title="Remover"
                  onClick={() => del.mutate({ id: a.id, storage_path: a.file_url, transaction_id: payable.id })}
                ><Trash2 className="w-4 h-4 text-destructive" /></Button>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter><Button variant="ghost" onClick={onClose}>Fechar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
