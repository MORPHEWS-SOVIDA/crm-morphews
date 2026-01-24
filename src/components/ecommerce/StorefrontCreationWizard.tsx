import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { 
  Sparkles, 
  Upload, 
  Store, 
  Palette, 
  Package,
  ArrowRight,
  ArrowLeft,
  Check,
  Loader2,
  ImageIcon,
  Info,
  Zap,
  Eye
} from 'lucide-react';
import { toast } from 'sonner';
import type { CreateStorefrontInput } from '@/hooks/ecommerce';

interface WizardData {
  // Step 1: Basics
  storeName: string;
  storeDescription: string;
  niche: 'saude' | 'beleza' | 'moda' | 'alimentos' | 'casa' | 'tech' | 'outro';
  
  // Step 2: Branding
  logoFile: File | null;
  logoPreview: string | null;
  bannerFile: File | null;
  bannerPreview: string | null;
  primaryColor: string;
  
  // Step 3: Template
  templateId: string;
  templateSlug: string;
  
  // Step 4: Contact
  whatsappNumber: string;
  instagramUrl: string;
  email: string;
}

interface StorefrontTemplate {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  preview_image_url: string | null;
  template_type: string;
  config: Record<string, any>;
}

interface StorefrontCreationWizardProps {
  templates: StorefrontTemplate[];
  onComplete: (data: Partial<CreateStorefrontInput>, logoFile?: File | null, bannerFile?: File | null) => Promise<void>;
  onCancel: () => void;
}

const NICHE_OPTIONS = [
  { value: 'saude', label: 'Saúde & Bem-estar', icon: '💊', color: '#10b981' },
  { value: 'beleza', label: 'Beleza & Cosméticos', icon: '💄', color: '#ec4899' },
  { value: 'moda', label: 'Moda & Acessórios', icon: '👗', color: '#8b5cf6' },
  { value: 'alimentos', label: 'Alimentos & Bebidas', icon: '🍎', color: '#f59e0b' },
  { value: 'casa', label: 'Casa & Decoração', icon: '🏠', color: '#6366f1' },
  { value: 'tech', label: 'Tecnologia', icon: '💻', color: '#3b82f6' },
  { value: 'outro', label: 'Outro', icon: '✨', color: '#6b7280' },
];

const STEPS = [
  { id: 1, title: 'Sobre sua Loja', icon: Store },
  { id: 2, title: 'Identidade Visual', icon: Palette },
  { id: 3, title: 'Escolha o Template', icon: Sparkles },
  { id: 4, title: 'Contato', icon: Package },
];

export function StorefrontCreationWizard({ templates, onComplete, onCancel }: StorefrontCreationWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  
  const [wizardData, setWizardData] = useState<WizardData>({
    storeName: '',
    storeDescription: '',
    niche: 'saude',
    logoFile: null,
    logoPreview: null,
    bannerFile: null,
    bannerPreview: null,
    primaryColor: '#10b981',
    templateId: '',
    templateSlug: '',
    whatsappNumber: '',
    instagramUrl: '',
    email: '',
  });

  const storeTemplates = templates.filter(t => t.template_type === 'store');

  const progress = (currentStep / STEPS.length) * 100;

  const handleFileChange = (type: 'logo' | 'banner', file: File | null) => {
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Imagem muito grande. Máximo 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const preview = e.target?.result as string;
      if (type === 'logo') {
        setWizardData(prev => ({ ...prev, logoFile: file, logoPreview: preview }));
      } else {
        setWizardData(prev => ({ ...prev, bannerFile: file, bannerPreview: preview }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleNicheChange = (niche: WizardData['niche']) => {
    const nicheOption = NICHE_OPTIONS.find(n => n.value === niche);
    setWizardData(prev => ({
      ...prev,
      niche,
      primaryColor: nicheOption?.color || prev.primaryColor,
    }));
  };

  const handleTemplateSelect = (template: StorefrontTemplate) => {
    const colors = template.config?.colors as { primary?: string } | undefined;
    setWizardData(prev => ({
      ...prev,
      templateId: template.id,
      templateSlug: template.slug,
      primaryColor: colors?.primary || prev.primaryColor,
    }));
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return wizardData.storeName.trim().length >= 2;
      case 2:
        return true; // Optional step
      case 3:
        return !!wizardData.templateId;
      case 4:
        return true; // Optional step
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    if (!wizardData.templateId) {
      toast.error('Selecione um template');
      return;
    }

    setIsSubmitting(true);
    try {
      await onComplete({
        name: wizardData.storeName,
        slug: wizardData.storeName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-'),
        template_id: wizardData.templateId,
        primary_color: wizardData.primaryColor,
        secondary_color: '#1a1a1a',
        whatsapp_number: wizardData.whatsappNumber || null,
        meta_description: wizardData.storeDescription || null,
      }, wizardData.logoFile, wizardData.bannerFile);
    } catch (error) {
      console.error('Error creating storefront:', error);
      toast.error('Erro ao criar loja');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Progress Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          {STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isActive = currentStep === step.id;
            const isComplete = currentStep > step.id;
            
            return (
              <div key={step.id} className="flex items-center">
                <div 
                  className={`
                    flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all
                    ${isComplete ? 'bg-primary border-primary text-primary-foreground' : ''}
                    ${isActive ? 'border-primary text-primary' : ''}
                    ${!isActive && !isComplete ? 'border-muted text-muted-foreground' : ''}
                  `}
                >
                  {isComplete ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                </div>
                {idx < STEPS.length - 1 && (
                  <div 
                    className={`w-16 h-0.5 mx-2 ${isComplete ? 'bg-primary' : 'bg-muted'}`}
                  />
                )}
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-sm">
          {STEPS.map(step => (
            <span 
              key={step.id}
              className={currentStep === step.id ? 'font-medium text-foreground' : 'text-muted-foreground'}
            >
              {step.title}
            </span>
          ))}
        </div>
        <Progress value={progress} className="mt-4" />
      </div>

      {/* Step Content */}
      <Card>
        <CardContent className="pt-6">
          {/* Step 1: Basics */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold mb-2">Vamos criar sua loja incrível!</h2>
                <p className="text-muted-foreground">
                  Conte-nos um pouco sobre seu negócio
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="storeName">Nome da Loja *</Label>
                  <Input
                    id="storeName"
                    value={wizardData.storeName}
                    onChange={(e) => setWizardData(prev => ({ ...prev, storeName: e.target.value }))}
                    placeholder="Ex: Minha Loja Premium"
                    className="text-lg py-6"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Qual é o nicho da sua loja?</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {NICHE_OPTIONS.map(option => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handleNicheChange(option.value as WizardData['niche'])}
                        className={`
                          p-4 rounded-xl border-2 text-center transition-all
                          ${wizardData.niche === option.value 
                            ? 'border-primary bg-primary/5' 
                            : 'border-muted hover:border-primary/50'}
                        `}
                      >
                        <span className="text-2xl mb-2 block">{option.icon}</span>
                        <span className="text-sm font-medium">{option.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="storeDescription">Descrição (opcional)</Label>
                  <Textarea
                    id="storeDescription"
                    value={wizardData.storeDescription}
                    onChange={(e) => setWizardData(prev => ({ ...prev, storeDescription: e.target.value }))}
                    placeholder="Descreva sua loja em poucas palavras..."
                    rows={3}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Branding */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold mb-2">Identidade Visual</h2>
                <p className="text-muted-foreground">
                  Faça upload do seu logo e banner (ou pule para usar os padrões)
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Logo Upload */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Logo</Label>
                    <Badge variant="outline" className="text-xs">
                      <Info className="h-3 w-3 mr-1" />
                      200×200px ideal
                    </Badge>
                  </div>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileChange('logo', e.target.files?.[0] || null)}
                  />
                  <div
                    onClick={() => logoInputRef.current?.click()}
                    className={`
                      aspect-square rounded-xl border-2 border-dashed cursor-pointer
                      flex items-center justify-center transition-all hover:border-primary
                      ${wizardData.logoPreview ? 'border-primary bg-primary/5' : 'border-muted'}
                    `}
                  >
                    {wizardData.logoPreview ? (
                      <img 
                        src={wizardData.logoPreview} 
                        alt="Logo preview" 
                        className="max-w-full max-h-full object-contain p-4"
                      />
                    ) : (
                      <div className="text-center text-muted-foreground">
                        <Upload className="h-8 w-8 mx-auto mb-2" />
                        <p className="text-sm">Clique para upload</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Banner Upload */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Banner Principal</Label>
                    <Badge variant="outline" className="text-xs">
                      <Info className="h-3 w-3 mr-1" />
                      1920×600px ideal
                    </Badge>
                  </div>
                  <input
                    ref={bannerInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileChange('banner', e.target.files?.[0] || null)}
                  />
                  <div
                    onClick={() => bannerInputRef.current?.click()}
                    className={`
                      aspect-[16/5] rounded-xl border-2 border-dashed cursor-pointer
                      flex items-center justify-center transition-all hover:border-primary
                      ${wizardData.bannerPreview ? 'border-primary bg-primary/5' : 'border-muted'}
                    `}
                  >
                    {wizardData.bannerPreview ? (
                      <img 
                        src={wizardData.bannerPreview} 
                        alt="Banner preview" 
                        className="w-full h-full object-cover rounded-lg"
                      />
                    ) : (
                      <div className="text-center text-muted-foreground">
                        <ImageIcon className="h-8 w-8 mx-auto mb-2" />
                        <p className="text-sm">Clique para upload</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Color Picker */}
              <div className="space-y-3">
                <Label>Cor Principal</Label>
                <div className="flex items-center gap-4">
                  <input
                    type="color"
                    value={wizardData.primaryColor}
                    onChange={(e) => setWizardData(prev => ({ ...prev, primaryColor: e.target.value }))}
                    className="w-12 h-12 rounded-lg cursor-pointer border-0"
                  />
                  <Input
                    value={wizardData.primaryColor}
                    onChange={(e) => setWizardData(prev => ({ ...prev, primaryColor: e.target.value }))}
                    className="w-32"
                  />
                  <div 
                    className="flex-1 h-12 rounded-lg"
                    style={{ backgroundColor: wizardData.primaryColor }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Template Selection */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold mb-2">Escolha seu Template</h2>
                <p className="text-muted-foreground">
                  Selecione o estilo que mais combina com sua marca
                </p>
              </div>

              <RadioGroup
                value={wizardData.templateId}
                onValueChange={(value) => {
                  const template = storeTemplates.find(t => t.id === value);
                  if (template) handleTemplateSelect(template);
                }}
                className="grid gap-4"
              >
                {storeTemplates.map(template => (
                  <div key={template.id}>
                    <RadioGroupItem 
                      value={template.id} 
                      id={template.id}
                      className="peer sr-only"
                    />
                    <Label
                      htmlFor={template.id}
                      className={`
                        flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer
                        transition-all hover:border-primary/50
                        peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5
                      `}
                    >
                      {/* Template Preview */}
                      <div 
                        className="w-24 h-24 rounded-lg bg-muted flex-shrink-0 overflow-hidden"
                        style={{ 
                          backgroundColor: (template.config?.colors as any)?.primary || '#e5e7eb'
                        }}
                      >
                        {template.preview_image_url ? (
                          <img 
                            src={template.preview_image_url} 
                            alt={template.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Eye className="h-8 w-8 text-white/50" />
                          </div>
                        )}
                      </div>

                      {/* Template Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold">{template.name}</h3>
                          {template.slug === 'premium-saude' && (
                            <Badge className="text-xs">Popular</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {template.description}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {((template.config?.features as string[]) || []).slice(0, 3).map((feature, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {feature.replace(/_/g, ' ')}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {/* Selection Indicator */}
                      {wizardData.templateId === template.id && (
                        <div className="flex-shrink-0">
                          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                            <Check className="h-4 w-4 text-primary-foreground" />
                          </div>
                        </div>
                      )}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          )}

          {/* Step 4: Contact */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold mb-2">Informações de Contato</h2>
                <p className="text-muted-foreground">
                  Opcional, mas recomendado para seus clientes entrarem em contato
                </p>
              </div>

              <div className="space-y-4 max-w-md mx-auto">
                <div className="space-y-2">
                  <Label htmlFor="whatsapp">WhatsApp</Label>
                  <Input
                    id="whatsapp"
                    value={wizardData.whatsappNumber}
                    onChange={(e) => setWizardData(prev => ({ ...prev, whatsappNumber: e.target.value }))}
                    placeholder="55 11 99999-9999"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="instagram">Instagram</Label>
                  <Input
                    id="instagram"
                    value={wizardData.instagramUrl}
                    onChange={(e) => setWizardData(prev => ({ ...prev, instagramUrl: e.target.value }))}
                    placeholder="https://instagram.com/sualoja"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={wizardData.email}
                    onChange={(e) => setWizardData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="contato@sualoja.com"
                  />
                </div>
              </div>

              {/* Summary */}
              <Card className="bg-muted/50 mt-8">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" />
                    Resumo da sua Loja
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Nome:</span>
                    <span className="ml-2 font-medium">{wizardData.storeName}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Template:</span>
                    <span className="ml-2 font-medium">
                      {storeTemplates.find(t => t.id === wizardData.templateId)?.name || '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Nicho:</span>
                    <span className="ml-2 font-medium">
                      {NICHE_OPTIONS.find(n => n.value === wizardData.niche)?.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Cor:</span>
                    <div 
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: wizardData.primaryColor }}
                    />
                    <span className="font-medium">{wizardData.primaryColor}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation Buttons */}
      <div className="flex justify-between mt-6">
        <Button
          variant="outline"
          onClick={currentStep === 1 ? onCancel : handleBack}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {currentStep === 1 ? 'Cancelar' : 'Voltar'}
        </Button>

        {currentStep < STEPS.length ? (
          <Button
            onClick={handleNext}
            disabled={!canProceed()}
          >
            Próximo
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !canProceed()}
            className="gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Criando...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Criar Minha Loja
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
