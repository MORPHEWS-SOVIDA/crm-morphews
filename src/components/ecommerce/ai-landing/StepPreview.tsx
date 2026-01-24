import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Check, 
  X, 
  Zap, 
  ImageIcon, 
  RefreshCw,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { 
  type GeneratedContent, 
  type UploadedImage, 
  type TestimonialUpload,
  type OfferType,
  OFFER_TYPE_CONFIGS 
} from './types';
import { cn } from '@/lib/utils';

interface StepPreviewProps {
  offerType: OfferType;
  generatedContent: GeneratedContent;
  uploadedImages: UploadedImage[];
  testimonialUploads: TestimonialUpload[];
  totalEnergyCost: number;
  feedbackText: string;
  showFeedbackForm: boolean;
  isRegenerating: boolean;
  onFeedbackChange: (text: string) => void;
  onShowFeedback: (show: boolean) => void;
  onApprove: () => void;
  onRegenerate: () => void;
}

export function StepPreview({
  offerType,
  generatedContent,
  uploadedImages,
  testimonialUploads,
  totalEnergyCost,
  feedbackText,
  showFeedbackForm,
  isRegenerating,
  onFeedbackChange,
  onShowFeedback,
  onApprove,
  onRegenerate,
}: StepPreviewProps) {
  const config = OFFER_TYPE_CONFIGS.find(c => c.value === offerType);
  const isWebinar = config?.pageStyle === 'webinar';
  const isMinimal = config?.pageStyle === 'minimal';

  const getHeroImage = () => {
    const hero = uploadedImages.find(img => img.type === 'hero_background');
    if (hero) return hero.url;
    const product = uploadedImages.find(img => img.type === 'product_image');
    if (product) return product.url;
    return null;
  };

  const getProductImage = () => {
    return uploadedImages.find(img => img.type === 'product_image')?.url;
  };

  const heroImage = getHeroImage();

  return (
    <div className="space-y-6">
      {/* Energy Cost Banner */}
      <div className="flex items-center justify-between p-4 bg-primary/10 rounded-lg">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          <span className="font-medium">Custo total: {totalEnergyCost} energia</span>
        </div>
        <div className="flex items-center gap-2">
          {uploadedImages.length > 0 && (
            <Badge variant="outline" className="gap-1">
              <ImageIcon className="h-3 w-3" />
              {uploadedImages.length} imagens
            </Badge>
          )}
          {testimonialUploads.length > 0 && (
            <Badge variant="outline" className="gap-1">
              {testimonialUploads.length} depoimentos
            </Badge>
          )}
        </div>
      </div>

      {/* Visual Preview */}
      <ScrollArea className={cn("rounded-lg border", isWebinar ? "h-[400px]" : "h-[600px]")}>
        <div className="space-y-0">
          {/* Hero Section Preview */}
          <div 
            className={cn(
              "relative flex items-center justify-center p-8",
              isWebinar ? "min-h-[300px]" : "min-h-[400px]"
            )}
            style={{ 
              background: heroImage 
                ? `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.7)), url(${heroImage}) center/cover`
                : `linear-gradient(135deg, ${generatedContent.primaryColor}, ${generatedContent.primaryColor}dd)`
            }}
          >
            <div className="text-center text-white max-w-3xl">
              <h1 className="text-3xl md:text-5xl font-bold mb-4 drop-shadow-lg">
                {generatedContent.headline}
              </h1>
              <p className="text-lg md:text-xl opacity-90 mb-6">
                {generatedContent.subheadline}
              </p>
              <Button 
                size="lg" 
                className="text-lg px-8"
                style={{ backgroundColor: generatedContent.primaryColor }}
              >
                {generatedContent.ctaText}
              </Button>
            </div>
          </div>

          {/* For webinar style, keep it minimal */}
          {!isWebinar && (
            <>
              {/* Urgency Banner */}
              <div 
                className="py-3 px-4 text-center text-white font-medium"
                style={{ backgroundColor: generatedContent.primaryColor }}
              >
                🔥 {generatedContent.urgencyText}
              </div>

              {/* Benefits Section */}
              {!isMinimal && (
                <div className="py-12 px-6 bg-muted/30">
                  <h2 className="text-2xl font-bold text-center mb-8">O que você vai receber:</h2>
                  <div className="grid gap-4 md:grid-cols-2 max-w-3xl mx-auto">
                    {generatedContent.benefits.map((benefit, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-4 bg-background rounded-lg shadow-sm">
                        <div 
                          className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white"
                          style={{ backgroundColor: generatedContent.primaryColor }}
                        >
                          <Check className="h-4 w-4" />
                        </div>
                        <span className="font-medium">{benefit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Product Image (if available) */}
              {getProductImage() && (
                <div className="py-12 px-6">
                  <div className="max-w-md mx-auto">
                    <img 
                      src={getProductImage()} 
                      alt="Produto" 
                      className="w-full rounded-xl shadow-2xl"
                    />
                  </div>
                </div>
              )}

              {/* Testimonials */}
              {generatedContent.testimonials.length > 0 && (
                <div className="py-12 px-6 bg-muted/30">
                  <h2 className="text-2xl font-bold text-center mb-8">O que nossos clientes dizem:</h2>
                  <div className="grid gap-4 md:grid-cols-3 max-w-4xl mx-auto">
                    {generatedContent.testimonials.map((testimonial, idx) => {
                      const testimonialImage = testimonialUploads[idx];
                      return (
                        <Card key={idx}>
                          <CardContent className="pt-6">
                            {testimonialImage && (
                              <div className="w-16 h-16 rounded-full overflow-hidden mx-auto mb-4">
                                <img 
                                  src={testimonialImage.imageUrl} 
                                  alt={testimonial.name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}
                            <p className="text-sm italic mb-3">"{testimonial.text}"</p>
                            <p className="text-sm font-medium text-center">— {testimonial.name}</p>
                            <div className="flex justify-center mt-2">
                              {[...Array(5)].map((_, i) => (
                                <span key={i} className="text-yellow-500">★</span>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Guarantee */}
              <div className="py-12 px-6">
                <div className="max-w-2xl mx-auto text-center">
                  <div 
                    className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
                    style={{ backgroundColor: `${generatedContent.primaryColor}20` }}
                  >
                    <Check className="h-8 w-8" style={{ color: generatedContent.primaryColor }} />
                  </div>
                  <h3 className="text-xl font-bold mb-3">Garantia Total</h3>
                  <p className="text-muted-foreground">{generatedContent.guaranteeText}</p>
                </div>
              </div>

              {/* FAQ */}
              {generatedContent.faq.length > 0 && (
                <div className="py-12 px-6 bg-muted/30">
                  <h2 className="text-2xl font-bold text-center mb-8">Perguntas Frequentes</h2>
                  <div className="max-w-2xl mx-auto space-y-4">
                    {generatedContent.faq.map((item, idx) => (
                      <Card key={idx}>
                        <CardContent className="pt-4">
                          <p className="font-medium mb-2">{item.question}</p>
                          <p className="text-sm text-muted-foreground">{item.answer}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Final CTA */}
          <div 
            className="py-12 px-6 text-center"
            style={{ backgroundColor: generatedContent.primaryColor }}
          >
            <h2 className="text-2xl font-bold text-white mb-4">
              {isWebinar ? 'Garanta sua vaga agora!' : 'Não perca essa oportunidade!'}
            </h2>
            <Button size="lg" variant="secondary" className="text-lg px-8">
              {generatedContent.ctaText}
            </Button>
          </div>
        </div>
      </ScrollArea>

      {/* Feedback Form */}
      {showFeedbackForm && (
        <Card className="border-destructive">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <span className="font-medium">O que não ficou bom?</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Descreva o que você não gostou para a Super IA melhorar
            </p>
            <Textarea
              value={feedbackText}
              onChange={(e) => onFeedbackChange(e.target.value)}
              placeholder="Ex: A headline não chamou atenção, os benefícios estão muito genéricos, as cores estão erradas..."
              rows={4}
            />
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => onShowFeedback(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button 
                onClick={onRegenerate}
                disabled={isRegenerating || !feedbackText.trim()}
                className="flex-1 gap-2"
              >
                {isRegenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Regenerar
                <Badge variant="secondary">~150 energia</Badge>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      {!showFeedbackForm && (
        <div className="flex gap-4">
          <Button
            variant="outline"
            size="lg"
            className="flex-1 gap-2"
            onClick={() => onShowFeedback(true)}
          >
            <X className="h-5 w-5" />
            Não gostei
          </Button>
          <Button
            size="lg"
            className="flex-1 gap-2"
            onClick={onApprove}
          >
            <Check className="h-5 w-5" />
            Usar este conteúdo
          </Button>
        </div>
      )}
    </div>
  );
}
