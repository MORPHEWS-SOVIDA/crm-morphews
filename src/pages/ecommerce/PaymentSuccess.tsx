import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, Package, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const saleId = searchParams.get('sale');
  const sessionId = searchParams.get('session_id');
  const [saleData, setSaleData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (saleId) {
      fetchSaleData();
    } else {
      setIsLoading(false);
    }
  }, [saleId]);

  const fetchSaleData = async () => {
    try {
      const { data, error } = await supabase
        .from('sales')
        .select(`
          id,
          total_cents,
          status,
          payment_status,
          sale_items(
            quantity,
            product:lead_products(name, image_url)
          ),
          lead:leads(full_name, email)
        `)
        .eq('id', saleId)
        .single();

      if (!error && data) {
        setSaleData(data);
      }
    } catch (e) {
      console.error('Error fetching sale:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center p-4">
      <Card className="max-w-md w-full shadow-xl border-0">
        <CardContent className="p-8 text-center">
          {/* Success Icon */}
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-scale-in">
            <CheckCircle className="h-12 w-12 text-green-600" />
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Pagamento Confirmado!
          </h1>
          
          <p className="text-gray-600 mb-6">
            Seu pedido foi processado com sucesso. Você receberá um e-mail com os detalhes.
          </p>

          {saleData && (
            <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-green-100 rounded flex items-center justify-center">
                  <Package className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-sm">Pedido #{saleData.id.slice(0, 8)}</p>
                  <p className="text-xs text-muted-foreground">
                    {saleData.sale_items?.[0]?.product?.name || 'Produto'}
                  </p>
                </div>
              </div>
              <div className="flex justify-between items-center pt-3 border-t">
                <span className="text-sm text-muted-foreground">Total pago:</span>
                <span className="font-bold text-green-600">
                  {formatCurrency(saleData.total_cents)}
                </span>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Em breve você receberá mais informações no e-mail 
              {saleData?.lead?.email && (
                <span className="font-medium"> {saleData.lead.email}</span>
              )}
            </p>

            <Link to="/">
              <Button className="w-full gap-2 bg-green-600 hover:bg-green-700">
                Voltar ao início
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
