import { useMemo, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Calculator, ArrowLeft, Info, Link2, Copy, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useEcommerceOrganizationId } from '@/hooks/ecommerce/useEcommerceOrganizationId';
import {
  useTenantInstallmentFees,
  calculateInstallmentWithInterest,
} from '@/hooks/ecommerce/useTenantInstallmentFees';
import { useCreatePaymentLink } from '@/hooks/usePaymentLinks';

function formatBRL(cents: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format((cents || 0) / 100);
}

export default function Calculadora() {
  const navigate = useNavigate();
  const { data: orgId } = useEcommerceOrganizationId();
  const { data: feesData, isLoading } = useTenantInstallmentFees(orgId);
  const createLink = useCreatePaymentLink();

  const [netCents, setNetCents] = useState<number>(10000); // valor desejado líquido
  const [chargeCents, setChargeCents] = useState<number>(10000); // valor a cobrar simulado

  // Estado do dialog de criar link
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkTitle, setLinkTitle] = useState('');
  const [linkSourceCents, setLinkSourceCents] = useState<number>(0);
  const [linkMaxInstallments, setLinkMaxInstallments] = useState<number>(12);
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const installmentFees = feesData?.installment_fees ?? {};
  const maxInstallments = feesData?.max_installments ?? 12;

  // Tabela de simulação: para cada nº de parcelas, qual o valor a cobrar e o valor da parcela
  // Aqui o "líquido" = valor sem juros (priceCents). Cliente paga o total com juros.
  const rows = useMemo(() => {
    const list: Array<{
      installments: number;
      installmentValue: number;
      totalCharged: number;
      interestPercentage: number;
      extraForCustomer: number;
      pagarmeMonthlyRate: number;
    }> = [];
    for (let i = 1; i <= maxInstallments; i++) {
      const info = calculateInstallmentWithInterest(netCents, i, installmentFees, true);
      // Taxa mensal equivalente para o Pagar.me (juros compostos a partir da 2ª parcela):
      // total = liquido * (1 + taxaMensal)^(n - 1)  →  taxaMensal = (total/liquido)^(1/(n-1)) - 1
      let pagarmeMonthlyRate = 0;
      if (i > 1 && netCents > 0 && info.totalWithInterest > netCents) {
        pagarmeMonthlyRate =
          (Math.pow(info.totalWithInterest / netCents, 1 / (i - 1)) - 1) * 100;
      }
      list.push({
        installments: i,
        installmentValue: info.installmentValue,
        totalCharged: info.totalWithInterest,
        interestPercentage: info.interestPercentage,
        extraForCustomer: info.totalWithInterest - netCents,
        pagarmeMonthlyRate,
      });
    }
    return list;
  }, [netCents, installmentFees, maxInstallments]);

  // Reverso: dado um valor a cobrar do cliente em X parcelas, quanto fica de líquido
  const [reverseInstallments, setReverseInstallments] = useState<number>(12);
  const reverseInfo = useMemo(() => {
    const fee = installmentFees[String(reverseInstallments)] || 0;
    if (reverseInstallments === 1 || fee === 0) {
      return {
        net: chargeCents,
        installmentValue: Math.ceil(chargeCents / reverseInstallments),
        feePct: 0,
      };
    }
    // total cobrado = líquido * (1 + fee/100) → líquido = total / (1 + fee/100)
    const net = Math.round(chargeCents / (1 + fee / 100));
    const installmentValue = Math.ceil(chargeCents / reverseInstallments);
    return { net, installmentValue, feePct: fee };
  }, [chargeCents, reverseInstallments, installmentFees]);

  return (
    <Layout>
      <div className="space-y-6 max-w-5xl">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/cobrar')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <Calculator className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Calculadora de Cobrança</h1>
              <p className="text-sm text-muted-foreground">
                Simule juros do parcelamento jogados para o cliente
              </p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center min-h-[200px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Modo 1: Quanto cobrar para receber X líquido */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quero receber líquido</CardTitle>
                <CardDescription>
                  Informe quanto você quer receber e veja quanto cobrar em cada parcela
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Valor líquido desejado</Label>
                  <CurrencyInput value={netCents} onChange={setNetCents} />
                </div>

                <div className="rounded-lg border">
                  <div className="grid grid-cols-5 gap-2 p-3 text-xs font-medium text-muted-foreground border-b bg-muted/40">
                    <div>Parcelas</div>
                    <div className="text-right">Parcela</div>
                    <div className="text-right">Total cobrado</div>
                    <div className="text-right">Juros</div>
                    <div className="text-right" title="Taxa mensal a configurar no campo 'Acréscimo no preço ao mês' do Pagar.me (a partir da 2ª parcela)">
                      Taxa Pagar.me/mês
                    </div>
                  </div>
                  <div className="max-h-[420px] overflow-auto">
                    {rows.map((r) => (
                      <div
                        key={r.installments}
                        className="grid grid-cols-5 gap-2 p-3 text-sm border-b last:border-0 hover:bg-muted/30"
                      >
                        <div className="font-medium">{r.installments}x</div>
                        <div className="text-right">{formatBRL(r.installmentValue)}</div>
                        <div className="text-right font-semibold">
                          {formatBRL(r.totalCharged)}
                        </div>
                        <div className="text-right">
                          {r.interestPercentage > 0 ? (
                            <Badge variant="secondary" className="text-xs">
                              +{r.interestPercentage.toFixed(2)}%
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">
                              sem juros
                            </Badge>
                          )}
                        </div>
                        <div className="text-right">
                          {r.pagarmeMonthlyRate > 0 ? (
                            <Badge className="text-xs bg-primary/10 text-primary hover:bg-primary/20 border-primary/20">
                              {r.pagarmeMonthlyRate.toFixed(2)}%
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <p className="text-xs text-muted-foreground flex gap-2">
                  <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  Use a coluna <strong>Taxa Pagar.me/mês</strong> no campo "Acréscimo no preço ao mês (em %)" do Pagar.me, com "Parcelas com acréscimo: A partir da 2ª".
                </p>

                <Button
                  className="w-full"
                  onClick={() => openCreateLinkDialog(netCents, maxInstallments)}
                  disabled={!netCents}
                >
                  <Link2 className="h-4 w-4 mr-2" />
                  Criar link de cobrança ({formatBRL(netCents)})
                </Button>
              </CardContent>
            </Card>

            {/* Modo 2: Reverso — dado valor cobrado, qual o líquido */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Já tenho o valor a cobrar</CardTitle>
                <CardDescription>
                  Informe quanto vai cobrar e veja quanto sobra de líquido
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Valor cobrado do cliente</Label>
                  <CurrencyInput value={chargeCents} onChange={setChargeCents} />
                </div>

                <div className="space-y-2">
                  <Label>Número de parcelas</Label>
                  <div className="grid grid-cols-6 gap-2">
                    {Array.from({ length: maxInstallments }, (_, i) => i + 1).map((n) => (
                      <Button
                        key={n}
                        variant={reverseInstallments === n ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setReverseInstallments(n)}
                      >
                        {n}x
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Cliente paga</span>
                    <span className="font-semibold">{formatBRL(chargeCents)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Em {reverseInstallments}x de
                    </span>
                    <span>{formatBRL(reverseInfo.installmentValue)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Taxa de parcelamento</span>
                    <span>
                      {reverseInfo.feePct > 0
                        ? `+${reverseInfo.feePct.toFixed(2)}%`
                        : 'sem juros'}
                    </span>
                  </div>
                  <div className="border-t pt-3 flex justify-between">
                    <span className="font-medium">Você recebe líquido</span>
                    <span className="text-lg font-bold text-green-600">
                      {formatBRL(reverseInfo.net)}
                    </span>
                  </div>
                  {reverseInfo.feePct > 0 && (
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Juros absorvidos pelo cliente</span>
                      <span>{formatBRL(chargeCents - reverseInfo.net)}</span>
                    </div>
                  )}
                </div>

                <Button
                  className="w-full"
                  onClick={() => openCreateLinkDialog(chargeCents, reverseInstallments)}
                  disabled={!chargeCents}
                >
                  <Link2 className="h-4 w-4 mr-2" />
                  Criar link de cobrança ({formatBRL(chargeCents)})
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Dialog: criar link de pagamento direto */}
      <Dialog
        open={linkDialogOpen}
        onOpenChange={(o) => {
          setLinkDialogOpen(o);
          if (!o) {
            setCreatedSlug(null);
            setCopied(false);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              {createdSlug ? 'Link criado!' : 'Criar link de cobrança'}
            </DialogTitle>
          </DialogHeader>

          {createdSlug ? (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg text-sm break-all">
                {`${window.location.origin}/pagar/${createdSlug}`}
              </div>
              <Button
                className="w-full"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/pagar/${createdSlug}`);
                  setCopied(true);
                  toast.success('Link copiado!');
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                {copied ? 'Copiado' : 'Copiar link'}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate('/cobrar/links')}
              >
                Ver todos os links
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Título *</Label>
                <Input
                  value={linkTitle}
                  onChange={(e) => setLinkTitle(e.target.value)}
                  placeholder="Ex: Cliente Bruno - Consultoria"
                />
              </div>
              <div className="space-y-2">
                <Label>Valor</Label>
                <CurrencyInput value={linkSourceCents} onChange={setLinkSourceCents} />
              </div>
              <div className="space-y-2">
                <Label>Parcelas máximas</Label>
                <Input
                  type="number"
                  min={1}
                  max={maxInstallments}
                  value={linkMaxInstallments}
                  onChange={(e) =>
                    setLinkMaxInstallments(
                      Math.max(1, Math.min(maxInstallments, parseInt(e.target.value) || 1))
                    )
                  }
                />
              </div>
              <p className="text-xs text-muted-foreground flex gap-2">
                <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                Os juros são absorvidos pelo cliente conforme as taxas configuradas.
              </p>
            </div>
          )}

          {!createdSlug && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={async () => {
                  if (!linkTitle.trim()) {
                    toast.error('Informe um título');
                    return;
                  }
                  if (!linkSourceCents) {
                    toast.error('Informe um valor');
                    return;
                  }
                  try {
                    const res = await createLink.mutateAsync({
                      title: linkTitle,
                      amount_cents: linkSourceCents,
                      allow_custom_amount: false,
                      pix_enabled: true,
                      boleto_enabled: false,
                      card_enabled: true,
                      max_installments: linkMaxInstallments,
                      interest_bearer: 'customer',
                    });
                    setCreatedSlug((res as { slug: string }).slug);
                    toast.success('Link criado com sucesso!');
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : 'Erro ao criar link');
                  }
                }}
                disabled={createLink.isPending}
              >
                {createLink.isPending ? 'Criando...' : 'Criar link'}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
