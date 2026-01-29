import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { QuickPaymentLinkButton } from './QuickPaymentLinkButton';
import { InlineTelesalesForm } from './InlineTelesalesForm';
import { useMyPermissions } from '@/hooks/useUserPermissions';
import { useAuth } from '@/hooks/useAuth';
import { useOrgFeatures } from '@/hooks/usePlanFeatures';
import { CreditCard, Link2 } from 'lucide-react';

interface PaymentActionsBarProps {
  amountCents: number;
  customerName: string;
  customerDocument?: string;
  customerPhone?: string;
  customerEmail?: string;
  leadId?: string;
  saleId?: string;
  productName?: string;
  onPaymentSuccess?: (transactionId: string) => void;
  className?: string;
  /** Compact mode for smaller spaces */
  compact?: boolean;
}

export function PaymentActionsBar({
  amountCents,
  customerName,
  customerDocument = '',
  customerPhone = '',
  customerEmail = '',
  leadId,
  saleId,
  productName,
  onPaymentSuccess,
  className = '',
  compact = false,
}: PaymentActionsBarProps) {
  const { isAdmin } = useAuth();
  const { data: permissions } = useMyPermissions();
  const { data: orgFeatures } = useOrgFeatures();
  
  const [showTelesales, setShowTelesales] = useState(false);

  // Check features and permissions
  const hasPaymentLinks = orgFeatures?.payment_links !== false;
  const hasTelesales = orgFeatures?.telesales !== false;
  const canCreateLinks = isAdmin || permissions?.payment_gateways_manage;
  const canTelesales = isAdmin || permissions?.telesales_manage;

  // If no payment features available, don't render
  if ((!hasPaymentLinks || !canCreateLinks) && (!hasTelesales || !canTelesales)) {
    return null;
  }

  const formatCurrency = (cents: number) => {
    return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {hasPaymentLinks && canCreateLinks && (
          <QuickPaymentLinkButton
            leadId={leadId}
            leadName={customerName}
            leadPhone={customerPhone}
            leadEmail={customerEmail}
            defaultAmount={amountCents}
            productName={productName}
            variant="outline"
            size="sm"
            label="Link"
          />
        )}
        
        {hasTelesales && canTelesales && amountCents > 0 && (
          <>
            <Button
              variant="default"
              size="sm"
              onClick={() => setShowTelesales(true)}
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Cobrar Cartão
            </Button>

            <InlineTelesalesForm
              amountCents={amountCents}
              customerName={customerName}
              customerDocument={customerDocument}
              customerPhone={customerPhone}
              customerEmail={customerEmail}
              saleId={saleId}
              leadId={leadId}
              onSuccess={onPaymentSuccess}
              isOpen={showTelesales}
              onOpenChange={setShowTelesales}
            />
          </>
        )}
      </div>
    );
  }

  return (
    <div className={`p-4 rounded-lg border bg-muted/30 space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm text-muted-foreground">
          Cobrar Agora
        </h4>
        <span className="text-lg font-bold text-primary">
          {formatCurrency(amountCents)}
        </span>
      </div>
      
      <div className="flex flex-col sm:flex-row gap-2">
        {hasPaymentLinks && canCreateLinks && (
          <QuickPaymentLinkButton
            leadId={leadId}
            leadName={customerName}
            leadPhone={customerPhone}
            leadEmail={customerEmail}
            defaultAmount={amountCents}
            productName={productName}
            variant="outline"
            size="default"
            className="flex-1"
            label="Gerar Link de Pagamento"
          />
        )}
        
        {hasTelesales && canTelesales && amountCents > 0 && (
          <>
            <Button
              variant="default"
              size="default"
              className="flex-1"
              onClick={() => setShowTelesales(true)}
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Cobrar no Cartão (Televendas)
            </Button>

            <InlineTelesalesForm
              amountCents={amountCents}
              customerName={customerName}
              customerDocument={customerDocument}
              customerPhone={customerPhone}
              customerEmail={customerEmail}
              saleId={saleId}
              leadId={leadId}
              onSuccess={onPaymentSuccess}
              isOpen={showTelesales}
              onOpenChange={setShowTelesales}
            />
          </>
        )}
      </div>
      
      <p className="text-xs text-muted-foreground">
        Gere um link para o cliente pagar ou faça a cobrança direta no cartão
      </p>
    </div>
  );
}
