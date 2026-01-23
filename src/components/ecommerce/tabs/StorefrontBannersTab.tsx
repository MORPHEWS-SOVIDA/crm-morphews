import { useState } from 'react';
import { Plus, Pencil, Trash2, GripVertical, Image, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  useStorefrontBanners,
  useDeleteStorefrontBanner,
  useUpdateStorefrontBanner,
  type StorefrontBanner,
} from '@/hooks/ecommerce';
import { StorefrontBannerFormDialog } from '../dialogs/StorefrontBannerFormDialog';

interface StorefrontBannersTabProps {
  storefrontId: string;
}

export function StorefrontBannersTab({ storefrontId }: StorefrontBannersTabProps) {
  const { data: banners, isLoading } = useStorefrontBanners(storefrontId);
  const deleteBanner = useDeleteStorefrontBanner();
  const updateBanner = useUpdateStorefrontBanner();

  const [formOpen, setFormOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<StorefrontBanner | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleEdit = (banner: StorefrontBanner) => {
    setEditingBanner(banner);
    setFormOpen(true);
  };

  const handleCreate = () => {
    setEditingBanner(null);
    setFormOpen(true);
  };

  const handleToggleActive = (banner: StorefrontBanner) => {
    updateBanner.mutate({
      id: banner.id,
      storefrontId,
      is_active: !banner.is_active,
    });
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteBanner.mutate(
        { id: deleteId, storefrontId },
        { onSuccess: () => setDeleteId(null) }
      );
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Banners do Carrossel</h3>
          <p className="text-sm text-muted-foreground">
            Gerencie os banners do hero da sua loja
          </p>
        </div>
        <Button onClick={handleCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Banner
        </Button>
      </div>

      {banners?.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Image className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum banner criado</h3>
            <p className="text-muted-foreground mb-4 max-w-md">
              Adicione banners para destacar promoções e produtos na sua loja.
            </p>
            <Button onClick={handleCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              Criar Banner
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {banners?.map((banner, index) => (
            <Card key={banner.id} className={!banner.is_active ? 'opacity-60' : ''}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  {/* Drag handle */}
                  <div className="text-muted-foreground cursor-grab">
                    <GripVertical className="h-5 w-5" />
                  </div>

                  {/* Preview */}
                  <div className="relative w-40 h-20 rounded overflow-hidden bg-muted flex-shrink-0">
                    <img
                      src={banner.image_url}
                      alt={banner.title || 'Banner'}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-1 right-1">
                      <Badge variant="secondary" className="text-xs">
                        #{index + 1}
                      </Badge>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium truncate">
                      {banner.title || 'Sem título'}
                    </h4>
                    {banner.subtitle && (
                      <p className="text-sm text-muted-foreground truncate">
                        {banner.subtitle}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      {banner.link_url && (
                        <Badge variant="outline" className="text-xs">
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Link
                        </Badge>
                      )}
                      {banner.button_text && (
                        <Badge variant="outline" className="text-xs">
                          {banner.button_text}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={banner.is_active}
                      onCheckedChange={() => handleToggleActive(banner)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(banner)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteId(banner.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <StorefrontBannerFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        storefrontId={storefrontId}
        banner={editingBanner}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover banner?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
