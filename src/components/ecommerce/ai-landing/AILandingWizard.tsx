import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, ArrowRight, Sparkles, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useProducts } from '@/hooks/useProducts';
import { useProductIngredients } from '@/hooks/useProductIngredients';
import { useProductFaqs } from '@/hooks/useProductFaqs';
import type { CreateLandingPageInput } from '@/hooks/ecommerce';

import { StepTypeSelection } from './StepTypeSelection';
import { StepImageUploads } from './StepImageUploads';
import { StepBriefing } from './StepBriefing';
import { StepPreview } from './StepPreview';
import { 
  type AILandingWizardState, 
  type OfferType,
  type GeneratedContent,
  OFFER_TYPE_CONFIGS 
} from './types';

interface AILandingWizardProps {
  onGenerated: (data: Partial<CreateLandingPageInput>) => void;
  onCancel: () => void;
}

const INITIAL_BRIEFING = {
  productId: '',
  productName: '',
  productDescription: '',
  promise: '',
  targetAudience: '',
  differentials: '',
  tone: 'professional' as const,
  style: 'health' as const,
  salesScript: '',
  generateMissingImages: true,
};

export function AILandingWizard({ onGenerated, onCancel }: AILandingWizardProps) {
  const { data: products } = useProducts();
  
  const [state, setState] = useState<AILandingWizardState>({
    step: 'type',
    offerType: null,
    uploadedImages: [],
    testimonialUploads: [],
    briefing: INITIAL_BRIEFING,
    generatedContent: null,
    productIngredients: [],
    productFaqs: [],
    totalEnergyCost: 0,
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [feedbackText, setFeedbackText] = useState('');
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);

  // Fetch product ingredients and FAQs when product changes
  const { data: ingredientsData } = useProductIngredients(state.briefing.productId);
  const { data: faqsData } = useProductFaqs(state.briefing.productId);

  useEffect(() => {
    if (ingredientsData) {
      setState(prev => ({
        ...prev,
        productIngredients: ingredientsData.map(i => `${i.name}${i.description ? `: ${i.description}` : ''}`),
      }));
    }
  }, [ingredientsData]);

  useEffect(() => {
    if (faqsData) {
      setState(prev => ({
        ...prev,
        productFaqs: faqsData.map(f => ({ question: f.question, answer: f.answer })),
      }));
    }
  }, [faqsData]);

  const config = state.offerType ? OFFER_TYPE_CONFIGS.find(c => c.value === state.offerType) : null;
  const selectedProduct = products?.find(p => p.id === state.briefing.productId);

  const canProceedFromType = !!state.offerType;
  
  const canProceedFromUploads = () => {
    if (!config) return false;
    // Check if all required uploads are present
    return config.requiredUploads.every(type => 
      state.uploadedImages.some(img => img.type === type)
    );
  };

  const canProceedFromBriefing = 
    !!state.briefing.productId && 
    !!state.briefing.promise;

  const goToStep = (step: AILandingWizardState['step']) => {
    setState(prev => ({ ...prev, step }));
  };

  const handleGenerate = async (isRegeneration = false) => {
    if (!state.briefing.productId || !state.briefing.promise) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    setIsGenerating(true);
    setState(prev => ({ ...prev, step: 'generating' }));
    setProgress(0);
    setProgressMessage('Preparando briefing...');

    try {
      // Build specifications from ingredients
      let specifications: string | undefined;
      if (state.productIngredients.length > 0) {
        specifications = `Ingredientes/Composição: ${state.productIngredients.join(', ')}`;
      }

      // Include existing product data
      if (state.briefing.productDescription) {
        specifications = specifications 
          ? `${specifications}. Descrição: ${state.briefing.productDescription}`
          : `Descrição: ${state.briefing.productDescription}`;
      }

      setProgress(20);
      setProgressMessage('Gerando copy de alta conversão...');

      const copyResponse = await supabase.functions.invoke('ai-landing-generator', {
        body: {
          action: isRegeneration ? 'regenerate' : 'generate',
          briefing: {
            productName: state.briefing.productName,
            productDescription: state.briefing.productDescription,
            promise: state.briefing.promise,
            targetAudience: state.briefing.targetAudience,
            differentials: state.briefing.differentials,
            tone: state.briefing.tone,
            style: state.briefing.style,
            ingredients: specifications,
            faq: state.productFaqs.length > 0 ? state.productFaqs : undefined,
            salesScript: state.briefing.salesScript || undefined,
            previousFeedback: isRegeneration ? feedbackText : undefined,
            isRegeneration,
            offerType: state.offerType,
            pageStyle: config?.pageStyle,
          },
        },
      });

      if (copyResponse.error) {
        throw new Error(copyResponse.error.message);
      }

      if (!copyResponse.data.success) {
        throw new Error(copyResponse.data.error || 'Erro ao gerar conteúdo');
      }

      setProgress(60);
      setProgressMessage('Copy gerado!');

      let totalEnergy = copyResponse.data.energyCost;

      // Generate missing images if enabled
      if (state.briefing.generateMissingImages) {
        setProgress(70);
        setProgressMessage('Verificando imagens...');

        // Check what images are missing
        const missingTypes: string[] = [];
        if (!state.uploadedImages.some(img => img.type === 'hero_background' || img.type === 'product_image')) {
          missingTypes.push('hero');
        }
        if (!state.uploadedImages.some(img => img.type === 'product_image') && config?.requiredUploads.includes('product_image')) {
          missingTypes.push('product');
        }

        if (missingTypes.length > 0) {
          setProgressMessage('Gerando imagens com IA...');
          setProgress(80);

          const imageRequests = missingTypes.map(type => ({
            type,
            productName: state.briefing.productName,
            productDescription: state.briefing.productDescription,
            style: state.briefing.style,
          }));

          try {
            const imagesResponse = await supabase.functions.invoke('ai-landing-images', {
              body: { requests: imageRequests },
            });

            if (imagesResponse.data?.success) {
              // Add generated images to state
              const generatedImages = imagesResponse.data.images.map((img: { type: string; imageUrl: string }) => ({
                type: img.type === 'hero' ? 'hero_background' : 'product_image',
                url: img.imageUrl,
                isAiGenerated: true,
              }));
              
              setState(prev => ({
                ...prev,
                uploadedImages: [...prev.uploadedImages, ...generatedImages],
              }));

              totalEnergy += imagesResponse.data.energyCost || 0;
            }
          } catch {
            console.warn('Image generation failed, continuing without');
          }
        }
      }

      setProgress(100);
      setProgressMessage('Landing page gerada!');

      // Merge product FAQs with generated FAQs
      const mergedFaq = [
        ...(state.productFaqs || []),
        ...(copyResponse.data.content.faq || []),
      ].slice(0, 6); // Limit to 6 FAQs

      const generatedContent: GeneratedContent = {
        ...copyResponse.data.content,
        faq: mergedFaq,
      };

      setState(prev => ({
        ...prev,
        step: 'preview',
        generatedContent,
        totalEnergyCost: totalEnergy,
      }));

      setFeedbackText('');
      setShowFeedbackForm(false);
      toast.success(`Landing page gerada! Custo: ${totalEnergy} energia`);

    } catch (error) {
      console.error('Generation error:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao gerar landing page');
      setState(prev => ({ ...prev, step: 'briefing' }));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApprove = () => {
    if (!state.generatedContent) return;

    // Find hero image
    const heroImage = state.uploadedImages.find(
      img => img.type === 'hero_background' || img.type === 'product_image'
    );

    onGenerated({
      product_id: state.briefing.productId,
      headline: state.generatedContent.headline,
      subheadline: state.generatedContent.subheadline,
      benefits: state.generatedContent.benefits,
      urgency_text: state.generatedContent.urgencyText,
      guarantee_text: state.generatedContent.guaranteeText,
      primary_color: state.generatedContent.primaryColor,
      // Note: heroImage?.url could be passed to logo_url or handled separately
    });

    toast.success('Conteúdo aplicado! Configure as ofertas e salve.');
  };

  const handleRegenerate = () => {
    if (!feedbackText.trim()) {
      toast.error('Descreva o que não ficou bom para melhorarmos');
      return;
    }
    handleGenerate(true);
  };

  const estimateEnergyCost = () => {
    let cost = 300; // Base copy cost
    if (state.briefing.generateMissingImages) cost += 100; // Potential image generation
    return cost;
  };

  // Render based on current step
  const renderStep = () => {
    switch (state.step) {
      case 'type':
        return (
          <StepTypeSelection
            selectedType={state.offerType}
            onSelect={(type) => setState(prev => ({ ...prev, offerType: type }))}
          />
        );

      case 'uploads':
        return (
          <StepImageUploads
            offerType={state.offerType!}
            uploadedImages={state.uploadedImages}
            testimonialUploads={state.testimonialUploads}
            onImagesChange={(images) => setState(prev => ({ ...prev, uploadedImages: images }))}
            onTestimonialsChange={(testimonials) => setState(prev => ({ ...prev, testimonialUploads: testimonials }))}
            productImageUrl={selectedProduct?.image_url}
          />
        );

      case 'briefing':
        return (
          <StepBriefing
            offerType={state.offerType!}
            briefing={state.briefing}
            productIngredients={state.productIngredients}
            productFaqs={state.productFaqs}
            onBriefingChange={(briefing) => setState(prev => ({ ...prev, briefing }))}
          />
        );

      case 'generating':
        return (
          <div className="py-12 space-y-8">
            <div className="text-center space-y-2">
              <Sparkles className="h-12 w-12 mx-auto text-primary animate-pulse" />
              <h2 className="text-2xl font-bold">Gerando sua Landing Page...</h2>
              <p className="text-muted-foreground">{progressMessage}</p>
            </div>
            <Progress value={progress} className="max-w-md mx-auto" />
          </div>
        );

      case 'preview':
        return state.generatedContent ? (
          <StepPreview
            offerType={state.offerType!}
            generatedContent={state.generatedContent}
            uploadedImages={state.uploadedImages}
            testimonialUploads={state.testimonialUploads}
            totalEnergyCost={state.totalEnergyCost}
            feedbackText={feedbackText}
            showFeedbackForm={showFeedbackForm}
            isRegenerating={isGenerating}
            onFeedbackChange={setFeedbackText}
            onShowFeedback={setShowFeedbackForm}
            onApprove={handleApprove}
            onRegenerate={handleRegenerate}
          />
        ) : null;

      default:
        return null;
    }
  };

  const getStepNumber = () => {
    const steps = ['type', 'uploads', 'briefing', 'generating', 'preview'];
    return steps.indexOf(state.step) + 1;
  };

  const canGoBack = state.step !== 'type' && state.step !== 'generating';
  const canGoNext = () => {
    switch (state.step) {
      case 'type': return canProceedFromType;
      case 'uploads': return canProceedFromUploads();
      case 'briefing': return canProceedFromBriefing;
      default: return false;
    }
  };

  const handleNext = () => {
    switch (state.step) {
      case 'type':
        goToStep('uploads');
        break;
      case 'uploads':
        goToStep('briefing');
        break;
      case 'briefing':
        handleGenerate();
        break;
    }
  };

  const handleBack = () => {
    switch (state.step) {
      case 'uploads':
        goToStep('type');
        break;
      case 'briefing':
        goToStep('uploads');
        break;
      case 'preview':
        goToStep('briefing');
        break;
    }
  };

  return (
    <div className="space-y-6">
      {/* Progress indicator */}
      {state.step !== 'generating' && (
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            {['type', 'uploads', 'briefing', 'preview'].map((step, idx) => (
              <div key={step} className="flex items-center gap-2">
                <div 
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    getStepNumber() > idx + 1 
                      ? 'bg-primary text-primary-foreground' 
                      : getStepNumber() === idx + 1 
                      ? 'bg-primary/20 text-primary border-2 border-primary' 
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {idx + 1}
                </div>
                {idx < 3 && <div className="w-8 h-0.5 bg-muted" />}
              </div>
            ))}
          </div>
          <Badge variant="outline" className="gap-1">
            <Sparkles className="h-3 w-3" />
            ~{estimateEnergyCost()} energia
          </Badge>
        </div>
      )}

      {/* Step content */}
      {renderStep()}

      {/* Navigation buttons */}
      {state.step !== 'generating' && state.step !== 'preview' && (
        <div className="flex justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={canGoBack ? handleBack : onCancel}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {canGoBack ? 'Voltar' : 'Cancelar'}
          </Button>

          <Button
            onClick={handleNext}
            disabled={!canGoNext() || isGenerating}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Gerando...
              </>
            ) : state.step === 'briefing' ? (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Gerar com IA
              </>
            ) : (
              <>
                Próximo
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
