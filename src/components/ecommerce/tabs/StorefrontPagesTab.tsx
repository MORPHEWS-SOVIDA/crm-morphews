import { useState } from 'react';
import { Plus, Pencil, Trash2, FileText, Eye, EyeOff, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
  useStorefrontPages,
  useDeleteStorefrontPage,
  useUpdateStorefrontPage,
  useCreateDefaultPages,
  PAGE_TYPE_LABELS,
  type StorefrontPage,
  type PageType,
} from '@/hooks/ecommerce';
import { StorefrontPageFormDialog } from '../dialogs/StorefrontPageFormDialog';

interface StorefrontPagesTabProps {
  storefrontId: string;
}

const PAGE_TYPE_ICONS: Record<PageType, typeof FileText> = {
  about: FileText,
  privacy: FileText,
  terms: FileText,
  returns: FileText,
  contact: FileText,
  faq: FileText,
  custom: FileText,
};

export function StorefrontPagesTab({ storefrontId }: StorefrontPagesTabProps) {
  const { data: pages, isLoading } = useStorefrontPages(storefrontId);
  const deletePage = useDeleteStorefrontPage();
  const updatePage = useUpdateStorefrontPage();
  const createDefaultPages = useCreateDefaultPages();

  const [formOpen, setFormOpen] = useState(false);
  const [editingPage, setEditingPage] = useState<StorefrontPage | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleEdit = (page: StorefrontPage) => {
    setEditingPage(page);
    setFormOpen(true);
  };

  const handleCreate = () => {
    setEditingPage(null);
    setFormOpen(true);
  };

  const handleToggleActive = (page: StorefrontPage) => {
    updatePage.mutate({
      id: page.id,
      storefrontId,
      is_active: !page.is_active,
    });
  };

  const handleDelete = () => {
    if (deleteId) {
      deletePage.mutate(
        { id: deleteId, storefrontId },
        { onSuccess: () => setDeleteId(null) }
      );
    }
  };

  const handleCreateDefaults = () => {
    createDefaultPages.mutate(storefrontId);
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Páginas Institucionais</h3>
          <p className="text-sm text-muted-foreground">
            Quem Somos, Políticas, FAQ e outras páginas
          </p>
        </div>
        <div className="flex gap-2">
          {pages?.length === 0 && (
            <Button
              variant="outline"
              onClick={handleCreateDefaults}
              disabled={createDefaultPages.isPending}
              className="gap-2"
            >
              <Wand2 className="h-4 w-4" />
              Criar Páginas Padrão
            </Button>
          )}
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Página
          </Button>
        </div>
      </div>

      {pages?.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma página criada</h3>
            <p className="text-muted-foreground mb-4 max-w-md">
              Crie páginas institucionais como "Quem Somos", "Política de Privacidade" e "Trocas e Devoluções".
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleCreateDefaults}
                disabled={createDefaultPages.isPending}
                className="gap-2"
              >
                <Wand2 className="h-4 w-4" />
                Criar Páginas Padrão
              </Button>
              <Button onClick={handleCreate} className="gap-2">
                <Plus className="h-4 w-4" />
                Criar Página
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {pages?.map((page) => {
            const Icon = PAGE_TYPE_ICONS[page.page_type] || FileText;
            return (
              <Card key={page.id} className={!page.is_active ? 'opacity-60' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-medium">{page.title}</h4>
                        <p className="text-xs text-muted-foreground">/{page.slug}</p>
                      </div>
                    </div>
                    <Badge variant={page.is_active ? 'default' : 'secondary'}>
                      {page.is_active ? (
                        <Eye className="h-3 w-3 mr-1" />
                      ) : (
                        <EyeOff className="h-3 w-3 mr-1" />
                      )}
                      {page.is_active ? 'Visível' : 'Oculta'}
                    </Badge>
                  </div>

                  <Badge variant="outline" className="mb-3">
                    {PAGE_TYPE_LABELS[page.page_type]}
                  </Badge>

                  <div className="flex items-center justify-between pt-3 border-t">
                    <Switch
                      checked={page.is_active}
                      onCheckedChange={() => handleToggleActive(page)}
                    />
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(page)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteId(page.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <StorefrontPageFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        storefrontId={storefrontId}
        page={editingPage}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover página?</AlertDialogTitle>
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
