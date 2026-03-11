import { useState } from 'react';
import { Users2, Plus, Trash2, DollarSign, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  useProductCoproducers,
  useUpdateCoproducerCommission,
  useCoproducerAccounts,
  useCreateCoproducer,
  useRemoveCoproducer,
  type Coproducer,
} from '@/hooks/useCoproducers';

interface CoproducerCommissionTabProps {
  productId: string;
  productName: string;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

function parseCurrency(value: string): number {
  const cleaned = value.replace(/[^\d,.-]/g, '').replace(',', '.');
  return Math.round(parseFloat(cleaned || '0') * 100);
}

function formatCentsToInput(cents: number): string {
  if (!cents) return '';
  return (cents / 100).toFixed(2).replace('.', ',');
}

function CoproducerRow({ coprod, onRemove }: { coprod: Coproducer; onRemove: () => void }) {
  const updateCommission = useUpdateCoproducerCommission();
  const [fixed1, setFixed1] = useState(formatCentsToInput(coprod.commission_fixed_1_cents));
  const [fixed3, setFixed3] = useState(formatCentsToInput(coprod.commission_fixed_3_cents));
  const [fixed5, setFixed5] = useState(formatCentsToInput(coprod.commission_fixed_5_cents));
  const [isDirty, setIsDirty] = useState(false);

  const handleChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value);
    setIsDirty(true);
  };

  const handleSave = () => {
    updateCommission.mutate({
      id: coprod.id,
      commission_fixed_1_cents: parseCurrency(fixed1),
      commission_fixed_3_cents: parseCurrency(fixed3),
      commission_fixed_5_cents: parseCurrency(fixed5),
    }, {
      onSuccess: () => setIsDirty(false),
    });
  };

  const partnerName = coprod.virtual_account?.holder_name || 'Co-produtor';
  const partnerEmail = coprod.virtual_account?.holder_email || '';

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Users2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">{partnerName}</CardTitle>
              {partnerEmail && (
                <CardDescription className="text-xs">{partnerEmail}</CardDescription>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {coprod.commission_type === 'fixed_per_quantity' ? 'Valor fixo' : 'Percentual'}
            </Badge>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remover co-produtor?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {partnerName} não receberá mais comissões deste produto.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={onRemove}>Remover</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {coprod.commission_type === 'fixed_per_quantity' ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              Ganho fixo por quantidade vendida
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">1 Frasco</Label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                  <Input
                    className="pl-8 text-sm h-9"
                    value={fixed1}
                    onChange={handleChange(setFixed1)}
                    placeholder="0,00"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">3 Frascos</Label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                  <Input
                    className="pl-8 text-sm h-9"
                    value={fixed3}
                    onChange={handleChange(setFixed3)}
                    placeholder="0,00"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">5 Frascos</Label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                  <Input
                    className="pl-8 text-sm h-9"
                    value={fixed5}
                    onChange={handleChange(setFixed5)}
                    placeholder="0,00"
                  />
                </div>
              </div>
            </div>

            {/* Summary badges */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {parseCurrency(fixed1) > 0 && (
                <Badge variant="secondary" className="text-xs font-mono">
                  1un → {formatCurrency(parseCurrency(fixed1))}
                </Badge>
              )}
              {parseCurrency(fixed3) > 0 && (
                <Badge variant="secondary" className="text-xs font-mono">
                  3un → {formatCurrency(parseCurrency(fixed3))}
                </Badge>
              )}
              {parseCurrency(fixed5) > 0 && (
                <Badge variant="secondary" className="text-xs font-mono">
                  5un → {formatCurrency(parseCurrency(fixed5))}
                </Badge>
              )}
            </div>

            {isDirty && (
              <Button
                size="sm"
                onClick={handleSave}
                disabled={updateCommission.isPending}
                className="w-full mt-2"
              >
                {updateCommission.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <DollarSign className="h-4 w-4 mr-2" />
                )}
                Salvar Comissões
              </Button>
            )}
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">
              Comissão: <span className="font-bold">{coprod.commission_percentage}%</span> sobre o valor líquido
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function CoproducerCommissionTab({ productId, productName }: CoproducerCommissionTabProps) {
  const { data: coproducers, isLoading } = useProductCoproducers(productId);
  const { data: accounts } = useCoproducerAccounts();
  const createCoproducer = useCreateCoproducer();
  const removeCoproducer = useRemoveCoproducer();

  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState('');

  // Filter out accounts already assigned to this product
  const assignedAccountIds = coproducers?.map(c => c.virtual_account_id) || [];
  const availableAccounts = accounts?.filter(a => !assignedAccountIds.includes(a.id)) || [];

  const handleAdd = () => {
    if (!selectedAccountId) return;
    createCoproducer.mutate({
      virtual_account_id: selectedAccountId,
      product_id: productId,
      commission_type: 'fixed_per_quantity',
    }, {
      onSuccess: () => {
        setShowAddForm(false);
        setSelectedAccountId('');
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="bg-muted/30 border-dashed">
        <CardContent className="py-3 px-4">
          <p className="text-sm text-muted-foreground">
            <Users2 className="h-4 w-4 inline mr-1.5 -mt-0.5" />
            Co-produtores recebem um valor fixo por cada venda paga de <strong>{productName}</strong>.
            O valor é debitado automaticamente no split quando o pagamento é confirmado.
          </p>
        </CardContent>
      </Card>

      {coproducers && coproducers.length > 0 ? (
        <div className="space-y-3">
          {coproducers.map(coprod => (
            <CoproducerRow
              key={coprod.id}
              coprod={coprod}
              onRemove={() => removeCoproducer.mutate(coprod.id)}
            />
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <Users2 className="h-10 w-10 text-muted-foreground mb-3" />
            <h4 className="font-medium mb-1">Nenhum co-produtor</h4>
            <p className="text-sm text-muted-foreground mb-4">
              Adicione um parceiro co-produtor para definir os ganhos por venda.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Add new coproducer */}
      {showAddForm ? (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <Label>Selecione o parceiro co-produtor</Label>
            <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Escolher parceiro..." />
              </SelectTrigger>
              <SelectContent>
                {availableAccounts.map(account => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.holder_name} ({account.holder_email})
                  </SelectItem>
                ))}
                {availableAccounts.length === 0 && (
                  <SelectItem value="__none" disabled>
                    Nenhum parceiro disponível
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleAdd}
                disabled={!selectedAccountId || createCoproducer.isPending}
              >
                {createCoproducer.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Adicionar
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowAddForm(false)}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={() => setShowAddForm(true)}
        >
          <Plus className="h-4 w-4" />
          Adicionar Co-produtor
        </Button>
      )}
    </div>
  );
}
