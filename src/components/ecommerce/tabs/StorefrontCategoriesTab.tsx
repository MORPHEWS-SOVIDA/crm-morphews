import { useState } from 'react';
import { Plus, Pencil, Trash2, Layers, ChevronRight } from 'lucide-react';
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
  useStorefrontCategories,
  useDeleteStorefrontCategory,
  useUpdateStorefrontCategory,
  type StorefrontCategory,
} from '@/hooks/ecommerce';
import { StorefrontCategoryFormDialog } from '../dialogs/StorefrontCategoryFormDialog';

interface StorefrontCategoriesTabProps {
  storefrontId: string;
}

export function StorefrontCategoriesTab({ storefrontId }: StorefrontCategoriesTabProps) {
  const { data: categories, isLoading } = useStorefrontCategories(storefrontId);
  const deleteCategory = useDeleteStorefrontCategory();
  const updateCategory = useUpdateStorefrontCategory();

  const [formOpen, setFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<StorefrontCategory | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleEdit = (category: StorefrontCategory) => {
    setEditingCategory(category);
    setParentId(null);
    setFormOpen(true);
  };

  const handleCreate = (parentId?: string) => {
    setEditingCategory(null);
    setParentId(parentId || null);
    setFormOpen(true);
  };

  const handleToggleActive = (category: StorefrontCategory) => {
    updateCategory.mutate({
      id: category.id,
      storefrontId,
      is_active: !category.is_active,
    });
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteCategory.mutate(
        { id: deleteId, storefrontId },
        { onSuccess: () => setDeleteId(null) }
      );
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  const renderCategory = (category: StorefrontCategory, isChild = false) => (
    <Card key={category.id} className={`${!category.is_active ? 'opacity-60' : ''} ${isChild ? 'ml-8' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          {/* Image */}
          {category.image_url ? (
            <img
              src={category.image_url}
              alt={category.name}
              className="w-12 h-12 rounded object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
              <Layers className="h-5 w-5 text-muted-foreground" />
            </div>
          )}

          {/* Info */}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              {isChild && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              <h4 className="font-medium">{category.name}</h4>
            </div>
            <p className="text-sm text-muted-foreground">/{category.slug}</p>
          </div>

          {/* Products count */}
          <Badge variant="outline">
            {category.products_count || 0} produtos
          </Badge>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Switch
              checked={category.is_active}
              onCheckedChange={() => handleToggleActive(category)}
            />
            {!isChild && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCreate(category.id)}
                title="Criar subcategoria"
              >
                <Plus className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleEdit(category)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeleteId(category.id)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Categorias de Produtos</h3>
          <p className="text-sm text-muted-foreground">
            Organize seus produtos em categorias e subcategorias
          </p>
        </div>
        <Button onClick={() => handleCreate()} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Categoria
        </Button>
      </div>

      {categories?.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Layers className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma categoria criada</h3>
            <p className="text-muted-foreground mb-4 max-w-md">
              Crie categorias para organizar seus produtos na loja.
            </p>
            <Button onClick={() => handleCreate()} className="gap-2">
              <Plus className="h-4 w-4" />
              Criar Categoria
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {categories?.map((category) => (
            <div key={category.id}>
              {renderCategory(category)}
              {category.children?.map((child) => renderCategory(child, true))}
            </div>
          ))}
        </div>
      )}

      <StorefrontCategoryFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        storefrontId={storefrontId}
        category={editingCategory}
        parentId={parentId}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover categoria?</AlertDialogTitle>
            <AlertDialogDescription>
              Os produtos desta categoria não serão removidos, apenas a associação.
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
