import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Plus, X, Pencil, Check } from 'lucide-react';
import { useProductBrands, useCreateProductBrand, useUpdateProductBrand, useDeleteProductBrand } from '@/hooks/useProductBrands';

export function ProductBrandsManager() {
  const { data: brands = [], isLoading } = useProductBrands();
  const createBrand = useCreateProductBrand();
  const updateBrand = useUpdateProductBrand();
  const deleteBrand = useDeleteProductBrand();
  
  const [newBrand, setNewBrand] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const handleAdd = async () => {
    if (!newBrand.trim()) return;
    await createBrand.mutateAsync(newBrand);
    setNewBrand('');
  };

  const handleStartEdit = (id: string, name: string) => {
    setEditingId(id);
    setEditingName(name);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editingName.trim()) return;
    await updateBrand.mutateAsync({ id: editingId, name: editingName });
    setEditingId(null);
    setEditingName('');
  };

  const handleDelete = async (id: string) => {
    await deleteBrand.mutateAsync(id);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="Nova marca..."
          value={newBrand}
          onChange={(e) => setNewBrand(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <Button onClick={handleAdd} disabled={createBrand.isPending || !newBrand.trim()}>
          {createBrand.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        </Button>
      </div>

      <div className="space-y-2 max-h-60 overflow-auto">
        {brands.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma marca cadastrada
          </p>
        ) : (
          brands.map((brand) => (
            <div
              key={brand.id}
              className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
            >
              {editingId === brand.id ? (
                <div className="flex items-center gap-2 flex-1 mr-2">
                  <Input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                    className="h-8"
                    autoFocus
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleSaveEdit}
                    disabled={updateBrand.isPending}
                    className="h-8 w-8"
                  >
                    {updateBrand.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4 text-green-500" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setEditingId(null)}
                    className="h-8 w-8"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <span className="text-sm font-medium">{brand.name}</span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleStartEdit(brand.id, brand.name)}
                      className="h-8 w-8"
                    >
                      <Pencil className="w-4 h-4 text-muted-foreground" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(brand.id)}
                      disabled={deleteBrand.isPending}
                      className="h-8 w-8"
                    >
                      {deleteBrand.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <X className="w-4 h-4 text-destructive" />
                      )}
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
