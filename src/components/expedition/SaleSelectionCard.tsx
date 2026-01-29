import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  ExternalLink, 
  Clock, 
  User, 
  Bike, 
  Store, 
  Truck, 
  FileImage, 
  Pencil,
  Loader2,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCurrency } from '@/hooks/useSales';
import { getCategoryConfig, PAYMENT_CATEGORIES, type PaymentCategory } from '@/lib/paymentCategories';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { getSignedStorageUrl } from '@/lib/storage-utils';

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
    motoboy_profile?: { first_name: string | null; last_name: string | null } | null;
    seller_profile?: { first_name: string | null; last_name: string | null } | null;
  };
  isSelected: boolean;
  onToggle: () => void;
  selectedBgClass?: string;
  showProofLink?: boolean;
  showEditPayment?: boolean;
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
  onPaymentCategoryChange,
}: SaleSelectionCardProps) {
  const queryClient = useQueryClient();
  const categoryConfig = getCategoryConfig(sale.payment_category);
  const [isProofDialogOpen, setIsProofDialogOpen] = useState(false);
  const [isEditPaymentOpen, setIsEditPaymentOpen] = useState(false);
  const [proofImageUrl, setProofImageUrl] = useState<string | null>(null);
  const [loadingProof, setLoadingProof] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<PaymentCategory>(sale.payment_category || 'other');

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
    setSelectedCategory(sale.payment_category || 'other');
    setIsEditPaymentOpen(true);
  };

  const handleSavePaymentCategory = async () => {
    setIsSaving(true);
    try {
      // Skip 'other' as it's not a valid DB category - just update locally
      if (selectedCategory === 'other') {
        // Clear payment method if 'other' is selected
        const { error } = await supabase
          .from('sales')
          .update({
            payment_method_id: null,
            payment_method: 'Outros',
          })
          .eq('id', sale.id);

        if (error) throw error;
      } else {
        // Find a payment_method that matches this category to update payment_method_id
        const { data: matchingMethod } = await supabase
          .from('payment_methods')
          .select('id, name')
          .eq('category', selectedCategory)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();

        // Update the sale
        const updateData: Record<string, unknown> = {};
        if (matchingMethod) {
          updateData.payment_method_id = matchingMethod.id;
          updateData.payment_method = matchingMethod.name;
        } else {
          // If no method found, just update the description
          updateData.payment_method = getCategoryConfig(selectedCategory).label;
        }

        const { error } = await supabase
          .from('sales')
          .update(updateData)
          .eq('id', sale.id);

        if (error) throw error;
      }

      toast.success('Forma de pagamento atualizada!');
      setIsEditPaymentOpen(false);
      
      // Invalidate queries to refresh the list
      queryClient.invalidateQueries({ queryKey: ['available-closing-sales'] });
      queryClient.invalidateQueries({ queryKey: ['expedition-sales'] });
      
      if (onPaymentCategoryChange) {
        onPaymentCategoryChange(sale.id, selectedCategory);
      }
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
          {/* Line 1: Romaneio + Client Name + Delivery Type + External Link */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-primary">#{sale.romaneio_number}</span>
            <span className="font-medium truncate max-w-[200px]">{sale.lead?.name || 'Cliente'}</span>
            {getDeliveryTypeBadge(sale.delivery_type)}
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-1 opacity-60 hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                window.open(`/vendas/${sale.id}`, '_blank');
              }}
            >
              <ExternalLink className="w-3 h-3" />
            </Button>
          </div>

          {/* Line 2: Price + Date + Payment Badge + Actions */}
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <span className="font-semibold text-lg text-foreground">
              {formatCurrency(sale.total_cents || 0)}
            </span>
            {sale.delivered_at && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <Clock className="w-3 h-3" />
                {format(parseISO(sale.delivered_at), "dd/MM HH:mm", { locale: ptBR })}
              </span>
            )}
            
            {/* Payment Badge with Edit Button */}
            <div className="flex items-center gap-1">
              <Badge 
                variant="outline" 
                className={`text-xs ${categoryConfig.bgClass} ${categoryConfig.colorClass} ${categoryConfig.borderClass}`}
              >
                {categoryConfig.emoji} {categoryConfig.shortLabel}
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

          {/* Line 3: Motoboy / Seller info */}
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

      {/* Edit Payment Category Dialog */}
      <Dialog open={isEditPaymentOpen} onOpenChange={setIsEditPaymentOpen}>
        <DialogContent className="max-w-md" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Alterar Forma de Pagamento - #{sale.romaneio_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Categoria de Pagamento</label>
              <Select value={selectedCategory} onValueChange={(v) => setSelectedCategory(v as PaymentCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_CATEGORIES.map(cat => (
                    <SelectItem key={cat.key} value={cat.key}>
                      <span className="flex items-center gap-2">
                        {cat.emoji} {cat.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditPaymentOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSavePaymentCategory} disabled={isSaving}>
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
