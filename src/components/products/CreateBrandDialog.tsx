import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useCreateProductBrand } from '@/hooks/useProductBrands';

interface CreateBrandDialogProps {
  onBrandCreated?: (brandId: string) => void;
}

export function CreateBrandDialog({ onBrandCreated }: CreateBrandDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const createBrand = useCreateProductBrand();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      const result = await createBrand.mutateAsync(name.trim());
      setName('');
      setOpen(false);
      if (onBrandCreated && result?.id) {
        onBrandCreated(result.id);
      }
    } catch {
      // Error handled by mutation
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="icon" className="shrink-0">
          <Plus className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Nova Marca</DialogTitle>
            <DialogDescription>
              Crie uma nova marca para organizar seus produtos.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="brand-name">Nome da Marca</Label>
            <Input
              id="brand-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Morpheus"
              className="mt-1.5"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={createBrand.isPending || !name.trim()}
            >
              {createBrand.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Criar Marca
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
