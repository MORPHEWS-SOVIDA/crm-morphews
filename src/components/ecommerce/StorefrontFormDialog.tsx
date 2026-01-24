import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';
import {
  useStorefrontTemplates,
  useCreateStorefront,
  useUpdateStorefront,
  type Storefront,
  type CreateStorefrontInput,
} from '@/hooks/ecommerce';

interface StorefrontFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storefront: Storefront | null;
}

export function StorefrontFormDialog({ open, onOpenChange, storefront }: StorefrontFormDialogProps) {
  const { data: templates } = useStorefrontTemplates();
  const createStorefront = useCreateStorefront();
  const updateStorefront = useUpdateStorefront();
  
  const [formData, setFormData] = useState<CreateStorefrontInput>({
    name: '',
    slug: '',
    template_id: '',
    logo_url: '',
    primary_color: '#000000',
    secondary_color: '#ffffff',
    meta_title: '',
    meta_description: '',
    whatsapp_number: '',
  });

  useEffect(() => {
    if (storefront) {
      setFormData({
        name: storefront.name,
        slug: storefront.slug,
        template_id: storefront.template_id || '',
        logo_url: storefront.logo_url || '',
        primary_color: storefront.primary_color,
        secondary_color: storefront.secondary_color,
        meta_title: storefront.meta_title || '',
        meta_description: storefront.meta_description || '',
        whatsapp_number: storefront.whatsapp_number || '',
      });
    } else {
      setFormData({
        name: '',
        slug: '',
        template_id: '',
        logo_url: '',
        primary_color: '#000000',
        secondary_color: '#ffffff',
        meta_title: '',
        meta_description: '',
        whatsapp_number: '',
      });
    }
  }, [storefront, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const dataToSend = {
      ...formData,
      template_id: formData.template_id || undefined,
    };

    if (storefront) {
      updateStorefront.mutate(
        { id: storefront.id, ...dataToSend },
        { onSuccess: () => onOpenChange(false) }
      );
    } else {
      createStorefront.mutate(dataToSend, {
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

  const isLoading = createStorefront.isPending || updateStorefront.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {storefront ? 'Editar Loja' : 'Nova Loja'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Tabs defaultValue="basic">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic">Básico</TabsTrigger>
              <TabsTrigger value="appearance">Aparência</TabsTrigger>
              <TabsTrigger value="seo">SEO & Tracking</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Loja *</Label>
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
                    placeholder="Minha Loja"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="slug">URL da Loja *</Label>
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">
                      sales.morphews.com/loja/
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
                      placeholder="minha-loja"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="template">Template</Label>
                <Select
                  value={formData.template_id || "__none__"}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, template_id: value === "__none__" ? "" : value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um template" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sem template (em branco)</SelectItem>
                    {templates
                      ?.filter((t) => t.template_type === 'store')
                      .map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
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

            <TabsContent value="appearance" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="logo_url">URL do Logo</Label>
                <Input
                  id="logo_url"
                  value={formData.logo_url}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, logo_url: e.target.value }))
                  }
                  placeholder="https://..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="primary_color">Cor Primária</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      id="primary_color"
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
                      placeholder="#000000"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="secondary_color">Cor Secundária</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      id="secondary_color"
                      value={formData.secondary_color}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, secondary_color: e.target.value }))
                      }
                      className="w-12 h-10 p-1"
                    />
                    <Input
                      value={formData.secondary_color}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, secondary_color: e.target.value }))
                      }
                      placeholder="#ffffff"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="seo" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="meta_title">Título da Página (SEO)</Label>
                <Input
                  id="meta_title"
                  value={formData.meta_title}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, meta_title: e.target.value }))
                  }
                  placeholder="Título para buscadores"
                  maxLength={60}
                />
                <p className="text-xs text-muted-foreground">
                  {formData.meta_title?.length || 0}/60 caracteres
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="meta_description">Descrição (SEO)</Label>
                <Textarea
                  id="meta_description"
                  value={formData.meta_description}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, meta_description: e.target.value }))
                  }
                  placeholder="Descrição para buscadores"
                  maxLength={160}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  {formData.meta_description?.length || 0}/160 caracteres
                </p>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {storefront ? 'Salvar' : 'Criar Loja'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
