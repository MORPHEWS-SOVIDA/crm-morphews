import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Edit, Check, FileText, Building, Calendar, CreditCard, Barcode, Copy } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { toast } from 'sonner';

import { type AccountPayable } from '@/hooks/useAccountsPayable';

interface PayableDetailDialogProps {
  open: boolean;
  onClose: () => void;
  payable: AccountPayable | null;
  onEdit: () => void;
  onConfirmPayment: () => void;
}

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pendente', variant: 'secondary' },
  approved: { label: 'Aprovado', variant: 'default' },
  paid: { label: 'Pago', variant: 'outline' },
  overdue: { label: 'Vencido', variant: 'destructive' },
  cancelled: { label: 'Cancelado', variant: 'outline' },
};

export function PayableDetailDialog({ open, onClose, payable, onEdit, onConfirmPayment }: PayableDetailDialogProps) {
  if (!payable) return null;
  
  const isOverdue = payable.status !== 'paid' && payable.status !== 'cancelled' && 
    new Date(payable.due_date) < new Date(format(new Date(), 'yyyy-MM-dd'));
  
  const canPay = (payable.status === 'pending' && !payable.requires_approval) || 
    payable.status === 'approved';
  
  const copyBarcode = () => {
    if (payable.barcode) {
      navigator.clipboard.writeText(payable.barcode);
      toast.success('Linha digitável copiada');
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Detalhes da Conta</span>
            <Badge variant={isOverdue ? 'destructive' : STATUS_CONFIG[payable.status]?.variant || 'secondary'}>
              {isOverdue ? 'Vencido' : STATUS_CONFIG[payable.status]?.label || payable.status}
            </Badge>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Description */}
          <div>
            <p className="text-sm text-muted-foreground">Descrição</p>
            <p className="font-medium">{payable.description}</p>
          </div>
          
          <Separator />
          
          {/* Values */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Valor</p>
              <p className="text-xl font-bold">{formatCurrency(payable.amount_cents)}</p>
            </div>
            {payable.status === 'paid' && payable.paid_amount_cents && (
              <div>
                <p className="text-sm text-muted-foreground">Valor Pago</p>
                <p className="text-xl font-bold text-green-600">
                  {formatCurrency(payable.paid_amount_cents)}
                </p>
              </div>
            )}
          </div>
          
          {/* Discounts/Interest */}
          {(payable.discount_cents > 0 || payable.interest_cents > 0 || payable.fine_cents > 0) && (
            <div className="flex gap-4 text-sm">
              {payable.discount_cents > 0 && (
                <span className="text-green-600">
                  Desconto: {formatCurrency(payable.discount_cents)}
                </span>
              )}
              {payable.interest_cents > 0 && (
                <span className="text-red-600">
                  Juros: {formatCurrency(payable.interest_cents)}
                </span>
              )}
              {payable.fine_cents > 0 && (
                <span className="text-red-600">
                  Multa: {formatCurrency(payable.fine_cents)}
                </span>
              )}
            </div>
          )}
          
          <Separator />
          
          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Vencimento</p>
                <p className={`font-medium ${isOverdue ? 'text-red-600' : ''}`}>
                  {format(new Date(payable.due_date), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                </p>
              </div>
            </div>
            {payable.paid_at && (
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Pago em</p>
                  <p className="font-medium text-green-600">
                    {format(new Date(payable.paid_at), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                  </p>
                </div>
              </div>
            )}
          </div>
          
          <Separator />
          
          {/* Supplier */}
          {payable.supplier && (
            <div className="flex items-center gap-2">
              <Building className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Fornecedor</p>
                <p className="font-medium">{payable.supplier.name}</p>
                {payable.supplier.cnpj && (
                  <p className="text-xs text-muted-foreground">{payable.supplier.cnpj}</p>
                )}
              </div>
            </div>
          )}
          
          {/* Document */}
          {payable.document_number && (
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Documento</p>
                <p className="font-medium">{payable.document_number}</p>
              </div>
            </div>
          )}
          
          {/* Payment Method */}
          {payable.payment_method && (
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Forma de Pagamento</p>
                <p className="font-medium capitalize">{payable.payment_method}</p>
              </div>
            </div>
          )}
          
          {/* Barcode */}
          {payable.barcode && (
            <div className="flex items-start gap-2">
              <Barcode className="h-4 w-4 text-muted-foreground mt-1" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Linha Digitável</p>
                <div className="flex items-center gap-2">
                  <p className="font-mono text-xs break-all">{payable.barcode}</p>
                  <Button variant="ghost" size="icon" className="shrink-0" onClick={copyBarcode}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
          
          {/* Category & Cost Center */}
          <div className="flex gap-4">
            {payable.category && (
              <Badge variant="outline">{payable.category.name}</Badge>
            )}
            {payable.cost_center && (
              <Badge variant="secondary">{payable.cost_center.name}</Badge>
            )}
          </div>
          
          {/* Notes */}
          {payable.notes && (
            <div>
              <p className="text-sm text-muted-foreground">Observações</p>
              <p className="text-sm">{payable.notes}</p>
            </div>
          )}
          
          {/* Approval info */}
          {payable.requires_approval && payable.status === 'pending' && (
            <div className="bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                ⚠️ Esta conta requer aprovação antes do pagamento
              </p>
            </div>
          )}
        </div>
        
        <div className="flex justify-end gap-2 pt-4">
          {payable.status !== 'paid' && payable.status !== 'cancelled' && (
            <Button variant="outline" onClick={onEdit}>
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </Button>
          )}
          {canPay && (
            <Button onClick={onConfirmPayment}>
              <Check className="h-4 w-4 mr-2" />
              Confirmar Pagamento
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
