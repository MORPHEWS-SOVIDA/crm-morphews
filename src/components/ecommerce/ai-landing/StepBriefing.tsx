import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { 
  Target, 
  Lightbulb, 
  Palette,
  MessageSquare,
  Sparkles,
  FileText,
  HelpCircle
} from 'lucide-react';
import { useProducts, type Product } from '@/hooks/useProducts';
import { type BriefingData, type OfferType, OFFER_TYPE_CONFIGS } from './types';

interface StepBriefingProps {
  offerType: OfferType;
  briefing: BriefingData;
  productIngredients: string[];
  productFaqs: { question: string; answer: string }[];
  onBriefingChange: (briefing: BriefingData) => void;
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

export function StepBriefing({
  offerType,
  briefing,
  productIngredients,
  productFaqs,
  onBriefingChange,
}: StepBriefingProps) {
  const { data: products } = useProducts();
  const config = OFFER_TYPE_CONFIGS.find(c => c.value === offerType);

  // Update product name/description when product changes
  useEffect(() => {
    if (briefing.productId && products) {
      const product = products.find((p: Product) => p.id === briefing.productId);
      if (product) {
        onBriefingChange({
          ...briefing,
          productName: product.name,
          productDescription: product.description || '',
        });
      }
    }
  }, [briefing.productId, products]);

  const updateField = <K extends keyof BriefingData>(field: K, value: BriefingData[K]) => {
    onBriefingChange({ ...briefing, [field]: value });
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Briefing da Landing Page</h2>
        <p className="text-muted-foreground">
          Preencha as informações para a IA criar sua página
        </p>
      </div>

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
              onValueChange={(value) => updateField('productId', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Escolha um produto" />
              </SelectTrigger>
              <SelectContent>
                {products?.map((product: Product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              onChange={(e) => updateField('promise', e.target.value)}
              placeholder={
                offerType === 'webinario' 
                  ? 'O que a pessoa vai aprender? Ex: "Descubra como faturar R$10mil/mês com marketing digital"'
                  : offerType === 'mentoria_high_ticket'
                  ? 'Qual transformação você entrega? Ex: "Escale seu negócio para 7 dígitos em 12 meses"'
                  : 'O que o produto resolve? Ex: "Emagreça 10kg em 30 dias sem dietas restritivas"'
              }
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Público-alvo</Label>
            <Textarea
              value={briefing.targetAudience}
              onChange={(e) => updateField('targetAudience', e.target.value)}
              placeholder="Quem é o cliente ideal? Ex: 'Mulheres 35-55 anos que já tentaram várias dietas'"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Diferenciais</Label>
            <Textarea
              value={briefing.differentials}
              onChange={(e) => updateField('differentials', e.target.value)}
              placeholder="Por que seu produto/serviço é melhor? Ex: '100% natural, aprovado pela ANVISA'"
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
              {TONE_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={briefing.tone === option.value ? 'default' : 'outline'}
                  className="justify-start h-auto py-3"
                  onClick={() => updateField('tone', option.value as BriefingData['tone'])}
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
              {STYLE_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={briefing.style === option.value ? 'default' : 'outline'}
                  className="justify-start h-auto py-3"
                  onClick={() => updateField('style', option.value as BriefingData['style'])}
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

      {/* Ingredients & FAQ from product (if applicable) */}
      {(config?.showIngredients && productIngredients.length > 0) || 
       (config?.showFaq && productFaqs.length > 0) ? (
        <Card className="border-green-500/50 bg-green-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Dados do Produto
            </CardTitle>
            <CardDescription>
              Encontramos informações cadastradas que serão usadas pela IA
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" className="w-full">
              {config?.showIngredients && productIngredients.length > 0 && (
                <AccordionItem value="ingredients">
                  <AccordionTrigger className="text-sm">
                    <span className="flex items-center gap-2">
                      Ingredientes/Composição
                      <Badge variant="secondary">{productIngredients.length}</Badge>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      {productIngredients.map((ing, idx) => (
                        <li key={idx}>• {ing}</li>
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              )}

              {config?.showFaq && productFaqs.length > 0 && (
                <AccordionItem value="faq">
                  <AccordionTrigger className="text-sm">
                    <span className="flex items-center gap-2">
                      <HelpCircle className="h-4 w-4" />
                      FAQ do Produto
                      <Badge variant="secondary">{productFaqs.length}</Badge>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="text-sm space-y-2 text-muted-foreground">
                      {productFaqs.slice(0, 3).map((faq, idx) => (
                        <div key={idx}>
                          <p className="font-medium text-foreground">{faq.question}</p>
                          <p className="text-xs">{faq.answer}</p>
                        </div>
                      ))}
                      {productFaqs.length > 3 && (
                        <p className="text-xs">+{productFaqs.length - 3} mais...</p>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )}
            </Accordion>
          </CardContent>
        </Card>
      ) : null}

      {/* Sales Script (optional) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Script de Vendas (opcional)
          </CardTitle>
          <CardDescription>
            Se você tem um script que já funciona, cole aqui. A IA vai usar como referência.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={briefing.salesScript}
            onChange={(e) => updateField('salesScript', e.target.value)}
            placeholder="Cole aqui seu script de vendas, argumentos que funcionam, objeções que seus clientes têm..."
            rows={4}
          />
        </CardContent>
      </Card>

      {/* AI Image Generation Toggle */}
      <Card className="border-primary/50 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-primary" />
              <div>
                <Label>Gerar imagens que faltam com IA</Label>
                <p className="text-xs text-muted-foreground">
                  A IA vai criar imagens profissionais para preencher lacunas
                </p>
              </div>
            </div>
            <Switch
              checked={briefing.generateMissingImages}
              onCheckedChange={(checked) => updateField('generateMissingImages', checked)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
