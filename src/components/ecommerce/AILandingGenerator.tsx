import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { 
  Wand2, 
  Sparkles, 
  RefreshCw, 
  Check, 
  X, 
  Zap, 
  Eye,
  MessageSquare,
  Loader2,
  AlertCircle,
  Target,
  Lightbulb,
  Palette,
  Image as ImageIcon,
  Video,
  Play
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useProducts } from '@/hooks/useProducts';
import type { LandingPage, CreateLandingPageInput } from '@/hooks/ecommerce';

interface BriefingData {
  productId: string;
  productName: string;
  productDescription: string;
  promise: string;
  targetAudience: string;
  differentials: string;
  tone: 'professional' | 'informal' | 'urgent' | 'premium';
  style: 'minimal' | 'bold' | 'luxury' | 'health';
  useProductData: boolean;
  salesScript: string;
  generateImages: boolean;
  generateVideo: boolean;
}

interface GeneratedContent {
  headline: string;
  subheadline: string;
  benefits: string[];
  urgencyText: string;
  guaranteeText: string;
  testimonials: { name: string; text: string }[];
  faq: { question: string; answer: string }[];
  ctaText: string;
  primaryColor: string;
  estimatedTokens: number;
}

interface GeneratedImage {
  type: string;
  imageUrl: string;
  prompt: string;
}

interface GenerationProgress {
  step: 'idle' | 'copy' | 'images' | 'video' | 'done';
  copyProgress: number;
  imagesProgress: number;
  videoProgress: number;
  currentMessage: string;
}

interface AILandingGeneratorProps {
  onGenerated: (data: Partial<CreateLandingPageInput>) => void;
  existingData?: LandingPage | null;
}

const TONE_OPTIONS = [
  { value: 'professional', label: 'Profissional', description: 'Confiável e corporativo' },
  { value: 'informal', label: 'Informal', description: 'Próximo e descontraído' },
  { value: 'urgent', label: 'Urgente', description: 'Direto e escasso' },
  { value: 'premium', label: 'Premium', description: 'Exclusivo e sofisticado' },
];

const STYLE_OPTIONS = [
  { value: 'minimal', label: 'Minimalista', description: 'Clean, preto e branco' },
  { value: 'bold', label: 'Bold', description: 'Cores vibrantes' },
  { value: 'luxury', label: 'Luxo', description: 'Dourado e elegante' },
  { value: 'health', label: 'Saúde', description: 'Verde e natural' },
];

export function AILandingGenerator({ onGenerated, existingData }: AILandingGeneratorProps) {
  const { data: products } = useProducts();
  const [activeTab, setActiveTab] = useState('briefing');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [generatedVideoFrame, setGeneratedVideoFrame] = useState<string | null>(null);
  const [totalEnergyCost, setTotalEnergyCost] = useState<number>(0);
  const [feedbackText, setFeedbackText] = useState('');
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  
  const [progress, setProgress] = useState<GenerationProgress>({
    step: 'idle',
    copyProgress: 0,
    imagesProgress: 0,
    videoProgress: 0,
    currentMessage: '',
  });

  const [briefing, setBriefing] = useState<BriefingData>({
    productId: '',
    productName: '',
    productDescription: '',
    promise: '',
    targetAudience: '',
    differentials: '',
    tone: 'professional',
    style: 'health',
    useProductData: true,
    salesScript: '',
    generateImages: true,
    generateVideo: false,
  });

  useEffect(() => {
    if (briefing.productId && products) {
      const product = products.find(p => p.id === briefing.productId);
      if (product) {
        setBriefing(prev => ({
          ...prev,
          productName: product.name,
          productDescription: product.description || '',
        }));
      }
    }
  }, [briefing.productId, products]);

  const handleGenerate = async (isRegeneration = false) => {
    if (!briefing.productId) {
      toast.error('Selecione um produto');
      return;
    }
    if (!briefing.promise) {
      toast.error('Descreva a promessa principal do produto');
      return;
    }

    setIsGenerating(true);
    setShowFeedbackForm(false);
    setGeneratedImages([]);
    setGeneratedVideoFrame(null);
    let accumulatedEnergy = 0;

    try {
      // Step 1: Generate Copy
      setProgress({
        step: 'copy',
        copyProgress: 20,
        imagesProgress: 0,
        videoProgress: 0,
        currentMessage: 'Gerando copy de alta conversão...',
      });

      let specifications: string | undefined;
      if (briefing.useProductData) {
        const { data: product } = await supabase
          .from('lead_products')
          .select('ecommerce_specifications, ecommerce_benefits, description')
          .eq('id', briefing.productId)
          .single();

        if (product) {
          const specs = product.ecommerce_specifications as Record<string, string> | null;
          const benefits = product.ecommerce_benefits as string[] | null;
          
          const parts: string[] = [];
          if (specs && typeof specs === 'object') {
            parts.push(Object.entries(specs).map(([k, v]) => `${k}: ${v}`).join(', '));
          }
          if (benefits && Array.isArray(benefits)) {
            parts.push(`Benefícios: ${benefits.join(', ')}`);
          }
          if (product.description) {
            parts.push(`Descrição: ${product.description}`);
          }
          specifications = parts.join('. ');
        }
      }

      const copyResponse = await supabase.functions.invoke('ai-landing-generator', {
        body: {
          action: isRegeneration ? 'regenerate' : 'generate',
          briefing: {
            productName: briefing.productName,
            productDescription: briefing.productDescription,
            promise: briefing.promise,
            targetAudience: briefing.targetAudience,
            differentials: briefing.differentials,
            tone: briefing.tone,
            style: briefing.style,
            ingredients: specifications,
            salesScript: briefing.salesScript || undefined,
            previousFeedback: isRegeneration ? feedbackText : undefined,
            isRegeneration,
          },
        },
      });

      if (copyResponse.error) {
        throw new Error(copyResponse.error.message);
      }

      if (!copyResponse.data.success) {
        throw new Error(copyResponse.data.error || 'Erro ao gerar conteúdo');
      }

      setProgress(prev => ({ ...prev, copyProgress: 100, currentMessage: 'Copy gerado!' }));
      setGeneratedContent(copyResponse.data.content);
      accumulatedEnergy += copyResponse.data.energyCost;

      // Step 2: Generate Images (if enabled)
      if (briefing.generateImages) {
        setProgress(prev => ({
          ...prev,
          step: 'images',
          imagesProgress: 10,
          currentMessage: 'Gerando imagens profissionais...',
        }));

        const imageRequests = [
          {
            type: 'hero',
            productName: briefing.productName,
            productDescription: briefing.productDescription,
            style: briefing.style,
          },
          {
            type: 'product',
            productName: briefing.productName,
            productDescription: briefing.productDescription,
            style: briefing.style,
          },
          {
            type: 'testimonial',
            productName: briefing.productName,
            style: briefing.style,
          },
          {
            type: 'benefit',
            productName: briefing.productName,
            productDescription: briefing.promise,
            style: briefing.style,
            context: briefing.promise,
          },
        ];

        setProgress(prev => ({ ...prev, imagesProgress: 30 }));

        const imagesResponse = await supabase.functions.invoke('ai-landing-images', {
          body: { requests: imageRequests },
        });

        if (imagesResponse.error) {
          console.error('Image generation failed:', imagesResponse.error);
          toast.warning('Algumas imagens não foram geradas. Você pode adicionar manualmente.');
        } else if (imagesResponse.data.success) {
          setGeneratedImages(imagesResponse.data.images);
          accumulatedEnergy += imagesResponse.data.energyCost;
        }

        setProgress(prev => ({ ...prev, imagesProgress: 100, currentMessage: 'Imagens geradas!' }));
      }

      // Step 3: Generate Video Frame (if enabled)
      if (briefing.generateVideo) {
        setProgress(prev => ({
          ...prev,
          step: 'video',
          videoProgress: 20,
          currentMessage: 'Gerando frame de vídeo...',
        }));

        const videoResponse = await supabase.functions.invoke('ai-landing-video', {
          body: {
            request: {
              type: 'hero',
              productName: briefing.productName,
              productDescription: briefing.productDescription,
              style: briefing.style,
            },
          },
        });

        if (videoResponse.error) {
          console.error('Video generation failed:', videoResponse.error);
          toast.warning('Frame de vídeo não gerado. Você pode adicionar manualmente.');
        } else if (videoResponse.data.success) {
          setGeneratedVideoFrame(videoResponse.data.videoFrameUrl);
          accumulatedEnergy += videoResponse.data.energyCost;
        }

        setProgress(prev => ({ ...prev, videoProgress: 100, currentMessage: 'Vídeo pronto!' }));
      }

      // Done!
      setProgress(prev => ({ ...prev, step: 'done', currentMessage: 'Landing page gerada!' }));
      setTotalEnergyCost(accumulatedEnergy);
      setActiveTab('preview');
      setFeedbackText('');

      toast.success(`Landing page gerada! Custo total: ${accumulatedEnergy} energia`);

    } catch (error) {
      console.error('Generation error:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao gerar landing page');
    } finally {
      setIsGenerating(false);
      setProgress(prev => ({ ...prev, step: 'idle' }));
    }
  };

  const handleApprove = () => {
    if (!generatedContent) return;

    const heroImage = generatedImages.find(img => img.type === 'hero');
    
    onGenerated({
      product_id: briefing.productId,
      headline: generatedContent.headline,
      subheadline: generatedContent.subheadline,
      benefits: generatedContent.benefits,
      urgency_text: generatedContent.urgencyText,
      guarantee_text: generatedContent.guaranteeText,
      primary_color: generatedContent.primaryColor,
      // Note: Images would need to be uploaded to storage first
      // For now, we pass the base64 URLs which can be processed later
    });

    toast.success('Conteúdo aplicado! Configure as ofertas e salve.');
  };

  const handleReject = () => {
    setShowFeedbackForm(true);
  };

  const handleRegenerate = () => {
    if (!feedbackText.trim()) {
      toast.error('Descreva o que não ficou bom para melhorarmos');
      return;
    }
    handleGenerate(true);
  };

  const getImageByType = (type: string) => {
    return generatedImages.find(img => img.type === type)?.imageUrl;
  };

  const estimateEnergyCost = () => {
    let cost = 300; // Base copy cost
    if (briefing.generateImages) cost += 200; // 4 images × 50
    if (briefing.generateVideo) cost += 100;
    return cost;
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="briefing" className="gap-2">
            <Wand2 className="h-4 w-4" />
            Briefing
          </TabsTrigger>
          <TabsTrigger value="preview" disabled={!generatedContent} className="gap-2">
            <Eye className="h-4 w-4" />
            Preview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="briefing" className="space-y-6 mt-6">
          {/* Product Selection */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4" />
                Produto
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Selecione o produto *</Label>
                <Select
                  value={briefing.productId}
                  onValueChange={(value) => setBriefing(prev => ({ ...prev, productId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha um produto" />
                  </SelectTrigger>
                  <SelectContent>
                    {products?.map(product => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Usar dados do produto</Label>
                  <p className="text-xs text-muted-foreground">A IA usará descrição, benefícios e especificações cadastradas</p>
                </div>
                <Switch
                  checked={briefing.useProductData}
                  onCheckedChange={(checked) => setBriefing(prev => ({ ...prev, useProductData: checked }))}
                />
              </div>
            </CardContent>
          </Card>

          {/* Promise & Audience */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Lightbulb className="h-4 w-4" />
                Promessa & Público
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Promessa principal *</Label>
                <Textarea
                  value={briefing.promise}
                  onChange={(e) => setBriefing(prev => ({ ...prev, promise: e.target.value }))}
                  placeholder="O que o produto resolve? Qual transformação ele entrega? Ex: 'Emagreça 10kg em 30 dias sem dietas restritivas'"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Público-alvo</Label>
                <Textarea
                  value={briefing.targetAudience}
                  onChange={(e) => setBriefing(prev => ({ ...prev, targetAudience: e.target.value }))}
                  placeholder="Quem é o cliente ideal? Ex: 'Mulheres 35-55 anos que já tentaram várias dietas'"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Diferenciais</Label>
                <Textarea
                  value={briefing.differentials}
                  onChange={(e) => setBriefing(prev => ({ ...prev, differentials: e.target.value }))}
                  placeholder="Por que seu produto é melhor que os outros? Ex: '100% natural, aprovado pela ANVISA, resultados comprovados'"
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Tone & Style */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Palette className="h-4 w-4" />
                Tom & Estilo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Tom de voz</Label>
                <div className="grid grid-cols-2 gap-2">
                  {TONE_OPTIONS.map(option => (
                    <Button
                      key={option.value}
                      type="button"
                      variant={briefing.tone === option.value ? 'default' : 'outline'}
                      className="justify-start h-auto py-3"
                      onClick={() => setBriefing(prev => ({ ...prev, tone: option.value as BriefingData['tone'] }))}
                    >
                      <div className="text-left">
                        <div className="font-medium">{option.label}</div>
                        <div className="text-xs opacity-70">{option.description}</div>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Estilo visual</Label>
                <div className="grid grid-cols-2 gap-2">
                  {STYLE_OPTIONS.map(option => (
                    <Button
                      key={option.value}
                      type="button"
                      variant={briefing.style === option.value ? 'default' : 'outline'}
                      className="justify-start h-auto py-3"
                      onClick={() => setBriefing(prev => ({ ...prev, style: option.value as BriefingData['style'] }))}
                    >
                      <div className="text-left">
                        <div className="font-medium">{option.label}</div>
                        <div className="text-xs opacity-70">{option.description}</div>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Media Generation Options */}
          <Card className="border-primary/50 bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Geração de Mídia com IA
              </CardTitle>
              <CardDescription>
                A Super IA vai criar imagens e vídeos profissionais para sua landing page
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-background rounded-lg">
                <div className="flex items-center gap-3">
                  <ImageIcon className="h-5 w-5 text-primary" />
                  <div className="space-y-0.5">
                    <Label>Gerar Imagens</Label>
                    <p className="text-xs text-muted-foreground">Hero, produto, depoimentos e benefícios</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">+200 energia</Badge>
                  <Switch
                    checked={briefing.generateImages}
                    onCheckedChange={(checked) => setBriefing(prev => ({ ...prev, generateImages: checked }))}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-background rounded-lg">
                <div className="flex items-center gap-3">
                  <Video className="h-5 w-5 text-primary" />
                  <div className="space-y-0.5">
                    <Label>Gerar Frame de Vídeo</Label>
                    <p className="text-xs text-muted-foreground">Imagem dinâmica para hero section</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">+100 energia</Badge>
                  <Switch
                    checked={briefing.generateVideo}
                    onCheckedChange={(checked) => setBriefing(prev => ({ ...prev, generateVideo: checked }))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Optional: Sales Script */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Script de Vendas (opcional)
              </CardTitle>
              <CardDescription>
                Se você tem um script de vendas que já funciona, cole aqui. A IA vai usar como referência.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={briefing.salesScript}
                onChange={(e) => setBriefing(prev => ({ ...prev, salesScript: e.target.value }))}
                placeholder="Cole aqui seu script de vendas, argumentos que funcionam, objeções que seus clientes têm..."
                rows={4}
              />
            </CardContent>
          </Card>

          {/* Generation Progress */}
          {isGenerating && (
            <Card className="border-primary">
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="font-medium">{progress.currentMessage}</span>
                </div>
                
                <div className="space-y-3">
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Copy</span>
                      <span>{progress.copyProgress}%</span>
                    </div>
                    <Progress value={progress.copyProgress} />
                  </div>
                  
                  {briefing.generateImages && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Imagens</span>
                        <span>{progress.imagesProgress}%</span>
                      </div>
                      <Progress value={progress.imagesProgress} />
                    </div>
                  )}
                  
                  {briefing.generateVideo && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Vídeo</span>
                        <span>{progress.videoProgress}%</span>
                      </div>
                      <Progress value={progress.videoProgress} />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Generate Button */}
          <Button
            size="lg"
            className="w-full gap-2"
            onClick={() => handleGenerate(false)}
            disabled={isGenerating || !briefing.productId || !briefing.promise}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Gerando landing page...
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5" />
                Gerar Landing Page com Super IA
                <Badge variant="secondary" className="ml-2">~{estimateEnergyCost()} energia</Badge>
              </>
            )}
          </Button>
        </TabsContent>

        <TabsContent value="preview" className="space-y-6 mt-6">
          {generatedContent && (
            <>
              {/* Energy Cost Banner */}
              <div className="flex items-center justify-between p-4 bg-primary/10 rounded-lg">
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  <span className="font-medium">Custo total: {totalEnergyCost} energia</span>
                </div>
                <div className="flex items-center gap-2">
                  {generatedImages.length > 0 && (
                    <Badge variant="outline" className="gap-1">
                      <ImageIcon className="h-3 w-3" />
                      {generatedImages.length} imagens
                    </Badge>
                  )}
                  {generatedVideoFrame && (
                    <Badge variant="outline" className="gap-1">
                      <Video className="h-3 w-3" />
                      1 vídeo
                    </Badge>
                  )}
                </div>
              </div>

              {/* Visual Preview */}
              <ScrollArea className="h-[600px] rounded-lg border">
                <div className="space-y-0">
                  {/* Hero Section Preview */}
                  <div 
                    className="relative min-h-[400px] flex items-center justify-center p-8"
                    style={{ 
                      background: getImageByType('hero') 
                        ? `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.7)), url(${getImageByType('hero')}) center/cover`
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

                  {/* Urgency Banner */}
                  <div 
                    className="py-3 px-4 text-center text-white font-medium"
                    style={{ backgroundColor: generatedContent.primaryColor }}
                  >
                    🔥 {generatedContent.urgencyText}
                  </div>

                  {/* Benefits Section */}
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

                  {/* Product Image (if generated) */}
                  {getImageByType('product') && (
                    <div className="py-12 px-6">
                      <div className="max-w-md mx-auto">
                        <img 
                          src={getImageByType('product')} 
                          alt="Produto" 
                          className="w-full rounded-xl shadow-2xl"
                        />
                      </div>
                    </div>
                  )}

                  {/* Testimonials */}
                  <div className="py-12 px-6 bg-muted/30">
                    <h2 className="text-2xl font-bold text-center mb-8">O que nossos clientes dizem:</h2>
                    <div className="grid gap-4 md:grid-cols-3 max-w-4xl mx-auto">
                      {generatedContent.testimonials.map((testimonial, idx) => (
                        <Card key={idx}>
                          <CardContent className="pt-6">
                            {getImageByType('testimonial') && idx === 0 && (
                              <div className="w-16 h-16 rounded-full overflow-hidden mx-auto mb-4">
                                <img 
                                  src={getImageByType('testimonial')} 
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
                      ))}
                    </div>
                  </div>

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

                  {/* Final CTA */}
                  <div 
                    className="py-12 px-6 text-center"
                    style={{ backgroundColor: generatedContent.primaryColor }}
                  >
                    <h2 className="text-2xl font-bold text-white mb-4">Não perca essa oportunidade!</h2>
                    <Button size="lg" variant="secondary" className="text-lg px-8">
                      {generatedContent.ctaText}
                    </Button>
                  </div>
                </div>
              </ScrollArea>

              {/* Feedback Form */}
              {showFeedbackForm && (
                <Card className="border-destructive">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      O que não ficou bom?
                    </CardTitle>
                    <CardDescription>
                      Descreva o que você não gostou para a Super IA melhorar
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Textarea
                      value={feedbackText}
                      onChange={(e) => setFeedbackText(e.target.value)}
                      placeholder="Ex: A headline não chamou atenção, os benefícios estão muito genéricos, as imagens não combinam com meu produto, as cores estão erradas..."
                      rows={4}
                    />
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        onClick={() => setShowFeedbackForm(false)}
                        className="flex-1"
                      >
                        Cancelar
                      </Button>
                      <Button 
                        onClick={handleRegenerate}
                        disabled={isGenerating || !feedbackText.trim()}
                        className="flex-1 gap-2"
                      >
                        {isGenerating ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                        Regenerar
                        <Badge variant="secondary">~{Math.ceil(estimateEnergyCost() * 0.5)} energia</Badge>
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
                    onClick={handleReject}
                  >
                    <X className="h-5 w-5" />
                    Não gostei
                  </Button>
                  <Button
                    size="lg"
                    className="flex-1 gap-2"
                    onClick={handleApprove}
                  >
                    <Check className="h-5 w-5" />
                    Usar este conteúdo
                  </Button>
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
