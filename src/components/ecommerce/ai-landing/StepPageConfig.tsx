import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileText, Link, Phone, Video } from 'lucide-react';
import type { PageConfig } from './types';

interface StepPageConfigProps {
  pageConfig: PageConfig;
  onConfigChange: (config: PageConfig) => void;
}

export function StepPageConfig({ pageConfig, onConfigChange }: StepPageConfigProps) {
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Configure sua página</h2>
        <p className="text-muted-foreground">
          Defina o nome e URL da sua landing page
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Nome da Página *
            </Label>
            <Input
              id="name"
              value={pageConfig.name}
              onChange={(e) => {
                const name = e.target.value;
                onConfigChange({
                  ...pageConfig,
                  name,
                  slug: pageConfig.slug || generateSlug(name),
                });
              }}
              placeholder="Oferta Especial Lipo Free"
              required
            />
            <p className="text-xs text-muted-foreground">
              Nome interno para identificar esta página
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug" className="flex items-center gap-2">
              <Link className="h-4 w-4" />
              URL da Página *
            </Label>
            <div className="flex items-center gap-1">
              <span className="text-sm text-muted-foreground whitespace-nowrap bg-muted px-2 py-2 rounded-l-md border border-r-0">
                sales.morphews.com/lp/
              </span>
              <Input
                id="slug"
                value={pageConfig.slug}
                onChange={(e) =>
                  onConfigChange({
                    ...pageConfig,
                    slug: generateSlug(e.target.value),
                  })
                }
                placeholder="oferta-especial"
                className="rounded-l-none"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="whatsapp" className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              WhatsApp para Suporte
            </Label>
            <Input
              id="whatsapp"
              value={pageConfig.whatsappNumber}
              onChange={(e) =>
                onConfigChange({
                  ...pageConfig,
                  whatsappNumber: e.target.value,
                })
              }
              placeholder="5511999999999"
            />
            <p className="text-xs text-muted-foreground">
              Número com DDD para botão de WhatsApp
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="video" className="flex items-center gap-2">
              <Video className="h-4 w-4" />
              URL do Vídeo de Vendas (VSL)
            </Label>
            <Input
              id="video"
              value={pageConfig.videoUrl || ''}
              onChange={(e) =>
                onConfigChange({
                  ...pageConfig,
                  videoUrl: e.target.value,
                })
              }
              placeholder="https://youtube.com/watch?v=..."
            />
            <p className="text-xs text-muted-foreground">
              YouTube, Vimeo ou link direto do vídeo
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
