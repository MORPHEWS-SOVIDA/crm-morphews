import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, CheckCircle2, XCircle, Building2, ListTree, ScrollText, Lock, Landmark, Tags, Layers } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import {
  useFinancialAccess,
  useFinancialEntities,
  useFinancialCategoriesV2,
  useCostCentersV2,
  useFinancialTransactions,
  useCreateFinancialTransaction,
  useRegisterPayment,
  useCancelTransaction,
  useFinancialAuditLogs,
  useFinancialBankAccounts,
  useFinancialOrgSettings,
  type FinancialDirection,
  type FinancialTxStatus,
  type FinancialTransaction,
} from '@/hooks/useFinancialV2';
import { EntitiesTab } from '@/components/financial-v2/EntitiesTab';
import { BanksTab } from '@/components/financial-v2/BanksTab';
import { SuppliersTab } from '@/components/financial-v2/SuppliersTab';
import { CategoriesTab } from '@/components/financial-v2/CategoriesTab';
import { CostCentersTab } from '@/components/financial-v2/CostCentersTab';

const STATUS_VARIANTS: Record<FinancialTxStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  previsto: 'outline',
  pendente_aprovacao: 'outline',
  aprovado: 'secondary',
  realizado: 'default',
  conciliado: 'default',
  cancelado: 'destructive',
  estornado: 'destructive',
  vencido: 'destructive',
  pago_parcial: 'secondary',
};

const fmt = (cents: number | null) =>
  cents == null ? '—' : (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function FinancialV2() {
  const { user, isLoading: authLoading } = useAuth();
  const { data: hasAccess, isLoading: accessLoading } = useFinancialAccess();

  if (authLoading || accessLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!user) return <Navigate to="/login?redirect=/financeiro-v2" replace />;

  if (!hasAccess) {
    return (
      <Layout>
        <div className="container mx-auto py-12">
          <Card className="max-w-lg mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5" /> Acesso restrito
              </CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              O Razão Financeiro está em validação interna e por enquanto só está liberado para o proprietário da operação.
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return <FinancialV2Content />;
}

function FinancialV2Content() {
  const { data: settings } = useFinancialOrgSettings();
  const displayName = (settings as any)?.financial_display_name ?? 'MORPHEWS';

  return (
    <Layout>
      <div className="container mx-auto py-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Razão Financeiro · {displayName}</h1>
          <p className="text-muted-foreground">
            Fundação multi-entidade — CNPJs, CPFs, projetos, imóveis e família.
          </p>
        </div>
        <Tabs defaultValue="transactions" className="space-y-4">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="transactions"><ListTree className="w-4 h-4 mr-2" />Lançamentos</TabsTrigger>
            <TabsTrigger value="entities"><Building2 className="w-4 h-4 mr-2" />Entidades</TabsTrigger>
            <TabsTrigger value="banks"><Landmark className="w-4 h-4 mr-2" />Bancos</TabsTrigger>
            <TabsTrigger value="suppliers"><Tags className="w-4 h-4 mr-2" />Fornecedores</TabsTrigger>
            <TabsTrigger value="categories"><ListTree className="w-4 h-4 mr-2" />Categorias</TabsTrigger>
            <TabsTrigger value="cost-centers"><Layers className="w-4 h-4 mr-2" />Centros</TabsTrigger>
            <TabsTrigger value="audit"><ScrollText className="w-4 h-4 mr-2" />Auditoria</TabsTrigger>
          </TabsList>
          <TabsContent value="transactions"><TransactionsTab /></TabsContent>
          <TabsContent value="entities"><EntitiesTab /></TabsContent>
          <TabsContent value="banks"><BanksTab /></TabsContent>
          <TabsContent value="suppliers"><SuppliersTab /></TabsContent>
          <TabsContent value="categories"><CategoriesTab /></TabsContent>
          <TabsContent value="cost-centers"><CostCentersTab /></TabsContent>
          <TabsContent value="audit"><AuditTab /></TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}

// =================== ENTITIES ===================
function EntitiesTab() {
  const { data: entities, isLoading } = useFinancialEntities();
  const createEntity = useCreateFinancialEntity();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ name: string; entity_type: FinancialEntityType; document: string; notes: string }>({
    name: '', entity_type: 'cnpj', document: '', notes: '',
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Entidades financeiras</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" />Nova entidade</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova entidade</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nome *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div>
                <Label>Tipo</Label>
                <Select value={form.entity_type} onValueChange={(v: FinancialEntityType) => setForm({ ...form, entity_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cnpj">CNPJ</SelectItem>
                    <SelectItem value="cpf">CPF</SelectItem>
                    <SelectItem value="projeto">Projeto</SelectItem>
                    <SelectItem value="imovel">Imóvel</SelectItem>
                    <SelectItem value="familia">Família</SelectItem>
                    <SelectItem value="carteira">Carteira</SelectItem>
                    <SelectItem value="centro_operacional">Centro operacional</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Documento (opcional)</Label><Input value={form.document} onChange={e => setForm({ ...form, document: e.target.value })} /></div>
              <div><Label>Notas</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button
                disabled={!form.name || createEntity.isPending}
                onClick={async () => {
                  await createEntity.mutateAsync({
                    name: form.name, entity_type: form.entity_type,
                    document: form.document || undefined, notes: form.notes || undefined,
                  });
                  setForm({ name: '', entity_type: 'cnpj', document: '', notes: '' });
                  setOpen(false);
                }}
              >Criar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
          <div className="grid gap-2">
            {entities?.map(e => (
              <div key={e.id} className="flex items-center gap-3 p-3 border rounded-md">
                <div className="w-3 h-3 rounded-full" style={{ background: e.color || 'hsl(var(--muted))' }} />
                <div className="flex-1">
                  <div className="font-medium">{e.name}</div>
                  <div className="text-xs text-muted-foreground">{e.entity_type}{e.document ? ` · ${e.document}` : ''}</div>
                </div>
                <Badge variant="outline">{e.is_active ? 'ativa' : 'inativa'}</Badge>
              </div>
            ))}
            {!entities?.length && <p className="text-sm text-muted-foreground">Nenhuma entidade ainda.</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// =================== TRANSACTIONS ===================
function TransactionsTab() {
  const { data: txs, isLoading } = useFinancialTransactions();
  const { data: entities } = useFinancialEntities();
  const { data: categories } = useFinancialCategoriesV2();
  const { data: ccs } = useCostCentersV2();
  const createTx = useCreateFinancialTransaction();
  const registerPayment = useRegisterPayment();
  const cancelTx = useCancelTransaction();
  const { data: bankAccounts } = useFinancialBankAccounts();

  const [open, setOpen] = useState(false);
  const [paying, setPaying] = useState<FinancialTransaction | null>(null);
  const [actualReais, setActualReais] = useState('');
  const [diffReason, setDiffReason] = useState<string>('');
  const [bankAccountId, setBankAccountId] = useState<string>('');
  const [paidAt, setPaidAt] = useState<string>(() => new Date().toISOString().slice(0, 10));

  const [form, setForm] = useState({
    entity_id: '', category_id: '', cost_center_id: '',
    description: '', direction: 'outflow' as FinancialDirection,
    amount_reais: '', due_date: '', competence_date: '',
  });

  const reset = () => setForm({
    entity_id: '', category_id: '', cost_center_id: '',
    description: '', direction: 'outflow',
    amount_reais: '', due_date: '', competence_date: '',
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Lançamentos</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" />Novo lançamento</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo lançamento previsto</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Entidade *</Label>
                  <Select value={form.entity_id} onValueChange={v => setForm({ ...form, entity_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {entities?.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Direção *</Label>
                  <Select value={form.direction} onValueChange={(v: FinancialDirection) => setForm({ ...form, direction: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="outflow">Saída (despesa)</SelectItem>
                      <SelectItem value="inflow">Entrada (receita)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Descrição *</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Categoria</Label>
                  <Select value={form.category_id} onValueChange={v => setForm({ ...form, category_id: v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      {categories
                        ?.filter(c => form.direction === 'inflow' ? c.type === 'income' : c.type === 'expense')
                        .map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Centro de custo</Label>
                  <Select value={form.cost_center_id} onValueChange={v => setForm({ ...form, cost_center_id: v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      {ccs?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Valor previsto (R$) *</Label>
                  <Input type="number" step="0.01" value={form.amount_reais} onChange={e => setForm({ ...form, amount_reais: e.target.value })} />
                </div>
                <div>
                  <Label>Vencimento</Label>
                  <Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
                </div>
                <div>
                  <Label>Competência</Label>
                  <Input type="date" value={form.competence_date} onChange={e => setForm({ ...form, competence_date: e.target.value })} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button
                disabled={!form.entity_id || !form.description || !form.amount_reais || createTx.isPending}
                onClick={async () => {
                  await createTx.mutateAsync({
                    entity_id: form.entity_id,
                    category_id: form.category_id || null,
                    cost_center_id: form.cost_center_id || null,
                    description: form.description,
                    direction: form.direction,
                    type: form.direction === 'inflow' ? 'receita' : 'despesa',
                    expected_amount_cents: Math.round(parseFloat(form.amount_reais) * 100),
                    due_date: form.due_date || undefined,
                    competence_date: form.competence_date || undefined,
                  });
                  reset();
                  setOpen(false);
                }}
              >Criar previsto</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
          <div className="space-y-2">
            {txs?.map(t => {
              const ent = entities?.find(e => e.id === t.entity_id);
              return (
                <div key={t.id} className="flex items-center gap-3 p-3 border rounded-md">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{t.description || '(sem descrição)'}</span>
                      <Badge variant={STATUS_VARIANTS[t.status]}>{t.status}</Badge>
                      <Badge variant="outline">{t.direction === 'inflow' ? '↓ entrada' : '↑ saída'}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {ent?.name ?? '—'} · vence {t.due_date ?? '—'} · pago em {t.paid_at ? new Date(t.paid_at).toLocaleDateString('pt-BR') : '—'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm">prev: {fmt(t.expected_amount_cents)}</div>
                    {t.actual_amount_cents != null && (
                      <div className="font-mono text-xs text-muted-foreground">real: {fmt(t.actual_amount_cents)} (Δ {fmt(t.difference_amount_cents)})</div>
                    )}
                  </div>
                  {!['realizado', 'conciliado', 'cancelado', 'estornado'].includes(t.status) && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => {
                        setPaying(t);
                        setActualReais(((t.expected_amount_cents ?? 0) / 100).toFixed(2));
                        setDiffReason('');
                        setBankAccountId(bankAccounts?.find(b => b.is_default)?.id ?? '');
                        setPaidAt(new Date().toISOString().slice(0, 10));
                      }}>
                        <CheckCircle2 className="w-4 h-4 mr-1" />Pagar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={async () => {
                        const reason = window.prompt('Motivo do cancelamento (mín. 3 caracteres)');
                        if (reason && reason.trim().length >= 3) await cancelTx.mutateAsync({ transaction_id: t.id, reason: reason.trim() });
                      }}>
                        <XCircle className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              );
            })}
            {!txs?.length && <p className="text-sm text-muted-foreground">Nenhum lançamento ainda. Crie um previsto para começar.</p>}
          </div>
        )}
      </CardContent>

      {/* Pagamento */}
      <Dialog open={!!paying} onOpenChange={v => !v && setPaying(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar pagamento</DialogTitle></DialogHeader>
          {paying && (() => {
            const expectedCents = paying.expected_amount_cents ?? 0;
            const actualCents = Math.round(parseFloat(actualReais || '0') * 100);
            const hasDifference = !!actualReais && actualCents !== expectedCents;
            return (
              <div className="space-y-3">
                <div className="text-sm text-muted-foreground">{paying.description}</div>
                <div><Label>Valor previsto</Label><Input value={fmt(paying.expected_amount_cents)} disabled /></div>
                <div>
                  <Label>Conta bancária *</Label>
                  <Select value={bankAccountId} onValueChange={setBankAccountId}>
                    <SelectTrigger><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
                    <SelectContent>
                      {bankAccounts?.map(b => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}{b.bank_name ? ` · ${b.bank_name}` : ''}
                        </SelectItem>
                      ))}
                      {!bankAccounts?.length && (
                        <div className="px-3 py-2 text-xs text-muted-foreground">
                          Nenhuma conta cadastrada. Vá em Bancos.
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Data do pagamento *</Label>
                    <Input type="date" value={paidAt} onChange={e => setPaidAt(e.target.value)} />
                  </div>
                  <div>
                    <Label>Valor pago (R$) *</Label>
                    <Input type="number" step="0.01" value={actualReais} onChange={e => setActualReais(e.target.value)} />
                  </div>
                </div>
                {hasDifference && (
                  <div>
                    <Label>Motivo da diferença * ({fmt(actualCents - expectedCents)})</Label>
                    <Select value={diffReason} onValueChange={setDiffReason}>
                      <SelectTrigger><SelectValue placeholder="Obrigatório quando há diferença" /></SelectTrigger>
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
                  </div>
                )}
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPaying(null)}>Cancelar</Button>
            <Button
              disabled={(() => {
                if (!paying || !actualReais || !bankAccountId || !paidAt || registerPayment.isPending) return true;
                const actualCents = Math.round(parseFloat(actualReais) * 100);
                const hasDifference = actualCents !== (paying.expected_amount_cents ?? 0);
                if (hasDifference && !diffReason) return true;
                return false;
              })()}
              onClick={async () => {
                if (!paying) return;
                await registerPayment.mutateAsync({
                  transaction_id: paying.id,
                  bank_account_id: bankAccountId,
                  actual_amount_cents: Math.round(parseFloat(actualReais) * 100),
                  paid_at: new Date(paidAt + 'T12:00:00').toISOString(),
                  difference_reason: diffReason || undefined,
                });
                setPaying(null);
              }}
            >Confirmar pagamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// =================== BANKS ===================
function BanksTab() {
  const { data: banks, isLoading } = useFinancialBankAccounts();
  const { data: entities } = useFinancialEntities();
  const createBank = useCreateFinancialBankAccount();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: '', entity_id: '', bank_name: '', bank_code: '',
    agency: '', account_number: '', account_type: 'corrente',
    initial_balance_reais: '0',
  });

  const reset = () => setForm({
    name: '', entity_id: '', bank_name: '', bank_code: '',
    agency: '', account_number: '', account_type: 'corrente',
    initial_balance_reais: '0',
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Contas bancárias</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" />Nova conta</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova conta bancária</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Apelido *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Itaú PJ MORPHEWS" /></div>
              <div>
                <Label>Entidade vinculada</Label>
                <Select value={form.entity_id} onValueChange={v => setForm({ ...form, entity_id: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {entities?.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Banco</Label><Input value={form.bank_name} onChange={e => setForm({ ...form, bank_name: e.target.value })} /></div>
                <div><Label>Código</Label><Input value={form.bank_code} onChange={e => setForm({ ...form, bank_code: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Agência</Label><Input value={form.agency} onChange={e => setForm({ ...form, agency: e.target.value })} /></div>
                <div><Label>Conta</Label><Input value={form.account_number} onChange={e => setForm({ ...form, account_number: e.target.value })} /></div>
                <div>
                  <Label>Tipo</Label>
                  <Select value={form.account_type} onValueChange={v => setForm({ ...form, account_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="corrente">Corrente</SelectItem>
                      <SelectItem value="poupanca">Poupança</SelectItem>
                      <SelectItem value="caixa">Caixa</SelectItem>
                      <SelectItem value="investimento">Investimento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Saldo inicial (R$)</Label>
                <Input type="number" step="0.01" value={form.initial_balance_reais} onChange={e => setForm({ ...form, initial_balance_reais: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button
                disabled={!form.name || createBank.isPending}
                onClick={async () => {
                  await createBank.mutateAsync({
                    name: form.name,
                    entity_id: form.entity_id || null,
                    bank_name: form.bank_name || undefined,
                    bank_code: form.bank_code || undefined,
                    agency: form.agency || undefined,
                    account_number: form.account_number || undefined,
                    account_type: form.account_type,
                    initial_balance_cents: Math.round(parseFloat(form.initial_balance_reais || '0') * 100),
                  });
                  reset();
                  setOpen(false);
                }}
              >Criar conta</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
          <div className="grid gap-2">
            {banks?.map(b => {
              const ent = entities?.find(e => e.id === b.entity_id);
              return (
                <div key={b.id} className="flex items-center gap-3 p-3 border rounded-md">
                  <Landmark className="w-4 h-4 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="font-medium">{b.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {b.bank_name ?? '—'} · ag {b.agency ?? '—'} · cc {b.account_number ?? '—'}
                      {ent ? ` · ${ent.name}` : ''}
                    </div>
                  </div>
                  <div className="font-mono text-sm">{fmt(b.current_balance_cents ?? 0)}</div>
                  {b.is_default && <Badge variant="outline">padrão</Badge>}
                </div>
              );
            })}
            {!banks?.length && <p className="text-sm text-muted-foreground">Nenhuma conta cadastrada. Crie a primeira para registrar pagamentos.</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// =================== AUDIT ===================
function AuditTab() {
  const { data: logs, isLoading } = useFinancialAuditLogs(200);
  return (
    <Card>
      <CardHeader><CardTitle>Trilha de auditoria</CardTitle></CardHeader>
      <CardContent>
        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
          <div className="space-y-1 font-mono text-xs">
            {logs?.map((l: any) => (
              <div key={l.id} className="flex gap-2 p-2 border-b">
                <span className="text-muted-foreground">{new Date(l.created_at).toLocaleString('pt-BR')}</span>
                <Badge variant="outline">{l.action}</Badge>
                <span>{l.table_name}</span>
                <span className="text-muted-foreground truncate">{l.record_id}</span>
              </div>
            ))}
            {!logs?.length && <p className="text-sm text-muted-foreground font-sans">Nenhum log ainda.</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
