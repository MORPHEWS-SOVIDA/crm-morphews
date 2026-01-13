import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, FlaskConical, GripVertical } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export interface ProductIngredient {
  id?: string;
  name: string;
  description: string | null;
  position: number;
}

interface ProductIngredientsManagerProps {
  ingredients: ProductIngredient[];
  onChange: (ingredients: ProductIngredient[]) => void;
}

export function ProductIngredientsManager({ ingredients, onChange }: ProductIngredientsManagerProps) {
  const addIngredient = () => {
    const newIngredient: ProductIngredient = {
      name: '',
      description: null,
      position: ingredients.length,
    };
    onChange([...ingredients, newIngredient]);
  };

  const updateIngredient = (index: number, field: 'name' | 'description', value: string) => {
    const updated = [...ingredients];
    updated[index] = { ...updated[index], [field]: value || null };
    onChange(updated);
  };

  const removeIngredient = (index: number) => {
    const updated = ingredients.filter((_, i) => i !== index);
    // Recalculate positions
    updated.forEach((ing, i) => (ing.position = i));
    onChange(updated);
  };

  const moveIngredient = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= ingredients.length) return;
    const updated = [...ingredients];
    const [removed] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, removed);
    // Recalculate positions
    updated.forEach((ing, i) => (ing.position = i));
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <FlaskConical className="h-4 w-4" />
        <span>Adicione os itens da composição do produto/serviço e uma descrição de cada um</span>
      </div>

      {ingredients.length === 0 ? (
        <div className="text-center py-8 border border-dashed rounded-lg">
          <FlaskConical className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground mb-4">Nenhum item adicionado</p>
          <Button type="button" variant="outline" size="sm" onClick={addIngredient}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Item
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {ingredients.map((ingredient, index) => (
            <Card key={ingredient.id || index} className="relative">
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-start gap-2">
                  <div className="flex flex-col gap-1 pt-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => moveIngredient(index, index - 1)}
                      disabled={index === 0}
                    >
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                  <div className="flex-1 space-y-3">
                    <Input
                      placeholder="Nome do item (ex: Vitamina C, Consultoria inicial)"
                      value={ingredient.name}
                      onChange={(e) => updateIngredient(index, 'name', e.target.value)}
                    />
                    <Textarea
                      placeholder="Descrição e benefícios..."
                      value={ingredient.description || ''}
                      onChange={(e) => updateIngredient(index, 'description', e.target.value)}
                      className="min-h-[60px]"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeIngredient(index)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          
          <Button type="button" variant="outline" size="sm" onClick={addIngredient}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Item
          </Button>
        </div>
      )}
    </div>
  );
}
