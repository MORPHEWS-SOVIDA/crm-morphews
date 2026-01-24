import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Upload, 
  X, 
  ImageIcon, 
  Plus,
  Camera,
  MessageSquare,
  User,
  Sparkles
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  OFFER_TYPE_CONFIGS, 
  UPLOAD_CONFIGS, 
  type OfferType, 
  type UploadedImage,
  type TestimonialUpload,
  type UploadType 
} from './types';
import { cn } from '@/lib/utils';

interface StepImageUploadsProps {
  offerType: OfferType;
  uploadedImages: UploadedImage[];
  testimonialUploads: TestimonialUpload[];
  onImagesChange: (images: UploadedImage[]) => void;
  onTestimonialsChange: (testimonials: TestimonialUpload[]) => void;
  productImageUrl?: string | null;
}

export function StepImageUploads({
  offerType,
  uploadedImages,
  testimonialUploads,
  onImagesChange,
  onTestimonialsChange,
  productImageUrl,
}: StepImageUploadsProps) {
  const [uploading, setUploading] = useState<UploadType | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const config = OFFER_TYPE_CONFIGS.find(c => c.value === offerType);
  if (!config) return null;

  const allUploads = [...config.requiredUploads, ...config.optionalUploads];

  const handleFileUpload = async (type: UploadType, files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploading(type);

    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `landing-uploads/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('product-images')
          .getPublicUrl(filePath);

        return publicUrl;
      });

      const urls = await Promise.all(uploadPromises);

      // Handle testimonial-type uploads differently
      if (type.startsWith('testimonial_')) {
        const rawType = type.replace('testimonial_', '');
        const imageType: TestimonialUpload['imageType'] = 
          rawType === 'whatsapp' ? 'whatsapp' : 
          rawType === 'holding' ? 'holding_product' : 'face';
        
        const newTestimonials: TestimonialUpload[] = urls.map((url) => ({
          id: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
          imageUrl: url,
          imageType,
        }));
        onTestimonialsChange([...testimonialUploads, ...newTestimonials]);
      } else {
        // For non-testimonial uploads, replace existing of same type
        const filtered = uploadedImages.filter(img => img.type !== type);
        const newImages: UploadedImage[] = urls.map((url) => ({
          type,
          url,
        }));
        onImagesChange([...filtered, ...newImages]);
      }

      toast.success('Upload realizado!');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Erro ao fazer upload');
    } finally {
      setUploading(null);
    }
  };

  const removeImage = (type: UploadType) => {
    onImagesChange(uploadedImages.filter(img => img.type !== type));
  };

  const removeTestimonial = (id: string) => {
    onTestimonialsChange(testimonialUploads.filter(t => t.id !== id));
  };

  const getImageForType = (type: UploadType) => {
    return uploadedImages.find(img => img.type === type);
  };

  const getIconForType = (type: UploadType) => {
    if (type.startsWith('testimonial_')) {
      if (type === 'testimonial_whatsapp') return <MessageSquare className="h-6 w-6" />;
      if (type === 'testimonial_holding') return <Camera className="h-6 w-6" />;
      return <User className="h-6 w-6" />;
    }
    return <ImageIcon className="h-6 w-6" />;
  };

  // Auto-populate product image if exists
  const hasProductImage = uploadedImages.some(img => img.type === 'product_image');
  
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Envie suas imagens</h2>
        <p className="text-muted-foreground">
          Quanto mais imagens reais você enviar, melhor será o resultado
        </p>
      </div>

      {/* Product image from system */}
      {productImageUrl && !hasProductImage && config.requiredUploads.includes('product_image') && (
        <Card className="border-green-500/50 bg-green-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <img src={productImageUrl} alt="Produto" className="w-20 h-20 object-cover rounded-lg" />
              <div className="flex-1">
                <p className="font-medium">Imagem do produto encontrada!</p>
                <p className="text-sm text-muted-foreground">Podemos usar a imagem cadastrada no sistema</p>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  onImagesChange([...uploadedImages, { type: 'product_image', url: productImageUrl }]);
                  toast.success('Imagem do produto adicionada!');
                }}
              >
                Usar esta
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Required uploads */}
      {config.requiredUploads.length > 0 && (
        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <Badge variant="destructive" className="text-xs">Obrigatório</Badge>
            Imagens essenciais
          </Label>
          <div className="grid gap-3">
            {config.requiredUploads.map((type) => {
              const uploadConfig = UPLOAD_CONFIGS[type];
              const existingImage = getImageForType(type);

              return (
                <Card key={type} className={cn(existingImage && 'border-green-500')}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      {existingImage ? (
                        <div className="relative">
                          <img 
                            src={existingImage.url} 
                            alt={uploadConfig.label}
                            className="w-20 h-20 object-cover rounded-lg"
                          />
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute -top-2 -right-2 h-6 w-6"
                            onClick={() => removeImage(type)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center">
                          {getIconForType(type)}
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="font-medium">{uploadConfig.label}</p>
                        <p className="text-sm text-muted-foreground">{uploadConfig.description}</p>
                      </div>
                      {!existingImage && (
                        <div>
                          <input
                            ref={(el) => { fileInputRefs.current[type] = el; }}
                            type="file"
                            accept={uploadConfig.accept}
                            className="hidden"
                            onChange={(e) => handleFileUpload(type, e.target.files)}
                          />
                          <Button
                            variant="outline"
                            disabled={uploading === type}
                            onClick={() => fileInputRefs.current[type]?.click()}
                          >
                            {uploading === type ? 'Enviando...' : 'Upload'}
                            <Upload className="h-4 w-4 ml-2" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Optional uploads */}
      {config.optionalUploads.length > 0 && (
        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">Opcional</Badge>
            Imagens adicionais
          </Label>

          {/* Non-testimonial optional uploads */}
          <div className="grid gap-3">
            {config.optionalUploads
              .filter(type => !type.startsWith('testimonial_') && type !== 'before_after')
              .map((type) => {
                const uploadConfig = UPLOAD_CONFIGS[type];
                const existingImage = getImageForType(type);

                return (
                  <Card key={type} className={cn(existingImage && 'border-green-500')}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        {existingImage ? (
                          <div className="relative">
                            <img 
                              src={existingImage.url} 
                              alt={uploadConfig.label}
                              className="w-20 h-20 object-cover rounded-lg"
                            />
                            <Button
                              variant="destructive"
                              size="icon"
                              className="absolute -top-2 -right-2 h-6 w-6"
                              onClick={() => removeImage(type)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center">
                            {getIconForType(type)}
                          </div>
                        )}
                        <div className="flex-1">
                          <p className="font-medium">{uploadConfig.label}</p>
                          <p className="text-sm text-muted-foreground">{uploadConfig.description}</p>
                        </div>
                        {!existingImage && (
                          <div>
                            <input
                              ref={(el) => { fileInputRefs.current[type] = el; }}
                              type="file"
                              accept={uploadConfig.accept}
                              className="hidden"
                              onChange={(e) => handleFileUpload(type, e.target.files)}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={uploading === type}
                              onClick={() => fileInputRefs.current[type]?.click()}
                            >
                              {uploading === type ? '...' : 'Upload'}
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
          </div>

          {/* Testimonial uploads section */}
          {config.optionalUploads.some(t => t.startsWith('testimonial_')) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Depoimentos
                </CardTitle>
                <CardDescription>
                  Adicione fotos de clientes ou prints de WhatsApp
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Existing testimonials */}
                {testimonialUploads.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {testimonialUploads.map((testimonial) => (
                      <div key={testimonial.id} className="relative">
                        <img
                          src={testimonial.imageUrl}
                          alt="Depoimento"
                          className="w-16 h-16 object-cover rounded-lg"
                        />
                        <Badge 
                          variant="secondary" 
                          className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[10px] px-1"
                        >
                          {testimonial.imageType === 'whatsapp' ? 'WA' : testimonial.imageType === 'holding_product' ? '📦' : '👤'}
                        </Badge>
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute -top-1 -right-1 h-5 w-5"
                          onClick={() => removeTestimonial(testimonial.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Upload buttons for each testimonial type */}
                <div className="flex flex-wrap gap-2">
                  {config.optionalUploads
                    .filter(t => t.startsWith('testimonial_'))
                    .map((type) => {
                      const uploadConfig = UPLOAD_CONFIGS[type];
                      return (
                        <div key={type}>
                          <input
                            ref={(el) => { fileInputRefs.current[type] = el; }}
                            type="file"
                            accept={uploadConfig.accept}
                            multiple={uploadConfig.multiple}
                            className="hidden"
                            onChange={(e) => handleFileUpload(type, e.target.files)}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={uploading === type}
                            onClick={() => fileInputRefs.current[type]?.click()}
                            className="gap-1"
                          >
                            <Plus className="h-3 w-3" />
                            {uploadConfig.label.replace('Rosto para Depoimento', 'Rosto').replace('Print de WhatsApp', 'WhatsApp').replace('Cliente com Produto', 'Com Produto')}
                          </Button>
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* AI generation notice */}
      <Card className="border-primary/50 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium">Sem imagens? A IA pode criar!</p>
              <p className="text-sm text-muted-foreground">
                Se você não tiver algumas imagens, a Super IA pode gerar imagens profissionais automaticamente.
                Porém, imagens reais sempre convertem melhor!
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
