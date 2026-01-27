import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ArrowLeft, 
  Eye, 
  Plus,
  GripVertical,
  Trash2,
  Settings,
  Users,
  Loader2,
  ExternalLink,
  Save,
  RefreshCw,
} from 'lucide-react';
import { useQuiz, useCreateQuizStep, useDeleteQuizStep, useReorderQuizSteps, STEP_TYPE_LABELS, type QuizStepType, type QuizStep } from '@/hooks/ecommerce/useQuizzes';
import { QuizStepEditor } from '@/components/ecommerce/quiz/QuizStepEditor';
import { QuizSettingsPanel } from '@/components/ecommerce/quiz/QuizSettingsPanel';
import { AffiliatesTab } from '@/components/ecommerce/affiliates/AffiliatesTab';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const stepTypeOptions: { type: QuizStepType; label: string; icon: string; description: string }[] = [
  { type: 'single_choice', label: 'Escolha Única', icon: '⭕', description: 'Usuário seleciona 1 opção' },
  { type: 'multiple_choice', label: 'Múltipla Escolha', icon: '☑️', description: 'Usuário seleciona várias' },
  { type: 'text_input', label: 'Texto', icon: '📝', description: 'Campo de texto livre' },
  { type: 'number_input', label: 'Número', icon: '🔢', description: 'Campo numérico' },
  { type: 'lead_capture', label: 'Captura de Lead', icon: '📧', description: 'Nome, email, WhatsApp' },
  { type: 'imc_calculator', label: 'Calculadora IMC', icon: '⚖️', description: 'Peso e altura' },
  { type: 'info', label: 'Informativo', icon: 'ℹ️', description: 'Texto sem interação' },
  { type: 'result', label: 'Resultado', icon: '🎯', description: 'Tela final com CTA' },
];

// Sortable Step Item Component
interface SortableStepItemProps {
  step: QuizStep;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

function SortableStepItem({ step, index, isSelected, onSelect, onDelete }: SortableStepItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors",
        isSelected ? "border-primary bg-primary/5" : "hover:bg-muted/50",
        isDragging && "opacity-50 shadow-lg z-50"
      )}
      onClick={onSelect}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
            {index + 1}
          </span>
          <span className="text-sm font-medium truncate">
            {step.title}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          {STEP_TYPE_LABELS[step.step_type]}
        </span>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 opacity-0 group-hover:opacity-100"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
      >
        <Trash2 className="h-3.5 w-3.5 text-destructive" />
      </Button>
    </div>
  );
}

export default function QuizEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState<'steps' | 'settings' | 'affiliates'>('steps');
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);

  const { data: quiz, isLoading, refetch } = useQuiz(id || '');
  const createStep = useCreateQuizStep();
  const deleteStep = useDeleteQuizStep();
  const reorderSteps = useReorderQuizSteps();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Select first step by default
  useEffect(() => {
    if (quiz?.steps?.length && !selectedStepId) {
      setSelectedStepId(quiz.steps[0].id);
    }
  }, [quiz?.steps, selectedStepId]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !quiz?.steps || !id) return;

    const oldIndex = quiz.steps.findIndex((s) => s.id === active.id);
    const newIndex = quiz.steps.findIndex((s) => s.id === over.id);
    const newOrder = arrayMove(quiz.steps, oldIndex, newIndex);
    
    reorderSteps.mutate({ 
      quizId: id, 
      orderedIds: newOrder.map((s) => s.id) 
    });
  };

  const handleAddStep = async (type: QuizStepType) => {
    if (!id) return;
    const position = (quiz?.steps?.length || 0);
    try {
      const step = await createStep.mutateAsync({
        quiz_id: id,
        step_type: type,
        title: `Nova ${STEP_TYPE_LABELS[type]}`,
        position,
      });
      setSelectedStepId(step.id);
      toast.success('Etapa adicionada!');
    } catch (error) {
      toast.error('Erro ao adicionar etapa');
    }
  };

  const handleDeleteStep = async (stepId: string) => {
    if (!id) return;
    try {
      await deleteStep.mutateAsync({ stepId, quizId: id });
      if (selectedStepId === stepId) {
        const remaining = quiz?.steps?.filter(s => s.id !== stepId);
        setSelectedStepId(remaining?.[0]?.id || null);
      }
      toast.success('Etapa removida');
    } catch (error) {
      toast.error('Erro ao remover etapa');
    }
  };

  const selectedStep = quiz?.steps?.find(s => s.id === selectedStepId);
  const previewUrl = quiz ? `${window.location.origin}/quiz/${quiz.slug}` : '';

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  if (!quiz) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Quiz não encontrado</p>
          <Button onClick={() => navigate('/ecommerce/quiz')} className="mt-4">
            Voltar
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-4 h-[calc(100vh-120px)]">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate('/ecommerce/quiz')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold">{quiz.name}</h1>
                <Badge variant={quiz.is_active ? "default" : "secondary"}>
                  {quiz.is_active ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                /quiz/{quiz.slug}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              onClick={() => window.open(previewUrl, '_blank')}
              className="gap-2"
            >
              <Eye className="h-4 w-4" />
              Visualizar
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 h-full">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'steps' | 'settings' | 'affiliates')} className="h-full flex flex-col">
            <TabsList className="w-fit">
              <TabsTrigger value="steps">Etapas</TabsTrigger>
              <TabsTrigger value="settings" className="gap-1">
                <Settings className="h-4 w-4" />
                Configurações
              </TabsTrigger>
              <TabsTrigger value="affiliates" className="gap-1">
                <Users className="h-4 w-4" />
                Afiliados
              </TabsTrigger>
            </TabsList>

            <TabsContent value="steps" className="flex-1 mt-4">
              <div className="flex gap-6 h-[calc(100vh-280px)]">
                {/* Steps Sidebar */}
                <Card className="w-80 flex flex-col">
                  <ScrollArea className="flex-1">
                    <div className="p-4 space-y-2">
                      {quiz.steps?.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <Plus className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">Nenhuma etapa ainda</p>
                          <p className="text-xs">Adicione a primeira etapa abaixo</p>
                        </div>
                      ) : (
                        <DndContext
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragEnd={handleDragEnd}
                        >
                          <SortableContext
                            items={quiz.steps?.map((s) => s.id) || []}
                            strategy={verticalListSortingStrategy}
                          >
                            {quiz.steps?.map((step, index) => (
                              <SortableStepItem
                                key={step.id}
                                step={step}
                                index={index}
                                isSelected={selectedStepId === step.id}
                                onSelect={() => setSelectedStepId(step.id)}
                                onDelete={() => handleDeleteStep(step.id)}
                              />
                            ))}
                          </SortableContext>
                        </DndContext>
                      )}
                    </div>
                  </ScrollArea>

                  {/* Add Step Menu */}
                  <div className="p-4 border-t">
                    <p className="text-xs text-muted-foreground mb-2 font-medium">Adicionar etapa:</p>
                    <div className="grid grid-cols-4 gap-2">
                      {stepTypeOptions.map(opt => (
                        <Button
                          key={opt.type}
                          variant="outline"
                          size="sm"
                          className="h-12 flex flex-col gap-0.5 text-xs p-1"
                          onClick={() => handleAddStep(opt.type)}
                          title={`${opt.label}: ${opt.description}`}
                          disabled={createStep.isPending}
                        >
                          <span className="text-lg">{opt.icon}</span>
                        </Button>
                      ))}
                    </div>
                  </div>
                </Card>

                {/* Step Editor */}
                <Card className="flex-1 overflow-hidden">
                  {selectedStep ? (
                    <ScrollArea className="h-full">
                      <QuizStepEditor 
                        step={selectedStep} 
                        allSteps={quiz.steps || []}
                      />
                    </ScrollArea>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      <div className="text-center">
                        <Plus className="h-12 w-12 mx-auto mb-4 opacity-20" />
                        <p>Selecione uma etapa para editar</p>
                        <p className="text-sm">ou adicione uma nova na barra lateral</p>
                      </div>
                    </div>
                  )}
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="settings" className="flex-1 mt-4 overflow-auto">
              <QuizSettingsPanel quiz={quiz} />
            </TabsContent>

            <TabsContent value="affiliates" className="flex-1 mt-4 overflow-auto">
              <AffiliatesTab
                assetType="quiz"
                assetId={quiz.id}
                assetSlug={quiz.slug}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Layout>
  );
}
