import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle, Minus, Plus, Trash2, Loader2, Pencil } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatCurrency } from '@/hooks/useSales';

interface SaleItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price_cents: number;
  discount_cents: number;
  total_cents: number;
  kit_id: string | null;
  kit_quantity: number | null;
  requisition_number: string | null;
}

interface EditableItem extends SaleItem {
  newQuantity: number;
  removed: boolean;
}

interface EditSaleOnClosingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saleId: string;
  saleTotalCents: number;
  romaneioNumber?: number | null;
  clientName?: string;
  onSaved: () => void;
}

export function EditSaleOnClosingDialog({
  open,
  onOpenChange,
  saleId,
  saleTotalCents,
  romaneioNumber,
  clientName,
  onSaved,
}: EditSaleOnClosingDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editableItems, setEditableItems] = useState<EditableItem[]>([]);
  const [justification, setJustification] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Fetch sale items
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['sale-items-for-edit', saleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sale_items')
        .select('id, product_name, quantity, unit_price_cents, discount_cents, total_cents, kit_id, kit_quantity, requisition_number')
        .eq('sale_id', saleId)
        .order('created_at');
      if (error) throw error;
      return (data || []) as SaleItem[];
    },
    enabled: open,
  });

  // Initialize editable items when items load
  useEffect(() => {
    if (items.length > 0) {
      setEditableItems(items.map(item => ({
        ...item,
        newQuantity: item.quantity,
        removed: false,
      })));
    }
  }, [items]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setJustification('');
      setEditableItems([]);
    }
  }, [open]);

  const handleQuantityChange = (itemId: string, delta: number) => {
    setEditableItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      const newQty = Math.max(0, item.newQuantity + delta);
      return { ...item, newQuantity: newQty, removed: newQty === 0 };
    }));
  };

  const handleSetQuantity = (itemId: string, value: string) => {
    const qty = parseInt(value) || 0;
    setEditableItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      return { ...item, newQuantity: Math.max(0, qty), removed: qty === 0 };
    }));
  };

  const handleRemoveItem = (itemId: string) => {
    setEditableItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      return { ...item, newQuantity: 0, removed: true };
    }));
  };

  const handleRestoreItem = (itemId: string) => {
    setEditableItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      return { ...item, newQuantity: item.quantity, removed: false };
    }));
  };

  // Calculate new total
  const newTotalCents = editableItems.reduce((sum, item) => {
    if (item.removed) return sum;
    const unitPrice = item.unit_price_cents;
    const itemDiscount = item.quantity > 0 
      ? Math.round((item.discount_cents / item.quantity) * item.newQuantity) 
      : 0;
    return sum + (unitPrice * item.newQuantity) - itemDiscount;
  }, 0);

  const hasChanges = editableItems.some(item => item.newQuantity !== item.quantity);
  const allRemoved = editableItems.every(item => item.removed);
  const canSave = hasChanges && !allRemoved && justification.trim().length >= 5;

  const handleSave = async () => {
    if (!canSave || !user?.id) return;
    setIsSaving(true);

    try {
      // 1. Update each changed item
      for (const item of editableItems) {
        if (item.removed) {
          // Delete the item
          await supabase.from('sale_items').delete().eq('id', item.id);
        } else if (item.newQuantity !== item.quantity) {
          // Update quantity and recalculate total
          const unitPrice = item.unit_price_cents;
          const itemDiscount = item.quantity > 0
            ? Math.round((item.discount_cents / item.quantity) * item.newQuantity)
            : 0;
          const newItemTotal = (unitPrice * item.newQuantity) - itemDiscount;

          await supabase
            .from('sale_items')
            .update({
              quantity: item.newQuantity,
              discount_cents: itemDiscount,
              total_cents: newItemTotal,
            })
            .eq('id', item.id);
        }
      }

      // 2. Update sale total and mark as modified at closing
      const { error: saleError } = await supabase
        .from('sales')
        .update({
          total_cents: newTotalCents,
          modified_at_closing: true,
          closing_modification_reason: justification.trim(),
          closing_modified_by: user.id,
          closing_modified_at: new Date().toISOString(),
        })
        .eq('id', saleId);

      if (saleError) throw saleError;

      // 3. Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['sale-items-for-edit', saleId] });
      queryClient.invalidateQueries({ queryKey: ['available-closing-sales'] });
      queryClient.invalidateQueries({ queryKey: ['available-pickup-sales'] });
      queryClient.invalidateQueries({ queryKey: ['expedition-sales'] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['sale', saleId] });

      toast.success('Venda alterada com sucesso!');
      onOpenChange(false);
      onSaved();
    } catch (error) {
      console.error('Error saving sale edit on closing:', error);
      toast.error('Erro ao salvar alterações');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-5 h-5 text-primary" />
            Editar Venda na Baixa
          </DialogTitle>
          <DialogDescription>
            {romaneioNumber && `#${romaneioNumber} • `}
            {clientName || 'Cliente'} • Original: {formatCurrency(saleTotalCents)}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Items list */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Produtos</Label>
              {editableItems.map(item => (
                <div
                  key={item.id}
                  className={`p-3 rounded-lg border transition-colors ${
                    item.removed
                      ? 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800 opacity-60'
                      : item.newQuantity !== item.quantity
                        ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800'
                        : 'bg-muted/30 border-border'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium text-sm ${item.removed ? 'line-through text-muted-foreground' : ''}`}>
                        {item.product_name}
                      </p>
                      {item.requisition_number && (
                        <p className="text-xs text-muted-foreground">Req: {item.requisition_number}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatCurrency(item.unit_price_cents)} un.
                        {item.kit_quantity && item.kit_quantity > 1 && ` (Kit ${item.kit_quantity})`}
                      </p>
                    </div>

                    {item.removed ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => handleRestoreItem(item.id)}
                      >
                        Restaurar
                      </Button>
                    ) : (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleQuantityChange(item.id, -1)}
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <Input
                          type="number"
                          value={item.newQuantity}
                          onChange={(e) => handleSetQuantity(item.id, e.target.value)}
                          className="w-14 h-7 text-center text-sm px-1"
                          min={0}
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleQuantityChange(item.id, 1)}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => handleRemoveItem(item.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Show change indicator */}
                  {!item.removed && item.newQuantity !== item.quantity && (
                    <p className="text-xs text-amber-600 mt-1">
                      Qtd: {item.quantity} → {item.newQuantity}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <Separator />

            {/* Total comparison */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
              <div>
                <p className="text-xs text-muted-foreground">Original</p>
                <p className="font-medium line-through text-muted-foreground">
                  {formatCurrency(saleTotalCents)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Novo valor</p>
                <p className={`font-bold text-lg ${newTotalCents < saleTotalCents ? 'text-red-600' : 'text-foreground'}`}>
                  {formatCurrency(newTotalCents)}
                </p>
              </div>
            </div>

            {/* Justification */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <Label className="text-sm font-medium">
                  Justificativa <span className="text-destructive">*</span>
                </Label>
              </div>
              <Textarea
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Ex: Cliente não quis ficar com parte do pedido, motoboy trouxe de volta os itens X e Y..."
                className="min-h-[80px]"
              />
              {justification.length > 0 && justification.trim().length < 5 && (
                <p className="text-xs text-destructive">Mínimo 5 caracteres</p>
              )}
            </div>

            {allRemoved && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <p className="text-sm text-destructive font-medium">
                  Não é possível remover todos os itens. Use o cancelamento de venda.
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={!canSave || isSaving}
            className="gap-2"
          >
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            Salvar Alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
