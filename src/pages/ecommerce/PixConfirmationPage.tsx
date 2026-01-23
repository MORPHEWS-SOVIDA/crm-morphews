import { useEffect, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, CheckCircle, Clock, ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

export function PixConfirmationPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(15 * 60); // 15 minutes

  const { saleId, pix_code, total_cents, storefront_slug } = location.state || {};

  // Countdown timer
  useEffect(() => {
    if (!pix_code) return;
    
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [pix_code]);

  const handleCopy = () => {
    if (pix_code) {
      navigator.clipboard.writeText(pix_code);
      setCopied(true);
      toast.success('Código PIX copiado!');
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!pix_code) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold mb-4">Pedido não encontrado</h1>
        <Button asChild>
          <Link to="/">Voltar ao início</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white dark:from-green-950/20 dark:to-background py-12">
      <div className="container mx-auto px-4 max-w-xl">
        <Card className="border-green-200 dark:border-green-800 shadow-xl">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mb-4">
              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-2xl text-green-700 dark:text-green-400">
              Pedido Criado!
            </CardTitle>
            <CardDescription className="text-base">
              Escaneie o QR Code ou copie o código PIX para pagar
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Total */}
            {total_cents && (
              <div className="text-center p-4 bg-muted rounded-lg">
                <span className="text-sm text-muted-foreground">Valor a pagar:</span>
                <p className="text-3xl font-bold">{formatCurrency(total_cents)}</p>
              </div>
            )}

            {/* Timer */}
            <div className="flex items-center justify-center gap-2 text-amber-600 dark:text-amber-400">
              <Clock className="h-5 w-5" />
              <span className="font-medium">
                Expira em: {formatTime(timeLeft)}
              </span>
            </div>

            {/* QR Code */}
            <div className="flex justify-center p-6 bg-white rounded-xl">
              <QRCodeSVG
                value={pix_code}
                size={220}
                level="H"
                includeMargin
              />
            </div>

            {/* Copy Button */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Código PIX Copia e Cola:</label>
              <div className="relative">
                <textarea
                  readOnly
                  value={pix_code}
                  className="w-full h-24 p-3 pr-20 text-xs rounded-lg border bg-muted resize-none font-mono"
                />
                <Button
                  size="sm"
                  className="absolute right-2 top-2"
                  onClick={handleCopy}
                  variant={copied ? 'default' : 'secondary'}
                >
                  {copied ? (
                    <>
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-1" />
                      Copiar
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Instructions */}
            <div className="space-y-2 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Como pagar:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Abra o app do seu banco</li>
                <li>Escolha pagar via PIX Copia e Cola</li>
                <li>Cole o código copiado</li>
                <li>Confirme o pagamento</li>
              </ol>
            </div>

            {/* Status */}
            <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Aguardando confirmação do pagamento...</span>
            </div>

            {/* Back link */}
            {storefront_slug && (
              <div className="text-center pt-4">
                <Link 
                  to={`/loja/${storefront_slug}`}
                  className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Continuar comprando
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Order ID */}
        {saleId && (
          <p className="text-center text-sm text-muted-foreground mt-4">
            Pedido #{saleId.slice(0, 8).toUpperCase()}
          </p>
        )}
      </div>
    </div>
  );
}
