import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription 
} from '@/components/ui/dialog';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  useDemandBoards, 
  useCreateDemandBoard, 
  useUpdateDemandBoard, 
  useDeleteDemandBoard,
  useDemandColumns,
  useCreateDemandColumn,
  useUpdateDemandColumn,
  useDeleteDemandColumn
} from '@/hooks/useDemandBoards';
import { Plus, Pencil, Trash2, GripVertical, ChevronDown, ChevronUp } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { DemandBoard, DemandColumn } from '@/types/demand';

const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', 
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
];

export function DemandBoardsManager() {
  const { data: boards, isLoading } = useDemandBoards();
  const createBoard = useCreateDemandBoard();
  const updateBoard = useUpdateDemandBoard();
  const deleteBoard = useDeleteDemandBoard();

  const [editingBoard, setEditingBoard] = useState<DemandBoard | null>(null);
  const [showCreateBoard, setShowCreateBoard] = useState(false);
  const [deletingBoard, setDeletingBoard] = useState<DemandBoard | null>(null);
  const [expandedBoards, setExpandedBoards] = useState<Set<string>>(new Set());

  const [boardForm, setBoardForm] = useState({ name: '', description: '', color: COLORS[0] });

  const toggleExpanded = (boardId: string) => {
    setExpandedBoards(prev => {
      const next = new Set(prev);
      if (next.has(boardId)) {
        next.delete(boardId);
      } else {
        next.add(boardId);
      }
      return next;
    });
  };

  const handleCreateBoard = async () => {
    if (!boardForm.name.trim()) return;
    await createBoard.mutateAsync({
      name: boardForm.name,
      description: boardForm.description || undefined,
      color: boardForm.color,
    });
    setBoardForm({ name: '', description: '', color: COLORS[0] });
    setShowCreateBoard(false);
  };

  const handleUpdateBoard = async () => {
    if (!editingBoard || !boardForm.name.trim()) return;
    await updateBoard.mutateAsync({
      id: editingBoard.id,
      name: boardForm.name,
      description: boardForm.description || null,
      color: boardForm.color,
    });
    setEditingBoard(null);
  };

  const handleDeleteBoard = async () => {
    if (!deletingBoard) return;
    await deleteBoard.mutateAsync(deletingBoard.id);
    setDeletingBoard(null);
  };

  const openEditBoard = (board: DemandBoard) => {
    setBoardForm({
      name: board.name,
      description: board.description || '',
      color: board.color || COLORS[0],
    });
    setEditingBoard(board);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2].map(i => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Quadros Kanban</h2>
          <p className="text-sm text-muted-foreground">
            Cada quadro representa um setor ou área de trabalho
          </p>
        </div>
        <Button onClick={() => {
          setBoardForm({ name: '', description: '', color: COLORS[0] });
          setShowCreateBoard(true);
        }}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Quadro
        </Button>
      </div>

      {boards?.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">Nenhum quadro criado ainda.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {boards?.map(board => (
            <Collapsible 
              key={board.id} 
              open={expandedBoards.has(board.id)}
              onOpenChange={() => toggleExpanded(board.id)}
            >
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {board.color && (
                        <div 
                          className="w-4 h-4 rounded-full" 
                          style={{ backgroundColor: board.color }} 
                        />
                      )}
                      <div>
                        <CardTitle className="text-base">{board.name}</CardTitle>
                        {board.description && (
                          <CardDescription>{board.description}</CardDescription>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => openEditBoard(board)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => setDeletingBoard(board)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="icon">
                          {expandedBoards.has(board.id) ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                    </div>
                  </div>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <BoardColumnsManager boardId={board.id} />
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
        </div>
      )}

      {/* Create/Edit Board Dialog */}
      <Dialog 
        open={showCreateBoard || !!editingBoard} 
        onOpenChange={(open) => {
          if (!open) {
            setShowCreateBoard(false);
            setEditingBoard(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingBoard ? 'Editar Quadro' : 'Novo Quadro'}
            </DialogTitle>
            <DialogDescription>
              {editingBoard ? 'Atualize as informações do quadro' : 'Crie um novo quadro Kanban para organizar demandas'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome do Quadro</Label>
              <Input
                value={boardForm.name}
                onChange={(e) => setBoardForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Comercial, Suporte, Marketing..."
              />
            </div>

            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Textarea
                value={boardForm.description}
                onChange={(e) => setBoardForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Descreva o propósito deste quadro..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    className={`w-8 h-8 rounded-full transition-transform ${
                      boardForm.color === color ? 'ring-2 ring-offset-2 ring-primary scale-110' : ''
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setBoardForm(prev => ({ ...prev, color }))}
                  />
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowCreateBoard(false);
                setEditingBoard(null);
              }}
            >
              Cancelar
            </Button>
            <Button 
              onClick={editingBoard ? handleUpdateBoard : handleCreateBoard}
              disabled={!boardForm.name.trim() || createBoard.isPending || updateBoard.isPending}
            >
              {editingBoard ? 'Salvar' : 'Criar Quadro'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Board Confirmation */}
      <AlertDialog open={!!deletingBoard} onOpenChange={() => setDeletingBoard(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Quadro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação excluirá o quadro "{deletingBoard?.name}" e todas as suas colunas e demandas. 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteBoard}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Columns Manager (nested component)
function BoardColumnsManager({ boardId }: { boardId: string }) {
  const { data: columns, isLoading } = useDemandColumns(boardId);
  const createColumn = useCreateDemandColumn();
  const updateColumn = useUpdateDemandColumn();
  const deleteColumn = useDeleteDemandColumn();

  const [editingColumn, setEditingColumn] = useState<DemandColumn | null>(null);
  const [showCreateColumn, setShowCreateColumn] = useState(false);
  const [columnForm, setColumnForm] = useState({ name: '', color: '', is_final: false });

  const handleCreateColumn = async () => {
    if (!columnForm.name.trim()) return;
    await createColumn.mutateAsync({
      board_id: boardId,
      name: columnForm.name,
      color: columnForm.color || undefined,
      is_final: columnForm.is_final,
    });
    setColumnForm({ name: '', color: '', is_final: false });
    setShowCreateColumn(false);
  };

  const handleUpdateColumn = async () => {
    if (!editingColumn || !columnForm.name.trim()) return;
    await updateColumn.mutateAsync({
      id: editingColumn.id,
      name: columnForm.name,
      color: columnForm.color || null,
      is_final: columnForm.is_final,
    });
    setEditingColumn(null);
  };

  const handleDeleteColumn = async (column: DemandColumn) => {
    await deleteColumn.mutateAsync({ id: column.id, boardId });
  };

  if (isLoading) {
    return <Skeleton className="h-20 w-full" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Colunas</Label>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => {
            setColumnForm({ name: '', color: '', is_final: false });
            setShowCreateColumn(true);
          }}
        >
          <Plus className="h-3 w-3 mr-1" />
          Coluna
        </Button>
      </div>

      {columns?.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          Nenhuma coluna criada. Adicione colunas como "A Fazer", "Em Andamento", "Concluído"...
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {columns?.map((column, index) => (
            <Badge 
              key={column.id} 
              variant="outline" 
              className="px-3 py-1.5 gap-2 cursor-pointer hover:bg-muted"
              style={{ borderColor: column.color || undefined }}
              onClick={() => {
                setColumnForm({
                  name: column.name,
                  color: column.color || '',
                  is_final: column.is_final,
                });
                setEditingColumn(column);
              }}
            >
              <GripVertical className="h-3 w-3 text-muted-foreground" />
              {column.color && (
                <div 
                  className="w-2 h-2 rounded-full" 
                  style={{ backgroundColor: column.color }} 
                />
              )}
              <span>{column.name}</span>
              {column.is_final && (
                <span className="text-xs text-muted-foreground">(Final)</span>
              )}
            </Badge>
          ))}
        </div>
      )}

      {/* Create/Edit Column Dialog */}
      <Dialog 
        open={showCreateColumn || !!editingColumn} 
        onOpenChange={(open) => {
          if (!open) {
            setShowCreateColumn(false);
            setEditingColumn(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingColumn ? 'Editar Coluna' : 'Nova Coluna'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome da Coluna</Label>
              <Input
                value={columnForm.name}
                onChange={(e) => setColumnForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: A Fazer, Em Andamento, Concluído..."
              />
            </div>

            <div className="space-y-2">
              <Label>Cor (opcional)</Label>
              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  className={`w-8 h-8 rounded-full border-2 border-dashed border-muted-foreground/50 ${
                    !columnForm.color ? 'ring-2 ring-offset-2 ring-primary' : ''
                  }`}
                  onClick={() => setColumnForm(prev => ({ ...prev, color: '' }))}
                />
                {COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    className={`w-8 h-8 rounded-full transition-transform ${
                      columnForm.color === color ? 'ring-2 ring-offset-2 ring-primary scale-110' : ''
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setColumnForm(prev => ({ ...prev, color }))}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={columnForm.is_final}
                onCheckedChange={(checked) => setColumnForm(prev => ({ ...prev, is_final: checked }))}
              />
              <div>
                <Label>Coluna Final</Label>
                <p className="text-xs text-muted-foreground">
                  Marque se esta coluna representa demandas concluídas
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            {editingColumn && (
              <Button 
                variant="destructive" 
                onClick={() => {
                  handleDeleteColumn(editingColumn);
                  setEditingColumn(null);
                }}
                className="mr-auto"
              >
                Excluir
              </Button>
            )}
            <Button 
              variant="outline" 
              onClick={() => {
                setShowCreateColumn(false);
                setEditingColumn(null);
              }}
            >
              Cancelar
            </Button>
            <Button 
              onClick={editingColumn ? handleUpdateColumn : handleCreateColumn}
              disabled={!columnForm.name.trim() || createColumn.isPending || updateColumn.isPending}
            >
              {editingColumn ? 'Salvar' : 'Criar Coluna'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
