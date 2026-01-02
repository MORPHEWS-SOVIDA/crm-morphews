import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
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
import type { ProductPriceKitFormData } from '@/hooks/useProductPriceKits';

interface PriceKitsManagerProps {
  kits: ProductPriceKitFormData[];
  onChange: (kits: ProductPriceKitFormData[]) => void;
}

const createEmptyKit = (quantity: number = 1): ProductPriceKitFormData => ({
  quantity,
  regular_price_cents: 0,
  regular_use_default_commission: true,
  regular_custom_commission: null,
  promotional_price_cents: null,
  promotional_use_default_commission: true,
  promotional_custom_commission: null,
  minimum_price_cents: null,
  minimum_use_default_commission: true,
  minimum_custom_commission: null,
  position: 0,
});

export function PriceKitsManager({ kits, onChange }: PriceKitsManagerProps) {
  const [newQuantity, setNewQuantity] = useState('');

  const handleAddKit = () => {
    const qty = parseInt(newQuantity) || 1;
    
    // Check if quantity already exists
    if (kits.some(k => k.quantity === qty)) {
      return;
    }
    
    const newKits = [...kits, createEmptyKit(qty)];
    // Sort by quantity
    newKits.sort((a, b) => a.quantity - b.quantity);
    // Update positions
    newKits.forEach((kit, idx) => kit.position = idx);
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

      {/* List of kits */}
      {kits.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          Nenhum kit de preço cadastrado. Adicione kits acima.
        </div>
      ) : (
        <Accordion type="multiple" className="w-full space-y-2">
          {kits.map((kit, index) => (
            <AccordionItem 
              key={index} 
              value={`kit-${index}`}
              className="border rounded-lg overflow-hidden"
            >
              <AccordionTrigger className="px-4 hover:no-underline">
                <div className="flex items-center justify-between w-full pr-2">
                  <span className="font-medium">
                    Kit {kit.quantity} {kit.quantity === 1 ? 'unidade' : 'unidades'}
                  </span>
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
                      onChange={(e) => handleUpdateKit(index, { quantity: parseInt(e.target.value) || 1 })}
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
                          onChange={(value) => handleUpdateKit(index, { regular_price_cents: value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Switch
                            id={`regular-commission-${index}`}
                            checked={kit.regular_use_default_commission}
                            onCheckedChange={(checked) => handleUpdateKit(index, { 
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
                              onChange={(e) => handleUpdateKit(index, { 
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

                  {/* Promotional Price */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                      Valor Promocional
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>Preço Promocional ({kit.quantity} {kit.quantity === 1 ? 'un' : 'uns'})</Label>
                        <CurrencyInput
                          value={kit.promotional_price_cents || 0}
                          onChange={(value) => handleUpdateKit(index, { promotional_price_cents: value || null })}
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Switch
                            id={`promo-commission-${index}`}
                            checked={kit.promotional_use_default_commission}
                            onCheckedChange={(checked) => handleUpdateKit(index, { 
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
                              onChange={(e) => handleUpdateKit(index, { 
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
                          onChange={(value) => handleUpdateKit(index, { minimum_price_cents: value || null })}
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Switch
                            id={`min-commission-${index}`}
                            checked={kit.minimum_use_default_commission}
                            onCheckedChange={(checked) => handleUpdateKit(index, { 
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
                              onChange={(e) => handleUpdateKit(index, { 
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

                  {/* Remove button */}
                  <div className="flex justify-end">
                    <Button 
                      type="button" 
                      variant="destructive" 
                      size="sm"
                      onClick={() => handleRemoveKit(index)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remover Kit
                    </Button>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}
