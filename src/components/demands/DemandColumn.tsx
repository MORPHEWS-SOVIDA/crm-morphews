import { DemandCard } from '@/components/demands/DemandCard';
import type { DemandColumn as DemandColumnType, DemandWithRelations } from '@/types/demand';
import { Badge } from '@/components/ui/badge';

interface DemandColumnProps {
  column: DemandColumnType;
  demands: DemandWithRelations[];
  boardId: string;
}

export function DemandColumn({ column, demands, boardId }: DemandColumnProps) {
  return (
    <div className="w-72 flex-shrink-0 flex flex-col bg-muted/30 rounded-lg">
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
        </div>
        <Badge variant="secondary" className="text-xs">
          {demands.length}
        </Badge>
      </div>

      {/* Column Content */}
      <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-16rem)]">
        {demands.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-xs text-muted-foreground">Nenhuma demanda</p>
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
    </div>
  );
}
