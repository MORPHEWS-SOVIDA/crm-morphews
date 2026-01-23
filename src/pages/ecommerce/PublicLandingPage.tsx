import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Shield, Clock, Star, Play, ShoppingCart, ChevronDown, ChevronUp } from 'lucide-react';
import { LandingCheckoutModal } from '@/components/ecommerce/LandingCheckoutModal';
import { CountdownTimer } from '@/components/ecommerce/CountdownTimer';
import { TrackingPixels } from '@/components/ecommerce/TrackingPixels';
import { SalesChatbot } from '@/components/ecommerce/SalesChatbot';
import { LandingPageStructuredData } from '@/components/ecommerce/StructuredData';

interface LandingOffer {
  id: string;
  quantity: number;
  label: string;
  price_cents: number;
  original_price_cents: number | null;
  discount_percentage: number | null;
  badge_text: string | null;
  is_highlighted: boolean;
  display_order: number;
}

interface PublicLandingPage {
  id: string;
  organization_id: string;
  product_id: string;
  name: string;
  slug: string;
  headline: string | null;
  subheadline: string | null;
  video_url: string | null;
  benefits: string[];
  testimonials: { name: string; text: string; avatar?: string }[];
  faq: { question: string; answer: string }[];
  urgency_text: string | null;
  guarantee_text: string | null;
  logo_url: string | null;
  primary_color: string;
  whatsapp_number: string | null;
  facebook_pixel_id: string | null;
  google_analytics_id: string | null;
  custom_css: string | null;
  settings: {
    timer_enabled?: boolean;
    timer_end_date?: string;
    timer_label?: string;
    show_stock_counter?: boolean;
    stock_remaining?: number;
    tiktok_pixel_id?: string;
    gtm_id?: string;
    checkout_style?: 'modal' | 'page';
  };
  offers: LandingOffer[];
  product: {
    id: string;
    name: string;
    price_cents: number;
    image_url: string | null;
    description: string | null;
  };
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="border-b">
      <button
        className="flex w-full items-center justify-between py-4 text-left font-medium"
        onClick={() => setIsOpen(!isOpen)}
      >
        {question}
        {isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
      </button>
      {isOpen && (
        <div className="pb-4 text-muted-foreground">
          {answer}
        </div>
      )}
    </div>
  );
}

export default function PublicLandingPage() {
  const { slug } = useParams<{ slug: string }>();
  const [selectedOffer, setSelectedOffer] = useState<LandingOffer | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const { data: landing, isLoading, error } = useQuery({
    queryKey: ['public-landing', slug],
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('landing_pages')
        .select(`
          *,
          offers:landing_offers(*),
          product:lead_products!landing_pages_product_id_fkey(id, name, price_cents, image_url, description)
        `)
        .eq('slug', slug)
        .eq('is_active', true)
        .single();
      
      if (error) throw error;
      
      return {
        ...data,
        benefits: (data.benefits as string[]) || [],
        testimonials: (data.testimonials as { name: string; text: string; avatar?: string }[]) || [],
        faq: (data.faq as { question: string; answer: string }[]) || [],
        settings: (data.settings as PublicLandingPage['settings']) || {},
        offers: ((data.offers as unknown as LandingOffer[]) || []).sort((a, b) => a.display_order - b.display_order),
        product: data.product as unknown as PublicLandingPage['product'],
      } as PublicLandingPage;
    },
  });

  // Auto-select highlighted offer
  useEffect(() => {
    if (landing?.offers && !selectedOffer) {
      const highlighted = landing.offers.find(o => o.is_highlighted);
      setSelectedOffer(highlighted || landing.offers[0] || null);
    }
  }, [landing?.offers, selectedOffer]);

  const handleBuy = (offer: LandingOffer) => {
    setSelectedOffer(offer);
    setCheckoutOpen(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (error || !landing) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Página não encontrada</h1>
          <p className="text-muted-foreground">Esta oferta não está mais disponível.</p>
        </div>
      </div>
    );
  }

  const primaryColor = landing.primary_color || '#000000';

  return (
    <>
      {/* Tracking Pixels */}
      <TrackingPixels
        facebookPixelId={landing.facebook_pixel_id}
        googleAnalyticsId={landing.google_analytics_id}
        tiktokPixelId={landing.settings.tiktok_pixel_id}
        gtmId={landing.settings.gtm_id}
      />

      {/* Custom CSS */}
      {landing.custom_css && (
        <style dangerouslySetInnerHTML={{ __html: landing.custom_css }} />
      )}

      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b py-4">
          <div className="container mx-auto px-4 flex items-center justify-between">
            {landing.logo_url ? (
              <img src={landing.logo_url} alt={landing.name} className="h-10" />
            ) : (
              <span className="text-xl font-bold" style={{ color: primaryColor }}>
                {landing.name}
              </span>
            )}
            {landing.whatsapp_number && (
              <a
                href={`https://wa.me/${landing.whatsapp_number.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Dúvidas? Fale conosco
              </a>
            )}
          </div>
        </header>

        {/* Timer Banner */}
        {landing.settings.timer_enabled && landing.settings.timer_end_date && (
          <CountdownTimer
            endDate={landing.settings.timer_end_date}
            label={landing.settings.timer_label || 'Oferta expira em:'}
            primaryColor={primaryColor}
          />
        )}

        {/* Hero Section */}
        <section className="py-12 md:py-20">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              {/* Headline */}
              {landing.headline && (
                <h1 className="text-3xl md:text-5xl font-bold mb-6">
                  {landing.headline}
                </h1>
              )}

              {/* Subheadline */}
              {landing.subheadline && (
                <p className="text-lg md:text-xl text-muted-foreground mb-8">
                  {landing.subheadline}
                </p>
              )}

              {/* Video VSL */}
              {landing.video_url && (
                <div className="aspect-video bg-black rounded-xl overflow-hidden mb-8 shadow-2xl">
                  <iframe
                    src={landing.video_url.replace('watch?v=', 'embed/')}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              )}

              {/* Urgency Text */}
              {landing.urgency_text && (
                <div 
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-white font-medium mb-8"
                  style={{ backgroundColor: primaryColor }}
                >
                  <Clock className="h-4 w-4" />
                  {landing.urgency_text}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        {landing.benefits.length > 0 && (
          <section className="py-12 bg-muted/30">
            <div className="container mx-auto px-4">
              <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">
                O que você vai receber:
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 max-w-4xl mx-auto">
                {landing.benefits.map((benefit, idx) => (
                  <div 
                    key={idx}
                    className="flex items-start gap-3 p-4 bg-background rounded-lg shadow-sm"
                  >
                    <div 
                      className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white"
                      style={{ backgroundColor: primaryColor }}
                    >
                      <Check className="h-4 w-4" />
                    </div>
                    <span className="font-medium">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Product & Offers Section */}
        <section className="py-12 md:py-20">
          <div className="container mx-auto px-4">
            <div className="max-w-5xl mx-auto">
              <div className="grid gap-8 lg:grid-cols-2 items-start">
                {/* Product Image */}
                <div>
                  {landing.product.image_url && (
                    <img
                      src={landing.product.image_url}
                      alt={landing.product.name}
                      className="w-full rounded-xl shadow-lg"
                    />
                  )}
                  {landing.product.description && (
                    <p className="mt-4 text-muted-foreground">
                      {landing.product.description}
                    </p>
                  )}
                </div>

                {/* Offers */}
                <div className="space-y-4">
                  <h3 className="text-xl font-bold mb-4">Escolha sua oferta:</h3>
                  
                  {/* Stock Counter */}
                  {landing.settings.show_stock_counter && landing.settings.stock_remaining && (
                    <div className="flex items-center gap-2 text-orange-600 font-medium mb-4">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span>
                      </span>
                      Apenas {landing.settings.stock_remaining} unidades restantes!
                    </div>
                  )}

                  {landing.offers.map((offer) => {
                    const isSelected = selectedOffer?.id === offer.id;
                    const savings = offer.original_price_cents 
                      ? offer.original_price_cents - offer.price_cents 
                      : 0;
                    
                    return (
                      <Card
                        key={offer.id}
                        className={`cursor-pointer transition-all ${
                          isSelected ? 'ring-2 shadow-lg' : 'hover:shadow-md'
                        } ${offer.is_highlighted ? 'border-2' : ''}`}
                        style={isSelected || offer.is_highlighted ? { 
                          borderColor: primaryColor,
                        } : undefined}
                        onClick={() => setSelectedOffer(offer)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <div 
                                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                  isSelected ? 'border-0' : ''
                                }`}
                                style={isSelected ? { backgroundColor: primaryColor } : { borderColor: primaryColor }}
                              >
                                {isSelected && <Check className="h-3 w-3 text-white" />}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold">{offer.label}</span>
                                  {offer.badge_text && (
                                    <Badge 
                                      className="text-xs"
                                      style={{ backgroundColor: primaryColor }}
                                    >
                                      {offer.badge_text}
                                    </Badge>
                                  )}
                                </div>
                                {offer.original_price_cents && (
                                  <span className="text-sm text-muted-foreground line-through">
                                    {formatCurrency(offer.original_price_cents)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xl font-bold" style={{ color: primaryColor }}>
                                {formatCurrency(offer.price_cents)}
                              </div>
                              {savings > 0 && (
                                <span className="text-xs text-green-600 font-medium">
                                  Economia de {formatCurrency(savings)}
                                </span>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}

                  {/* CTA Button */}
                  <Button
                    size="lg"
                    className="w-full text-lg py-6 mt-4"
                    style={{ backgroundColor: primaryColor }}
                    onClick={() => selectedOffer && handleBuy(selectedOffer)}
                    disabled={!selectedOffer}
                  >
                    <ShoppingCart className="h-5 w-5 mr-2" />
                    COMPRAR AGORA
                  </Button>

                  {/* Trust Badges */}
                  <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground pt-4">
                    <div className="flex items-center gap-1">
                      <Shield className="h-4 w-4" />
                      Compra Segura
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4" />
                      Satisfação Garantida
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials */}
        {landing.testimonials.length > 0 && (
          <section className="py-12 bg-muted/30">
            <div className="container mx-auto px-4">
              <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">
                O que nossos clientes dizem:
              </h2>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
                {landing.testimonials.map((testimonial, idx) => (
                  <Card key={idx}>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-3 mb-4">
                        {testimonial.avatar ? (
                          <img 
                            src={testimonial.avatar} 
                            alt={testimonial.name}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        ) : (
                          <div 
                            className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold"
                            style={{ backgroundColor: primaryColor }}
                          >
                            {testimonial.name.charAt(0)}
                          </div>
                        )}
                        <div>
                          <div className="font-semibold">{testimonial.name}</div>
                          <div className="flex text-yellow-400">
                            {[...Array(5)].map((_, i) => (
                              <Star key={i} className="h-4 w-4 fill-current" />
                            ))}
                          </div>
                        </div>
                      </div>
                      <p className="text-muted-foreground italic">"{testimonial.text}"</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Guarantee Section */}
        {landing.guarantee_text && (
          <section className="py-12">
            <div className="container mx-auto px-4">
              <div className="max-w-2xl mx-auto text-center">
                <div 
                  className="w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: primaryColor + '20' }}
                >
                  <Shield className="h-10 w-10" style={{ color: primaryColor }} />
                </div>
                <h2 className="text-2xl font-bold mb-4">Garantia de Satisfação</h2>
                <p className="text-muted-foreground">{landing.guarantee_text}</p>
              </div>
            </div>
          </section>
        )}

        {/* FAQ Section */}
        {landing.faq.length > 0 && (
          <section className="py-12 bg-muted/30">
            <div className="container mx-auto px-4">
              <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">
                Perguntas Frequentes
              </h2>
              <div className="max-w-2xl mx-auto">
                {landing.faq.map((item, idx) => (
                  <FAQItem key={idx} question={item.question} answer={item.answer} />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="border-t py-8">
          <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
            <p>© {new Date().getFullYear()} {landing.name}. Todos os direitos reservados.</p>
            {landing.whatsapp_number && (
              <p className="mt-2">
                Atendimento: {' '}
                <a 
                  href={`https://wa.me/${landing.whatsapp_number.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                  style={{ color: primaryColor }}
                >
                  WhatsApp
                </a>
              </p>
            )}
          </div>
        </footer>

        {/* Structured Data for SEO & ChatGPT Shopping */}
        <LandingPageStructuredData
          productName={landing.product.name}
          productDescription={landing.product.description || landing.subheadline || undefined}
          productImage={landing.product.image_url || undefined}
          productPrice={selectedOffer?.price_cents || landing.offers[0]?.price_cents || 0}
          faqs={landing.faq}
          organizationName={landing.name}
          organizationLogo={landing.logo_url || undefined}
          pageUrl={window.location.href}
        />

        {/* Sales Chatbot */}
        <SalesChatbot
          landingPageId={landing.id}
          productId={landing.product_id}
          productName={landing.product.name}
          productPrice={selectedOffer?.price_cents}
          primaryColor={primaryColor}
          welcomeMessage={`Olá! 👋 Está com dúvidas sobre ${landing.product.name}? Posso ajudar!`}
        />

        {/* Checkout Modal */}
        {selectedOffer && (
          <LandingCheckoutModal
            open={checkoutOpen}
            onOpenChange={setCheckoutOpen}
            landingPage={landing}
            offer={selectedOffer}
          />
        )}
      </div>
    </>
  );
}
