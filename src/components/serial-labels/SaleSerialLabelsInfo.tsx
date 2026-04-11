import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { QrCode, User, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface SaleSerialLabelsInfoProps {
  saleId: string;
}

function useSerialLabelsForSale(saleId: string) {
  return useQuery({
    queryKey: ['sale-serial-labels-info', saleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_serial_labels')
        .select('serial_code, status, product_name, assigned_at, assigned_by, shipped_at')
        .eq('sale_id', saleId)
        .order('assigned_at', { ascending: true });

      if (error) throw error;
      if (!data || data.length === 0) return [];

      // Fetch profile names for assigned_by users
      const userIds = [...new Set(data.map(d => d.assigned_by).filter(Boolean))];
      let profileMap: Record<string, string> = {};

      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name')
          .in('user_id', userIds);

        if (profiles) {
          profiles.forEach(p => {
            profileMap[p.user_id] = [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Desconhecido';
          });
        }
      }

      return data.map(d => ({
        ...d,
        assigned_by_name: d.assigned_by ? (profileMap[d.assigned_by] || 'Desconhecido') : null,
      }));
    },
    enabled: !!saleId,
  });
}

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  assigned: { label: 'Separado', variant: 'secondary' },
  shipped: { label: 'Despachado', variant: 'default' },
  delivered: { label: 'Entregue', variant: 'default' },
  returned: { label: 'Devolvido', variant: 'destructive' },
};

export function SaleSerialLabelsInfo({ saleId }: SaleSerialLabelsInfoProps) {
  const { data: labels = [], isLoading } = useSerialLabelsForSale(saleId);

  if (isLoading || labels.length === 0) return null;

  // Group by product
  const grouped: Record<string, typeof labels> = {};
  labels.forEach(l => {
    const key = l.product_name || 'Sem produto';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(l);
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <QrCode className="h-4 w-4 text-primary" />
          Etiquetas Seriais Vinculadas ({labels.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {Object.entries(grouped).map(([productName, items]) => (
          <div key={productName}>
            <p className="text-sm font-medium mb-1">{productName}</p>
            <div className="space-y-1">
              {items.map(item => {
                const st = statusLabels[item.status] || { label: item.status, variant: 'outline' as const };
                return (
                  <div key={item.serial_code} className="flex items-center gap-2 text-xs py-1 px-2 rounded bg-muted/50">
                    <span className="font-mono font-medium">{item.serial_code}</span>
                    <Badge variant={st.variant} className="text-[10px] h-4">
                      {st.label}
                    </Badge>
                    {item.assigned_by_name && (
                      <span className="flex items-center gap-1 text-muted-foreground ml-auto">
                        <User className="h-3 w-3" />
                        {item.assigned_by_name}
                      </span>
                    )}
                    {item.assigned_at && (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {format(new Date(item.assigned_at), 'dd/MM HH:mm')}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
