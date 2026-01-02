import { useState } from 'react';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Separator } from '@/components/ui/separator';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ProductPriceKitFormData } from '@/hooks/useProductPriceKits';

interface PriceKitsManagerProps {
  kits: ProductPriceKitFormData[];
  onChange: (kits: ProductPriceKitFormData[]) => void;
}

const createEmptyKit = (quantity: number = 1, position: number = 0): ProductPriceKitFormData => ({
  quantity,
  regular_price_cents: 0,
  regular_use_default_commission: true,
  regular_custom_commission: null,
  promotional_price_cents: null,
  promotional_use_default_commission: true,
  promotional_custom_commission: null,
  promotional_price_2_cents: null,
  promotional_2_use_default_commission: true,
  promotional_2_custom_commission: null,
  minimum_price_cents: null,
  minimum_use_default_commission: true,
  minimum_custom_commission: null,
  points: null,
  position,
});

// Sortable Kit Item Component
function SortableKitItem({ 
  kit, 
  index, 
  onUpdate, 
  onRemove,
  formatPrice,
}: { 
  kit: ProductPriceKitFormData; 
  index: number;
  onUpdate: (updates: Partial<ProductPriceKitFormData>) => void;
  onRemove: () => void;
  formatPrice: (cents: number | null | undefined) => string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `kit-${index}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <AccordionItem 
      ref={setNodeRef}
      style={style}
      value={`kit-${index}`}
      className="border rounded-lg overflow-hidden bg-card"
    >
      <AccordionTrigger className="px-4 hover:no-underline">
        <div className="flex items-center justify-between w-full pr-2">
          <div className="flex items-center gap-2">
            <div
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="w-4 h-4 text-muted-foreground" />
            </div>
            <span className="font-medium">
              Kit {kit.quantity} {kit.quantity === 1 ? 'unidade' : 'unidades'}
            </span>
          </div>
          <span className="text-sm text-muted-foreground">
            {formatPrice(kit.regular_price_cents)}
          </span>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4">
        <div className="space-y-6">
          {/* Quantity */}
          <div>
            <Label>Quantidade de Unidades</Label>
            <Input
              type="number"
              min="1"
              value={kit.quantity}
              onChange={(e) => onUpdate({ quantity: parseInt(e.target.value) || 1 })}
              className="mt-1 w-32"
            />
          </div>

          <Separator />

          {/* Regular Price */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
              Valor Normal
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Preço ({kit.quantity} {kit.quantity === 1 ? 'un' : 'uns'})</Label>
                <CurrencyInput
                  value={kit.regular_price_cents}
                  onChange={(value) => onUpdate({ regular_price_cents: value })}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Switch
                    id={`regular-commission-${index}`}
                    checked={kit.regular_use_default_commission}
                    onCheckedChange={(checked) => onUpdate({ 
                      regular_use_default_commission: checked,
                      regular_custom_commission: checked ? null : 0
                    })}
                  />
                  <Label htmlFor={`regular-commission-${index}`}>
                    Comissão Padrão
                  </Label>
                </div>
                {!kit.regular_use_default_commission && (
                  <div>
                    <Label className="text-xs">Comissão Personalizada (%)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={kit.regular_custom_commission || ''}
                      onChange={(e) => onUpdate({ 
                        regular_custom_commission: parseFloat(e.target.value) || 0 
                      })}
                      placeholder="0.00"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Promotional Price - Renamed to "Venda por:" */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
              Venda por:
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Preço de Venda ({kit.quantity} {kit.quantity === 1 ? 'un' : 'uns'})</Label>
                <CurrencyInput
                  value={kit.promotional_price_cents || 0}
                  onChange={(value) => onUpdate({ promotional_price_cents: value || null })}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Switch
                    id={`promo-commission-${index}`}
                    checked={kit.promotional_use_default_commission}
                    onCheckedChange={(checked) => onUpdate({ 
                      promotional_use_default_commission: checked,
                      promotional_custom_commission: checked ? null : 0
                    })}
                  />
                  <Label htmlFor={`promo-commission-${index}`}>
                    Comissão Padrão
                  </Label>
                </div>
                {!kit.promotional_use_default_commission && (
                  <div>
                    <Label className="text-xs">Comissão Personalizada (%)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={kit.promotional_custom_commission || ''}
                      onChange={(e) => onUpdate({ 
                        promotional_custom_commission: parseFloat(e.target.value) || 0 
                      })}
                      placeholder="0.00"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Promotional Price 2 */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
              Valor Promocional 2
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Preço Promocional 2 ({kit.quantity} {kit.quantity === 1 ? 'un' : 'uns'})</Label>
                <CurrencyInput
                  value={kit.promotional_price_2_cents || 0}
                  onChange={(value) => onUpdate({ promotional_price_2_cents: value || null })}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Switch
                    id={`promo2-commission-${index}`}
                    checked={kit.promotional_2_use_default_commission}
                    onCheckedChange={(checked) => onUpdate({ 
                      promotional_2_use_default_commission: checked,
                      promotional_2_custom_commission: checked ? null : 0
                    })}
                  />
                  <Label htmlFor={`promo2-commission-${index}`}>
                    Comissão Padrão
                  </Label>
                </div>
                {!kit.promotional_2_use_default_commission && (
                  <div>
                    <Label className="text-xs">Comissão Personalizada (%)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={kit.promotional_2_custom_commission || ''}
                      onChange={(e) => onUpdate({ 
                        promotional_2_custom_commission: parseFloat(e.target.value) || 0 
                      })}
                      placeholder="0.00"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Minimum Price */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
              Valor Mínimo
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Preço Mínimo ({kit.quantity} {kit.quantity === 1 ? 'un' : 'uns'})</Label>
                <CurrencyInput
                  value={kit.minimum_price_cents || 0}
                  onChange={(value) => onUpdate({ minimum_price_cents: value || null })}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Switch
                    id={`min-commission-${index}`}
                    checked={kit.minimum_use_default_commission}
                    onCheckedChange={(checked) => onUpdate({ 
                      minimum_use_default_commission: checked,
                      minimum_custom_commission: checked ? null : 0
                    })}
                  />
                  <Label htmlFor={`min-commission-${index}`}>
                    Comissão Padrão
                  </Label>
                </div>
                {!kit.minimum_use_default_commission && (
                  <div>
                    <Label className="text-xs">Comissão Personalizada (%)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={kit.minimum_custom_commission || ''}
                      onChange={(e) => onUpdate({ 
                        minimum_custom_commission: parseFloat(e.target.value) || 0 
                      })}
                      placeholder="0.00"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Points */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
              🏆 Pontos de Campanha
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Pontos que o vendedor ganha</Label>
                <Input
                  type="number"
                  min="0"
                  value={kit.points || 0}
                  onChange={(e) => onUpdate({ points: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Deixe 0 se esse kit não gera pontos
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Remove button */}
          <div className="flex justify-end">
            <Button 
              type="button" 
              variant="destructive" 
              size="sm"
              onClick={onRemove}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Remover Kit
            </Button>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

export function PriceKitsManager({ kits, onChange }: PriceKitsManagerProps) {
  const [newQuantity, setNewQuantity] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleAddKit = () => {
    const qty = parseInt(newQuantity) || 1;
    
    // Check if quantity already exists
    if (kits.some(k => k.quantity === qty)) {
      return;
    }
    
    const newKits = [...kits, createEmptyKit(qty, kits.length)];
    onChange(newKits);
    setNewQuantity('');
  };

  const handleRemoveKit = (index: number) => {
    const newKits = kits.filter((_, i) => i !== index);
    newKits.forEach((kit, idx) => kit.position = idx);
    onChange(newKits);
  };

  const handleUpdateKit = (index: number, updates: Partial<ProductPriceKitFormData>) => {
    const newKits = [...kits];
    newKits[index] = { ...newKits[index], ...updates };
    onChange(newKits);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = parseInt(String(active.id).replace('kit-', ''));
      const newIndex = parseInt(String(over.id).replace('kit-', ''));
      
      const newKits = arrayMove(kits, oldIndex, newIndex);
      // Update positions
      newKits.forEach((kit, idx) => kit.position = idx);
      onChange(newKits);
    }
  };

  const formatPrice = (cents: number | null | undefined) => {
    if (!cents) return 'Não definido';
    return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <div className="space-y-4">
      {/* Add new kit */}
      <div className="flex items-end gap-2 p-4 rounded-lg border border-dashed">
        <div className="flex-1">
          <Label htmlFor="newQuantity">Adicionar Kit com Quantas Unidades?</Label>
          <Input
            id="newQuantity"
            type="number"
            min="1"
            placeholder="Ex: 1, 2, 3..."
            value={newQuantity}
            onChange={(e) => setNewQuantity(e.target.value)}
            className="mt-1"
          />
        </div>
        <Button 
          type="button" 
          onClick={handleAddKit}
          disabled={!newQuantity || kits.some(k => k.quantity === parseInt(newQuantity))}
        >
          <Plus className="h-4 w-4 mr-2" />
          Adicionar Kit
        </Button>
      </div>

      {/* List of kits with drag-and-drop */}
      {kits.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          Nenhum kit de preço cadastrado. Adicione kits acima.
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={kits.map((_, idx) => `kit-${idx}`)}
            strategy={verticalListSortingStrategy}
          >
            <Accordion type="multiple" className="w-full space-y-2">
              {kits.map((kit, index) => (
                <SortableKitItem
                  key={`kit-${index}`}
                  kit={kit}
                  index={index}
                  onUpdate={(updates) => handleUpdateKit(index, updates)}
                  onRemove={() => handleRemoveKit(index)}
                  formatPrice={formatPrice}
                />
              ))}
            </Accordion>
          </SortableContext>
        </DndContext>
      )}

      {kits.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          💡 Arraste os kits para reordenar. O primeiro kit será exibido primeiro para o vendedor.
        </p>
      )}
    </div>
  );
}
