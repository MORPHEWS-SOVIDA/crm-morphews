import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useCreateStorefrontCategory, useUpdateStorefrontCategory, type StorefrontCategory } from '@/hooks/ecommerce';

interface StorefrontCategoryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storefrontId: string;
  category: StorefrontCategory | null;
  parentId: string | null;
}

export function StorefrontCategoryFormDialog({ open, onOpenChange, storefrontId, category, parentId }: StorefrontCategoryFormDialogProps) {
  const createCategory = useCreateStorefrontCategory();
  const updateCategory = useUpdateStorefrontCategory();
  const isEditing = !!category;

  const [formData, setFormData] = useState({ name: '', slug: '', description: '', image_url: '', is_active: true });

  useEffect(() => {
    if (category) {
      setFormData({ name: category.name, slug: category.slug, description: category.description || '', image_url: category.image_url || '', is_active: category.is_active });
    } else {
      setFormData({ name: '', slug: '', description: '', image_url: '', is_active: true });
    }
  }, [category, open]);

  const generateSlug = (name: string) => name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const handleNameChange = (name: string) => {
    setFormData(prev => ({ ...prev, name, slug: isEditing ? prev.slug : generateSlug(name) }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing) {
      updateCategory.mutate({ id: category.id, storefrontId, ...formData }, { onSuccess: () => onOpenChange(false) });
    } else {
      createCategory.mutate({ storefront_id: storefrontId, parent_id: parentId || undefined, ...formData }, { onSuccess: () => onOpenChange(false) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{isEditing ? 'Editar Categoria' : parentId ? 'Nova Subcategoria' : 'Nova Categoria'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input value={formData.name} onChange={(e) => handleNameChange(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Slug *</Label>
            <Input value={formData.slug} onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))} required />
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea value={formData.description} onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>URL da Imagem</Label>
            <Input value={formData.image_url} onChange={(e) => setFormData(prev => ({ ...prev, image_url: e.target.value }))} placeholder="https://..." />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={formData.is_active} onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))} />
            <Label>Ativa</Label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={createCategory.isPending || updateCategory.isPending}>Salvar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
