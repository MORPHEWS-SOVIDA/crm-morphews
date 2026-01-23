import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useCreateStorefrontBanner, useUpdateStorefrontBanner, type StorefrontBanner } from '@/hooks/ecommerce';

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
    link_url: '',
    button_text: '',
    is_active: true,
  });

  useEffect(() => {
    if (banner) {
      setFormData({
        title: banner.title || '',
        subtitle: banner.subtitle || '',
        image_url: banner.image_url,
        link_url: banner.link_url || '',
        button_text: banner.button_text || '',
        is_active: banner.is_active,
      });
    } else {
      setFormData({ title: '', subtitle: '', image_url: '', link_url: '', button_text: '', is_active: true });
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Banner' : 'Novo Banner'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>URL da Imagem *</Label>
            <Input value={formData.image_url} onChange={(e) => setFormData(prev => ({ ...prev, image_url: e.target.value }))} required />
          </div>
          <div className="space-y-2">
            <Label>Título</Label>
            <Input value={formData.title} onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Subtítulo</Label>
            <Textarea value={formData.subtitle} onChange={(e) => setFormData(prev => ({ ...prev, subtitle: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Link de destino</Label>
            <Input value={formData.link_url} onChange={(e) => setFormData(prev => ({ ...prev, link_url: e.target.value }))} placeholder="https://..." />
          </div>
          <div className="space-y-2">
            <Label>Texto do botão</Label>
            <Input value={formData.button_text} onChange={(e) => setFormData(prev => ({ ...prev, button_text: e.target.value }))} placeholder="Comprar agora" />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={formData.is_active} onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))} />
            <Label>Ativo</Label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={createBanner.isPending || updateBanner.isPending}>Salvar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
