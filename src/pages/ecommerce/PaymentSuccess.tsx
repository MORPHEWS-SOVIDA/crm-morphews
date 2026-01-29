import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, Package, ArrowRight, Loader2, Copy, Clock, RefreshCw, MessageCircle, Sparkles } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface PixPaymentData {
  saleId: string;
  pix_code: string;
  pix_expiration?: string;
  total_cents: number;
  storefront_slug?: string;
  organization_whatsapp?: string;
}

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const saleId = searchParams.get('sale');
  const paymentMethod = searchParams.get('method');
  const [saleData, setSaleData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pixData, setPixData] = useState<PixPaymentData | null>(null);
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30 * 60); // 30 minutes default
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);
  const [checkAttempts, setCheckAttempts] = useState(0);

  // Check if this is a PIX payment pending confirmation
  const isPixPending = paymentMethod === 'pix' && pixData && !paymentConfirmed;

  // Function to check payment status via public edge function
  const checkPaymentStatus = useCallback(async () => {
    if (!saleId) return false;
    
    try {
      setIsCheckingPayment(true);
      
      // Use the public edge function that doesn't require auth
      const params = new URLSearchParams({
        sale_id: saleId,
        storefront_slug: pixData?.storefront_slug || '_standalone',
      });
      
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ecommerce-sale-status?${params.toString()}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        }
      );
      
      const json = await resp.json();
      console.log('[PaymentSuccess] Status check response:', json);
      
      if (json?.success && json?.sale?.payment_status) {
        const status = json.sale.payment_status.toLowerCase();
        if (status === 'paid') {
          setPaymentConfirmed(true);
          localStorage.removeItem('pix_payment_data');
          toast.success('🎉 Pagamento confirmado!');
          return true;
        }
      }
      return false;
    } catch (e) {
      console.error('Error checking payment status:', e);
      return false;
    } finally {
      setIsCheckingPayment(false);
    }
  }, [saleId, pixData?.storefront_slug]);

  // Manual check button handler
  const handleManualCheck = async () => {
    setCheckAttempts(prev => prev + 1);
    const confirmed = await checkPaymentStatus();
    if (!confirmed) {
      if (checkAttempts >= 2) {
        toast.info('Pode demorar alguns instantes para o banco processar. Verifique seu e-mail ou WhatsApp.');
      } else {
        toast.info('Ainda não confirmado. Aguarde alguns instantes.');
      }
    }
  };

  // WhatsApp support handler
  const handleWhatsAppSupport = () => {
    const whatsappNumber = pixData?.organization_whatsapp || '5551999999999'; // fallback
    const message = encodeURIComponent(`Olá! Fiz um pagamento PIX do pedido ${saleId?.slice(0, 8)} e gostaria de enviar o comprovante.`);
    window.open(`https://wa.me/${whatsappNumber.replace(/\D/g, '')}?text=${message}`, '_blank');
  };

  useEffect(() => {
    // Try to load PIX data from localStorage
    if (paymentMethod === 'pix') {
      const storedData = localStorage.getItem('pix_payment_data');
      if (storedData) {
        try {
          const parsed = JSON.parse(storedData);
          setPixData(parsed);
          
          // Calculate remaining time from expiration
          if (parsed.pix_expiration) {
            const expiresAt = new Date(parsed.pix_expiration).getTime();
            const now = Date.now();
            const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
            setTimeLeft(remaining);
          }
        } catch (e) {
          console.error('Error parsing PIX data:', e);
        }
      }
    }
  }, [paymentMethod]);

  useEffect(() => {
    if (saleId) {
      fetchSaleData();
    } else {
      setIsLoading(false);
    }
  }, [saleId]);

  // Countdown timer for PIX
  useEffect(() => {
    if (!isPixPending || timeLeft <= 0) return;
    
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
  }, [isPixPending, timeLeft]);

  // Poll for payment status using public edge function - faster polling (5s)
  useEffect(() => {
    if (!isPixPending || !saleId) return;

    // Initial check
    checkPaymentStatus();

    // Poll every 5 seconds for faster feedback
    const pollInterval = setInterval(() => {
      checkPaymentStatus();
    }, 5000);

    return () => clearInterval(pollInterval);
  }, [isPixPending, saleId, checkPaymentStatus]);

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
        // If payment is already confirmed, update state
        if (data.payment_status === 'paid') {
          setPaymentConfirmed(true);
          localStorage.removeItem('pix_payment_data');
        }
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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCopyPixCode = () => {
    if (pixData?.pix_code) {
      navigator.clipboard.writeText(pixData.pix_code);
      setCopied(true);
      toast.success('Código PIX copiado!');
      setTimeout(() => setCopied(false), 3000);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    );
  }

  // Show PIX QR Code if payment is pending
  if (isPixPending) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white dark:from-green-950/20 dark:to-background py-8">
        <div className="container mx-auto px-4 max-w-md">
          <Card className="border-green-200 dark:border-green-800 shadow-xl">
            <CardContent className="p-6 text-center space-y-4">
              {/* Header */}
              <div>
                <div className="mx-auto w-14 h-14 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mb-3">
                  <CheckCircle className="h-7 w-7 text-green-600 dark:text-green-400" />
                </div>
                <h1 className="text-xl font-bold text-green-700 dark:text-green-400">
                  Pedido Criado!
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Escaneie o QR Code ou copie o código PIX
                </p>
              </div>

              {/* Total */}
              <div className="p-3 bg-muted rounded-lg">
                <span className="text-xs text-muted-foreground">Valor a pagar:</span>
                <p className="text-2xl font-bold">
                  {formatCurrency(pixData.total_cents)}
                </p>
              </div>

              {/* Timer */}
              {timeLeft > 0 && (
                <div className="flex items-center justify-center gap-2 text-amber-600 dark:text-amber-400">
                  <Clock className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    Expira em: {formatTime(timeLeft)}
                  </span>
                </div>
              )}

              {/* QR Code */}
              <div className="flex justify-center p-4 bg-white rounded-xl">
                <QRCodeSVG
                  value={pixData.pix_code}
                  size={200}
                  level="H"
                  includeMargin
                />
              </div>

              {/* "Já Paguei" Button - MOVED CLOSER TO QR CODE */}
              <Button
                onClick={handleManualCheck}
                disabled={isCheckingPayment}
                size="lg"
                className={cn(
                  "w-full gap-2 text-base font-semibold transition-all",
                  "bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700",
                  "shadow-lg hover:shadow-xl",
                  "animate-pulse hover:animate-none"
                )}
              >
                {isCheckingPayment ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5" />
                    JÁ PAGUEI ✓
                  </>
                )}
              </Button>

              {/* Helper text */}
              <p className="text-xs text-muted-foreground">
                Ou verifique se recebeu um e-mail ou WhatsApp com seu comprovante de compra
              </p>

              {/* WhatsApp support button - shows after 3+ attempts */}
              {checkAttempts >= 3 && (
                <div className="pt-2 border-t">
                  <p className="text-sm text-muted-foreground mb-3">
                    Está com dificuldades? Envie o comprovante por WhatsApp:
                  </p>
                  <Button
                    onClick={handleWhatsAppSupport}
                    variant="outline"
                    className="w-full gap-2 border-green-500 text-green-600 hover:bg-green-50"
                  >
                    <MessageCircle className="h-4 w-4" />
                    Enviar comprovante por WhatsApp
                  </Button>
                </div>
              )}

              {/* Copy Button */}
              <div className="space-y-2 text-left pt-2 border-t">
                <label className="text-xs font-medium text-muted-foreground">Código PIX Copia e Cola:</label>
                <div className="relative">
                  <textarea
                    readOnly
                    value={pixData.pix_code}
                    className="w-full h-20 p-2 pr-20 text-xs rounded-lg border bg-muted resize-none font-mono"
                  />
                  <Button
                    size="sm"
                    className="absolute right-2 top-2"
                    onClick={handleCopyPixCode}
                    variant={copied ? 'default' : 'secondary'}
                  >
                    {copied ? (
                      <>
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Copiado
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3 mr-1" />
                        Copiar
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Status indicator */}
              <div className="flex items-center justify-center gap-2 p-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span className="text-xs">Verificando pagamento automaticamente...</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show success message for confirmed payments
  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center p-4">
      <Card className="max-w-md w-full shadow-xl border-0">
        <CardContent className="p-8 text-center">
          {/* Success Icon with animation */}
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
            <CheckCircle className="h-12 w-12 text-green-600" />
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            🎉 Pagamento Confirmado!
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
