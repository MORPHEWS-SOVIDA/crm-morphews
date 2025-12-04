import { useState } from 'react';
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
import { useFunnelStages, useUpdateFunnelStage, useCreateFunnelStage, useDeleteFunnelStage, useReorderFunnelStages, FunnelStageCustom } from '@/hooks/useFunnelStages';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Loader2, Plus, Pencil, Trash2, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

const STAGE_COLORS = [
  { value: 'bg-slate-200', label: 'Cinza', textColor: 'text-slate-700' },
  { value: 'bg-orange-200', label: 'Laranja Claro', textColor: 'text-orange-900' },
  { value: 'bg-orange-400', label: 'Laranja', textColor: 'text-white' },
  { value: 'bg-yellow-300', label: 'Amarelo', textColor: 'text-yellow-900' },
  { value: 'bg-sky-300', label: 'Azul Claro', textColor: 'text-sky-900' },
  { value: 'bg-green-300', label: 'Verde Claro', textColor: 'text-green-900' },
  { value: 'bg-green-500', label: 'Verde', textColor: 'text-white' },
  { value: 'bg-amber-400', label: 'Dourado', textColor: 'text-amber-900' },
  { value: 'bg-red-200', label: 'Vermelho Claro', textColor: 'text-red-800' },
  { value: 'bg-purple-300', label: 'Roxo', textColor: 'text-purple-900' },
  { value: 'bg-pink-300', label: 'Rosa', textColor: 'text-pink-900' },
];

interface StageEditFormProps {
  stage?: FunnelStageCustom;
  onSave: (data: Partial<FunnelStageCustom>) => void;
  onCancel: () => void;
  isLoading: boolean;
  isNew?: boolean;
  maxPosition: number;
  organizationId: string;
}

function StageEditForm({ stage, onSave, onCancel, isLoading, isNew, maxPosition, organizationId }: StageEditFormProps) {
  const [name, setName] = useState(stage?.name || '');
  const [color, setColor] = useState(stage?.color || 'bg-slate-200');
  const [stageType, setStageType] = useState<'funnel' | 'cloud' | 'trash'>(stage?.stage_type || 'funnel');

  const selectedColorInfo = STAGE_COLORS.find(c => c.value === color);

  const handleSubmit = () => {
    if (!name.trim()) return;
    
    const data: Partial<FunnelStageCustom> = {
      name: name.trim(),
      color,
      text_color: selectedColorInfo?.textColor || 'text-slate-700',
      stage_type: stageType,
    };

    if (isNew) {
      data.position = maxPosition + 1;
      data.organization_id = organizationId;
      data.is_default = false;
    }

    onSave(data);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Nome da Etapa</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Reunião marcada"
        />
      </div>

      <div className="space-y-2">
        <Label>Cor</Label>
        <Select value={color} onValueChange={setColor}>
          <SelectTrigger>
            <SelectValue>
              <div className="flex items-center gap-2">
                <div className={cn('w-4 h-4 rounded', color)} />
                {selectedColorInfo?.label}
              </div>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {STAGE_COLORS.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                <div className="flex items-center gap-2">
                  <div className={cn('w-4 h-4 rounded', c.value)} />
                  {c.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Tipo</Label>
        <Select value={stageType} onValueChange={(v: 'funnel' | 'cloud' | 'trash') => setStageType(v)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cloud">Não classificado (acima do funil)</SelectItem>
            <SelectItem value="funnel">Etapa do funil</SelectItem>
            <SelectItem value="trash">Sem interesse (ao lado do funil)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Preview */}
      <div className="space-y-2">
        <Label>Preview</Label>
        <div className={cn('p-3 rounded-lg', color)}>
          <span className={selectedColorInfo?.textColor}>{name || 'Nome da etapa'}</span>
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button onClick={handleSubmit} disabled={isLoading || !name.trim()}>
          {isLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
          {isNew ? 'Adicionar' : 'Salvar'}
        </Button>
      </div>
    </div>
  );
}

interface SortableStageItemProps {
  stage: FunnelStageCustom;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

function SortableStageItem({ stage, canDelete, onEdit, onDelete }: SortableStageItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stage.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 group',
        isDragging && 'opacity-50'
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="p-1 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <div className={cn('flex-1 p-3 rounded-lg', stage.color)}>
        <span className={stage.text_color}>{stage.name}</span>
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onEdit}
        >
          <Pencil className="w-4 h-4" />
        </Button>
        {canDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

export function FunnelStagesManager() {
  const { profile } = useAuth();
  const { data: stages = [], isLoading } = useFunnelStages();
  const updateStage = useUpdateFunnelStage();
  const createStage = useCreateFunnelStage();
  const deleteStage = useDeleteFunnelStage();
  const reorderStages = useReorderFunnelStages();

  const [editingStage, setEditingStage] = useState<FunnelStageCustom | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<FunnelStageCustom | null>(null);

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

  const cloudStage = stages.find(s => s.stage_type === 'cloud');
  const funnelStages = stages.filter(s => s.stage_type === 'funnel').sort((a, b) => a.position - b.position);
  const trashStage = stages.find(s => s.stage_type === 'trash');

  const maxPosition = Math.max(...stages.map(s => s.position), 0);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = funnelStages.findIndex((s) => s.id === active.id);
    const newIndex = funnelStages.findIndex((s) => s.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(funnelStages, oldIndex, newIndex);
    
    // Update positions (funnel stages start at position 1)
    const updates = reordered.map((stage, index) => ({
      id: stage.id,
      position: index + 1, // Position 0 is cloud, so funnel starts at 1
    }));

    await reorderStages.mutateAsync(updates);
  };

  const handleSaveEdit = async (data: Partial<FunnelStageCustom>) => {
    if (!editingStage) return;
    await updateStage.mutateAsync({ id: editingStage.id, updates: data });
    setEditingStage(null);
  };

  const handleSaveNew = async (data: Partial<FunnelStageCustom>) => {
    await createStage.mutateAsync(data as Omit<FunnelStageCustom, 'id' | 'created_at' | 'updated_at'>);
    setIsAddingNew(false);
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    await deleteStage.mutateAsync(deleteConfirm.id);
    setDeleteConfirm(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const StageItem = ({ stage, canDelete = true }: { stage: FunnelStageCustom; canDelete?: boolean }) => (
    <div className="flex items-center gap-2 group">
      <div className={cn('flex-1 p-3 rounded-lg', stage.color)}>
        <span className={stage.text_color}>{stage.name}</span>
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setEditingStage(stage)}
        >
          <Pencil className="w-4 h-4" />
        </Button>
        {canDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={() => setDeleteConfirm(stage)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Arraste as etapas para reordenar
        </p>
        <Dialog open={isAddingNew} onOpenChange={setIsAddingNew}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Nova Etapa
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Etapa</DialogTitle>
            </DialogHeader>
            <StageEditForm
              onSave={handleSaveNew}
              onCancel={() => setIsAddingNew(false)}
              isLoading={createStage.isPending}
              isNew
              maxPosition={maxPosition}
              organizationId={profile?.organization_id || ''}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Cloud Stage */}
      {cloudStage && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">Não Classificado</Label>
          <StageItem stage={cloudStage} canDelete={false} />
        </div>
      )}

      {/* Funnel Stages - Sortable */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground uppercase tracking-wide">Etapas do Funil (arraste para reordenar)</Label>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={funnelStages.map(s => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {funnelStages.map((stage) => (
                <SortableStageItem
                  key={stage.id}
                  stage={stage}
                  canDelete={funnelStages.length > 1}
                  onEdit={() => setEditingStage(stage)}
                  onDelete={() => setDeleteConfirm(stage)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* Trash Stage */}
      {trashStage && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">Sem Interesse</Label>
          <StageItem stage={trashStage} canDelete={false} />
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingStage} onOpenChange={(open) => !open && setEditingStage(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Etapa</DialogTitle>
          </DialogHeader>
          {editingStage && (
            <StageEditForm
              stage={editingStage}
              onSave={handleSaveEdit}
              onCancel={() => setEditingStage(null)}
              isLoading={updateStage.isPending}
              maxPosition={maxPosition}
              organizationId={profile?.organization_id || ''}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Etapa</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover a etapa "{deleteConfirm?.name}"? 
              Os leads nesta etapa serão movidos para "Não classificado".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
