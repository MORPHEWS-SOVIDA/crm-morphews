import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, GripVertical, Trash2, Settings, Eye, Users } from 'lucide-react';
import { useQuiz, useCreateQuizStep, useDeleteQuizStep, STEP_TYPE_LABELS, type QuizStep, type QuizStepType } from '@/hooks/ecommerce/useQuizzes';
import { QuizStepEditor } from './QuizStepEditor';
import { QuizSettingsPanel } from './QuizSettingsPanel';
import { AffiliatesTab } from '@/components/ecommerce/affiliates/AffiliatesTab';
import { cn } from '@/lib/utils';

interface QuizBuilderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quizId: string;
}

export function QuizBuilderDialog({ open, onOpenChange, quizId }: QuizBuilderDialogProps) {
  const [activeTab, setActiveTab] = useState<'steps' | 'settings' | 'affiliates'>('steps');
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);

  const { data: quiz, isLoading } = useQuiz(quizId);
  const createStep = useCreateQuizStep();
  const deleteStep = useDeleteQuizStep();

  const handleAddStep = async (type: QuizStepType) => {
    const position = (quiz?.steps?.length || 0);
    const step = await createStep.mutateAsync({
      quiz_id: quizId,
      step_type: type,
      title: `Nova ${STEP_TYPE_LABELS[type]}`,
      position,
    });
    setSelectedStepId(step.id);
  };

  const handleDeleteStep = async (stepId: string) => {
    await deleteStep.mutateAsync({ stepId, quizId });
    if (selectedStepId === stepId) {
      setSelectedStepId(null);
    }
  };

  const selectedStep = quiz?.steps?.find(s => s.id === selectedStepId);

  const stepTypeOptions: { type: QuizStepType; label: string; icon: string }[] = [
    { type: 'single_choice', label: 'Escolha Única', icon: '⭕' },
    { type: 'multiple_choice', label: 'Múltipla Escolha', icon: '☑️' },
    { type: 'text_input', label: 'Texto', icon: '📝' },
    { type: 'number_input', label: 'Número', icon: '🔢' },
    { type: 'lead_capture', label: 'Captura de Lead', icon: '📧' },
    { type: 'imc_calculator', label: 'Calculadora IMC', icon: '⚖️' },
    { type: 'info', label: 'Informativo', icon: 'ℹ️' },
    { type: 'result', label: 'Resultado', icon: '🎯' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle>
              {quiz?.name || 'Carregando...'}
            </DialogTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`/quiz/${quiz?.slug}`, '_blank')}
              >
                <Eye className="h-4 w-4 mr-2" />
                Visualizar
              </Button>
            </div>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'steps' | 'settings' | 'affiliates')} className="flex-1 flex flex-col">
            <TabsList className="mx-6 mt-2 w-fit">
              <TabsTrigger value="steps">Etapas</TabsTrigger>
              <TabsTrigger value="settings">
                <Settings className="h-4 w-4 mr-2" />
                Configurações
              </TabsTrigger>
              <TabsTrigger value="affiliates">
                <Users className="h-4 w-4 mr-2" />
                Afiliados
              </TabsTrigger>
            </TabsList>

            <TabsContent value="steps" className="flex-1 flex m-0 overflow-hidden">
              {/* Steps List */}
              <div className="w-72 border-r flex flex-col">
                <ScrollArea className="flex-1">
                  <div className="p-4 space-y-2">
                    {quiz?.steps?.map((step, index) => (
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
                    ))}
                  </div>
                </ScrollArea>

                {/* Add Step Menu */}
                <div className="p-4 border-t">
                  <div className="grid grid-cols-4 gap-2">
                    {stepTypeOptions.map(opt => (
                      <Button
                        key={opt.type}
                        variant="outline"
                        size="sm"
                        className="h-12 flex flex-col gap-0.5 text-xs"
                        onClick={() => handleAddStep(opt.type)}
                        title={opt.label}
                      >
                        <span className="text-base">{opt.icon}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Step Editor */}
              <div className="flex-1 overflow-hidden">
                {selectedStep ? (
                  <QuizStepEditor 
                    step={selectedStep} 
                    allSteps={quiz?.steps || []}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <Plus className="h-12 w-12 mx-auto mb-4 opacity-20" />
                      <p>Selecione uma etapa para editar</p>
                      <p className="text-sm">ou adicione uma nova abaixo</p>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="settings" className="flex-1 m-0 overflow-auto">
              {quiz && <QuizSettingsPanel quiz={quiz} />}
            </TabsContent>

            <TabsContent value="affiliates" className="flex-1 m-0 overflow-auto p-6">
              {quiz && (
                <AffiliatesTab
                  assetType="quiz"
                  assetId={quiz.id}
                  assetSlug={quiz.slug}
                />
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
