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
  Users,
  Lightbulb,
  Palette
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
  const [energyCost, setEnergyCost] = useState<number>(0);
  const [feedbackText, setFeedbackText] = useState('');
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);

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
  });

  // Update briefing when product is selected
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

    try {
      // Get product details if using specifications/benefits
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

      const response = await supabase.functions.invoke('ai-landing-generator', {
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

      if (response.error) {
        throw new Error(response.error.message);
      }

      const data = response.data;

      if (!data.success) {
        throw new Error(data.error || 'Erro ao gerar conteúdo');
      }

      setGeneratedContent(data.content);
      setEnergyCost(data.energyCost);
      setActiveTab('preview');
      setFeedbackText('');

      toast.success(`Landing page gerada! Custo: ${data.energyCost} energia`);

    } catch (error) {
      console.error('Generation error:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao gerar landing page');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApprove = () => {
    if (!generatedContent) return;

    onGenerated({
      product_id: briefing.productId,
      headline: generatedContent.headline,
      subheadline: generatedContent.subheadline,
      benefits: generatedContent.benefits,
      urgency_text: generatedContent.urgencyText,
      guarantee_text: generatedContent.guaranteeText,
      primary_color: generatedContent.primaryColor,
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
                Gerar Landing Page com IA
                <Badge variant="secondary" className="ml-2">~300 energia</Badge>
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
                  <span className="font-medium">Custo: {energyCost} energia</span>
                </div>
                <Badge variant="outline">{generatedContent.estimatedTokens} tokens</Badge>
              </div>

              {/* Preview Content */}
              <ScrollArea className="h-[500px] rounded-lg border p-6">
                <div className="space-y-8">
                  {/* Headline */}
                  <div className="text-center space-y-4">
                    <h1 
                      className="text-3xl md:text-4xl font-bold"
                      style={{ color: generatedContent.primaryColor }}
                    >
                      {generatedContent.headline}
                    </h1>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                      {generatedContent.subheadline}
                    </p>
                  </div>

                  <Separator />

                  {/* Benefits */}
                  <div>
                    <h3 className="font-semibold mb-4">Benefícios</h3>
                    <div className="grid gap-2">
                      {generatedContent.benefits.map((benefit, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <Check 
                            className="h-5 w-5 mt-0.5 flex-shrink-0" 
                            style={{ color: generatedContent.primaryColor }}
                          />
                          <span>{benefit}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Urgency & Guarantee */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Urgência</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm">{generatedContent.urgencyText}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Garantia</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm">{generatedContent.guaranteeText}</p>
                      </CardContent>
                    </Card>
                  </div>

                  <Separator />

                  {/* Testimonials */}
                  <div>
                    <h3 className="font-semibold mb-4">Depoimentos</h3>
                    <div className="grid gap-4">
                      {generatedContent.testimonials.map((testimonial, idx) => (
                        <Card key={idx}>
                          <CardContent className="pt-4">
                            <p className="text-sm italic mb-2">"{testimonial.text}"</p>
                            <p className="text-sm font-medium">— {testimonial.name}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* FAQ */}
                  <div>
                    <h3 className="font-semibold mb-4">FAQ</h3>
                    <div className="space-y-4">
                      {generatedContent.faq.map((item, idx) => (
                        <div key={idx}>
                          <p className="font-medium">{item.question}</p>
                          <p className="text-sm text-muted-foreground mt-1">{item.answer}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* CTA Preview */}
                  <div className="text-center pt-4">
                    <Button 
                      size="lg" 
                      style={{ backgroundColor: generatedContent.primaryColor }}
                    >
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
                      Descreva o que você não gostou para a IA melhorar
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Textarea
                      value={feedbackText}
                      onChange={(e) => setFeedbackText(e.target.value)}
                      placeholder="Ex: A headline não chamou atenção, os benefícios estão muito genéricos, as cores não combinam com minha marca..."
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
