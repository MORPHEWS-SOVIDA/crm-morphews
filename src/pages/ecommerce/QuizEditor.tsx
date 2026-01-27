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
import { useQuiz, useCreateQuizStep, useDeleteQuizStep, STEP_TYPE_LABELS, type QuizStepType } from '@/hooks/ecommerce/useQuizzes';
import { QuizStepEditor } from '@/components/ecommerce/quiz/QuizStepEditor';
import { QuizSettingsPanel } from '@/components/ecommerce/quiz/QuizSettingsPanel';
import { AffiliatesTab } from '@/components/ecommerce/affiliates/AffiliatesTab';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

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

export default function QuizEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState<'steps' | 'settings' | 'affiliates'>('steps');
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);

  const { data: quiz, isLoading, refetch } = useQuiz(id || '');
  const createStep = useCreateQuizStep();
  const deleteStep = useDeleteQuizStep();

  // Select first step by default
  useEffect(() => {
    if (quiz?.steps?.length && !selectedStepId) {
      setSelectedStepId(quiz.steps[0].id);
    }
  }, [quiz?.steps, selectedStepId]);

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
                        quiz.steps?.map((step, index) => (
                          <div
                            key={step.id}
                            className={cn(
                              "group flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors",
                              selectedStepId === step.id
                                ? "border-primary bg-primary/5"
                                : "hover:bg-muted/50"
                            )}
                            onClick={() => setSelectedStepId(step.id)}
                          >
                            <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
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
                                handleDeleteStep(step.id);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        ))
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
