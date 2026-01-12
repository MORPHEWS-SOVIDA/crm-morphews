import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useDemandLabels, useCreateDemandLabel } from '@/hooks/useDemandDetails';
import { Plus, Tag } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const LABEL_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e',
  '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6',
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
];

export function DemandLabelsManager() {
  const { data: labels, isLoading } = useDemandLabels();
  const createLabel = useCreateDemandLabel();

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', color: LABEL_COLORS[0] });

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    await createLabel.mutateAsync({
      name: form.name,
      color: form.color,
    });
    setForm({ name: '', color: LABEL_COLORS[0] });
    setShowCreate(false);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-32" />
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-8 w-24" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Etiquetas</h2>
          <p className="text-sm text-muted-foreground">
            Crie etiquetas para categorizar e filtrar demandas
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Etiqueta
        </Button>
      </div>

      {labels?.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Tag className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">Nenhuma etiqueta criada ainda.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Etiquetas ajudam a organizar e filtrar suas demandas.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-wrap gap-2">
          {labels?.map(label => (
            <Badge 
              key={label.id}
              className="px-3 py-1.5 text-white cursor-default"
              style={{ backgroundColor: label.color }}
            >
              {label.name}
            </Badge>
          ))}
        </div>
      )}

      {/* Create Label Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Etiqueta</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Urgente, Bug, Melhoria..."
              />
            </div>

            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex gap-2 flex-wrap">
                {LABEL_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    className={`w-8 h-8 rounded-full transition-transform ${
                      form.color === color ? 'ring-2 ring-offset-2 ring-primary scale-110' : ''
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setForm(prev => ({ ...prev, color }))}
                  />
                ))}
              </div>
            </div>

            <div className="pt-2">
              <Label className="text-sm text-muted-foreground">Pré-visualização</Label>
              <div className="mt-2">
                <Badge 
                  className="px-3 py-1.5 text-white"
                  style={{ backgroundColor: form.color }}
                >
                  {form.name || 'Nome da etiqueta'}
                </Badge>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleCreate}
              disabled={!form.name.trim() || createLabel.isPending}
            >
              Criar Etiqueta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
