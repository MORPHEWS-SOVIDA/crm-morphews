import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { CurrencyInput } from '@/components/ui/currency-input';
import { useProducts } from '@/hooks/useProducts';
import {
  useCreateLandingPage,
  useUpdateLandingPage,
  type LandingPage,
  type CreateLandingPageInput,
} from '@/hooks/ecommerce';
import { AILandingWizard } from './ai-landing';

interface LandingPageFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  landingPage: LandingPage | null;
}

interface OfferForm {
  quantity: number;
  label: string;
  price_cents: number;
  original_price_cents?: number;
  discount_percentage?: number;
  badge_text?: string;
  is_highlighted: boolean;
}

export function LandingPageFormDialog({ open, onOpenChange, landingPage }: LandingPageFormDialogProps) {
  const { data: products } = useProducts();
  const createLandingPage = useCreateLandingPage();
  const updateLandingPage = useUpdateLandingPage();
  
  // Now AI-only for new pages, edit mode for existing
  const isEditMode = !!landingPage;
  
  const [formData, setFormData] = useState<Omit<CreateLandingPageInput, 'offers'>>({
    product_id: '',
    name: '',
    slug: '',
    headline: '',
    subheadline: '',
    video_url: '',
    benefits: [],
    urgency_text: '',
    guarantee_text: '',
    logo_url: '',
    primary_color: '#000000',
    whatsapp_number: '',
  });

  const [offers, setOffers] = useState<OfferForm[]>([
    { quantity: 1, label: '1 unidade', price_cents: 0, is_highlighted: false },
  ]);

  const [benefitsText, setBenefitsText] = useState('');

  const handleAIGenerated = (data: Partial<CreateLandingPageInput>) => {
    // AI wizard now handles full flow, just save directly
    const benefits = data.benefits as string[] || [];
    const dataToSend: CreateLandingPageInput = {
      product_id: data.product_id || '',
      name: data.name || '',
      slug: data.slug || '',
      headline: data.headline || '',
      subheadline: data.subheadline || '',
      video_url: data.video_url || '',
      benefits,
      urgency_text: data.urgency_text || '',
      guarantee_text: data.guarantee_text || '',
      logo_url: data.logo_url || '',
      primary_color: data.primary_color || '#000000',
      whatsapp_number: data.whatsapp_number || '',
      offers: data.offers || [],
    };
    
    createLandingPage.mutate(dataToSend, {
      onSuccess: () => onOpenChange(false),
    });
  };

  useEffect(() => {
    if (landingPage) {
      setFormData({
        product_id: landingPage.product_id,
        name: landingPage.name,
        slug: landingPage.slug,
        headline: landingPage.headline || '',
        subheadline: landingPage.subheadline || '',
        video_url: landingPage.video_url || '',
        benefits: landingPage.benefits as string[] || [],
        urgency_text: landingPage.urgency_text || '',
        guarantee_text: landingPage.guarantee_text || '',
        logo_url: landingPage.logo_url || '',
        primary_color: landingPage.primary_color || '#000000',
        whatsapp_number: landingPage.whatsapp_number || '',
      });
      setBenefitsText((landingPage.benefits as string[] || []).join('\n'));
      
      if (landingPage.offers && landingPage.offers.length > 0) {
        setOffers(
          landingPage.offers.map((o) => ({
            quantity: o.quantity,
            label: o.label,
            price_cents: o.price_cents,
            original_price_cents: o.original_price_cents || undefined,
            discount_percentage: o.discount_percentage || undefined,
            badge_text: o.badge_text || undefined,
            is_highlighted: o.is_highlighted,
          }))
        );
      }
    } else {
      setFormData({
        product_id: '',
        name: '',
        slug: '',
        headline: '',
        subheadline: '',
        video_url: '',
        benefits: [],
        urgency_text: '',
        guarantee_text: '',
        logo_url: '',
        primary_color: '#000000',
        whatsapp_number: '',
      });
      setOffers([{ quantity: 1, label: '1 unidade', price_cents: 0, is_highlighted: false }]);
      setBenefitsText('');
    }
  }, [landingPage, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const benefits = benefitsText.split('\n').filter((b) => b.trim());
    
    const dataToSend: CreateLandingPageInput = {
      ...formData,
      benefits,
      offers: offers.filter((o) => o.price_cents > 0),
    };

    if (landingPage) {
      // For update, we need to pass data compatible with the mutation
      const updateData = {
        id: landingPage.id,
        ...formData,
        benefits,
        offers: offers.filter((o) => o.price_cents > 0),
      };
      updateLandingPage.mutate(updateData as any, {
        onSuccess: () => onOpenChange(false),
      });
    } else {
      createLandingPage.mutate(dataToSend, {
        onSuccess: () => onOpenChange(false),
      });
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const addOffer = () => {
    const nextQty = offers.length === 0 ? 1 : offers.length === 1 ? 3 : 5;
    setOffers([
      ...offers,
      {
        quantity: nextQty,
        label: `${nextQty} unidade${nextQty > 1 ? 's' : ''}`,
        price_cents: 0,
        is_highlighted: false,
      },
    ]);
  };

  const removeOffer = (index: number) => {
    setOffers(offers.filter((_, i) => i !== index));
  };

  const updateOffer = (index: number, field: keyof OfferForm, value: unknown) => {
    setOffers(
      offers.map((o, i) =>
        i === index ? { ...o, [field]: value } : o
      )
    );
  };

  const isLoading = createLandingPage.isPending || updateLandingPage.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? 'Editar Landing Page' : 'Criar Landing Page com IA'}
          </DialogTitle>
          <DialogDescription>
            {isEditMode 
              ? 'Edite os dados da sua landing page'
              : 'Configure sua página e deixe a IA criar o conteúdo perfeito'
            }
          </DialogDescription>
        </DialogHeader>

        {!isEditMode ? (
          <AILandingWizard 
            onGenerated={handleAIGenerated} 
            onCancel={() => onOpenChange(false)} 
          />
        ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <Tabs defaultValue="basic">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basic">Básico</TabsTrigger>
              <TabsTrigger value="offers">Ofertas</TabsTrigger>
              <TabsTrigger value="content">Conteúdo</TabsTrigger>
              <TabsTrigger value="settings">Config</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="product">Produto *</Label>
                <Select
                  value={formData.product_id}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, product_id: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o produto" />
                  </SelectTrigger>
                  <SelectContent>
                    {products?.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Página *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => {
                      setFormData((prev) => ({
                        ...prev,
                        name: e.target.value,
                        slug: prev.slug || generateSlug(e.target.value),
                      }));
                    }}
                    placeholder="Oferta Especial"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="slug">URL *</Label>
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">
                      sales.morphews.com/lp/
                    </span>
                    <Input
                      id="slug"
                      value={formData.slug}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          slug: generateSlug(e.target.value),
                        }))
                      }
                      placeholder="oferta-especial"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="headline">Headline (Título principal)</Label>
                <Input
                  id="headline"
                  value={formData.headline}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, headline: e.target.value }))
                  }
                  placeholder="O produto que vai mudar sua vida"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="subheadline">Subheadline</Label>
                <Textarea
                  id="subheadline"
                  value={formData.subheadline}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, subheadline: e.target.value }))
                  }
                  placeholder="Descrição breve do produto"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="video_url">URL do Vídeo (VSL)</Label>
                <Input
                  id="video_url"
                  value={formData.video_url}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, video_url: e.target.value }))
                  }
                  placeholder="https://youtube.com/..."
                />
              </div>
            </TabsContent>

            <TabsContent value="offers" className="space-y-4 mt-4">
              <div className="flex justify-between items-center">
                <Label>Ofertas (1, 3, 5 unidades)</Label>
                <Button type="button" variant="outline" size="sm" onClick={addOffer}>
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar
                </Button>
              </div>

              <div className="space-y-4">
                {offers.map((offer, index) => (
                  <Card key={index}>
                    <CardContent className="pt-4 space-y-4">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={offer.is_highlighted}
                            onCheckedChange={(checked) =>
                              updateOffer(index, 'is_highlighted', checked)
                            }
                          />
                          <Label className="text-sm">Destacar oferta</Label>
                        </div>
                        {offers.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeOffer(index)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Quantidade</Label>
                          <Input
                            type="number"
                            value={offer.quantity}
                            onChange={(e) =>
                              updateOffer(index, 'quantity', parseInt(e.target.value) || 1)
                            }
                            min={1}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Label</Label>
                          <Input
                            value={offer.label}
                            onChange={(e) => updateOffer(index, 'label', e.target.value)}
                            placeholder="Kit 3 unidades"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Preço (R$)</Label>
                          <CurrencyInput
                            value={offer.price_cents}
                            onChange={(value) => updateOffer(index, 'price_cents', value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Preço Original (riscado)</Label>
                          <CurrencyInput
                            value={offer.original_price_cents || 0}
                            onChange={(value) =>
                              updateOffer(index, 'original_price_cents', value || undefined)
                            }
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Badge (ex: "Mais vendido")</Label>
                        <Input
                          value={offer.badge_text || ''}
                          onChange={(e) =>
                            updateOffer(index, 'badge_text', e.target.value || undefined)
                          }
                          placeholder="Melhor custo-benefício"
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="content" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="benefits">Benefícios (um por linha)</Label>
                <Textarea
                  id="benefits"
                  value={benefitsText}
                  onChange={(e) => setBenefitsText(e.target.value)}
                  placeholder="Benefício 1&#10;Benefício 2&#10;Benefício 3"
                  rows={5}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="urgency">Texto de Urgência</Label>
                <Input
                  id="urgency"
                  value={formData.urgency_text}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, urgency_text: e.target.value }))
                  }
                  placeholder="Oferta válida apenas hoje!"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="guarantee">Texto de Garantia</Label>
                <Textarea
                  id="guarantee"
                  value={formData.guarantee_text}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, guarantee_text: e.target.value }))
                  }
                  placeholder="Garantia de 30 dias ou seu dinheiro de volta"
                  rows={2}
                />
              </div>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="logo">URL do Logo</Label>
                <Input
                  id="logo"
                  value={formData.logo_url}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, logo_url: e.target.value }))
                  }
                  placeholder="https://..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="color">Cor Principal</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    id="color"
                    value={formData.primary_color}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, primary_color: e.target.value }))
                    }
                    className="w-12 h-10 p-1"
                  />
                  <Input
                    value={formData.primary_color}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, primary_color: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="whatsapp">WhatsApp (atendimento)</Label>
                <Input
                  id="whatsapp"
                  value={formData.whatsapp_number}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, whatsapp_number: e.target.value }))
                  }
                  placeholder="5511999999999"
                />
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading || !formData.product_id}>
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {landingPage ? 'Salvar' : 'Criar Landing Page'}
            </Button>
          </div>
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
