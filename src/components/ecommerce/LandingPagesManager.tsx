import { useState } from 'react';
import { Plus, FileText, Trash2, ExternalLink, Eye, EyeOff, Copy, Settings } from 'lucide-react';
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
  useLandingPages,
  useDeleteLandingPage,
  useUpdateLandingPage,
  useDuplicateLandingPage,
  type LandingPage,
} from '@/hooks/ecommerce';
import { LandingPageFormDialog } from './LandingPageFormDialog';

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

export function LandingPagesManager() {
  const { data: landingPages, isLoading } = useLandingPages();
  const deleteLandingPage = useDeleteLandingPage();
  const updateLandingPage = useUpdateLandingPage();
  const duplicateLandingPage = useDuplicateLandingPage();
  
  const [formOpen, setFormOpen] = useState(false);
  const [editingPage, setEditingPage] = useState<LandingPage | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleEdit = (page: LandingPage) => {
    setEditingPage(page);
    setFormOpen(true);
  };

  const handleCreate = () => {
    setEditingPage(null);
    setFormOpen(true);
  };

  const handleToggleActive = (page: LandingPage) => {
    updateLandingPage.mutate({
      id: page.id,
      is_active: !page.is_active,
    });
  };

  const handleDuplicate = (id: string) => {
    duplicateLandingPage.mutate(id);
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteLandingPage.mutate(deleteId, {
        onSuccess: () => setDeleteId(null),
      });
    }
  };

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
          <h2 className="text-lg font-semibold">Landing Pages</h2>
          <p className="text-sm text-muted-foreground">
            Páginas de vendas focadas em um único produto
          </p>
        </div>
        <Button onClick={handleCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Landing
        </Button>
      </div>

      {landingPages?.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma landing page</h3>
            <p className="text-muted-foreground mb-4 max-w-md">
              Crie páginas de venda focadas com ofertas de 1, 3 ou 5 unidades.
            </p>
            <Button onClick={handleCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              Criar Landing Page
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {landingPages?.map((page) => (
            <Card key={page.id} className={!page.is_active ? 'opacity-60' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{page.name}</CardTitle>
                    <CardDescription className="text-xs">
                      /{page.slug}
                    </CardDescription>
                  </div>
                  <Badge variant={page.is_active ? 'default' : 'secondary'}>
                    {page.is_active ? 'Ativa' : 'Inativa'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {page.product && (
                  <div className="flex items-center gap-2">
                    {page.product.image_url && (
                      <img
                        src={page.product.image_url}
                        alt={page.product.name}
                        className="h-10 w-10 rounded object-cover"
                      />
                    )}
                    <div className="text-sm">
                      <div className="font-medium truncate">{page.product.name}</div>
                      <div className="text-muted-foreground">
                        {formatCurrency(page.product.price_cents)}
                      </div>
                    </div>
                  </div>
                )}

                {page.offers && page.offers.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {page.offers.map((offer) => (
                      <Badge key={offer.id} variant="outline" className="text-xs">
                        {offer.quantity}x - {formatCurrency(offer.price_cents)}
                      </Badge>
                    ))}
                  </div>
                )}

                {page.headline && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {page.headline}
                  </p>
                )}

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleEdit(page)}
                  >
                    <Settings className="h-4 w-4 mr-1" />
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleActive(page)}
                  >
                    {page.is_active ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDuplicate(page.id)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                  >
                    <a
                      href={`https://${page.slug}.morphews.shop`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteId(page.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <LandingPageFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        landingPage={editingPage}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover landing page?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A página e suas ofertas serão removidas.
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
