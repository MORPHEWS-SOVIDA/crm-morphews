import React, { useState, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Clock, 
  User, 
  Bike, 
  Store, 
  Truck, 
  FileImage, 
  Pencil,
  Loader2,
  Package,
  MapPin,
  Eye,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCurrency } from '@/hooks/useSales';
import { getCategoryConfig, type PaymentCategory } from '@/lib/paymentCategories';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { getSignedStorageUrl } from '@/lib/storage-utils';
import { EditSaleOnClosingDialog } from '@/components/expedition/EditSaleOnClosingDialog';
import { useCurrentTenantId } from '@/hooks/useTenant';
import { PaymentConfirmationDialog, PaymentConfirmationData } from '@/components/sales/PaymentConfirmationDialog';
import { useSaveSalePayments } from '@/hooks/useSalePayments';

// Tracking status labels for display
const TRACKING_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  waiting_post: { label: 'Aguardando postagem', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  posted: { label: 'Postado', color: 'bg-blue-100 text-blue-700 border-blue-300' },
  in_transit: { label: 'Em trânsito', color: 'bg-blue-100 text-blue-700 border-blue-300' },
  in_destination_city: { label: 'Na cidade destino', color: 'bg-indigo-100 text-indigo-700 border-indigo-300' },
  out_for_delivery: { label: 'Saiu para entrega', color: 'bg-purple-100 text-purple-700 border-purple-300' },
  delivered: { label: 'Entregue', color: 'bg-green-100 text-green-700 border-green-300' },
  returned: { label: 'Devolvido', color: 'bg-red-100 text-red-700 border-red-300' },
  generated: { label: 'Etiqueta gerada', color: 'bg-gray-100 text-gray-700 border-gray-300' },
};

interface SaleSelectionCardProps {
  sale: {
    id: string;
    romaneio_number?: number | null;
    lead?: { name: string } | null;
    total_cents?: number | null;
    payment_category?: PaymentCategory | null;
    payment_method?: string | null;
    payment_method_id?: string | null;
    payment_proof_url?: string | null;
    delivered_at?: string | null;
    scheduled_delivery_date?: string | null;
    created_at?: string | null;
    delivery_type?: string | null;
    status?: string | null;
    delivery_status?: string | null;
    tracking_code?: string | null;
    carrier_tracking_status?: string | null;
    modified_at_closing?: boolean | null;
    melhor_envio_label?: {
      id: string;
      tracking_code: string | null;
      status: string | null;
      company_name?: string | null;
      service_name?: string | null;
      label_pdf_url?: string | null;
    } | null;
    motoboy_profile?: { first_name: string | null; last_name: string | null } | null;
    seller_profile?: { first_name: string | null; last_name: string | null } | null;
  };
  isSelected: boolean;
  onToggle: () => void;
  selectedBgClass?: string;
  showProofLink?: boolean;
  showEditPayment?: boolean;
  showTracking?: boolean;
  showEditSale?: boolean;
  onPaymentCategoryChange?: (saleId: string, newCategory: PaymentCategory) => void;
}

const getDeliveryTypeBadge = (type: string | null | undefined) => {
  switch (type) {
    case 'motoboy':
      return (
        <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-xs">
          <Bike className="w-3 h-3 mr-1" />
          Motoboy
        </Badge>
      );
    case 'pickup':
      return (
        <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs">
          <Store className="w-3 h-3 mr-1" />
          Balcão
        </Badge>
      );
    case 'carrier':
      return (
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
          <Truck className="w-3 h-3 mr-1" />
          Transportadora
        </Badge>
      );
    default:
      return null;
  }
};

export function SaleSelectionCard({ 
  sale, 
  isSelected, 
  onToggle,
  selectedBgClass = 'bg-green-50 dark:bg-green-950/30',
  showProofLink = true,
  showEditPayment = true,
  showTracking = false,
  showEditSale = false,
  onPaymentCategoryChange,
}: SaleSelectionCardProps) {
  const queryClient = useQueryClient();
  const { data: tenantId } = useCurrentTenantId();
  const categoryConfig = getCategoryConfig(sale.payment_category);
  const [isProofDialogOpen, setIsProofDialogOpen] = useState(false);
  const [isEditPaymentOpen, setIsEditPaymentOpen] = useState(false);
  const [isEditSaleOpen, setIsEditSaleOpen] = useState(false);
  const [proofImageUrl, setProofImageUrl] = useState<string | null>(null);
  const [loadingProof, setLoadingProof] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const saveSalePayments = useSaveSalePayments();

  const handleOpenProof = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!sale.payment_proof_url) return;
    
    setLoadingProof(true);
    setIsProofDialogOpen(true);
    
    try {
      const signedUrl = await getSignedStorageUrl(sale.payment_proof_url);
      setProofImageUrl(signedUrl);
    } catch (error) {
      console.error('Error loading proof:', error);
      toast.error('Erro ao carregar comprovante');
    } finally {
      setLoadingProof(false);
    }
  };

  const handleOpenEditPayment = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditPaymentOpen(true);
  };

  const handlePaymentConfirm = async (data: PaymentConfirmationData) => {
    setIsSaving(true);
    try {
      // Build update payload – payment category is derived from payment_methods and
      // must not be persisted directly on sales.
      const updatePayload: Record<string, unknown> = {
        payment_method_id: data.payment_method_id || null,
        payment_method: data.payment_method_name || 'Não informado',
        modified_at_closing: true,
      };

      // If the operator adjusted the total value, persist it
      if (data.adjusted_total_cents != null && data.adjusted_total_cents !== (sale.total_cents || 0)) {
        updatePayload.total_cents = data.adjusted_total_cents;
        // Also update discount to reflect the difference
        const originalTotal = sale.total_cents || 0;
        if (data.adjusted_total_cents < originalTotal) {
          updatePayload.discount_cents = originalTotal - data.adjusted_total_cents;
        }
      }

      const { error } = await supabase
        .from('sales')
        .update(updatePayload)
        .eq('id', sale.id);

      if (error) throw error;

      // Save split payment lines to sale_payments
      const effectiveTotal = data.adjusted_total_cents ?? (sale.total_cents || 0);
      if (data.payment_lines && data.payment_lines.length > 0 && tenantId) {
        await saveSalePayments.mutateAsync({
          saleId: sale.id,
          organizationId: tenantId,
          payments: data.payment_lines.map((l) => ({
            payment_method_id: l.payment_method_id || null,
            payment_method_name: l.payment_method_name,
            amount_cents: l.amount_cents,
          })),
        });
      }

      toast.success('Pagamento e valor atualizados!');
      setIsEditPaymentOpen(false);
      
      queryClient.invalidateQueries({ queryKey: ['available-closing-sales'] });
      queryClient.invalidateQueries({ queryKey: ['available-pickup-sales'] });
      queryClient.invalidateQueries({ queryKey: ['expedition-sales'] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
    } catch (error) {
      console.error('Error updating payment:', error);
      toast.error('Erro ao atualizar forma de pagamento');
    } finally {
      setIsSaving(false);
    }
  };
  
  return (
    <>
      <div
        className={`flex items-start gap-4 p-4 cursor-pointer transition-all border-b last:border-b-0 ${
          isSelected 
            ? selectedBgClass
            : 'hover:bg-muted/50'
        }`}
        onClick={onToggle}
      >
        <Checkbox checked={isSelected} className="mt-1" />
        <div className="flex-1 min-w-0 space-y-2">
          {/* Line 1: Romaneio + Client Name + Delivery Type + View Sale Button */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-primary">#{sale.romaneio_number}</span>
            <span className="font-medium truncate max-w-[200px]">{sale.lead?.name || 'Cliente'}</span>
            {getDeliveryTypeBadge(sale.delivery_type)}
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                window.open(`/vendas/${sale.id}`, '_blank');
              }}
              title="Ver venda em nova aba"
            >
              <Eye className="w-3 h-3 mr-1" />
            Ver Venda
            </Button>
            {showEditSale && (
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2 text-xs bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditSaleOpen(true);
                }}
                title="Editar venda na baixa"
              >
                <Pencil className="w-3 h-3 mr-1" />
                Editar Venda
              </Button>
            )}
            {(sale as any).modified_at_closing && (
              <Badge variant="outline" className="text-xs bg-amber-100 text-amber-700 border-amber-300">
                ⚠️ Alterada na baixa
              </Badge>
            )}
          </div>

          {/* Line 2: Price + Sale Date + Delivery Date + Payment Method Name + Actions */}
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <span className="font-semibold text-lg text-foreground">
              {formatCurrency(sale.total_cents || 0)}
            </span>
            {/* Sale Date - when the sale was created */}
            {sale.created_at && (
              <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                Venda: {format(parseISO(sale.created_at), "dd/MM/yy", { locale: ptBR })}
              </span>
            )}
            {/* Delivery Date - when it was delivered */}
            {sale.delivered_at && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <Clock className="w-3 h-3" />
                Entregue: {format(parseISO(sale.delivered_at), "dd/MM HH:mm", { locale: ptBR })}
              </span>
            )}
            
            {/* Payment Method - shows full name with edit button */}
            <div className="flex items-center gap-1">
              <Badge 
                variant="outline" 
                className={`text-xs ${categoryConfig.bgClass} ${categoryConfig.colorClass} ${categoryConfig.borderClass}`}
                title={sale.payment_method || categoryConfig.label}
              >
                {categoryConfig.emoji} {sale.payment_method || categoryConfig.shortLabel}
              </Badge>
              {showEditPayment && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 opacity-60 hover:opacity-100"
                  onClick={handleOpenEditPayment}
                  title="Alterar forma de pagamento"
                >
                  <Pencil className="w-3 h-3" />
                </Button>
              )}
            </div>

            {/* Proof Link */}
            {showProofLink && sale.payment_proof_url && (
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2 text-xs bg-green-50 border-green-300 text-green-700 hover:bg-green-100"
                onClick={handleOpenProof}
              >
                <FileImage className="w-3 h-3 mr-1" />
                Ver Comprovante
              </Button>
            )}
          </div>

          {/* Line 3: Tracking Info (for carrier) */}
          {showTracking && (
            <div className="flex items-center gap-2 flex-wrap">
              {/* Delivery Status Badge */}
              {sale.delivery_status && (
                <Badge 
                  variant="outline" 
                  className={`text-xs ${
                    sale.delivery_status.startsWith('delivered') 
                      ? 'bg-green-100 text-green-700 border-green-300' 
                      : sale.delivery_status === 'pending' 
                        ? 'bg-yellow-100 text-yellow-700 border-yellow-300'
                        : 'bg-gray-100 text-gray-700 border-gray-300'
                  }`}
                >
                  {sale.delivery_status.startsWith('delivered') ? '✅ Entregue' : '⏳ Pendente'}
                </Badge>
              )}
              
              {/* Carrier Status Badge (from Melhor Envio webhook) */}
              {sale.carrier_tracking_status && (
                <Badge 
                  variant="outline" 
                  className={`text-xs ${TRACKING_STATUS_LABELS[sale.carrier_tracking_status]?.color || 'bg-gray-100 text-gray-700'}`}
                >
                  <MapPin className="w-3 h-3 mr-1" />
                  {TRACKING_STATUS_LABELS[sale.carrier_tracking_status]?.label || sale.carrier_tracking_status}
                </Badge>
              )}

              {/* Helper: check if tracking code is a valid carrier code (not UUID) */}
              {(() => {
                // UUIDs have format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
                const isValidTrackingCode = sale.tracking_code && 
                  !sale.tracking_code.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
                
                return (
                  <>
                    {/* Tracking Code Badge - only show valid codes */}
                    {isValidTrackingCode && (
                      <Badge variant="outline" className="text-xs bg-indigo-50 border-indigo-300 text-indigo-700">
                        <Package className="w-3 h-3 mr-1" />
                        {sale.tracking_code}
                      </Badge>
                    )}

                    {/* Carrier name */}
                    {sale.melhor_envio_label?.company_name && (
                      <span className="text-xs text-muted-foreground">
                        {sale.melhor_envio_label.company_name} {sale.melhor_envio_label.service_name && `- ${sale.melhor_envio_label.service_name}`}
                      </span>
                    )}

                    {/* External Tracking Button - PROMINENT, only show with valid tracking code */}
                    {isValidTrackingCode && (
                      <Button
                        variant="default"
                        size="sm"
                        className="h-7 px-3 text-xs bg-yellow-500 hover:bg-yellow-600 text-black font-semibold"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(`https://rastreamento.correios.com.br/app/index.php?objeto=${sale.tracking_code}`, '_blank');
                        }}
                        title="Rastrear no site dos Correios"
                      >
                        📦 Rastrear Correios
                      </Button>
                    )}

                    {/* Status: Label generated but not yet posted */}
                    {!isValidTrackingCode && sale.melhor_envio_label?.id && (
                      <Badge variant="outline" className="text-xs bg-amber-100 text-amber-700 border-amber-300">
                        🏷️ Etiqueta gerada (aguardando postagem)
                      </Badge>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {/* Line 4: Motoboy / Seller info */}
          <div className="flex items-center gap-3 flex-wrap">
            {sale.motoboy_profile?.first_name && (
              <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-700">
                <Bike className="w-3 h-3 mr-1" />
                Motoboy: {sale.motoboy_profile.first_name}
              </Badge>
            )}
            {sale.seller_profile?.first_name && (
              <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                <User className="w-3 h-3 mr-1" />
                {sale.seller_profile.first_name}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Proof Image Dialog */}
      <Dialog open={isProofDialogOpen} onOpenChange={setIsProofDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Comprovante de Pagamento - #{sale.romaneio_number}</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center min-h-[300px]">
            {loadingProof ? (
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            ) : proofImageUrl ? (
              <img 
                src={proofImageUrl} 
                alt="Comprovante de pagamento" 
                className="max-w-full max-h-[70vh] object-contain rounded-lg"
              />
            ) : (
              <p className="text-muted-foreground">Erro ao carregar imagem</p>
            )}
          </div>
          {proofImageUrl && (
            <div className="flex justify-end gap-2 mt-4">
              <Button
                variant="outline"
                onClick={() => window.open(proofImageUrl, '_blank')}
              >
                Abrir em nova aba
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Split Payment Dialog */}
      <PaymentConfirmationDialog
        open={isEditPaymentOpen}
        onOpenChange={setIsEditPaymentOpen}
        onConfirm={handlePaymentConfirm}
        totalCents={sale.total_cents || 0}
        existingPaymentMethodId={sale.payment_method_id}
        allowTotalEdit={true}
      />

      {/* Edit Sale on Closing Dialog */}
      {showEditSale && (
        <EditSaleOnClosingDialog
          open={isEditSaleOpen}
          onOpenChange={setIsEditSaleOpen}
          saleId={sale.id}
          saleTotalCents={sale.total_cents || 0}
          romaneioNumber={sale.romaneio_number}
          clientName={sale.lead?.name}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['available-closing-sales'] });
            queryClient.invalidateQueries({ queryKey: ['available-pickup-sales'] });
          }}
        />
      )}
    </>
  );
}
