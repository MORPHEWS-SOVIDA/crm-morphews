import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Copy, Clock, Home, ArrowRight, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { StorefrontData } from '@/hooks/ecommerce/usePublicStorefront';

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

export function StorefrontPixPayment() {
  const { storefront } = useOutletContext<{ storefront: StorefrontData }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30 * 60); // 30 minutes

  // Get data from navigation state
  const { saleId, pix_code, pix_expiration, total_cents, paymentMethod } = location.state || {};

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

  // No PIX code - redirect to store
  if (!pix_code) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <Card className="max-w-lg mx-auto">
          <CardContent className="pt-8 pb-8">
            <div className="w-16 h-16 rounded-full bg-destructive/10 mx-auto mb-4 flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <h1 className="text-2xl font-bold mb-4">Dados de pagamento não encontrados</h1>
            <Button asChild>
              <Link to={`/loja/${storefront.slug}`}>Voltar à loja</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="max-w-xl mx-auto shadow-lg">
        <CardHeader className="text-center pb-2">
          <div 
            className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4"
            style={{ backgroundColor: storefront.primary_color + '20' }}
          >
            <CheckCircle 
              className="h-8 w-8" 
              style={{ color: storefront.primary_color }}
            />
          </div>
          <CardTitle className="text-2xl">Pedido Criado!</CardTitle>
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
          <div 
            className="flex items-center justify-center gap-2 p-3 rounded-lg"
            style={{ backgroundColor: timeLeft < 300 ? 'hsl(var(--destructive) / 0.1)' : storefront.primary_color + '10' }}
          >
            <Clock className="h-5 w-5" style={{ color: timeLeft < 300 ? 'hsl(var(--destructive))' : storefront.primary_color }} />
            <span 
              className="font-medium"
              style={{ color: timeLeft < 300 ? 'hsl(var(--destructive))' : storefront.primary_color }}
            >
              Expira em: {formatTime(timeLeft)}
            </span>
          </div>

          {/* QR Code */}
          <div className="flex justify-center p-6 bg-white rounded-xl border">
            <QRCodeSVG
              value={pix_code}
              size={200}
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
                className="w-full h-20 p-3 pr-20 text-xs rounded-lg border bg-muted resize-none font-mono"
              />
              <Button
                size="sm"
                className="absolute right-2 top-2"
                onClick={handleCopy}
                style={copied ? { backgroundColor: storefront.primary_color } : undefined}
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
          <div className="space-y-2 text-sm text-muted-foreground bg-muted/50 p-4 rounded-lg">
            <p className="font-medium text-foreground">Como pagar:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Abra o app do seu banco</li>
              <li>Escolha pagar com PIX Copia e Cola</li>
              <li>Cole o código acima ou escaneie o QR Code</li>
              <li>Confirme o pagamento</li>
            </ol>
          </div>

          {/* Status notice */}
          <div className="text-center text-sm text-muted-foreground">
            <p>Após o pagamento, você receberá a confirmação por e-mail.</p>
            {storefront.whatsapp_number && (
              <p className="mt-2">
                Dúvidas? WhatsApp:{' '}
                <a 
                  href={`https://wa.me/${storefront.whatsapp_number.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium hover:underline"
                  style={{ color: storefront.primary_color }}
                >
                  {storefront.whatsapp_number}
                </a>
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
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
