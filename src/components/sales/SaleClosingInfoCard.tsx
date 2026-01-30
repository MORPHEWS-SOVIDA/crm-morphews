import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  FileCheck, 
  ExternalLink, 
  CheckCircle, 
  Clock,
  Store,
  Bike,
  Truck,
} from 'lucide-react';
import { formatCurrency } from '@/hooks/useSales';

interface SaleClosingInfoCardProps {
  saleId: string;
}

interface ClosingInfo {
  closingId: string;
  closingNumber: number;
  closingDate: string;
  closingType: 'pickup' | 'motoboy' | 'carrier';
  status: string;
  totalAmountCents: number;
  confirmedByAuxiliarAt: string | null;
  confirmedByAdminAt: string | null;
  auxiliarName: string | null;
  adminName: string | null;
}

const closingTypeLabels: Record<string, { label: string; icon: React.ReactNode; path: string }> = {
  pickup: { label: 'Balcão', icon: <Store className="w-4 h-4" />, path: '/expedicao/baixa-balcao' },
  motoboy: { label: 'Motoboy', icon: <Bike className="w-4 h-4" />, path: '/expedicao/baixa-motoboy' },
  carrier: { label: 'Transportadora', icon: <Truck className="w-4 h-4" />, path: '/expedicao/baixa-transportadora' },
};

export function SaleClosingInfoCard({ saleId }: SaleClosingInfoCardProps) {
  const { data: closingInfo, isLoading } = useQuery({
    queryKey: ['sale-closing-info', saleId],
    queryFn: async (): Promise<ClosingInfo | null> => {
      // Get the closing for this sale
      const { data: closingSale, error } = await supabase
        .from('pickup_closing_sales')
        .select(`
          closing_id,
          closing:pickup_closings(
            id,
            closing_number,
            closing_date,
            closing_type,
            status,
            total_amount_cents,
            confirmed_at_auxiliar,
            confirmed_at_admin,
            confirmed_by_auxiliar,
            confirmed_by_admin
          )
        `)
        .eq('sale_id', saleId)
        .maybeSingle();

      if (error || !closingSale?.closing) return null;

      const closing = closingSale.closing as any;
      
      // Get profile names for confirmers
      let auxiliarName = null;
      let adminName = null;
      
      if (closing.confirmed_by_auxiliar) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('user_id', closing.confirmed_by_auxiliar)
          .maybeSingle();
        if (profile) {
          auxiliarName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
        }
      }
      
      if (closing.confirmed_by_admin) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('user_id', closing.confirmed_by_admin)
          .maybeSingle();
        if (profile) {
          adminName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
        }
      }

      return {
        closingId: closing.id,
        closingNumber: closing.closing_number,
        closingDate: closing.closing_date,
        closingType: closing.closing_type || 'pickup',
        status: closing.status,
        totalAmountCents: closing.total_amount_cents,
        confirmedByAuxiliarAt: closing.confirmed_at_auxiliar,
        confirmedByAdminAt: closing.confirmed_at_admin,
        auxiliarName,
        adminName,
      };
    },
    enabled: !!saleId,
    staleTime: 60000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="w-4 h-4 animate-spin" />
            <span className="text-sm">Carregando fechamento...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!closingInfo) {
    return null; // Sale not in any closing yet
  }

  const typeConfig = closingTypeLabels[closingInfo.closingType] || closingTypeLabels.pickup;
  
  const statusBadge = () => {
    switch (closingInfo.status) {
      case 'confirmed_final':
        return <Badge className="bg-purple-100 text-purple-700">Finalizado</Badge>;
      case 'confirmed_auxiliar':
        return <Badge className="bg-teal-100 text-teal-700">Baixado</Badge>;
      default:
        return <Badge variant="secondary">Pendente</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileCheck className="w-5 h-5 text-primary" />
          Fechamento
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {typeConfig.icon}
            <span className="font-medium">
              Fechamento #{closingInfo.closingNumber}
            </span>
            <Badge variant="outline" className="text-xs">
              {typeConfig.label}
            </Badge>
          </div>
          {statusBadge()}
        </div>

        <div className="text-sm text-muted-foreground">
          Data: {format(parseISO(closingInfo.closingDate), 'dd/MM/yyyy', { locale: ptBR })}
        </div>

        {/* Confirmation statuses */}
        <div className="space-y-1.5 text-sm">
          {closingInfo.confirmedByAuxiliarAt && (
            <div className="flex items-center gap-2 text-teal-600">
              <CheckCircle className="w-4 h-4" />
              <span>
                Baixado por {closingInfo.auxiliarName || 'Financeiro'} em{' '}
                {format(parseISO(closingInfo.confirmedByAuxiliarAt), "dd/MM 'às' HH:mm", { locale: ptBR })}
              </span>
            </div>
          )}
          {closingInfo.confirmedByAdminAt && (
            <div className="flex items-center gap-2 text-purple-600">
              <CheckCircle className="w-4 h-4" />
              <span>
                Finalizado por {closingInfo.adminName || 'Admin'} em{' '}
                {format(parseISO(closingInfo.confirmedByAdminAt), "dd/MM 'às' HH:mm", { locale: ptBR })}
              </span>
            </div>
          )}
        </div>

        <Link to={typeConfig.path}>
          <Button variant="outline" size="sm" className="w-full mt-2">
            <ExternalLink className="w-4 h-4 mr-2" />
            Ver Fechamento
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
