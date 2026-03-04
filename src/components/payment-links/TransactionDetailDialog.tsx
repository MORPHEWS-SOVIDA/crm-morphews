import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { 
  CreditCard, QrCode, FileText, CheckCircle2, XCircle, AlertCircle, Clock,
  Copy, ExternalLink, User, Mail, Phone, FileDigit, Globe, Calendar, 
  DollarSign, Ban, ShieldAlert
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface TransactionDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: any;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  abandoned: { label: 'Abandonado', color: 'bg-orange-500/10 text-orange-600 border-orange-500/20', icon: AlertCircle },
  pending: { label: 'Pendente', color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20', icon: Clock },
  paid: { label: 'Pago', color: 'bg-green-500/10 text-green-600 border-green-500/20', icon: CheckCircle2 },
  failed: { label: 'Falhou', color: 'bg-red-500/10 text-red-600 border-red-500/20', icon: XCircle },
  refunded: { label: 'Estornado', color: 'bg-purple-500/10 text-purple-600 border-purple-500/20', icon: AlertCircle },
  cancelled: { label: 'Cancelado', color: 'bg-gray-500/10 text-gray-600 border-gray-500/20', icon: XCircle },
};

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
  toast.success('Copiado!');
}

function CopyButton({ value }: { value: string }) {
  return (
    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => copyToClipboard(value)}>
      <Copy className="h-3 w-3" />
    </Button>
  );
}

function DetailRow({ label, value, copyable, icon: Icon }: { label: string; value?: string | null; copyable?: boolean; icon?: React.ElementType }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between py-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        <span>{label}</span>
      </div>
      <div className="flex items-center gap-1 text-sm font-medium text-right max-w-[60%] break-all">
        <span>{value}</span>
        {copyable && <CopyButton value={value} />}
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-sm">{title}</h3>
      </div>
      <div className="bg-muted/30 rounded-lg p-3 divide-y divide-border/50">
        {children}
      </div>
    </div>
  );
}

export function TransactionDetailDialog({ open, onOpenChange, transaction: tx }: TransactionDetailDialogProps) {
  if (!tx) return null;

  const formatCurrency = (cents: number) => {
    return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const status = statusConfig[tx.status] || statusConfig.pending;
  const StatusIcon = status.icon;

  // Extract gateway response data
  const gwResponse = tx.gateway_response as any;
  const lastTx = gwResponse?.charges?.[0]?.last_transaction || gwResponse?.last_transaction;
  const chargeData = gwResponse?.charges?.[0];
  const customerData = gwResponse?.customer || chargeData?.customer;
  const cardData = lastTx?.card;
  
  // Acquirer info
  const acquirerMessage = lastTx?.acquirer_message;
  const acquirerReturnCode = lastTx?.acquirer_return_code;
  const acquirerName = lastTx?.acquirer_name;
  const acquirerNsu = lastTx?.acquirer_nsu;
  const acquirerTid = lastTx?.acquirer_tid;
  const operationType = lastTx?.operation_type;
  const txStatus = lastTx?.status;
  
  // Card info from gateway
  const cardBrand = cardData?.brand || tx.card_brand;
  const cardLastDigits = cardData?.last_four_digits || tx.card_last_digits;
  const cardFirstSix = cardData?.first_six_digits;
  const cardHolder = cardData?.holder_name;
  const cardExpMonth = cardData?.exp_month;
  const cardExpYear = cardData?.exp_year;
  const cardBillingAddress = cardData?.billing_address;

  // Customer address
  const customerAddress = customerData?.address;
  const customerDocument = customerData?.document || tx.customer_document;
  const customerPhone = customerData?.phones?.mobile_phone;

  // Gateway IDs
  const gatewayOrderId = tx.gateway_order_id || gwResponse?.id;
  const gatewayChargeId = tx.gateway_charge_id || chargeData?.id;
  const gatewayTxId = tx.gateway_transaction_id || lastTx?.id;
  const gatewayNumericId = lastTx?.gateway_id?.toString();
  const orderCode = gwResponse?.code || chargeData?.code;

  // Pagar.me dashboard link
  const pagarmeOrderUrl = gatewayOrderId 
    ? `https://dash.pagar.me/merch_WrgRKV8tGubALIPe/acc_40nvZdeuVSn03aQB/orders/${gatewayOrderId}`
    : null;

  const isError = tx.status === 'failed' || txStatus === 'not_authorized';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">Detalhes da Transação</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Header: Value + Status */}
          <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
            <div>
              <p className="text-xs text-muted-foreground">Valor</p>
              <p className="text-2xl font-bold">{formatCurrency(tx.amount_cents)}</p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(tx.created_at), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
            <Badge className={`${status.color} text-sm px-3 py-1`}>
              <StatusIcon className="h-4 w-4 mr-1" />
              {status.label}
            </Badge>
          </div>

          {/* Error Banner */}
          {isError && acquirerMessage && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-start gap-2">
              <ShieldAlert className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-700 dark:text-red-400">
                  {acquirerMessage}
                  {acquirerReturnCode && ` — Código: ${acquirerReturnCode}`}
                </p>
                {txStatus && (
                  <p className="text-xs text-red-600/70 mt-1 capitalize">{txStatus.replace(/_/g, ' ')}</p>
                )}
              </div>
            </div>
          )}

          {/* Financial Details */}
          <Section title="Valores" icon={DollarSign}>
            <DetailRow label="Valor bruto" value={formatCurrency(tx.amount_cents)} />
            {tx.base_amount_cents && tx.base_amount_cents !== tx.amount_cents && (
              <DetailRow label="Valor base" value={formatCurrency(tx.base_amount_cents)} />
            )}
            {tx.interest_amount_cents > 0 && (
              <DetailRow label="Juros" value={formatCurrency(tx.interest_amount_cents)} />
            )}
            <DetailRow label="Taxa" value={formatCurrency(tx.fee_cents)} />
            <DetailRow label="Valor líquido" value={formatCurrency(tx.net_amount_cents)} />
            {tx.release_date && (
              <DetailRow label="Liberação" value={format(new Date(tx.release_date), "dd/MM/yyyy", { locale: ptBR })} icon={Calendar} />
            )}
          </Section>

          {/* Payment Method */}
          <Section title="Pagamento" icon={CreditCard}>
            <DetailRow label="Método" value={
              tx.payment_method === 'credit_card' 
                ? `Cartão de Crédito${tx.installments > 1 ? ` (${tx.installments}x)` : ''}`
                : tx.payment_method === 'pix' ? 'PIX' 
                : tx.payment_method === 'boleto' ? 'Boleto' 
                : tx.payment_method
            } />
            {cardBrand && <DetailRow label="Bandeira" value={cardBrand} />}
            {cardLastDigits && (
              <DetailRow 
                label="Número do cartão" 
                value={`${cardFirstSix ? cardFirstSix.substring(0,4) + ' ' + cardFirstSix.substring(4) + '** **** ' : '**** **** **** '}${cardLastDigits}`}
              />
            )}
            {cardHolder && <DetailRow label="Titular" value={cardHolder} />}
            {cardExpMonth && cardExpYear && <DetailRow label="Validade" value={`${String(cardExpMonth).padStart(2,'0')}/${cardExpYear}`} />}
            {cardBillingAddress && (
              <DetailRow label="Endereço cobrança" value={
                `${cardBillingAddress.street || ''}, ${cardBillingAddress.number || ''}, ${cardBillingAddress.neighborhood || ''}, ${cardBillingAddress.city || ''}, ${cardBillingAddress.state || ''} • CEP: ${cardBillingAddress.zip_code || ''}`
              } />
            )}
          </Section>

          {/* Customer */}
          <Section title="Cliente" icon={User}>
            <DetailRow label="Nome" value={tx.customer_name} icon={User} />
            <DetailRow label="E-mail" value={tx.customer_email} icon={Mail} copyable />
            <DetailRow label="Telefone" value={
              tx.customer_phone || (customerPhone ? `(${customerPhone.area_code}) ${customerPhone.number}` : null)
            } icon={Phone} copyable />
            <DetailRow label="Documento" value={customerDocument} icon={FileDigit} copyable />
            {customerAddress && (
              <DetailRow label="Endereço" value={
                `${customerAddress.street || ''}, ${customerAddress.number || ''}, ${customerAddress.neighborhood || ''}, ${customerAddress.city || ''}, ${customerAddress.state || ''} • CEP: ${customerAddress.zip_code || ''}`
              } />
            )}
          </Section>

          {/* Acquirer / Gateway */}
          {(acquirerName || gatewayTxId || gatewayOrderId) && (
            <Section title="Gateway / Adquirente" icon={Globe}>
              <DetailRow label="Adquirente" value={acquirerName} />
              {operationType && <DetailRow label="Operação" value={operationType.replace(/_/g, ' ')} />}
              {acquirerMessage && <DetailRow label="Mensagem" value={acquirerMessage} />}
              {acquirerReturnCode && <DetailRow label="Código retorno" value={String(acquirerReturnCode)} />}
              {acquirerNsu && <DetailRow label="NSU" value={String(acquirerNsu)} copyable />}
              {acquirerTid && <DetailRow label="TID" value={String(acquirerTid)} copyable />}
            </Section>
          )}

          {/* IDs */}
          <Section title="Identificadores" icon={FileDigit}>
            <DetailRow label="ID interno" value={tx.id} copyable />
            {gatewayOrderId && <DetailRow label="ID do pedido" value={gatewayOrderId} copyable />}
            {orderCode && <DetailRow label="Código pedido" value={orderCode} copyable />}
            {gatewayChargeId && <DetailRow label="ID da cobrança" value={gatewayChargeId} copyable />}
            {gatewayTxId && <DetailRow label="ID da transação" value={gatewayTxId} copyable />}
            {gatewayNumericId && <DetailRow label="Gateway ID" value={gatewayNumericId} copyable />}
            {tx.ip_address && <DetailRow label="IP" value={tx.ip_address} />}
          </Section>

          {/* Actions */}
          {pagarmeOrderUrl && (
            <div className="pt-2">
              <Button variant="outline" className="w-full" asChild>
                <a href={pagarmeOrderUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Ver no Pagar.me
                </a>
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}