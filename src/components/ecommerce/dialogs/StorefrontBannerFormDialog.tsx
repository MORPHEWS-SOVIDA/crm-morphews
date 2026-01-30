import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Info, Monitor, Smartphone, Tablet } from 'lucide-react';
import { useCreateStorefrontBanner, useUpdateStorefrontBanner, type StorefrontBanner } from '@/hooks/ecommerce';
import { StorefrontImageUpload } from '../StorefrontImageUpload';

interface StorefrontBannerFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storefrontId: string;
  banner: StorefrontBanner | null;
}

export function StorefrontBannerFormDialog({ open, onOpenChange, storefrontId, banner }: StorefrontBannerFormDialogProps) {
  const createBanner = useCreateStorefrontBanner();
  const updateBanner = useUpdateStorefrontBanner();
  const isEditing = !!banner;

  const [formData, setFormData] = useState({
    title: '',
    subtitle: '',
    image_url: '',
    image_tablet_url: '',
    image_mobile_url: '',
    link_url: '',
    button_text: '',
    button_style: 'solid',
    text_color: '#ffffff',
    position: 'left',
    is_active: true,
  });

  useEffect(() => {
    if (banner) {
      setFormData({
        title: banner.title || '',
        subtitle: banner.subtitle || '',
        image_url: banner.image_url,
        image_tablet_url: banner.image_tablet_url || '',
        image_mobile_url: banner.image_mobile_url || '',
        link_url: banner.link_url || '',
        button_text: banner.button_text || '',
        button_style: banner.button_style || 'solid',
        text_color: banner.text_color || '#ffffff',
        position: banner.position || 'left',
        is_active: banner.is_active,
      });
    } else {
      setFormData({ 
        title: '', 
        subtitle: '', 
        image_url: '', 
        image_tablet_url: '',
        image_mobile_url: '',
        link_url: '', 
        button_text: '', 
        button_style: 'solid',
        text_color: '#ffffff',
        position: 'left',
        is_active: true 
      });
    }
  }, [banner, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing) {
      updateBanner.mutate({ id: banner.id, storefrontId, ...formData }, { onSuccess: () => onOpenChange(false) });
    } else {
      createBanner.mutate({ storefront_id: storefrontId, ...formData }, { onSuccess: () => onOpenChange(false) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Banner' : 'Novo Banner'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Image Section */}
          <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Info className="h-4 w-4 text-blue-500" />
              <span>Tamanhos recomendados para imagens</span>
            </div>
            
            {/* Desktop Image */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Monitor className="h-4 w-4 text-muted-foreground" />
                <Label>Imagem Desktop *</Label>
                <Badge variant="secondary" className="text-xs">1920 x 800 px</Badge>
              </div>
              <StorefrontImageUpload
                value={formData.image_url}
                onChange={(url) => setFormData(prev => ({ ...prev, image_url: url }))}
                storefrontId={storefrontId}
                folder="banners/desktop"
                placeholder="https://exemplo.com/banner-desktop.jpg"
                recommendedSize="Proporção 21:9 (widescreen). Formatos: JPG, PNG ou WebP. Max 5MB"
              />
            </div>

            {/* Tablet Image */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Tablet className="h-4 w-4 text-muted-foreground" />
                <Label>Imagem Tablet (opcional)</Label>
                <Badge variant="outline" className="text-xs">1024 x 600 px</Badge>
              </div>
              <StorefrontImageUpload
                value={formData.image_tablet_url}
                onChange={(url) => setFormData(prev => ({ ...prev, image_tablet_url: url }))}
                storefrontId={storefrontId}
                folder="banners/tablet"
                placeholder="https://exemplo.com/banner-tablet.jpg"
                recommendedSize="Proporção 16:9 (paisagem). Se não informar, usará a imagem desktop adaptada"
              />
            </div>

            {/* Mobile Image */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-muted-foreground" />
                <Label>Imagem Mobile (opcional)</Label>
                <Badge variant="outline" className="text-xs">750 x 900 px</Badge>
              </div>
              <StorefrontImageUpload
                value={formData.image_mobile_url}
                onChange={(url) => setFormData(prev => ({ ...prev, image_mobile_url: url }))}
                storefrontId={storefrontId}
                folder="banners/mobile"
                placeholder="https://exemplo.com/banner-mobile.jpg"
                recommendedSize="Proporção 4:5 (vertical). Se não informar, usará a imagem desktop adaptada"
              />
            </div>
          </div>

          {/* Content Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input 
                value={formData.title} 
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))} 
                placeholder="Promoção de Verão"
              />
            </div>
            <div className="space-y-2">
              <Label>Posição do texto</Label>
              <Select 
                value={formData.position} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, position: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Esquerda</SelectItem>
                  <SelectItem value="center">Centro</SelectItem>
                  <SelectItem value="right">Direita</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Subtítulo</Label>
            <Textarea 
              value={formData.subtitle} 
              onChange={(e) => setFormData(prev => ({ ...prev, subtitle: e.target.value }))} 
              placeholder="Aproveite descontos incríveis em toda a loja"
              rows={2}
            />
          </div>

          {/* Button & Link Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Link de destino</Label>
              <Input 
                value={formData.link_url} 
                onChange={(e) => setFormData(prev => ({ ...prev, link_url: e.target.value }))} 
                placeholder="/loja/minha-loja/produtos"
              />
            </div>
            <div className="space-y-2">
              <Label>Texto do botão</Label>
              <Input 
                value={formData.button_text} 
                onChange={(e) => setFormData(prev => ({ ...prev, button_text: e.target.value }))} 
                placeholder="Comprar agora"
              />
            </div>
          </div>

          {/* Style Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Estilo do botão</Label>
              <Select 
                value={formData.button_style} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, button_style: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="solid">Sólido</SelectItem>
                  <SelectItem value="outline">Contorno</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cor do texto</Label>
              <div className="flex gap-2">
                <Input 
                  type="color"
                  value={formData.text_color} 
                  onChange={(e) => setFormData(prev => ({ ...prev, text_color: e.target.value }))} 
                  className="w-14 h-10 p-1 cursor-pointer"
                />
                <Input 
                  value={formData.text_color} 
                  onChange={(e) => setFormData(prev => ({ ...prev, text_color: e.target.value }))} 
                  className="flex-1"
                  placeholder="#ffffff"
                />
              </div>
            </div>
            <div className="flex items-end gap-2 pb-2">
              <Switch 
                checked={formData.is_active} 
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))} 
              />
              <Label>Banner ativo</Label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createBanner.isPending || updateBanner.isPending}>
              {createBanner.isPending || updateBanner.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
