import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Plus, GripVertical, Pencil, Trash2, Loader2, ClipboardList } from 'lucide-react';
import {
  usePostSaleQuestions,
  useCreatePostSaleQuestion,
  useUpdatePostSaleQuestion,
  useDeletePostSaleQuestion,
  useReorderPostSaleQuestions,
  questionTypeLabels,
  type QuestionType,
  type PostSaleQuestion,
} from '@/hooks/usePostSaleQuestions';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';

interface SortableQuestionItemProps {
  question: PostSaleQuestion;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
  isUpdating: boolean;
}

function SortableQuestionItem({ question, onEdit, onDelete, onToggleActive, isUpdating }: SortableQuestionItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: question.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 p-4 bg-card border rounded-lg",
        isDragging && "opacity-50 shadow-lg"
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
      >
        <GripVertical className="w-5 h-5" />
      </button>

      <div className="flex-1 min-w-0">
        <p className={cn("font-medium", !question.is_active && "text-muted-foreground line-through")}>
          {question.question}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="secondary" className="text-xs">
            {questionTypeLabels[question.question_type]}
          </Badge>
          {question.is_required && (
            <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
              Obrigatória
            </Badge>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Switch
          checked={question.is_active}
          onCheckedChange={onToggleActive}
          disabled={isUpdating}
        />
        <Button variant="ghost" size="icon" onClick={onEdit}>
          <Pencil className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onDelete} className="text-destructive hover:text-destructive">
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

export function PostSaleQuestionsTab() {
  const { data: questions = [], isLoading } = usePostSaleQuestions();
  const createQuestion = useCreatePostSaleQuestion();
  const updateQuestion = useUpdatePostSaleQuestion();
  const deleteQuestion = useDeletePostSaleQuestion();
  const reorderQuestions = useReorderPostSaleQuestions();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<PostSaleQuestion | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form state
  const [formQuestion, setFormQuestion] = useState('');
  const [formType, setFormType] = useState<QuestionType>('yes_no');
  const [formRequired, setFormRequired] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: any) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      const oldIndex = questions.findIndex((q) => q.id === active.id);
      const newIndex = questions.findIndex((q) => q.id === over.id);
      const newOrder = arrayMove(questions, oldIndex, newIndex);
      reorderQuestions.mutate(newOrder.map((q) => q.id));
    }
  };

  const openCreateDialog = () => {
    setEditingQuestion(null);
    setFormQuestion('');
    setFormType('yes_no');
    setFormRequired(false);
    setIsDialogOpen(true);
  };

  const openEditDialog = (question: PostSaleQuestion) => {
    setEditingQuestion(question);
    setFormQuestion(question.question);
    setFormType(question.question_type);
    setFormRequired(question.is_required);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formQuestion.trim()) return;

    if (editingQuestion) {
      await updateQuestion.mutateAsync({
        id: editingQuestion.id,
        question: formQuestion,
        question_type: formType,
        is_required: formRequired,
      });
    } else {
      await createQuestion.mutateAsync({
        question: formQuestion,
        question_type: formType,
        is_required: formRequired,
      });
    }

    setIsDialogOpen(false);
  };

  const handleDelete = async () => {
    if (deleteConfirmId) {
      await deleteQuestion.mutateAsync(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-primary" />
                Perguntas do Pós-Venda
              </CardTitle>
              <CardDescription>
                Configure as perguntas que serão feitas aos clientes após a entrega. Arraste para reordenar.
              </CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreateDialog}>
                  <Plus className="w-4 h-4 mr-2" />
                  Nova Pergunta
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingQuestion ? 'Editar Pergunta' : 'Nova Pergunta'}</DialogTitle>
                  <DialogDescription>
                    Configure a pergunta que será exibida na pesquisa de pós-venda.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="question">Pergunta</Label>
                    <Input
                      id="question"
                      value={formQuestion}
                      onChange={(e) => setFormQuestion(e.target.value)}
                      placeholder="Ex: Recebeu seu pedido em boas condições?"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="type">Tipo de Resposta</Label>
                    <Select value={formType} onValueChange={(v) => setFormType(v as QuestionType)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes_no">Sim / Não</SelectItem>
                        <SelectItem value="rating_0_10">Nota (0-10)</SelectItem>
                        <SelectItem value="text">Texto livre</SelectItem>
                        <SelectItem value="medication">Medicação contínua (com autocomplete)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      id="required"
                      checked={formRequired}
                      onCheckedChange={setFormRequired}
                    />
                    <Label htmlFor="required">Resposta obrigatória</Label>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={!formQuestion.trim() || createQuestion.isPending || updateQuestion.isPending}
                  >
                    {(createQuestion.isPending || updateQuestion.isPending) && (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    )}
                    Salvar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {questions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ClipboardList className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">Nenhuma pergunta configurada</p>
              <p className="text-sm">Adicione perguntas para começar a coletar feedback dos clientes.</p>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={questions.map((q) => q.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {questions.map((question) => (
                    <SortableQuestionItem
                      key={question.id}
                      question={question}
                      onEdit={() => openEditDialog(question)}
                      onDelete={() => setDeleteConfirmId(question.id)}
                      onToggleActive={() =>
                        updateQuestion.mutate({
                          id: question.id,
                          is_active: !question.is_active,
                        })
                      }
                      isUpdating={updateQuestion.isPending}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover pergunta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. As respostas existentes para esta pergunta serão mantidas no histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
