import { useSearchParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Home, MessageCircle } from 'lucide-react';

export default function LandingPaymentConfirmed() {
  const [searchParams] = useSearchParams();
  const saleId = searchParams.get('sale');

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
      <Card className="max-w-lg w-full shadow-lg">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-4">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>
          <CardTitle className="text-2xl text-green-700">Pagamento Confirmado!</CardTitle>
          <CardDescription className="text-base">
            Obrigado por sua compra. Você receberá a confirmação por e-mail em breve.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {saleId && (
            <div className="text-center p-4 bg-muted rounded-lg">
              <span className="text-sm text-muted-foreground">Número do pedido:</span>
              <p className="font-mono text-sm mt-1">{saleId}</p>
            </div>
          )}

          <div className="space-y-2 text-sm text-muted-foreground bg-green-50 p-4 rounded-lg border border-green-200">
            <p className="font-medium text-green-800">Próximos passos:</p>
            <ul className="list-disc list-inside space-y-1 text-green-700">
              <li>Você receberá um e-mail de confirmação</li>
              <li>Acompanhe o status do seu pedido</li>
              <li>Em caso de dúvidas, entre em contato conosco</li>
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Button variant="outline" asChild>
              <Link to="/">
                <Home className="h-4 w-4 mr-2" />
                Voltar ao Início
              </Link>
            </Button>
            <Button asChild className="bg-green-600 hover:bg-green-700">
              <a href="https://wa.me/5547999999999" target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-4 w-4 mr-2" />
                Falar no WhatsApp
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
