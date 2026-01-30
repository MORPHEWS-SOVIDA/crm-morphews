import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Info, Image as ImageIcon } from 'lucide-react';
import { 
  useCreateStorefrontTestimonial, 
  useUpdateStorefrontTestimonial, 
  type StorefrontTestimonial 
} from '@/hooks/ecommerce/useStorefrontTestimonials';
import { useAuth } from '@/hooks/useAuth';

interface StorefrontTestimonialFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storefrontId: string;
  testimonial: StorefrontTestimonial | null;
}

export function StorefrontTestimonialFormDialog({ 
  open, 
  onOpenChange, 
  storefrontId, 
  testimonial 
}: StorefrontTestimonialFormDialogProps) {
  const { profile } = useAuth();
  const createTestimonial = useCreateStorefrontTestimonial();
  const updateTestimonial = useUpdateStorefrontTestimonial();
  const isEditing = !!testimonial;

  const [formData, setFormData] = useState({
    customer_name: '',
    testimonial_text: '',
    photo_url: '',
    is_verified: true,
    is_active: true,
  });

  useEffect(() => {
    if (testimonial) {
      setFormData({
        customer_name: testimonial.customer_name,
        testimonial_text: testimonial.testimonial_text,
        photo_url: testimonial.photo_url || '',
        is_verified: testimonial.is_verified,
        is_active: testimonial.is_active,
      });
    } else {
      setFormData({ 
        customer_name: '', 
        testimonial_text: '', 
        photo_url: '', 
        is_verified: true,
        is_active: true 
      });
    }
  }, [testimonial, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.organization_id) return;

    if (isEditing) {
      updateTestimonial.mutate(
        { id: testimonial.id, storefrontId, ...formData }, 
        { onSuccess: () => onOpenChange(false) }
      );
    } else {
      createTestimonial.mutate(
        { 
          storefront_id: storefrontId, 
          organization_id: profile.organization_id,
          ...formData 
        }, 
        { onSuccess: () => onOpenChange(false) }
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Depoimento' : 'Novo Depoimento'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Photo URL */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
              <Label>URL da Foto do Cliente</Label>
              <Badge variant="outline" className="text-xs">400 x 400 px</Badge>
            </div>
            <Input 
              value={formData.photo_url} 
              onChange={(e) => setFormData(prev => ({ ...prev, photo_url: e.target.value }))} 
              placeholder="https://exemplo.com/foto-cliente.jpg"
            />
            <p className="text-xs text-muted-foreground">
              Proporção 1:1 (quadrada). Foto do cliente com o produto.
            </p>
          </div>

          {/* Customer Name */}
          <div className="space-y-2">
            <Label>Nome do Cliente *</Label>
            <Input 
              value={formData.customer_name} 
              onChange={(e) => setFormData(prev => ({ ...prev, customer_name: e.target.value }))} 
              placeholder="Maria S."
              required
            />
            <p className="text-xs text-muted-foreground">
              Dica: Use apenas o primeiro nome e inicial do sobrenome (ex: "Karine R.")
            </p>
          </div>

          {/* Testimonial Text */}
          <div className="space-y-2">
            <Label>Depoimento *</Label>
            <Textarea 
              value={formData.testimonial_text} 
              onChange={(e) => setFormData(prev => ({ ...prev, testimonial_text: e.target.value }))} 
              placeholder="Amei o produto! Chegou super rápido..."
              rows={3}
              required
            />
            <p className="text-xs text-muted-foreground">
              Texto curto e impactante (máx. 150 caracteres recomendado)
            </p>
          </div>

          {/* Switches */}
          <div className="flex flex-col sm:flex-row gap-4 pt-2">
            <div className="flex items-center gap-2">
              <Switch 
                checked={formData.is_verified} 
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_verified: checked }))} 
              />
              <Label className="text-sm">Verificado ✓</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch 
                checked={formData.is_active} 
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))} 
              />
              <Label className="text-sm">Ativo</Label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={createTestimonial.isPending || updateTestimonial.isPending}
            >
              {createTestimonial.isPending || updateTestimonial.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
