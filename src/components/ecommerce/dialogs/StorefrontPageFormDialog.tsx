import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateStorefrontPage, useUpdateStorefrontPage, PAGE_TYPE_LABELS, DEFAULT_PAGE_TEMPLATES, type StorefrontPage, type PageType } from '@/hooks/ecommerce';

interface StorefrontPageFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storefrontId: string;
  page: StorefrontPage | null;
}

export function StorefrontPageFormDialog({ open, onOpenChange, storefrontId, page }: StorefrontPageFormDialogProps) {
  const createPage = useCreateStorefrontPage();
  const updatePage = useUpdateStorefrontPage();
  const isEditing = !!page;

  const [formData, setFormData] = useState({ page_type: 'about' as PageType, title: '', slug: '', content: '', is_active: true });

  useEffect(() => {
    if (page) {
      setFormData({ page_type: page.page_type, title: page.title, slug: page.slug, content: page.content || '', is_active: page.is_active });
    } else {
      setFormData({ page_type: 'about', title: '', slug: '', content: '', is_active: true });
    }
  }, [page, open]);

  const handleTypeChange = (type: PageType) => {
    if (!isEditing) {
      const template = DEFAULT_PAGE_TEMPLATES[type];
      setFormData(prev => ({ ...prev, page_type: type, title: template.title, slug: template.slug, content: template.content }));
    } else {
      setFormData(prev => ({ ...prev, page_type: type }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing) {
      updatePage.mutate({ id: page.id, storefrontId, ...formData }, { onSuccess: () => onOpenChange(false) });
    } else {
      createPage.mutate({ storefront_id: storefrontId, ...formData }, { onSuccess: () => onOpenChange(false) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isEditing ? 'Editar Página' : 'Nova Página'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Tipo de Página</Label>
              <Select value={formData.page_type} onValueChange={handleTypeChange} disabled={isEditing}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PAGE_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input value={formData.title} onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Slug (URL) *</Label>
            <Input value={formData.slug} onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') }))} required />
          </div>
          <div className="space-y-2">
            <Label>Conteúdo (HTML)</Label>
            <Textarea value={formData.content} onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))} rows={10} className="font-mono text-sm" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={createPage.isPending || updatePage.isPending}>Salvar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
