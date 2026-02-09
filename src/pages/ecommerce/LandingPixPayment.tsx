import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Copy, Clock, AlertCircle, Loader2, Home } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

interface SaleData {
  id: string;
  total_cents: number;
  payment_status: string;
  payment_method: string;
  pix_code?: string;
  pix_expiration?: string;
}

// Hook to fetch sale status for polling
function useSaleStatus(saleId: string | null) {
  return useQuery({
    queryKey: ['landing-pix-sale', saleId],
    queryFn: async () => {
      if (!saleId) return null;

      const { data, error } = await supabase
        .from('sales')
        .select('id, total_cents, payment_status, payment_method')
        .eq('id', saleId)
        .maybeSingle();

      if (error) throw error;
      return data as SaleData | null;
    },
    enabled: !!saleId,
    refetchInterval: 10000, // Poll every 10 seconds
  });
}

export default function LandingPixPayment() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const saleId = searchParams.get('sale');
  const [copied, setCopied] = useState(false);

  // Try to get PIX data from localStorage (set by LandingCheckoutModal)
  const storedData = useMemo(() => {
    try {
      const stored = localStorage.getItem('pix_checkout_result');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Error parsing stored PIX data:', e);
    }
    return null;
  }, []);

  const pixCode = storedData?.pix_code;
  const pixExpiration = storedData?.pix_expiration;
  const totalCents = storedData?.amount || storedData?.total_cents;
  const landingName = storedData?.landingName;
  const offerLabel = storedData?.offerLabel;

  // Poll for payment status
  const { data: sale, refetch, isLoading: isPolling } = useSaleStatus(saleId);

  const initialTimeLeft = useMemo(() => {
    if (!pixExpiration) return 30 * 60;
    const expiresAt = new Date(pixExpiration).getTime();
    if (Number.isNaN(expiresAt)) return 30 * 60;
    const diff = Math.floor((expiresAt - Date.now()) / 1000);
    return Math.max(0, diff);
  }, [pixExpiration]);

  const [timeLeft, setTimeLeft] = useState(initialTimeLeft);

  // Countdown timer
  useEffect(() => {
    if (!pixCode) return;
    
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
  }, [pixCode]);

  // Redirect once payment is confirmed
  useEffect(() => {
    const status = (sale?.payment_status || '').toLowerCase();
    if (status === 'paid') {
      // Clear stored data
      localStorage.removeItem('pix_checkout_result');
      // Redirect to success page
      navigate(`/pagamento-confirmado?sale=${saleId}`, { replace: true });
    }
  }, [sale?.payment_status, navigate, saleId]);

  const handleCopy = () => {
    if (pixCode) {
      navigator.clipboard.writeText(pixCode);
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

  // No PIX code found
  if (!pixCode) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
        <Card className="max-w-lg w-full">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="w-16 h-16 rounded-full bg-destructive/10 mx-auto mb-4 flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Dados de pagamento não encontrados</h1>
            <p className="text-muted-foreground mb-6">
              O código PIX expirou ou não foi gerado corretamente.
            </p>
            <Button asChild>
              <Link to="/">
                <Home className="h-4 w-4 mr-2" />
                Ir para o Início
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const effectiveTotalCents = sale?.total_cents ?? totalCents;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 py-8 px-4">
      <Card className="max-w-xl mx-auto shadow-lg">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <CardTitle className="text-2xl">Pedido Criado!</CardTitle>
          <CardDescription className="text-base">
            {landingName && <span className="block font-medium text-foreground">{landingName}</span>}
            {offerLabel && <span className="block">{offerLabel}</span>}
            Escaneie o QR Code ou copie o código PIX para pagar
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Total */}
          {effectiveTotalCents != null && (
            <div className="text-center p-4 bg-muted rounded-lg">
              <span className="text-sm text-muted-foreground">Valor a pagar:</span>
              <p className="text-3xl font-bold text-green-600">{formatCurrency(effectiveTotalCents)}</p>
            </div>
          )}

          {/* Timer */}
          <div 
            className={`flex items-center justify-center gap-2 p-3 rounded-lg ${
              timeLeft < 300 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
            }`}
          >
            <Clock className="h-5 w-5" />
            <span className="font-medium">
              Expira em: {formatTime(timeLeft)}
            </span>
          </div>

          {/* QR Code */}
          <div className="flex justify-center p-6 bg-white rounded-xl border">
            <QRCodeSVG
              value={pixCode}
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
                value={pixCode}
                className="w-full h-20 p-3 pr-20 text-xs rounded-lg border bg-muted resize-none font-mono"
              />
              <Button
                size="sm"
                className="absolute right-2 top-2"
                onClick={handleCopy}
                variant={copied ? "default" : "secondary"}
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
            <p>Após o pagamento, você receberá a confirmação automaticamente.</p>
            <div className="mt-3 flex flex-col items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isPolling}
              >
                {isPolling ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  'Já paguei — verificar agora'
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
