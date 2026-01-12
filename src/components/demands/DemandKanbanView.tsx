import { useDemandColumns } from '@/hooks/useDemandBoards';
import { useDemandsByColumn } from '@/hooks/useDemands';
import { DemandColumn } from '@/components/demands/DemandColumn';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

interface DemandKanbanViewProps {
  boardId: string;
  filters?: {
    assigneeId?: string;
  };
}

export function DemandKanbanView({ boardId, filters }: DemandKanbanViewProps) {
  const { data: columns, isLoading: columnsLoading } = useDemandColumns(boardId);
  const { data: demandsByColumn, isLoading: demandsLoading } = useDemandsByColumn(boardId, filters);

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
  );
}
