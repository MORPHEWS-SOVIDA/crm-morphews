import { useState, useMemo, useRef } from 'react';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
import { SyncedPriceInput, formatPriceWithUnit } from './SyncedPriceInput';

interface PriceKitsManagerProps {
  kits: ProductPriceKitFormData[];
  onChange: (kits: ProductPriceKitFormData[]) => void;
}

// Generate a stable unique ID for each kit
let kitIdCounter = 0;
const generateKitId = () => `kit-${Date.now()}-${++kitIdCounter}`;

const createEmptyKit = (quantity: number = 1, position: number = 0): ProductPriceKitFormData & { _tempId: string } => ({
  _tempId: generateKitId(),
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
  points_regular: 0,
  points_promotional: 0,
  points_promotional_2: 0,
  points_minimum: 0,
  usage_period_days: null,
  position,
});

// Extended type with stable ID for drag and drop
type KitWithId = ProductPriceKitFormData & { _tempId?: string };

// Sortable Kit Item Component
function SortableKitItem({ 
  kit, 
  index, 
  kitId,
  onUpdate, 
  onRemove,
}: { 
  kit: ProductPriceKitFormData; 
  index: number;
  kitId: string;
  onUpdate: (updates: Partial<ProductPriceKitFormData>) => void;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: kitId });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 'auto',
    position: 'relative' as const,
  };

  return (
    <AccordionItem 
      ref={setNodeRef}
      style={style}
      value={`kit-${index}`}
      className="border rounded-lg overflow-hidden bg-card"
    >
      <div className="flex items-center">
        {/* Drag handle - outside AccordionTrigger to avoid conflicts */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-3 hover:bg-muted flex items-center touch-none"
        >
          <GripVertical className="w-5 h-5 text-muted-foreground" />
        </button>
        
        <AccordionTrigger className="flex-1 px-2 hover:no-underline">
          <div className="flex items-center justify-between w-full pr-2">
            <span className="font-medium">
              Kit {kit.quantity} {kit.quantity === 1 ? 'unidade' : 'unidades'}
            </span>
            <span className="text-sm text-muted-foreground">
              {formatPriceWithUnit(kit.regular_price_cents, kit.quantity)}
            </span>
          </div>
        </AccordionTrigger>
      </div>
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
            <div className="space-y-4">
              <SyncedPriceInput
                label="Preço"
                quantity={kit.quantity}
                valueCents={kit.regular_price_cents}
                onChange={(value) => onUpdate({ regular_price_cents: value || 0 })}
              />
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
                    className="w-32"
                  />
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Promotional Price - Renamed to "Venda por:" */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
              Venda por:
            </h4>
            <div className="space-y-4">
              <SyncedPriceInput
                label="Preço de Venda"
                quantity={kit.quantity}
                valueCents={kit.promotional_price_cents}
                onChange={(value) => onUpdate({ promotional_price_cents: value })}
              />
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
                    className="w-32"
                  />
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Promotional Price 2 */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
              Valor Promocional 2
            </h4>
            <div className="space-y-4">
              <SyncedPriceInput
                label="Preço Promocional 2"
                quantity={kit.quantity}
                valueCents={kit.promotional_price_2_cents}
                onChange={(value) => onUpdate({ promotional_price_2_cents: value })}
              />
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
                    className="w-32"
                  />
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Minimum Price */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
              Valor Mínimo
            </h4>
            <div className="space-y-4">
              <SyncedPriceInput
                label="Preço Mínimo"
                quantity={kit.quantity}
                valueCents={kit.minimum_price_cents}
                onChange={(value) => onUpdate({ minimum_price_cents: value })}
              />
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
                    className="w-32"
                  />
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Período de Uso do Tratamento */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
              📅 Período de Uso (ERP)
            </h4>
            <div>
              <Label>Quantos dias dura esse kit?</Label>
              <Input
                type="number"
                min="1"
                value={kit.usage_period_days || ''}
                onChange={(e) => onUpdate({ usage_period_days: parseInt(e.target.value) || null })}
                placeholder="Ex: 30, 90, 180..."
                className="mt-1 w-40"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Usado para relatórios de recompra e tratamento terminando
              </p>
            </div>
          </div>

          <Separator />

          {/* Points per price type */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
              🏆 Pontos de Campanha
            </h4>
            <p className="text-xs text-muted-foreground -mt-2">
              Configure quantos pontos o vendedor ganha para cada tipo de preço vendido
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Points for Regular */}
              <div className="p-3 rounded-lg border bg-muted/30">
                <Label className="text-xs font-medium">Valor Normal</Label>
                <Input
                  type="number"
                  min="0"
                  value={kit.points_regular || 0}
                  onChange={(e) => onUpdate({ points_regular: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Pontua se vender pelo valor fixo normal
                </p>
              </div>
              
              {/* Points for Promotional (Venda por) */}
              <div className="p-3 rounded-lg border bg-muted/30">
                <Label className="text-xs font-medium">Venda Por</Label>
                <Input
                  type="number"
                  min="0"
                  value={kit.points_promotional || 0}
                  onChange={(e) => onUpdate({ points_promotional: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Pontua se vender pelo valor fixo proposto
                </p>
              </div>
              
              {/* Points for Promotional 2 */}
              <div className="p-3 rounded-lg border bg-muted/30">
                <Label className="text-xs font-medium">Valor Promocional 2</Label>
                <Input
                  type="number"
                  min="0"
                  value={kit.points_promotional_2 || 0}
                  onChange={(e) => onUpdate({ points_promotional_2: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Pontua se vender pelo valor fixo proposto
                </p>
              </div>
              
              {/* Points for Minimum */}
              <div className="p-3 rounded-lg border bg-muted/30">
                <Label className="text-xs font-medium">Valor Mínimo</Label>
                <Input
                  type="number"
                  min="0"
                  value={kit.points_minimum || 0}
                  onChange={(e) => onUpdate({ points_minimum: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Qualquer valor diferente dos acima pontua aqui
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
  
  // Generate stable IDs for each kit based on their original position when first seen
  const kitIdsRef = useRef<Map<number, string>>(new Map());
  
  // Ensure each kit has a stable ID based on its quantity (unique per product)
  const kitsWithIds = useMemo(() => {
    return kits.map((kit, idx) => {
      // Use quantity as the stable identifier since it must be unique per product
      const stableKey = kit.quantity;
      if (!kitIdsRef.current.has(stableKey)) {
        kitIdsRef.current.set(stableKey, `kit-${stableKey}-${Date.now()}`);
      }
      return {
        ...kit,
        _stableId: kitIdsRef.current.get(stableKey)!,
        _index: idx,
      };
    });
  }, [kits]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
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
    const removedKit = kits[index];
    // Clean up the ID mapping
    kitIdsRef.current.delete(removedKit.quantity);
    
    const newKits = kits.filter((_, i) => i !== index);
    newKits.forEach((kit, idx) => kit.position = idx);
    onChange(newKits);
  };

  const handleUpdateKit = (index: number, updates: Partial<ProductPriceKitFormData>) => {
    const newKits = [...kits];
    
    // If quantity changed, update ID mapping
    if (updates.quantity !== undefined && updates.quantity !== kits[index].quantity) {
      const oldQuantity = kits[index].quantity;
      const oldId = kitIdsRef.current.get(oldQuantity);
      kitIdsRef.current.delete(oldQuantity);
      if (oldId) {
        kitIdsRef.current.set(updates.quantity, oldId);
      }
    }
    
    newKits[index] = { ...newKits[index], ...updates };
    onChange(newKits);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      // Find indices by stable ID
      const oldIndex = kitsWithIds.findIndex(k => k._stableId === active.id);
      const newIndex = kitsWithIds.findIndex(k => k._stableId === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const newKits = arrayMove(kits, oldIndex, newIndex);
        // Update positions
        newKits.forEach((kit, idx) => kit.position = idx);
        onChange(newKits);
      }
    }
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
            items={kitsWithIds.map(k => k._stableId)}
            strategy={verticalListSortingStrategy}
          >
            <Accordion type="multiple" className="w-full space-y-2">
              {kitsWithIds.map((kitWithId) => (
                <SortableKitItem
                  key={kitWithId._stableId}
                  kit={kitWithId}
                  index={kitWithId._index}
                  kitId={kitWithId._stableId}
                  onUpdate={(updates) => handleUpdateKit(kitWithId._index, updates)}
                  onRemove={() => handleRemoveKit(kitWithId._index)}
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
