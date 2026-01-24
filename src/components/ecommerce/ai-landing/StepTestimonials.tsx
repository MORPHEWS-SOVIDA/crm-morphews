import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { 
  MessageSquare, 
  Star, 
  Upload, 
  Sparkles, 
  Mic, 
  Video, 
  User,
  X,
  Plus,
  Image
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { TestimonialConfig, TestimonialUpload, TestimonialStyle } from './types';
import { ENERGY_COSTS } from './types';
import { cn } from '@/lib/utils';

interface StepTestimonialsProps {
  config: TestimonialConfig;
  onConfigChange: (config: TestimonialConfig) => void;
}

export function StepTestimonials({ config, onConfigChange }: StepTestimonialsProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-testimonial-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `landing-uploads/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('product-images')
          .getPublicUrl(filePath);

        return {
          id: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
          imageUrl: publicUrl,
          imageType: 'face' as const,
        };
      });

      const newUploads = await Promise.all(uploadPromises);
      onConfigChange({
        ...config,
        uploads: [...config.uploads, ...newUploads],
        useRealPhotos: true,
      });
      toast.success('Fotos enviadas!');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Erro ao fazer upload');
    } finally {
      setUploading(false);
    }
  };

  const removeUpload = (id: string) => {
    onConfigChange({
      ...config,
      uploads: config.uploads.filter((u) => u.id !== id),
    });
  };

  const calculateEnergyCost = () => {
    let cost = 0;
    
    // Testimonial text generation
    cost += config.count * ENERGY_COSTS.testimonialGeneration;
    
    // Photo generation (if not using real photos)
    if (!config.useRealPhotos) {
      cost += config.count * ENERGY_COSTS.imageGeneration;
    }
    
    // WhatsApp style conversion
    if (config.style === 'whatsapp') {
      cost += config.count * ENERGY_COSTS.whatsappStyleConversion;
    }
    
    // Audio generation
    if (config.generateAudio) {
      cost += config.count * ENERGY_COSTS.audioGeneration;
    }
    
    // Video avatar generation
    if (config.generateVideoAvatar) {
      cost += config.count * ENERGY_COSTS.videoAvatarGeneration;
    }
    
    return cost;
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Configure os depoimentos</h2>
        <p className="text-muted-foreground">
          Escolha como os depoimentos serão exibidos na página
        </p>
      </div>

      {/* Number of testimonials */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Quantidade de Depoimentos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Slider
              value={[config.count]}
              onValueChange={([value]) => onConfigChange({ ...config, count: value })}
              min={1}
              max={10}
              step={1}
              className="flex-1"
            />
            <Badge variant="secondary" className="min-w-[3rem] justify-center">
              {config.count}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Testimonial Style */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Estilo dos Depoimentos</CardTitle>
          <CardDescription>
            Como os depoimentos serão exibidos na página
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={config.style}
            onValueChange={(value: TestimonialStyle) => 
              onConfigChange({ ...config, style: value })
            }
            className="grid grid-cols-2 gap-4"
          >
            <Label
              htmlFor="review"
              className={cn(
                'flex flex-col items-center p-4 rounded-lg border-2 cursor-pointer transition-all hover:border-primary/50',
                config.style === 'review' ? 'border-primary bg-primary/5' : 'border-muted'
              )}
            >
              <RadioGroupItem value="review" id="review" className="sr-only" />
              <Star className="h-8 w-8 mb-2 text-yellow-500" />
              <span className="font-medium">Review Clássico</span>
              <span className="text-xs text-muted-foreground text-center mt-1">
                Foto, nome, texto e estrelas
              </span>
            </Label>

            <Label
              htmlFor="whatsapp"
              className={cn(
                'flex flex-col items-center p-4 rounded-lg border-2 cursor-pointer transition-all hover:border-primary/50',
                config.style === 'whatsapp' ? 'border-primary bg-primary/5' : 'border-muted'
              )}
            >
              <RadioGroupItem value="whatsapp" id="whatsapp" className="sr-only" />
              <MessageSquare className="h-8 w-8 mb-2 text-green-500" />
              <span className="font-medium">Conversa WhatsApp</span>
              <span className="text-xs text-muted-foreground text-center mt-1">
                Estilo chat com animação
              </span>
              <Badge variant="outline" className="mt-2 text-xs">
                +{ENERGY_COSTS.whatsappStyleConversion * config.count} energia
              </Badge>
            </Label>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Photo Source */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" />
            Fotos dos Clientes
          </CardTitle>
          <CardDescription>
            Use fotos reais ou deixe a IA gerar rostos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => onConfigChange({ ...config, useRealPhotos: false })}
              className={cn(
                'p-4 rounded-lg border-2 text-left transition-all hover:border-primary/50',
                !config.useRealPhotos ? 'border-primary bg-primary/5' : 'border-muted'
              )}
            >
              <Sparkles className="h-6 w-6 mb-2 text-primary" />
              <div className="font-medium text-sm">IA Gera Rostos</div>
              <p className="text-xs text-muted-foreground mt-1">
                Rostos realistas gerados por IA
              </p>
              <Badge variant="outline" className="mt-2 text-xs">
                +{ENERGY_COSTS.imageGeneration * config.count} energia
              </Badge>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'p-4 rounded-lg border-2 text-left transition-all hover:border-primary/50',
                config.useRealPhotos ? 'border-primary bg-primary/5' : 'border-muted'
              )}
            >
              <Upload className="h-6 w-6 mb-2" />
              <div className="font-medium text-sm">Enviar Fotos Reais</div>
              <p className="text-xs text-muted-foreground mt-1">
                Fotos de clientes reais
              </p>
              <Badge variant="secondary" className="mt-2 text-xs">
                Grátis
              </Badge>
            </button>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*"
            multiple
            onChange={(e) => handlePhotoUpload(e.target.files)}
          />

          {/* Uploaded photos preview */}
          {config.uploads.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm">Fotos enviadas ({config.uploads.length})</Label>
              <div className="flex flex-wrap gap-2">
                {config.uploads.map((upload) => (
                  <div key={upload.id} className="relative group">
                    <img
                      src={upload.imageUrl}
                      alt="Depoimento"
                      className="w-16 h-16 rounded-lg object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeUpload(upload.id)}
                      className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-16 h-16 rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center hover:border-primary/50 transition-colors"
                >
                  <Plus className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Audio & Video Options */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recursos Extras</CardTitle>
          <CardDescription>
            Aumente o impacto com áudio e vídeo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div className="flex items-center gap-3">
              <Mic className="h-5 w-5 text-primary" />
              <div>
                <div className="font-medium text-sm">Áudio dos Depoimentos</div>
                <p className="text-xs text-muted-foreground">
                  Voz gerada com ElevenLabs
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                +{ENERGY_COSTS.audioGeneration * config.count} energia
              </Badge>
              <Switch
                checked={config.generateAudio}
                onCheckedChange={(checked) =>
                  onConfigChange({ ...config, generateAudio: checked })
                }
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div className="flex items-center gap-3">
              <Video className="h-5 w-5 text-primary" />
              <div>
                <div className="font-medium text-sm">Vídeo com Avatar</div>
                <p className="text-xs text-muted-foreground">
                  Avatar IA falando o depoimento
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                +{ENERGY_COSTS.videoAvatarGeneration * config.count} energia
              </Badge>
              <Switch
                checked={config.generateVideoAvatar}
                onCheckedChange={(checked) =>
                  onConfigChange({ ...config, generateVideoAvatar: checked })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Energy cost summary */}
      <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">Custo total dos depoimentos</div>
            <p className="text-sm text-muted-foreground">
              {config.count} depoimentos • {config.style === 'whatsapp' ? 'WhatsApp' : 'Review'}
              {config.generateAudio && ' • Áudio'}
              {config.generateVideoAvatar && ' • Vídeo'}
            </p>
          </div>
          <Badge className="gap-1 text-base px-3 py-1">
            <Sparkles className="h-4 w-4" />
            {calculateEnergyCost()} energia
          </Badge>
        </div>
      </div>
    </div>
  );
}
