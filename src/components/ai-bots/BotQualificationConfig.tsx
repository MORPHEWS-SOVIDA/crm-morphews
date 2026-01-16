import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ClipboardList, GripVertical, Plus, Trash2 } from "lucide-react";
import { useStandardQuestions, CATEGORY_LABELS } from "@/hooks/useStandardQuestions";
import { cn } from "@/lib/utils";

interface InitialQuestion {
  questionId: string;
  questionText: string;
  questionType: string;
  position: number;
}

interface BotQualificationConfigProps {
  botId: string;
  enabled: boolean;
  initialQuestions: InitialQuestion[];
  onEnabledChange: (enabled: boolean) => void;
  onQuestionsChange: (questions: InitialQuestion[]) => void;
}

export function BotQualificationConfig({
  botId,
  enabled,
  initialQuestions,
  onEnabledChange,
  onQuestionsChange,
}: BotQualificationConfigProps) {
  const { data: standardQuestions = [], isLoading } = useStandardQuestions();
  const [selectedQuestions, setSelectedQuestions] = useState<InitialQuestion[]>(initialQuestions);
  const [showSelector, setShowSelector] = useState(false);

  // Sync with parent when initialQuestions changes
  useEffect(() => {
    setSelectedQuestions(initialQuestions);
  }, [initialQuestions]);

  // Group standard questions by category
  const questionsByCategory = standardQuestions.reduce((acc, q) => {
    const category = q.category || 'outros';
    if (!acc[category]) acc[category] = [];
    acc[category].push(q);
    return acc;
  }, {} as Record<string, typeof standardQuestions>);

  const selectedIds = new Set(selectedQuestions.map(q => q.questionId));

  const handleToggleQuestion = (question: typeof standardQuestions[0]) => {
    if (selectedIds.has(question.id)) {
      // Remove
      const updated = selectedQuestions.filter(q => q.questionId !== question.id);
      setSelectedQuestions(updated);
      onQuestionsChange(updated);
    } else {
      // Add
      const newQuestion: InitialQuestion = {
        questionId: question.id,
        questionText: question.question_text,
        questionType: question.question_type,
        position: selectedQuestions.length + 1,
      };
      const updated = [...selectedQuestions, newQuestion];
      setSelectedQuestions(updated);
      onQuestionsChange(updated);
    }
  };

  const handleRemoveQuestion = (questionId: string) => {
    const updated = selectedQuestions
      .filter(q => q.questionId !== questionId)
      .map((q, idx) => ({ ...q, position: idx + 1 }));
    setSelectedQuestions(updated);
    onQuestionsChange(updated);
  };

  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === selectedQuestions.length - 1) return;

    const newQuestions = [...selectedQuestions];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newQuestions[index], newQuestions[targetIndex]] = [newQuestions[targetIndex], newQuestions[index]];
    
    const updated = newQuestions.map((q, idx) => ({ ...q, position: idx + 1 }));
    setSelectedQuestions(updated);
    onQuestionsChange(updated);
  };

  const getQuestionTypeLabel = (type: string) => {
    switch (type) {
      case 'multiple_choice': return 'Múltipla Escolha';
      case 'single_choice': return 'Escolha Única';
      case 'number': return 'Número';
      case 'text': return 'Texto';
      case 'imc_calculator': return 'Calculadora IMC';
      default: return type;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-primary" />
          Qualificação Inicial
        </CardTitle>
        <CardDescription>
          Configure perguntas que o robô fará automaticamente para qualificar o lead
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Toggle */}
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div>
            <Label className="font-medium">Ativar Qualificação</Label>
            <p className="text-sm text-muted-foreground">
              O robô fará perguntas antes de prosseguir com o atendimento
            </p>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={onEnabledChange}
          />
        </div>

        {enabled && (
          <>
            {/* Selected Questions List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">
                  Perguntas Selecionadas ({selectedQuestions.length})
                </Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSelector(!showSelector)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar
                </Button>
              </div>

              {selectedQuestions.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm border border-dashed rounded-lg">
                  Nenhuma pergunta selecionada
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedQuestions.map((q, idx) => (
                    <div
                      key={q.questionId}
                      className="flex items-center gap-2 p-3 border rounded-lg bg-background"
                    >
                      <div className="flex flex-col gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          onClick={() => moveQuestion(idx, 'up')}
                          disabled={idx === 0}
                        >
                          ▲
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          onClick={() => moveQuestion(idx, 'down')}
                          disabled={idx === selectedQuestions.length - 1}
                        >
                          ▼
                        </Button>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{q.questionText}</p>
                        <Badge variant="secondary" className="text-xs">
                          {getQuestionTypeLabel(q.questionType)}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveQuestion(q.questionId)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Question Selector */}
            {showSelector && (
              <Card className="border-primary/50">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">Selecionar Perguntas Sovida</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <ScrollArea className="h-[300px] pr-4">
                    {isLoading ? (
                      <div className="text-center py-4 text-muted-foreground">
                        Carregando perguntas...
                      </div>
                    ) : (
                      Object.entries(questionsByCategory).map(([category, questions]) => (
                        <div key={category} className="mb-4">
                          <h4 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
                            {CATEGORY_LABELS[category] || category}
                          </h4>
                          <div className="space-y-2">
                            {questions.map((question) => {
                              const isSelected = selectedIds.has(question.id);
                              return (
                                <div
                                  key={question.id}
                                  onClick={() => handleToggleQuestion(question)}
                                  className={cn(
                                    "flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-all",
                                    isSelected 
                                      ? "border-primary bg-primary/5" 
                                      : "hover:border-muted-foreground"
                                  )}
                                >
                                  <Checkbox checked={isSelected} />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm">{question.question_text}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                      <Badge variant="outline" className="text-xs">
                                        {getQuestionTypeLabel(question.question_type)}
                                      </Badge>
                                      {question.options && question.options.length > 0 && (
                                        <span className="text-xs text-muted-foreground">
                                          {question.options.length} opções
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))
                    )}
                  </ScrollArea>
                  <div className="pt-3 border-t mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => setShowSelector(false)}
                    >
                      Fechar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Info */}
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-sm text-blue-700 dark:text-blue-300">
              💡 O robô fará essas perguntas em ordem e salvará as respostas no cadastro do lead automaticamente.
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
