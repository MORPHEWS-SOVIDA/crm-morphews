import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Plus, Eye, Package, Printer, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useLeadSales, formatCurrency, getStatusLabel, getStatusColor } from '@/hooks/useSales';
import { carrierTrackingLabels } from '@/hooks/useCarrierTracking';
import { useMyPermissions } from '@/hooks/useUserPermissions';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface LeadSalesSectionProps {
  leadId: string;
  leadName?: string;
}

export function LeadSalesSection({ leadId, leadName }: LeadSalesSectionProps) {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { data: permissions } = useMyPermissions();
  const { data: sales, isLoading } = useLeadSales(leadId);
  
  // Check if new sale button should be hidden
  const hideNewSaleButton = !isAdmin && permissions?.sales_hide_new_button;

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl p-6 shadow-card">
        <div className="flex items-center gap-2 mb-4">
          <ShoppingCart className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Vendas</h2>
        </div>
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl p-6 shadow-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Vendas</h2>
          {sales && sales.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {sales.length}
            </Badge>
          )}
        </div>
        {!hideNewSaleButton && (
          <Button 
            size="sm"
            onClick={() => navigate(`/vendas/nova?leadId=${leadId}`)}
          >
            <Plus className="w-4 h-4 mr-1" />
            Nova Venda
          </Button>
        )}
      </div>

      {!sales || sales.length === 0 ? (
        <div className="text-center py-8">
          <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
          <p className="text-muted-foreground mb-3">Nenhuma venda registrada</p>
          {!hideNewSaleButton && (
            <Button 
              variant="outline"
              onClick={() => navigate(`/vendas/nova?leadId=${leadId}`)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Criar primeira venda
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {sales.map((sale) => (
            <div 
              key={sale.id} 
              className="p-4 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={getStatusColor(sale.status)}>
                      {getStatusLabel(sale.status)}
                    </Badge>
                    {(sale as any).delivery_type === 'carrier' && (sale as any).carrier_tracking_status && (
                      <Badge variant="outline" className="text-xs flex items-center gap-1">
                        <Truck className="w-3 h-3" />
                        {carrierTrackingLabels[(sale as any).carrier_tracking_status as keyof typeof carrierTrackingLabels]}
                      </Badge>
                    )}
                    <span className="text-sm text-muted-foreground">
                      {format(new Date(sale.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                  </div>
                  <p className="font-semibold text-primary text-lg mt-1">
                    {formatCurrency(sale.total_cents)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => window.open(`/vendas/${sale.id}`, '_blank')}
                    title="Ver detalhes"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => navigate(`/vendas/${sale.id}/romaneio`)}
                    title="Imprimir romaneio"
                  >
                    <Printer className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
