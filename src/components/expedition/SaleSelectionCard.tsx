import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ExternalLink, Clock, User, Bike, Store, Truck } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCurrency } from '@/hooks/useSales';
import { getCategoryConfig, type PaymentCategory } from '@/lib/paymentCategories';

interface SaleSelectionCardProps {
  sale: {
    id: string;
    romaneio_number?: number | null;
    lead?: { name: string } | null;
    total_cents?: number | null;
    payment_category?: PaymentCategory | null;
    payment_method?: string | null;
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
  selectedBgClass = 'bg-green-50 dark:bg-green-950/30'
}: SaleSelectionCardProps) {
  const categoryConfig = getCategoryConfig(sale.payment_category);
  
  return (
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

        {/* Line 2: Price + Date + Payment Badge */}
        <div className="flex items-center gap-3 text-sm flex-wrap">
          <span className="font-semibold text-lg text-foreground">
            {formatCurrency(sale.total_cents || 0)}
          </span>
          {sale.delivered_at && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <Clock className="w-3 h-3" />
              {format(parseISO(sale.delivered_at), "dd/MM HH:mm", { locale: ptBR })}
            </span>
          )}
          <Badge 
            variant="outline" 
            className={`text-xs ${categoryConfig.bgClass} ${categoryConfig.colorClass} ${categoryConfig.borderClass}`}
          >
            {categoryConfig.emoji} {categoryConfig.shortLabel}
          </Badge>
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
  );
}
