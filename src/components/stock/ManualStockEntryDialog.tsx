import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Package } from 'lucide-react';
import { useProducts } from '@/hooks/useProducts';
import { useStockLocations } from '@/hooks/useStockLocations';
import { useCreateStockMovement, type StockMovementInput } from '@/hooks/useStock';

interface ManualStockEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedProductId?: string;
}

export function ManualStockEntryDialog({
  open,
  onOpenChange,
  preselectedProductId,
}: ManualStockEntryDialogProps) {
  const [productId, setProductId] = useState(preselectedProductId || '');
  const [movementType, setMovementType] = useState<StockMovementInput['movement_type']>('entry');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [locationId, setLocationId] = useState('');

  const { data: products } = useProducts();
  const { data: locations } = useStockLocations();
  const createMovement = useCreateStockMovement();

  const isLoading = createMovement.isPending;

  const handleClose = (openState: boolean) => {
    if (!openState) {
      setProductId(preselectedProductId || '');
      setMovementType('entry');
      setQuantity('');
      setNotes('');
      setLocationId('');
    }
    onOpenChange(openState);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!productId || !quantity) return;

    await createMovement.mutateAsync({
      product_id: productId,
      movement_type: movementType,
      quantity: parseFloat(quantity),
      notes: notes || undefined,
    });

    handleClose(false);
  };

  const selectedProduct = products?.find(p => p.id === productId);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Entrada Manual de Estoque
            </DialogTitle>
            <DialogDescription>
              Registre uma movimentação de estoque manual
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Product */}
            <div className="space-y-2">
              <Label htmlFor="product">Produto *</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o produto..." />
                </SelectTrigger>
                <SelectContent>
                  {products?.filter(p => p.track_stock !== false).map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      <div className="flex items-center justify-between w-full">
                        <span>{product.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          Estoque: {product.stock_quantity || 0}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Movement Type */}
            <div className="space-y-2">
              <Label htmlFor="movementType">Tipo de Movimentação *</Label>
              <Select 
                value={movementType} 
                onValueChange={(v) => setMovementType(v as StockMovementInput['movement_type'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entry">
                    <span className="text-green-600 font-medium">Entrada</span>
                    {' '}- Adicionar ao estoque
                  </SelectItem>
                  <SelectItem value="exit">
                    <span className="text-red-600 font-medium">Saída</span>
                    {' '}- Remover do estoque
                  </SelectItem>
                  <SelectItem value="adjustment">
                    <span className="text-blue-600 font-medium">Ajuste</span>
                    {' '}- Definir quantidade absoluta
                  </SelectItem>
                  <SelectItem value="return">
                    <span className="text-purple-600 font-medium">Devolução</span>
                    {' '}- Retorno ao estoque
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Quantity */}
            <div className="space-y-2">
              <Label htmlFor="quantity">
                {movementType === 'adjustment' ? 'Nova Quantidade *' : 'Quantidade *'}
              </Label>
              <Input
                id="quantity"
                type="number"
                min="0"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder={movementType === 'adjustment' ? 'Novo saldo' : 'Quantidade'}
                required
              />
              {selectedProduct && movementType !== 'adjustment' && (
                <p className="text-xs text-muted-foreground">
                  Estoque atual: {selectedProduct.stock_quantity || 0}
                  {quantity && (
                    <>
                      {' → '}
                      Novo estoque:{' '}
                      {movementType === 'entry' || movementType === 'return'
                        ? (selectedProduct.stock_quantity || 0) + parseFloat(quantity || '0')
                        : (selectedProduct.stock_quantity || 0) - parseFloat(quantity || '0')}
                    </>
                  )}
                </p>
              )}
            </div>

            {/* Location (optional) */}
            {locations && locations.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="location">Local (opcional)</Label>
                <Select value={locationId} onValueChange={setLocationId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o local..." />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name}
                        {location.is_default && ' (Padrão)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Observações (opcional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Motivo da movimentação, número de documento, etc."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleClose(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading || !productId || !quantity}>
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Registrar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
