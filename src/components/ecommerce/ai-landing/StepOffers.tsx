import { useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Plus, Trash2, Star, Package, Sparkles, Upload, Image } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { ProductOffer } from './types';
import { ENERGY_COSTS } from './types';
import { cn } from '@/lib/utils';

interface StepOffersProps {
  offers: ProductOffer[];
  onOffersChange: (offers: ProductOffer[]) => void;
  productImageUrl?: string | null;
}

export function StepOffers({ offers, onOffersChange, productImageUrl }: StepOffersProps) {
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const addOffer = () => {
    const nextQty = offers.length === 0 ? 1 : offers.length === 1 ? 3 : 6;
    const newOffer: ProductOffer = {
      id: Date.now().toString(),
      quantity: nextQty,
      label: `${nextQty} unidade${nextQty > 1 ? 's' : ''}`,
      price_cents: 0,
      is_highlighted: false,
      multiplyImage: nextQty > 1,
    };
    onOffersChange([...offers, newOffer]);
  };

  const removeOffer = (id: string) => {
    onOffersChange(offers.filter((o) => o.id !== id));
  };

  const updateOffer = (id: string, updates: Partial<ProductOffer>) => {
    onOffersChange(
      offers.map((o) => (o.id === id ? { ...o, ...updates } : o))
    );
  };

  const handleKitImageUpload = async (offerId: string, file: File) => {
    setUploadingId(offerId);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-kit-${offerId}.${fileExt}`;
      const filePath = `landing-uploads/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      updateOffer(offerId, { customKitImage: publicUrl, multiplyImage: false });
      toast.success('Imagem do kit enviada!');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Erro ao fazer upload');
    } finally {
      setUploadingId(null);
    }
  };

  const calculateEnergyCost = (offer: ProductOffer) => {
    if (offer.multiplyImage && offer.quantity > 1 && !offer.customKitImage) {
      return ENERGY_COSTS.imageMultiplication;
    }
    return 0;
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Configure suas ofertas</h2>
        <p className="text-muted-foreground">
          Defina os kits e preços que serão exibidos na página
        </p>
      </div>

      <div className="space-y-4">
        {offers.map((offer, index) => (
          <Card 
            key={offer.id}
            className={cn(
              'transition-all',
              offer.is_highlighted && 'ring-2 ring-primary border-primary'
            )}
          >
            <CardContent className="pt-4 space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={offer.is_highlighted}
                      onCheckedChange={(checked) =>
                        updateOffer(offer.id, { is_highlighted: checked })
                      }
                    />
                    <Label className="text-sm flex items-center gap-1">
                      <Star className="h-3 w-3" />
                      Destacar
                    </Label>
                  </div>
                  {offer.is_highlighted && (
                    <Badge variant="default" className="text-xs">Oferta Destaque</Badge>
                  )}
                </div>
                {offers.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeOffer(offer.id)}
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
                      updateOffer(offer.id, { 
                        quantity: parseInt(e.target.value) || 1,
                        multiplyImage: parseInt(e.target.value) > 1 && !offer.customKitImage,
                      })
                    }
                    min={1}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Label</Label>
                  <Input
                    value={offer.label}
                    onChange={(e) => updateOffer(offer.id, { label: e.target.value })}
                    placeholder="Kit 3 unidades"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Preço (R$)</Label>
                  <CurrencyInput
                    value={offer.price_cents}
                    onChange={(value) => updateOffer(offer.id, { price_cents: value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Preço Original (riscado)</Label>
                  <CurrencyInput
                    value={offer.original_price_cents || 0}
                    onChange={(value) =>
                      updateOffer(offer.id, { original_price_cents: value || undefined })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Badge (ex: "Mais vendido")</Label>
                <Input
                  value={offer.badge_text || ''}
                  onChange={(e) =>
                    updateOffer(offer.id, { badge_text: e.target.value || undefined })
                  }
                  placeholder="Melhor custo-benefício"
                />
              </div>

              {/* Kit Image Options - Only for quantities > 1 */}
              {offer.quantity > 1 && (
                <div className="border-t pt-4 space-y-3">
                  <Label className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Imagem do Kit ({offer.quantity} unidades)
                  </Label>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Option 1: AI Multiply */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => updateOffer(offer.id, { multiplyImage: true, customKitImage: undefined })}
                          className={cn(
                            'p-3 rounded-lg border-2 text-left transition-all hover:border-primary/50',
                            offer.multiplyImage && !offer.customKitImage
                              ? 'border-primary bg-primary/5'
                              : 'border-muted'
                          )}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Sparkles className="h-4 w-4 text-primary" />
                            <span className="font-medium text-sm">IA Multiplica</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            A IA vai gerar {offer.quantity} frascos na imagem
                          </p>
                          <Badge variant="outline" className="mt-2 text-xs">
                            +{ENERGY_COSTS.imageMultiplication} energia
                          </Badge>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        A IA pega a foto individual do produto e multiplica para mostrar {offer.quantity} unidades
                      </TooltipContent>
                    </Tooltip>

                    {/* Option 2: Upload Custom Kit Image */}
                    <div
                      className={cn(
                        'p-3 rounded-lg border-2 transition-all',
                        offer.customKitImage
                          ? 'border-primary bg-primary/5'
                          : 'border-muted hover:border-primary/50'
                      )}
                    >
                      <input
                        type="file"
                        ref={(el) => (fileInputRefs.current[offer.id] = el)}
                        className="hidden"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleKitImageUpload(offer.id, file);
                        }}
                      />
                      {offer.customKitImage ? (
                        <div className="space-y-2">
                          <img
                            src={offer.customKitImage}
                            alt="Kit"
                            className="w-full h-16 object-contain rounded"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full text-xs"
                            onClick={() => fileInputRefs.current[offer.id]?.click()}
                          >
                            Trocar imagem
                          </Button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => fileInputRefs.current[offer.id]?.click()}
                          disabled={uploadingId === offer.id}
                          className="w-full text-left"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Upload className="h-4 w-4" />
                            <span className="font-medium text-sm">Enviar Foto</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Já tenho foto com {offer.quantity} produtos
                          </p>
                          <Badge variant="secondary" className="mt-2 text-xs">
                            Grátis
                          </Badge>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Show product preview if available */}
                  {productImageUrl && offer.multiplyImage && !offer.customKitImage && (
                    <div className="bg-muted/50 p-3 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-2">
                        Preview: A IA vai multiplicar esta imagem
                      </p>
                      <div className="flex items-center justify-center gap-1">
                        {Array.from({ length: Math.min(offer.quantity, 6) }).map((_, i) => (
                          <img
                            key={i}
                            src={productImageUrl}
                            alt="Produto"
                            className="w-12 h-12 object-contain opacity-70"
                            style={{ transform: `rotate(${(i - 1) * 5}deg)` }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={addOffer}
        >
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Oferta
        </Button>
      </div>

      {/* Energy cost summary */}
      <div className="bg-muted/50 p-4 rounded-lg">
        <div className="flex items-center justify-between text-sm">
          <span>Custo de energia para multiplicação de imagens:</span>
          <Badge variant="outline" className="gap-1">
            <Sparkles className="h-3 w-3" />
            {offers.reduce((sum, o) => sum + calculateEnergyCost(o), 0)} energia
          </Badge>
        </div>
      </div>
    </div>
  );
}
