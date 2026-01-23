import { useOutletContext, Link } from 'react-router-dom';
import { CheckCircle, ArrowRight, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { StorefrontData } from '@/hooks/ecommerce/usePublicStorefront';

export function StorefrontOrderConfirmed() {
  const { storefront } = useOutletContext<{ storefront: StorefrontData }>();

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

          <h1 className="text-2xl font-bold mb-2">Pedido Confirmado!</h1>
          
          <p className="text-muted-foreground mb-6">
            Obrigado pela sua compra! Você receberá um e-mail com os detalhes do seu pedido.
          </p>

          <div className="bg-muted/50 rounded-lg p-4 mb-6">
            <p className="text-sm text-muted-foreground">
              Em caso de dúvidas, entre em contato pelo WhatsApp:
            </p>
            {storefront.whatsapp_number && (
              <a 
                href={`https://wa.me/${storefront.whatsapp_number.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium hover:underline"
                style={{ color: storefront.primary_color }}
              >
                {storefront.whatsapp_number}
              </a>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button variant="outline" asChild>
              <Link to={`/loja/${storefront.slug}`}>
                <Home className="h-4 w-4 mr-2" />
                Voltar à Loja
              </Link>
            </Button>
            <Button 
              asChild
              style={{ backgroundColor: storefront.primary_color }}
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
