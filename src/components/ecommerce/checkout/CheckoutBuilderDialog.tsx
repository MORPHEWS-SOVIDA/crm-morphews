import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import {
  Timer,
  MessageSquare,
  Shield,
  Palette,
  Eye,
  Save,
  Loader2,
  Star,
  Plus,
  Trash2,
  Users,
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import {
  useUpdateStandaloneCheckout,
  useCheckoutTestimonials,
  useCreateCheckoutTestimonial,
  useDeleteCheckoutTestimonial,
  type StandaloneCheckout,
  type CheckoutElements,
  type CheckoutTheme,
} from '@/hooks/ecommerce/useStandaloneCheckouts';
import { supabase } from '@/integrations/supabase/client';
import { CheckoutAffiliatesTab } from './CheckoutAffiliatesTab';
import { CheckoutPartnersTab } from './CheckoutPartnersTab';
import { Factory } from 'lucide-react';

interface CheckoutBuilderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checkout: StandaloneCheckout;
}

const FONT_OPTIONS = [
  { value: 'Inter', label: 'Inter' },
  { value: 'Poppins', label: 'Poppins' },
  { value: 'Roboto', label: 'Roboto' },
  { value: 'Open Sans', label: 'Open Sans' },
  { value: 'Montserrat', label: 'Montserrat' },
];

const BUTTON_STYLES = [
  { value: 'solid', label: 'Sólido' },
  { value: 'outline', label: 'Contorno' },
  { value: 'gradient', label: 'Gradiente' },
];

export function CheckoutBuilderDialog({ open, onOpenChange, checkout }: CheckoutBuilderDialogProps) {
  const updateCheckout = useUpdateStandaloneCheckout();
  const { data: testimonials, isLoading: loadingTestimonials } = useCheckoutTestimonials(checkout.id);
  const createTestimonial = useCreateCheckoutTestimonial();
  const deleteTestimonial = useDeleteCheckoutTestimonial();

  const [elements, setElements] = useState<CheckoutElements>(checkout.elements);
  const [theme, setTheme] = useState<CheckoutTheme>(checkout.theme);
  const [attributionModel, setAttributionModel] = useState<string>(checkout.attribution_model || 'last_click');
  const [activeTab, setActiveTab] = useState('elements');
  const [organizationId, setOrganizationId] = useState<string>('');
  
  // New testimonial form
  const [newTestimonial, setNewTestimonial] = useState({
    author_name: '',
    author_location: '',
    rating: 5,
    content: '',
  });

  useEffect(() => {
    setElements(checkout.elements);
    setTheme(checkout.theme);
    setAttributionModel(checkout.attribution_model || 'last_click');
    
    // Get organization ID
    supabase.from('profiles').select('organization_id').single().then(({ data }) => {
      if (data?.organization_id) {
        setOrganizationId(data.organization_id);
      }
    });
  }, [checkout]);

  const handleSave = async () => {
    // Partners are now saved directly via hooks in CheckoutPartnersTab
    await updateCheckout.mutateAsync({
      id: checkout.id,
      elements,
      theme,
      attribution_model: attributionModel as 'first_click' | 'last_click',
    });
  };

  const handleAddTestimonial = async () => {
    if (!newTestimonial.author_name || !newTestimonial.content || !organizationId) return;

    await createTestimonial.mutateAsync({
      checkout_id: checkout.id,
      organization_id: organizationId,
      author_name: newTestimonial.author_name,
      author_location: newTestimonial.author_location || null,
      author_photo_url: null,
      rating: newTestimonial.rating,
      content: newTestimonial.content,
      position: (testimonials?.length || 0) + 1,
      is_active: true,
    });

    setNewTestimonial({ author_name: '', author_location: '', rating: 5, content: '' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Editor Visual - {checkout.name}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="elements">Elementos</TabsTrigger>
              <TabsTrigger value="testimonials">Depoimentos</TabsTrigger>
              <TabsTrigger value="theme">Estilo</TabsTrigger>
              <TabsTrigger value="partners" className="flex items-center gap-1">
                <Factory className="h-3 w-3" />
                Parceiros
              </TabsTrigger>
              <TabsTrigger value="affiliates" className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                Afiliados
              </TabsTrigger>
            </TabsList>

            {/* Elements Tab */}
            <TabsContent value="elements" className="space-y-4 mt-4">
              {/* Countdown */}
              <Card>
                <CardHeader className="py-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Timer className="h-4 w-4" />
                      Cronômetro de Urgência
                    </CardTitle>
                    <Switch
                      checked={elements.countdown.enabled}
                      onCheckedChange={(checked) =>
                        setElements(prev => ({
                          ...prev,
                          countdown: { ...prev.countdown, enabled: checked },
                        }))
                      }
                    />
                  </div>
                </CardHeader>
                {elements.countdown.enabled && (
                  <CardContent className="space-y-3 pt-0">
                    <div className="space-y-2">
                      <Label>Texto</Label>
                      <Input
                        value={elements.countdown.text}
                        onChange={(e) =>
                          setElements(prev => ({
                            ...prev,
                            countdown: { ...prev.countdown, text: e.target.value },
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Duração (minutos): {elements.countdown.duration_minutes}</Label>
                      <Slider
                        value={[elements.countdown.duration_minutes]}
                        onValueChange={([value]) =>
                          setElements(prev => ({
                            ...prev,
                            countdown: { ...prev.countdown, duration_minutes: value },
                          }))
                        }
                        min={5}
                        max={60}
                        step={5}
                      />
                    </div>
                  </CardContent>
                )}
              </Card>

              {/* Top Banner */}
              <Card>
                <CardHeader className="py-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Banner Superior</CardTitle>
                    <Switch
                      checked={elements.top_banner.enabled}
                      onCheckedChange={(checked) =>
                        setElements(prev => ({
                          ...prev,
                          top_banner: { ...prev.top_banner, enabled: checked },
                        }))
                      }
                    />
                  </div>
                </CardHeader>
                {elements.top_banner.enabled && (
                  <CardContent className="space-y-3 pt-0">
                    <div className="space-y-2">
                      <Label>Texto do Banner</Label>
                      <Input
                        value={elements.top_banner.text}
                        onChange={(e) =>
                          setElements(prev => ({
                            ...prev,
                            top_banner: { ...prev.top_banner, text: e.target.value },
                          }))
                        }
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Cor de Fundo</Label>
                        <div className="flex gap-2">
                          <Input
                            type="color"
                            value={elements.top_banner.background_color}
                            onChange={(e) =>
                              setElements(prev => ({
                                ...prev,
                                top_banner: { ...prev.top_banner, background_color: e.target.value },
                              }))
                            }
                            className="w-12 h-10 p-1"
                          />
                          <Input
                            value={elements.top_banner.background_color}
                            onChange={(e) =>
                              setElements(prev => ({
                                ...prev,
                                top_banner: { ...prev.top_banner, background_color: e.target.value },
                              }))
                            }
                            className="flex-1"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Cor do Texto</Label>
                        <div className="flex gap-2">
                          <Input
                            type="color"
                            value={elements.top_banner.text_color}
                            onChange={(e) =>
                              setElements(prev => ({
                                ...prev,
                                top_banner: { ...prev.top_banner, text_color: e.target.value },
                              }))
                            }
                            className="w-12 h-10 p-1"
                          />
                          <Input
                            value={elements.top_banner.text_color}
                            onChange={(e) =>
                              setElements(prev => ({
                                ...prev,
                                top_banner: { ...prev.top_banner, text_color: e.target.value },
                              }))
                            }
                            className="flex-1"
                          />
                        </div>
                      </div>
                    </div>
                    {/* Preview */}
                    <div
                      className="p-3 text-center text-sm font-medium rounded"
                      style={{
                        backgroundColor: elements.top_banner.background_color,
                        color: elements.top_banner.text_color,
                      }}
                    >
                      {elements.top_banner.text}
                    </div>
                  </CardContent>
                )}
              </Card>

              {/* Testimonials Toggle */}
              <Card>
                <CardHeader className="py-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Depoimentos
                    </CardTitle>
                    <Switch
                      checked={elements.testimonials.enabled}
                      onCheckedChange={(checked) =>
                        setElements(prev => ({
                          ...prev,
                          testimonials: { ...prev.testimonials, enabled: checked },
                        }))
                      }
                    />
                  </div>
                </CardHeader>
                {elements.testimonials.enabled && (
                  <CardContent className="pt-0">
                    <p className="text-xs text-muted-foreground">
                      Configure os depoimentos na aba "Depoimentos"
                    </p>
                  </CardContent>
                )}
              </Card>

              {/* Guarantee */}
              <Card>
                <CardHeader className="py-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Garantia
                    </CardTitle>
                    <Switch
                      checked={elements.guarantee.enabled}
                      onCheckedChange={(checked) =>
                        setElements(prev => ({
                          ...prev,
                          guarantee: { ...prev.guarantee, enabled: checked },
                        }))
                      }
                    />
                  </div>
                </CardHeader>
                {elements.guarantee.enabled && (
                  <CardContent className="space-y-3 pt-0">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Dias de Garantia</Label>
                        <Input
                          type="number"
                          min={1}
                          max={365}
                          value={elements.guarantee.days}
                          onChange={(e) =>
                            setElements(prev => ({
                              ...prev,
                              guarantee: { ...prev.guarantee, days: parseInt(e.target.value) || 7 },
                            }))
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Texto da Garantia</Label>
                      <Input
                        value={elements.guarantee.text}
                        onChange={(e) =>
                          setElements(prev => ({
                            ...prev,
                            guarantee: { ...prev.guarantee, text: e.target.value },
                          }))
                        }
                      />
                    </div>
                  </CardContent>
                )}
              </Card>

              {/* Trust Badges */}
              <Card>
                <CardHeader className="py-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Selos de Confiança</CardTitle>
                    <Switch
                      checked={elements.trust_badges.enabled}
                      onCheckedChange={(checked) =>
                        setElements(prev => ({
                          ...prev,
                          trust_badges: { ...prev.trust_badges, enabled: checked },
                        }))
                      }
                    />
                  </div>
                </CardHeader>
                {elements.trust_badges.enabled && (
                  <CardContent className="space-y-2 pt-0">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={elements.trust_badges.show_secure_payment}
                        onCheckedChange={(checked) =>
                          setElements(prev => ({
                            ...prev,
                            trust_badges: { ...prev.trust_badges, show_secure_payment: checked },
                          }))
                        }
                      />
                      <Label>Pagamento Seguro</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={elements.trust_badges.show_money_back}
                        onCheckedChange={(checked) =>
                          setElements(prev => ({
                            ...prev,
                            trust_badges: { ...prev.trust_badges, show_money_back: checked },
                          }))
                        }
                      />
                      <Label>Garantia de Devolução</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={elements.trust_badges.show_support}
                        onCheckedChange={(checked) =>
                          setElements(prev => ({
                            ...prev,
                            trust_badges: { ...prev.trust_badges, show_support: checked },
                          }))
                        }
                      />
                      <Label>Suporte ao Cliente</Label>
                    </div>
                  </CardContent>
                )}
              </Card>
            </TabsContent>

            {/* Testimonials Tab */}
            <TabsContent value="testimonials" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Adicionar Depoimento</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nome do Cliente</Label>
                      <Input
                        value={newTestimonial.author_name}
                        onChange={(e) => setNewTestimonial(prev => ({ ...prev, author_name: e.target.value }))}
                        placeholder="João Silva"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Localização (opcional)</Label>
                      <Input
                        value={newTestimonial.author_location}
                        onChange={(e) => setNewTestimonial(prev => ({ ...prev, author_location: e.target.value }))}
                        placeholder="São Paulo, SP"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Avaliação: {newTestimonial.rating} estrelas</Label>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setNewTestimonial(prev => ({ ...prev, rating: star }))}
                          className="p-1"
                        >
                          <Star
                            className={`h-5 w-5 ${
                              star <= newTestimonial.rating
                                ? 'fill-yellow-400 text-yellow-400'
                                : 'text-gray-300'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Depoimento</Label>
                    <Textarea
                      value={newTestimonial.content}
                      onChange={(e) => setNewTestimonial(prev => ({ ...prev, content: e.target.value }))}
                      placeholder="O produto superou minhas expectativas..."
                      rows={3}
                    />
                  </div>
                  <Button
                    onClick={handleAddTestimonial}
                    disabled={createTestimonial.isPending || !newTestimonial.author_name || !newTestimonial.content}
                  >
                    {createTestimonial.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4 mr-2" />
                    )}
                    Adicionar
                  </Button>
                </CardContent>
              </Card>

              {/* Testimonials List */}
              <div className="space-y-3">
                <Label>Depoimentos Cadastrados ({testimonials?.length || 0})</Label>
                {loadingTestimonials ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando...
                  </div>
                ) : testimonials && testimonials.length > 0 ? (
                  testimonials.map((testimonial) => (
                    <Card key={testimonial.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{testimonial.author_name}</span>
                              {testimonial.author_location && (
                                <Badge variant="secondary" className="text-xs">
                                  {testimonial.author_location}
                                </Badge>
                              )}
                            </div>
                            <div className="flex gap-0.5">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className={`h-3 w-3 ${
                                    star <= testimonial.rating
                                      ? 'fill-yellow-400 text-yellow-400'
                                      : 'text-gray-300'
                                  }`}
                                />
                              ))}
                            </div>
                            <p className="text-sm text-muted-foreground">{testimonial.content}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => deleteTestimonial.mutate({ id: testimonial.id, checkoutId: checkout.id })}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhum depoimento cadastrado</p>
                )}
              </div>
            </TabsContent>

            {/* Theme Tab */}
            <TabsContent value="theme" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cor Principal</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={theme.primary_color}
                      onChange={(e) => setTheme(prev => ({ ...prev, primary_color: e.target.value }))}
                      className="w-12 h-10 p-1"
                    />
                    <Input
                      value={theme.primary_color}
                      onChange={(e) => setTheme(prev => ({ ...prev, primary_color: e.target.value }))}
                      className="flex-1"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Cor de Fundo</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={theme.background_color}
                      onChange={(e) => setTheme(prev => ({ ...prev, background_color: e.target.value }))}
                      className="w-12 h-10 p-1"
                    />
                    <Input
                      value={theme.background_color}
                      onChange={(e) => setTheme(prev => ({ ...prev, background_color: e.target.value }))}
                      className="flex-1"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Cor do Texto</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={theme.text_color}
                      onChange={(e) => setTheme(prev => ({ ...prev, text_color: e.target.value }))}
                      className="w-12 h-10 p-1"
                    />
                    <Input
                      value={theme.text_color}
                      onChange={(e) => setTheme(prev => ({ ...prev, text_color: e.target.value }))}
                      className="flex-1"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Fonte</Label>
                  <select
                    value={theme.font_family}
                    onChange={(e) => setTheme(prev => ({ ...prev, font_family: e.target.value }))}
                    className="w-full h-10 px-3 border rounded-md bg-background"
                  >
                    {FONT_OPTIONS.map((font) => (
                      <option key={font.value} value={font.value}>
                        {font.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Border Radius</Label>
                  <Input
                    value={theme.border_radius}
                    onChange={(e) => setTheme(prev => ({ ...prev, border_radius: e.target.value }))}
                    placeholder="8px"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Estilo do Botão</Label>
                  <select
                    value={theme.button_style}
                    onChange={(e) => setTheme(prev => ({ ...prev, button_style: e.target.value as 'solid' | 'outline' | 'gradient' }))}
                    className="w-full h-10 px-3 border rounded-md bg-background"
                  >
                    {BUTTON_STYLES.map((style) => (
                      <option key={style.value} value={style.value}>
                        {style.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Preview */}
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    Preview do Botão
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div
                    className="p-4 rounded"
                    style={{ backgroundColor: theme.background_color }}
                  >
                    <button
                      className="w-full py-3 px-6 font-medium transition-all"
                      style={{
                        backgroundColor: theme.button_style === 'outline' ? 'transparent' : theme.primary_color,
                        color: theme.button_style === 'outline' ? theme.primary_color : '#ffffff',
                        border: theme.button_style === 'outline' ? `2px solid ${theme.primary_color}` : 'none',
                        borderRadius: theme.border_radius,
                        fontFamily: theme.font_family,
                        background: theme.button_style === 'gradient'
                          ? `linear-gradient(135deg, ${theme.primary_color}, ${theme.primary_color}88)`
                          : undefined,
                      }}
                    >
                      Finalizar Compra
                    </button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Partners Tab (Industry, Factory, Coproducer) */}
            <TabsContent value="partners" className="mt-4">
              <CheckoutPartnersTab checkoutId={checkout.id} />
            </TabsContent>

            {/* Affiliates Tab */}
            <TabsContent value="affiliates" className="mt-4">
              <CheckoutAffiliatesTab
                checkoutId={checkout.id}
                checkoutSlug={checkout.slug}
                attributionModel={attributionModel}
                onAttributionModelChange={setAttributionModel}
              />
            </TabsContent>
          </Tabs>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={updateCheckout.isPending}>
            {updateCheckout.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar Alterações
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
