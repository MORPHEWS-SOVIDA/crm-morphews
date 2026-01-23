import { useState } from 'react';
import { Plus, Store, Globe, Settings, Trash2, ExternalLink, Eye, EyeOff, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  useStorefronts,
  useDeleteStorefront,
  useUpdateStorefront,
  type Storefront,
} from '@/hooks/ecommerce';
import { StorefrontFormDialog } from './StorefrontFormDialog';
import { StorefrontDetailManager } from './StorefrontDetailManager';

export function StorefrontsManager() {
  const { data: storefronts, isLoading } = useStorefronts();
  const deleteStorefront = useDeleteStorefront();
  const updateStorefront = useUpdateStorefront();
  
  const [formOpen, setFormOpen] = useState(false);
  const [editingStorefront, setEditingStorefront] = useState<Storefront | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [managingStorefrontId, setManagingStorefrontId] = useState<string | null>(null);

  const handleEdit = (storefront: Storefront) => {
    setEditingStorefront(storefront);
    setFormOpen(true);
  };

  const handleCreate = () => {
    setEditingStorefront(null);
    setFormOpen(true);
  };

  const handleToggleActive = (storefront: Storefront) => {
    updateStorefront.mutate({
      id: storefront.id,
      is_active: !storefront.is_active,
    });
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteStorefront.mutate(deleteId, {
        onSuccess: () => setDeleteId(null),
      });
    }
  };

  const handleManage = (storefrontId: string) => {
    setManagingStorefrontId(storefrontId);
  };

  // If managing a storefront, show the detail manager
  if (managingStorefrontId) {
    return (
      <StorefrontDetailManager
        storefrontId={managingStorefrontId}
        onBack={() => setManagingStorefrontId(null)}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">Suas Lojas</h2>
          <p className="text-sm text-muted-foreground">
            Crie e gerencie lojas online com seus produtos
          </p>
        </div>
        <Button onClick={handleCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Loja
        </Button>
      </div>

      {storefronts?.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Store className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma loja criada</h3>
            <p className="text-muted-foreground mb-4 max-w-md">
              Crie sua primeira loja online e comece a vender seus produtos na internet.
            </p>
            <Button onClick={handleCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              Criar Loja
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {storefronts?.map((storefront) => (
            <Card key={storefront.id} className={!storefront.is_active ? 'opacity-60' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {storefront.logo_url ? (
                      <img
                        src={storefront.logo_url}
                        alt={storefront.name}
                        className="h-8 w-8 rounded object-cover"
                      />
                    ) : (
                      <div
                        className="h-8 w-8 rounded flex items-center justify-center"
                        style={{ backgroundColor: storefront.primary_color }}
                      >
                        <Store className="h-4 w-4 text-white" />
                      </div>
                    )}
                    <div>
                      <CardTitle className="text-base">{storefront.name}</CardTitle>
                      <CardDescription className="text-xs">
                        /{storefront.slug}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant={storefront.is_active ? 'default' : 'secondary'}>
                    {storefront.is_active ? 'Ativa' : 'Inativa'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Globe className="h-4 w-4" />
                  <span>
                    {storefront.domains?.length || 0} domínio(s) •{' '}
                    {storefront.products_count || 0} produto(s)
                  </span>
                </div>

                {storefront.template && (
                  <div className="text-xs text-muted-foreground">
                    Template: {storefront.template.name}
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="default"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleManage(storefront.id)}
                  >
                    <LayoutDashboard className="h-4 w-4 mr-1" />
                    Gerenciar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(storefront)}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleActive(storefront)}
                  >
                    {storefront.is_active ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                  >
                    <a
                      href={`https://${storefront.slug}.morphews.shop`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteId(storefront.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <StorefrontFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        storefront={editingStorefront}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover loja?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todos os dados da loja serão removidos.
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
