import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { DemandCard } from '@/components/demands/DemandCard';
import type { DemandColumn as DemandColumnType, DemandWithRelations } from '@/types/demand';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface DemandColumnProps {
  column: DemandColumnType;
  demands: DemandWithRelations[];
  boardId: string;
}

export function DemandColumn({ column, demands, boardId }: DemandColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

  const demandIds = demands.map(d => d.id);

  return (
    <div 
      className={cn(
        "w-72 flex-shrink-0 flex flex-col bg-muted/30 rounded-lg transition-colors",
        isOver && "bg-primary/10 ring-2 ring-primary/30"
      )}
    >
      {/* Column Header */}
      <div 
        className="px-3 py-2 border-b flex items-center justify-between"
        style={{ borderColor: column.color || undefined }}
      >
        <div className="flex items-center gap-2">
          {column.color && (
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: column.color }} 
            />
          )}
          <span className="font-medium text-sm">{column.name}</span>
          {column.is_final && (
            <Badge variant="outline" className="text-[10px] text-green-600 border-green-300">
              Final
            </Badge>
          )}
        </div>
        <Badge variant="secondary" className="text-xs">
          {demands.length}
        </Badge>
      </div>

      {/* Column Content - Droppable area */}
      <SortableContext items={demandIds} strategy={verticalListSortingStrategy}>
        <div 
          ref={setNodeRef}
          className={cn(
            "flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-16rem)] min-h-[100px]",
            isOver && "bg-primary/5"
          )}
        >
          {demands.length === 0 ? (
            <div className={cn(
              "py-8 text-center border-2 border-dashed rounded-lg transition-colors",
              isOver ? "border-primary bg-primary/10" : "border-transparent"
            )}>
              <p className="text-xs text-muted-foreground">
                {isOver ? "Solte aqui" : "Nenhuma demanda"}
              </p>
            </div>
          ) : (
            demands.map(demand => (
              <DemandCard 
                key={demand.id} 
                demand={demand}
                boardId={boardId}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}
