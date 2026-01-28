import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DollarSign, Calendar, CreditCard, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface OrderFinancialBreakdownProps {
  orderId: string;
  saleId: string | null;
  totalCents: number;
  shippingCents: number;
  subtotalCents: number;
  paidAt: string | null;
  paymentMethod?: string | null;
  paymentInstallments?: number | null;
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

const CARD_BRAND_ICONS: Record<string, string> = {
  mastercard: '💳',
  visa: '💳',
  elo: '💳',
  amex: '💳',
  hipercard: '💳',
};

export function OrderFinancialBreakdown({
  orderId,
  saleId,
  totalCents,
  shippingCents,
  subtotalCents,
  paidAt,
  paymentMethod,
  paymentInstallments,
}: OrderFinancialBreakdownProps) {
  // Fetch sale data for transaction info
  const { data: sale, isLoading: saleLoading } = useQuery({
    queryKey: ['sale-for-financial', saleId],
    enabled: !!saleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .eq('id', saleId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch splits for breakdown
  const { data: splits, isLoading: splitsLoading } = useQuery({
    queryKey: ['sale-splits-breakdown', saleId],
    enabled: !!saleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sale_splits')
        .select('*')
        .eq('sale_id', saleId!);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch affiliate attribution
  const { data: affiliateAttribution } = useQuery({
    queryKey: ['affiliate-attribution', saleId],
    enabled: !!saleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('affiliate_attributions')
        .select(`
          *,
          affiliate:affiliates(
            affiliate_code,
            virtual_account:virtual_accounts(holder_name)
          )
        `)
        .eq('sale_id', saleId!)
        .maybeSingle();
      if (!error) return data;
      return null;
    },
  });

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  if (saleLoading || splitsLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Calculate breakdown
  const platformSplit = splits?.find(s => s.split_type === 'platform_fee');
  const affiliateSplit = splits?.find(s => s.split_type === 'affiliate');
  const tenantSplit = splits?.find(s => s.split_type === 'tenant');
  const factorySplit = splits?.find(s => s.split_type === 'factory');
  const industrySplit = splits?.find(s => s.split_type === 'industry');
  const coproducerSplit = splits?.find(s => s.split_type === 'coproducer');

  const platformFee = platformSplit?.gross_amount_cents || 0;
  const affiliateFee = affiliateSplit?.gross_amount_cents || 0;
  const tenantNet = tenantSplit?.net_amount_cents || (totalCents - platformFee - affiliateFee);
  const factoryFee = factorySplit?.gross_amount_cents || 0;
  const industryFee = industrySplit?.gross_amount_cents || 0;
  const coproducerFee = coproducerSplit?.gross_amount_cents || 0;

  // Estimate availability date (D+2 for credit card)
  const availabilityDate = paidAt ? addDays(new Date(paidAt), 2) : null;

  // Get transaction info from sale
  const gatewayTransactionId = sale?.gateway_transaction_id || null;
  const cardBrand = sale?.payment_method === 'credit_card' ? 'credit_card' : sale?.payment_method;
  const installments = sale?.payment_installments || paymentInstallments || 1;
  const installmentValue = totalCents / installments;

  const affiliateName = affiliateAttribution?.affiliate?.virtual_account?.holder_name ||
    affiliateAttribution?.affiliate?.affiliate_code ||
    null;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" />
            Você recebe
          </CardTitle>
          {sale?.status === 'payment_confirmed' && (
            <Badge variant="default" className="bg-green-600">Aprovada</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Net Amount */}
        <div className="text-right">
          <span className="text-3xl font-bold text-primary">
            {formatCurrency(tenantNet)}
          </span>
        </div>

        {/* Availability */}
        {availabilityDate && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Disponível em:
            </span>
            <span className="font-medium">
              {format(availabilityDate, 'dd/MM/yyyy', { locale: ptBR })}
            </span>
          </div>
        )}

        <div className="border-t pt-3 space-y-2">
          {/* Sale Value */}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Valor da venda:</span>
            <span className="font-medium">{formatCurrency(totalCents)}</span>
          </div>

          {/* Product Value */}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Valor do(s) produto(s):</span>
            <span>{formatCurrency(subtotalCents)}</span>
          </div>

          {/* Shipping */}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Frete:</span>
            <span>{formatCurrency(shippingCents)}</span>
          </div>

          {/* Factory Fee */}
          {factoryFee > 0 && (
            <div className="flex justify-between text-sm text-orange-600">
              <span>Fábrica:</span>
              <span>-{formatCurrency(factoryFee)}</span>
            </div>
          )}

          {/* Industry Fee */}
          {industryFee > 0 && (
            <div className="flex justify-between text-sm text-orange-600">
              <span>Indústria:</span>
              <span>-{formatCurrency(industryFee)}</span>
            </div>
          )}

          {/* Coproducer Fee */}
          {coproducerFee > 0 && (
            <div className="flex justify-between text-sm text-purple-600">
              <span>Co-produtor:</span>
              <span>-{formatCurrency(coproducerFee)}</span>
            </div>
          )}

          {/* Affiliate */}
          {affiliateFee > 0 && (
            <div className="flex justify-between text-sm text-blue-600">
              <span>
                Afiliado{affiliateName ? `: ${affiliateName}` : ''}:
              </span>
              <span>-{formatCurrency(affiliateFee)}</span>
            </div>
          )}

          {/* Platform Fee */}
          {platformFee > 0 && (
            <div className="flex justify-between text-sm text-red-600">
              <span>Taxa Plataforma (4.99% + R$1,00):</span>
              <span>-{formatCurrency(platformFee)}</span>
            </div>
          )}
        </div>

        {/* Transaction Info */}
        {gatewayTransactionId && (
          <div className="border-t pt-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Transação:</span>
              <div className="flex items-center gap-1">
                <span className="font-mono text-xs">#{gatewayTransactionId.slice(0, 24)}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={() => copyToClipboard(gatewayTransactionId, 'ID da transação')}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Card Info */}
            {sale?.payment_method === 'credit_card' && (
              <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Cartão de Crédito</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold">{formatCurrency(totalCents)}</p>
                  {installments > 1 && (
                    <p className="text-xs text-muted-foreground">
                      {installments}x {formatCurrency(installmentValue)}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* PIX Info */}
            {sale?.payment_method === 'pix' && (
              <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                <div className="text-xl">🔑</div>
                <div className="flex-1">
                  <span className="text-xs text-muted-foreground">PIX</span>
                </div>
                <div className="text-right">
                  <p className="font-bold">{formatCurrency(totalCents)}</p>
                </div>
              </div>
            )}

            {/* Boleto Info */}
            {sale?.payment_method === 'boleto' && (
              <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                <div className="text-xl">📄</div>
                <div className="flex-1">
                  <span className="text-xs text-muted-foreground">Boleto</span>
                </div>
                <div className="text-right">
                  <p className="font-bold">{formatCurrency(totalCents)}</p>
                </div>
              </div>
            )}

            {/* Approval Date */}
            {paidAt && (
              <div className="text-xs text-muted-foreground text-center pt-1">
                Transação aprovada em {format(new Date(paidAt), "dd/MM/yyyy '-' HH:mm:ss", { locale: ptBR })}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
