import { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { DemandKanbanView } from '@/components/demands/DemandKanbanView';
import { DemandFilters } from '@/components/demands/DemandFilters';
import { DemandKPIDashboard } from '@/components/demands/DemandKPIDashboard';
import { useDemandBoards } from '@/hooks/useDemandBoards';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, Plus, LayoutGrid, BarChart3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CreateDemandDialog } from '@/components/demands/CreateDemandDialog';
import { Skeleton } from '@/components/ui/skeleton';

export default function Demands() {
  const { data: boards, isLoading: boardsLoading } = useDemandBoards();
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [filters, setFilters] = useState<{ assigneeId?: string; status?: string }>({});
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('kanban');

  // Auto-select first board
  const currentBoardId = selectedBoardId || boards?.[0]?.id || null;
  const currentBoard = boards?.find(b => b.id === currentBoardId);

  return (
    <Layout>
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        {/* Header */}
        <div className="p-4 md:p-6 border-b bg-background">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Demandas</h1>
              <p className="text-muted-foreground">Gerencie tarefas e demandas da sua equipe</p>
            </div>

            <div className="flex items-center gap-3">
              {/* View Tabs */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="hidden md:block">
                <TabsList>
                  <TabsTrigger value="kanban" className="gap-1.5">
                    <LayoutGrid className="h-4 w-4" />
                    Kanban
                  </TabsTrigger>
                  <TabsTrigger value="dashboard" className="gap-1.5">
                    <BarChart3 className="h-4 w-4" />
                    Dashboard
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Board Selector - only show in kanban view */}
              {activeTab === 'kanban' && (
                boardsLoading ? (
                  <Skeleton className="h-10 w-48" />
                ) : boards && boards.length > 0 ? (
                  <Select value={currentBoardId || ''} onValueChange={setSelectedBoardId}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Selecione um quadro" />
                    </SelectTrigger>
                    <SelectContent>
                      {boards.map(board => (
                        <SelectItem key={board.id} value={board.id}>
                          <div className="flex items-center gap-2">
                            {board.color && (
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: board.color }} 
                              />
                            )}
                            {board.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null
              )}

              {activeTab === 'kanban' && (
                <Button onClick={() => setShowCreateDialog(true)} disabled={!currentBoardId}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Demanda
                </Button>
              )}

              <Button variant="outline" asChild>
                <Link to="/demandas/configuracoes">
                  <Settings className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>

          {/* Filters - only show in kanban view */}
          {activeTab === 'kanban' && currentBoardId && (
            <div className="mt-4">
              <DemandFilters filters={filters} onFiltersChange={setFilters} />
            </div>
          )}

          {/* Mobile view tabs */}
          <div className="mt-4 md:hidden">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full">
                <TabsTrigger value="kanban" className="flex-1 gap-1.5">
                  <LayoutGrid className="h-4 w-4" />
                  Kanban
                </TabsTrigger>
                <TabsTrigger value="dashboard" className="flex-1 gap-1.5">
                  <BarChart3 className="h-4 w-4" />
                  Dashboard
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'kanban' ? (
            // Kanban View
            boardsLoading ? (
              <div className="p-6 flex gap-4">
                {[1, 2, 3, 4].map(i => (
                  <Skeleton key={i} className="w-72 h-96 flex-shrink-0" />
                ))}
              </div>
            ) : !boards?.length ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-6">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Settings className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Nenhum quadro configurado</h3>
                <p className="text-muted-foreground mb-4">
                  Crie seu primeiro quadro para começar a gerenciar demandas.
                </p>
                <Button asChild>
                  <Link to="/demandas/configuracoes">
                    Configurar Quadros
                  </Link>
                </Button>
              </div>
            ) : currentBoardId ? (
              <DemandKanbanView 
                boardId={currentBoardId} 
                filters={filters}
              />
            ) : null
          ) : (
            // Dashboard View
            <div className="p-6 overflow-y-auto h-full">
              <DemandKPIDashboard />
            </div>
          )}
        </div>
      </div>

      {/* Create Demand Dialog */}
      {currentBoard && (
        <CreateDemandDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          boardId={currentBoard.id}
        />
      )}
    </Layout>
  );
}
