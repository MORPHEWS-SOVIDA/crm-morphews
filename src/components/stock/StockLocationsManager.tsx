import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
  Warehouse,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Star,
  MapPin,
} from 'lucide-react';
import {
  useStockLocations,
  useCreateStockLocation,
  useUpdateStockLocation,
  useDeleteStockLocation,
  type StockLocation,
  type CreateStockLocationInput,
} from '@/hooks/useStockLocations';

interface FormData extends CreateStockLocationInput {}

const initialFormData: FormData = {
  name: '',
  code: '',
  address: '',
  is_default: false,
};

export function StockLocationsManager() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingLocation, setEditingLocation] = useState<StockLocation | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);

  const { data: locations, isLoading } = useStockLocations();
  const createLocation = useCreateStockLocation();
  const updateLocation = useUpdateStockLocation();
  const deleteLocation = useDeleteStockLocation();

  const isSubmitting = createLocation.isPending || updateLocation.isPending;

  const handleOpenCreate = () => {
    setEditingLocation(null);
    setFormData(initialFormData);
    setDialogOpen(true);
  };

  const handleOpenEdit = (location: StockLocation) => {
    setEditingLocation(location);
    setFormData({
      name: location.name,
      code: location.code || '',
      address: location.address || '',
      is_default: location.is_default,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingLocation) {
        await updateLocation.mutateAsync({
          id: editingLocation.id,
          data: formData,
        });
      } else {
        await createLocation.mutateAsync(formData);
      }
      setDialogOpen(false);
      setFormData(initialFormData);
      setEditingLocation(null);
    } catch (error) {
      // Error handled by hook
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteLocation.mutateAsync(deleteId);
    setDeleteId(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Locais de Estoque</h3>
          <p className="text-sm text-muted-foreground">
            Gerencie depósitos, filiais e centros de distribuição
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleOpenCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Local
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>
                  {editingLocation ? 'Editar Local' : 'Novo Local de Estoque'}
                </DialogTitle>
                <DialogDescription>
                  Cadastre um depósito, filial ou centro de distribuição
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Matriz, CD São Paulo, Filial RJ..."
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="code">Código (opcional)</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="Ex: MTZ, CDSP, FRJ..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Endereço (opcional)</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Endereço completo"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="is_default">Local padrão</Label>
                    <p className="text-xs text-muted-foreground">
                      Será usado automaticamente nas entradas de estoque
                    </p>
                  </div>
                  <Switch
                    id="is_default"
                    checked={formData.is_default}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_default: checked })}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting || !formData.name}>
                  {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingLocation ? 'Salvar' : 'Criar'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {locations?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Warehouse className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">Nenhum local cadastrado</h3>
            <p className="text-muted-foreground mb-4">
              Crie seu primeiro local de estoque para começar
            </p>
            <Button onClick={handleOpenCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Local
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {locations?.map((location) => (
            <Card key={location.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Warehouse className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base">{location.name}</CardTitle>
                  </div>
                  {location.is_default && (
                    <Badge variant="default" className="gap-1">
                      <Star className="h-3 w-3" />
                      Padrão
                    </Badge>
                  )}
                </div>
                {location.code && (
                  <CardDescription>Código: {location.code}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                {location.address && (
                  <div className="flex items-start gap-2 text-sm text-muted-foreground mb-3">
                    <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{location.address}</span>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenEdit(location)}
                  >
                    <Pencil className="h-4 w-4 mr-1" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteId(location.id)}
                    disabled={location.is_default}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Remover
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Local</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este local de estoque? 
              Os produtos não serão afetados.
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
