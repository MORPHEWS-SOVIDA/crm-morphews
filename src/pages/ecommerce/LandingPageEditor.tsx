import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ArrowLeft, 
  Save, 
  Eye, 
  Palette, 
  Type, 
  Image as ImageIcon,
  Check,
  Loader2,
  ExternalLink,
  RefreshCw,
  Code,
  AlertCircle,
  Users,
} from 'lucide-react';
import { AffiliatesTab } from '@/components/ecommerce/affiliates/AffiliatesTab';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface EditorLandingPage {
  id: string;
  name: string;
  slug: string;
  headline: string | null;
  subheadline: string | null;
  benefits: unknown[];
  urgency_text: string | null;
  guarantee_text: string | null;
  primary_color: string | null;
  // Full HTML mode
  full_html: string | null;
  import_mode: 'structured' | 'full_html' | null;
  source_url: string | null;
}

export default function LandingPageEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [landingPage, setLandingPage] = useState<EditorLandingPage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Editable fields
  const [headline, setHeadline] = useState('');
  const [subheadline, setSubheadline] = useState('');
  const [benefits, setBenefits] = useState<string[]>([]);
  const [urgencyText, setUrgencyText] = useState('');
  const [guaranteeText, setGuaranteeText] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#10b981');
  const [ctaText, setCtaText] = useState('COMPRAR AGORA');
  
  // Full HTML mode
  const [fullHtml, setFullHtml] = useState('');
  useEffect(() => {
    if (id) {
      loadLandingPage();
    }
  }, [id]);

  const loadLandingPage = async () => {
    try {
      const { data, error } = await supabase
        .from('landing_pages')
        .select('id, name, slug, headline, subheadline, benefits, urgency_text, guarantee_text, primary_color, full_html, import_mode, source_url')
        .eq('id', id)
        .single();

      if (error) throw error;

      // Normalize benefits - convert objects to strings if needed
      const rawBenefits = Array.isArray(data.benefits) ? data.benefits : [];
      const normalizedBenefits: string[] = rawBenefits.map((b: unknown) => {
        if (typeof b === 'string') return b;
        if (b && typeof b === 'object') {
          const obj = b as Record<string, unknown>;
          // Handle {title, description} or {text} formats from scraping
          if (typeof obj.title === 'string') return obj.title;
          if (typeof obj.text === 'string') return obj.text;
          if (typeof obj.description === 'string') return obj.description;
          // Last resort: stringify
          try { return JSON.stringify(b); } catch { return ''; }
        }
        return String(b ?? '');
      }).filter((b: string) => b.trim().length > 0);

      const lp: EditorLandingPage = {
        id: data.id,
        name: data.name,
        slug: data.slug,
        headline: data.headline,
        subheadline: data.subheadline,
        benefits: normalizedBenefits,
        urgency_text: data.urgency_text,
        guarantee_text: data.guarantee_text,
        primary_color: data.primary_color,
        full_html: data.full_html,
        import_mode: (data.import_mode as 'structured' | 'full_html' | null) || null,
        source_url: data.source_url,
      };

      setLandingPage(lp);
      setHeadline(lp.headline || '');
      setSubheadline(lp.subheadline || '');
      setBenefits(normalizedBenefits);
      setUrgencyText(lp.urgency_text || '');
      setGuaranteeText(lp.guarantee_text || '');
      setPrimaryColor(lp.primary_color || '#10b981');
      setFullHtml(lp.full_html || '');
    } catch (error) {
      console.error('Error loading landing page:', error);
      toast.error('Erro ao carregar landing page');
      navigate('/ecommerce');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!landingPage) return;

    setIsSaving(true);
    try {
      const isFullHtmlMode = landingPage.import_mode === 'full_html';
      
      const updateData: Record<string, any> = {
        headline,
        subheadline,
        benefits,
        urgency_text: urgencyText,
        guarantee_text: guaranteeText,
        primary_color: primaryColor,
        updated_at: new Date().toISOString(),
      };
      
      // If full HTML mode, also save the HTML
      if (isFullHtmlMode) {
        updateData.full_html = fullHtml;
      }
      
      const { error } = await supabase
        .from('landing_pages')
        .update(updateData)
        .eq('id', landingPage.id);

      if (error) throw error;

      toast.success('Alterações salvas!');
      setHasChanges(false);
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Erro ao salvar alterações');
    } finally {
      setIsSaving(false);
    }
  };

  const updateBenefit = (index: number, value: string) => {
    const newBenefits = [...benefits];
    newBenefits[index] = value;
    setBenefits(newBenefits);
    setHasChanges(true);
  };

  const addBenefit = () => {
    setBenefits([...benefits, '']);
    setHasChanges(true);
  };

  const removeBenefit = (index: number) => {
    setBenefits(benefits.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  const previewUrl = landingPage 
    ? `https://sales.morphews.com/lp/${landingPage.slug}`
    : '';

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!landingPage) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Landing page não encontrada</p>
          <Button onClick={() => navigate('/ecommerce')} className="mt-4">
            Voltar
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate('/ecommerce')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">{landingPage.name}</h1>
              <p className="text-sm text-muted-foreground">
                Edite textos, cores e imagens
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasChanges && (
              <Badge variant="secondary" className="gap-1">
                <RefreshCw className="h-3 w-3" />
                Alterações não salvas
              </Badge>
            )}
            <Button
              variant="outline"
              onClick={() => window.open(previewUrl, '_blank')}
              className="gap-2"
            >
              <Eye className="h-4 w-4" />
              Visualizar
            </Button>
            <Button
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className="gap-2"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Salvar
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Editor Panel */}
          <div className="lg:col-span-1 space-y-4">
            <Tabs defaultValue="text">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="text" className="gap-1">
                  <Type className="h-4 w-4" />
                  Textos
                </TabsTrigger>
                <TabsTrigger value="colors" className="gap-1">
                  <Palette className="h-4 w-4" />
                  Cores
                </TabsTrigger>
                <TabsTrigger value="images" className="gap-1">
                  <ImageIcon className="h-4 w-4" />
                  Imagens
                </TabsTrigger>
                <TabsTrigger value="affiliates" className="gap-1">
                  <Users className="h-4 w-4" />
                  Afiliados
                </TabsTrigger>
              </TabsList>

              <TabsContent value="text" className="space-y-4 mt-4">
                {/* Full HTML Mode Notice */}
                {landingPage.import_mode === 'full_html' && (
                  <Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                    <Code className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-700 dark:text-green-300">
                      <strong>Modo Site Completo:</strong> O HTML original foi importado.
                      {landingPage.source_url && (
                        <span className="block text-xs mt-1 opacity-75">
                          Fonte: {landingPage.source_url}
                        </span>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
                
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Headline Principal</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={headline}
                      onChange={(e) => {
                        setHeadline(e.target.value);
                        setHasChanges(true);
                      }}
                      placeholder="Sua headline impactante"
                      rows={2}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Subheadline</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={subheadline}
                      onChange={(e) => {
                        setSubheadline(e.target.value);
                        setHasChanges(true);
                      }}
                      placeholder="Texto complementar"
                      rows={2}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Benefícios</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {benefits.map((benefit, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          value={benefit}
                          onChange={(e) => updateBenefit(index, e.target.value)}
                          placeholder={`Benefício ${index + 1}`}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeBenefit(index)}
                          className="flex-shrink-0"
                        >
                          ×
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addBenefit}
                      className="w-full"
                    >
                      + Adicionar benefício
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Texto de Urgência</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Input
                      value={urgencyText}
                      onChange={(e) => {
                        setUrgencyText(e.target.value);
                        setHasChanges(true);
                      }}
                      placeholder="🔥 Últimas unidades!"
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Garantia</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={guaranteeText}
                      onChange={(e) => {
                        setGuaranteeText(e.target.value);
                        setHasChanges(true);
                      }}
                      placeholder="Garantia de 30 dias..."
                      rows={2}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Texto do Botão (CTA)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Input
                      value={ctaText}
                      onChange={(e) => {
                        setCtaText(e.target.value);
                        setHasChanges(true);
                      }}
                      placeholder="COMPRAR AGORA"
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="colors" className="space-y-4 mt-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Cor Principal</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={primaryColor}
                        onChange={(e) => {
                          setPrimaryColor(e.target.value);
                          setHasChanges(true);
                        }}
                        className="w-12 h-12 rounded-lg cursor-pointer border-2"
                      />
                      <Input
                        value={primaryColor}
                        onChange={(e) => {
                          setPrimaryColor(e.target.value);
                          setHasChanges(true);
                        }}
                        placeholder="#10b981"
                        className="flex-1"
                      />
                    </div>
                    <div className="grid grid-cols-6 gap-2">
                      {['#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#f59e0b', '#000000'].map((color) => (
                        <button
                          key={color}
                          onClick={() => {
                            setPrimaryColor(color);
                            setHasChanges(true);
                          }}
                          className={cn(
                            'w-8 h-8 rounded-lg border-2 transition-all',
                            primaryColor === color ? 'ring-2 ring-offset-2 ring-primary' : ''
                          )}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Preview do Botão</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Button 
                      className="w-full" 
                      style={{ backgroundColor: primaryColor }}
                    >
                      {ctaText || 'COMPRAR AGORA'}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="images" className="space-y-4 mt-4">
                {landingPage.import_mode === 'full_html' ? (
                  <>
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Code className="h-4 w-4" />
                          Código HTML
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Textarea
                          value={fullHtml}
                          onChange={(e) => {
                            setFullHtml(e.target.value);
                            setHasChanges(true);
                          }}
                          placeholder="HTML do site"
                          rows={15}
                          className="font-mono text-xs"
                        />
                        <p className="text-xs text-muted-foreground mt-2">
                          Edite o HTML diretamente. Cuidado para não quebrar a estrutura.
                        </p>
                      </CardContent>
                    </Card>
                  </>
                ) : (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Imagens</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        Em breve você poderá trocar as imagens da página aqui.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Affiliates Tab */}
              <TabsContent value="affiliates" className="space-y-4 mt-4">
                {landingPage && (
                  <AffiliatesTab
                    assetType="landing"
                    assetId={landingPage.id}
                    assetSlug={landingPage.slug}
                  />
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* Preview Panel */}
          <div className="lg:col-span-2">
            <Card className="overflow-hidden">
              <CardHeader className="border-b py-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Preview em Tempo Real</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(previewUrl, '_blank')}
                    className="gap-1 text-xs"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Abrir em nova aba
                  </Button>
                </div>
              </CardHeader>
              <ScrollArea className="h-[600px]">
                {/* Full HTML Mode Preview */}
                {landingPage.import_mode === 'full_html' && fullHtml ? (
                  <iframe
                    srcDoc={fullHtml}
                    title="Preview"
                    className="w-full h-[600px] border-0"
                    sandbox="allow-same-origin"
                  />
                ) : (
                <div className="space-y-0">
                  {/* Hero */}
                  <div 
                    className="relative min-h-[300px] flex items-center justify-center p-8"
                    style={{ 
                      background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)`
                    }}
                  >
                    <div className="text-center text-white max-w-2xl">
                      <h1 className="text-3xl font-bold mb-4">
                        {headline || 'Sua headline aqui'}
                      </h1>
                      <p className="text-lg opacity-90 mb-6">
                        {subheadline || 'Subheadline complementar'}
                      </p>
                      <Button variant="secondary" size="lg">
                        {ctaText || 'COMPRAR AGORA'}
                      </Button>
                    </div>
                  </div>

                  {/* Urgency */}
                  {urgencyText && (
                    <div 
                      className="py-3 text-center text-white font-medium"
                      style={{ backgroundColor: primaryColor }}
                    >
                      🔥 {urgencyText}
                    </div>
                  )}

                  {/* Benefits */}
                  {benefits.length > 0 && (
                    <div className="py-8 px-6 bg-muted/30">
                      <h2 className="text-xl font-bold text-center mb-6">
                        O que você vai receber:
                      </h2>
                      <div className="grid gap-3 max-w-xl mx-auto">
                        {benefits.filter(b => typeof b === 'string' && b.trim()).map((benefit, idx) => (
                          <div 
                            key={idx} 
                            className="flex items-start gap-3 p-3 bg-background rounded-lg"
                          >
                            <div 
                              className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-white"
                              style={{ backgroundColor: primaryColor }}
                            >
                              <Check className="h-3 w-3" />
                            </div>
                            <span className="text-sm">{benefit}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Guarantee */}
                  {guaranteeText && (
                    <div className="py-8 px-6">
                      <div className="max-w-md mx-auto text-center">
                        <div 
                          className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-3"
                          style={{ backgroundColor: `${primaryColor}20` }}
                        >
                          <Check className="h-6 w-6" style={{ color: primaryColor }} />
                        </div>
                        <h3 className="font-bold mb-2">Garantia Total</h3>
                        <p className="text-sm text-muted-foreground">{guaranteeText}</p>
                      </div>
                    </div>
                  )}

                  {/* Final CTA */}
                  <div 
                    className="py-8 px-6 text-center"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <h2 className="text-xl font-bold text-white mb-4">
                      Não perca essa oportunidade!
                    </h2>
                    <Button variant="secondary" size="lg">
                      {ctaText || 'COMPRAR AGORA'}
                    </Button>
                  </div>
                </div>
                )}
              </ScrollArea>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
