import { useOutletContext, Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle, ArrowRight, Home, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { StorefrontData } from '@/hooks/ecommerce/usePublicStorefront';

export function StorefrontOrderConfirmed() {
  const { storefront } = useOutletContext<{ storefront: StorefrontData }>();
  const location = useLocation();
  const saleId = (location.state as any)?.saleId;

  const { data: orderNumber } = useQuery({
    queryKey: ['order-confirmation', saleId],
    enabled: !!saleId,
    queryFn: async () => {
      const { data } = await supabase
        .from('ecommerce_orders')
        .select('order_number')
        .eq('sale_id', saleId)
        .maybeSingle();
      return data?.order_number || saleId?.slice(0, 8).toUpperCase();
    },
  });

  const displayCode = orderNumber || saleId?.slice(0, 8).toUpperCase() || '';

  const handleCopy = () => {
    if (displayCode) {
      navigator.clipboard.writeText(displayCode);
      toast.success('Código copiado!');
    }
  };

  return (
    <div className="container mx-auto px-4 py-12">
      <Card className="max-w-lg mx-auto text-center">
        <CardContent className="pt-8 pb-8">
          <div 
            className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center"
            style={{ backgroundColor: storefront.primary_color + '20' }}
          >
            <CheckCircle 
              className="h-10 w-10" 
              style={{ color: storefront.primary_color }}
            />
          </div>

          <h1 className="text-2xl font-bold mb-2" style={{ color: '#ffffff' }}>Pedido Confirmado!</h1>
          
          <p className="mb-4" style={{ color: '#d1d5db' }}>
            Obrigado pela sua compra! Você receberá um e-mail com os detalhes do seu pedido.
          </p>

          {displayCode && (
            <div 
              className="rounded-lg p-4 mb-6 inline-flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)' }}
              onClick={handleCopy}
              title="Clique para copiar"
            >
              <div>
                <p className="text-xs mb-1" style={{ color: '#9ca3af' }}>Código do pedido</p>
                <p className="text-lg font-mono font-bold tracking-wider" style={{ color: '#ffffff' }}>
                  #{displayCode}
                </p>
              </div>
              <Copy className="h-4 w-4 flex-shrink-0" style={{ color: '#9ca3af' }} />
            </div>
          )}

          <div className="rounded-lg p-4 mb-6" style={{ backgroundColor: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)' }}>
            <p className="text-sm mb-1" style={{ color: '#d1d5db' }}>
              Em caso de dúvidas, entre em contato pelo WhatsApp:
            </p>
            {storefront.whatsapp_number && (
              <a 
                href={`https://wa.me/${storefront.whatsapp_number.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold hover:underline"
                style={{ color: storefront.primary_color }}
              >
                {storefront.whatsapp_number}
              </a>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button variant="outline" asChild style={{ borderColor: 'rgba(255,255,255,0.4)', color: '#ffffff', backgroundColor: 'rgba(255,255,255,0.1)' }}>
              <Link to={`/loja/${storefront.slug}`}>
                <Home className="h-4 w-4 mr-2" />
                Voltar à Loja
              </Link>
            </Button>
            <Button 
              asChild
              style={{ backgroundColor: storefront.primary_color, color: '#ffffff' }}
            >
              <Link to={`/loja/${storefront.slug}/produtos`}>
                Continuar Comprando
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}