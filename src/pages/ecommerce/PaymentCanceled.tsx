import { useSearchParams, Link } from 'react-router-dom';
import { XCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function PaymentCanceled() {
  const [searchParams] = useSearchParams();
  const saleId = searchParams.get('sale');

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white flex items-center justify-center p-4">
      <Card className="max-w-md w-full shadow-xl border-0">
        <CardContent className="p-8 text-center">
          {/* Cancel Icon */}
          <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <XCircle className="h-12 w-12 text-orange-600" />
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Pagamento Cancelado
          </h1>
          
          <p className="text-gray-600 mb-6">
            Seu pagamento foi cancelado ou não foi concluído. Não se preocupe, nenhum valor foi cobrado.
          </p>

          <div className="bg-orange-50 rounded-lg p-4 mb-6 text-sm text-orange-800">
            <p>
              Se você teve algum problema durante o checkout, entre em contato conosco ou tente novamente.
            </p>
          </div>

          <div className="space-y-3">
            <Button 
              variant="default"
              className="w-full gap-2 bg-orange-600 hover:bg-orange-700"
              onClick={() => window.history.back()}
            >
              <RefreshCw className="h-4 w-4" />
              Tentar Novamente
            </Button>

            <Link to="/">
              <Button variant="outline" className="w-full gap-2">
                <ArrowLeft className="h-4 w-4" />
                Voltar ao início
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
