import { useState, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useDemandColumns } from '@/hooks/useDemandBoards';
import { useDemandsByColumn, useMoveDemand } from '@/hooks/useDemands';
import { DemandColumn } from '@/components/demands/DemandColumn';
import { DemandCard } from '@/components/demands/DemandCard';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import type { DemandWithRelations } from '@/types/demand';

interface DemandKanbanViewProps {
  boardId: string;
  filters?: {
    assigneeId?: string;
  };
}

export function DemandKanbanView({ boardId, filters }: DemandKanbanViewProps) {
  const { data: columns, isLoading: columnsLoading } = useDemandColumns(boardId);
  const { data: demandsByColumn, isLoading: demandsLoading } = useDemandsByColumn(boardId, filters);
  const moveDemand = useMoveDemand();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeDemand, setActiveDemand] = useState<DemandWithRelations | null>(null);

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

  const findDemandById = useCallback((id: string): DemandWithRelations | null => {
    if (!demandsByColumn) return null;
    for (const columnId of Object.keys(demandsByColumn)) {
      const demand = demandsByColumn[columnId]?.find(d => d.id === id);
      if (demand) return demand;
    }
    return null;
  }, [demandsByColumn]);

  const findColumnByDemandId = useCallback((demandId: string): string | null => {
    if (!demandsByColumn) return null;
    for (const columnId of Object.keys(demandsByColumn)) {
      const demand = demandsByColumn[columnId]?.find(d => d.id === demandId);
      if (demand) return columnId;
    }
    return null;
  }, [demandsByColumn]);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);
    const demand = findDemandById(active.id as string);
    setActiveDemand(demand);
  };

  const handleDragOver = (event: DragOverEvent) => {
    // We can use this for visual feedback if needed
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    setActiveId(null);
    setActiveDemand(null);

    if (!over) return;

    const demandId = active.id as string;
    const overId = over.id as string;

    // Find the source column
    const sourceColumnId = findColumnByDemandId(demandId);
    if (!sourceColumnId) return;

    // Determine target column
    // If dropped on a column directly
    const isColumn = columns?.some(col => col.id === overId);
    let targetColumnId = overId;

    // If dropped on another demand, find its column
    if (!isColumn) {
      const overDemandColumn = findColumnByDemandId(overId);
      if (overDemandColumn) {
        targetColumnId = overDemandColumn;
      } else {
        return; // Invalid drop target
      }
    }

    // If same column, no need to move
    if (sourceColumnId === targetColumnId) return;

    // Calculate new position (put at end of column for now)
    const targetDemands = demandsByColumn?.[targetColumnId] || [];
    const newPosition = targetDemands.length > 0 
      ? Math.max(...targetDemands.map(d => d.position)) + 1 
      : 0;

    // Execute move
    await moveDemand.mutateAsync({
      demandId,
      columnId: targetColumnId,
      position: newPosition,
      boardId,
    });
  };

  const isLoading = columnsLoading || demandsLoading;

  if (isLoading) {
    return (
      <div className="p-6 flex gap-4 overflow-x-auto">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="w-72 flex-shrink-0 space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (!columns?.length) {
    return (
      <div className="flex items-center justify-center h-full text-center p-6">
        <div>
          <p className="text-muted-foreground mb-2">Este quadro não tem colunas configuradas.</p>
          <p className="text-sm text-muted-foreground">
            Vá em Configurações para adicionar colunas como "A Fazer", "Em Andamento", "Concluído".
          </p>
        </div>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <ScrollArea className="h-full">
        <div className="p-6 flex gap-4 min-w-max">
          {columns.map(column => (
            <DemandColumn 
              key={column.id}
              column={column}
              demands={demandsByColumn?.[column.id] || []}
              boardId={boardId}
            />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Drag Overlay - shows the card being dragged */}
      <DragOverlay>
        {activeId && activeDemand ? (
          <div className="opacity-80 rotate-3">
            <DemandCard 
              demand={activeDemand}
              boardId={boardId}
              isDragging
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
