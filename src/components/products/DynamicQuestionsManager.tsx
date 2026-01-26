import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Trash2, GripVertical, List, PenLine, Bot } from 'lucide-react';
import { useStandardQuestions, CATEGORY_LABELS, type StandardQuestion } from '@/hooks/useStandardQuestions';
import { useOrgFeatures } from '@/hooks/usePlanFeatures';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

export interface DynamicQuestion {
  id?: string;
  question_text: string;
  position: number;
  is_standard?: boolean;
  standard_question_id?: string;
}

interface DynamicQuestionsManagerProps {
  questions: DynamicQuestion[];
  onChange: (questions: DynamicQuestion[]) => void;
}

function StandardQuestionAnswerPreview({ question }: { question?: StandardQuestion }) {
  if (!question) return null;

  const options = (question.options || []).slice().sort((a, b) => a.position - b.position);

  if (question.question_type === 'multiple_choice') {
    if (options.length === 0) {
      return <p className="text-xs text-muted-foreground">Sem opções cadastradas.</p>;
    }

    return (
      <div className="space-y-2">
        {options.map((opt) => (
          <div key={opt.id} className="flex items-center gap-2">
            <Checkbox checked={false} disabled />
            <span className="text-sm">{opt.option_text}</span>
          </div>
        ))}
      </div>
    );
  }

  if (question.question_type === 'single_choice') {
    if (options.length === 0) {
      return <p className="text-xs text-muted-foreground">Sem opções cadastradas.</p>;
    }

    return (
      <RadioGroup value="" className="space-y-2">
        {options.map((opt) => (
          <div key={opt.id} className="flex items-center gap-2">
            <RadioGroupItem value={opt.id} disabled />
            <Label className="text-sm font-normal">{opt.option_text}</Label>
          </div>
        ))}
      </RadioGroup>
    );
  }

  if (question.question_type === 'number') {
    return <Input disabled inputMode="numeric" placeholder="Digite um número..." />;
  }

  if (question.question_type === 'text') {
    return <Textarea disabled rows={2} className="resize-none" placeholder="Digite a resposta..." />;
  }

  // imc_calculator
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
      <Input disabled inputMode="numeric" placeholder="Peso (kg)" />
      <Input disabled inputMode="numeric" placeholder="Altura (cm)" />
      <Input disabled inputMode="numeric" placeholder="Idade" />
    </div>
  );
}

export function DynamicQuestionsManager({ questions, onChange }: DynamicQuestionsManagerProps) {
  const [showStandardDialog, setShowStandardDialog] = useState(false);
  const [selectedStandardIds, setSelectedStandardIds] = useState<string[]>([]);
  const { data: standardQuestions = [], isLoading } = useStandardQuestions();
  const { data: orgFeatures } = useOrgFeatures();
  
  // Only show standard questions button if org has the feature enabled
  const showStandardQuestionsOption = orgFeatures?.standard_questions !== false;

  const standardById = useMemo(() => {
    const map = new Map<string, StandardQuestion>();
    for (const q of standardQuestions) map.set(q.id, q);
    return map;
  }, [standardQuestions]);

  const addCustomQuestion = () => {
    const newPosition = questions.length;
    onChange([...questions, { question_text: '', position: newPosition, is_standard: false }]);
  };

  const openStandardDialog = () => {
    // Pre-select already added standard questions
    const alreadyAdded = questions
      .filter((q) => q.is_standard && q.standard_question_id)
      .map((q) => q.standard_question_id!);
    setSelectedStandardIds(alreadyAdded);
    setShowStandardDialog(true);
  };

  const handleToggleStandard = (id: string) => {
    setSelectedStandardIds((prev) => (prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id]));
  };

  const handleConfirmStandard = () => {
    // Remove old standard questions that are no longer selected
    const customQuestions = questions.filter((q) => !q.is_standard);

    // Add selected standard questions
    const newStandardQuestions: DynamicQuestion[] = selectedStandardIds.map((sid, index) => {
      const sq = standardById.get(sid);
      return {
        question_text: sq?.question_text || '',
        position: customQuestions.length + index,
        is_standard: true,
        standard_question_id: sid,
      };
    });

    // Merge: custom first, then standard
    const merged = [...customQuestions, ...newStandardQuestions].map((q, i) => ({ ...q, position: i }));

    onChange(merged);
    setShowStandardDialog(false);
  };

  const updateQuestion = (index: number, text: string) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], question_text: text };
    onChange(updated);
  };

  const removeQuestion = (index: number) => {
    const updated = questions.filter((_, i) => i !== index);
    onChange(updated.map((q, i) => ({ ...q, position: i })));
  };

  const moveQuestion = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= questions.length) return;

    const updated = [...questions];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    onChange(updated.map((q, i) => ({ ...q, position: i })));
  };

  // Group standard questions by category
  const groupedStandard = standardQuestions.reduce((acc, q) => {
    if (!acc[q.category]) acc[q.category] = [];
    acc[q.category].push(q);
    return acc;
  }, {} as Record<string, typeof standardQuestions>);

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 text-sm text-muted-foreground">
        <Bot className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <p>
          Perguntas que o <strong>Robô IA</strong> fará ao cliente durante a negociação deste produto. 
          As respostas serão salvas no cadastro do lead.
        </p>
      </div>

      {questions.length === 0 ? (
        <div className="border border-dashed rounded-lg p-6 text-center space-y-3">
          <p className="text-muted-foreground">Nenhuma pergunta cadastrada</p>
          <div className="flex flex-wrap justify-center gap-2">
            {showStandardQuestionsOption && (
              <Button type="button" variant="outline" size="sm" onClick={openStandardDialog}>
                <List className="w-4 h-4 mr-2" />
                Selecionar Perguntas Padrão
              </Button>
            )}
            <Button type="button" variant="outline" size="sm" onClick={addCustomQuestion}>
              <PenLine className="w-4 h-4 mr-2" />
              Criar Pergunta para o Robô
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {questions.map((question, index) => {
            const sq = question.is_standard && question.standard_question_id
              ? standardById.get(question.standard_question_id)
              : undefined;

            return (
              <div key={question.id || `q-${index}`} className="flex gap-2 items-start">
                <div className="flex flex-col gap-1 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 cursor-grab"
                    onClick={() => moveQuestion(index, index - 1)}
                    disabled={index === 0}
                  >
                    <GripVertical className="w-4 h-4 text-muted-foreground" />
                  </Button>
                </div>

                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground">Pergunta {index + 1}</span>
                    {question.is_standard && (
                      <Badge variant="secondary" className="text-xs">
                        Padrão
                      </Badge>
                    )}
                  </div>

                  {question.is_standard ? (
                    <div className="p-3 bg-muted/50 rounded-md space-y-3">
                      <div className="text-sm">{sq?.question_text || question.question_text}</div>
                      <StandardQuestionAnswerPreview question={sq} />
                    </div>
                  ) : (
                    <Textarea
                      value={question.question_text}
                      onChange={(e) => updateQuestion(index, e.target.value)}
                      placeholder="Digite a pergunta..."
                      rows={2}
                      className="resize-none"
                    />
                  )}
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive mt-6"
                  onClick={() => removeQuestion(index)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {questions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {showStandardQuestionsOption && (
            <Button type="button" variant="outline" size="sm" onClick={openStandardDialog}>
              <List className="w-4 h-4 mr-2" />
              Perguntas Padrão
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" onClick={addCustomQuestion}>
            <PenLine className="w-4 h-4 mr-2" />
            Nova Pergunta
          </Button>
        </div>
      )}

      {/* Dialog for selecting standard questions */}
      <Dialog open={showStandardDialog} onOpenChange={setShowStandardDialog}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Selecionar Perguntas Padrão</DialogTitle>
          </DialogHeader>

          {isLoading ? (
            <p className="text-muted-foreground text-center py-4">Carregando...</p>
          ) : standardQuestions.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              Nenhuma pergunta padrão configurada. Acesse Configurações para criar.
            </p>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedStandard).map(([category, catQuestions]) => (
                <div key={category}>
                  <h4 className="font-medium text-sm mb-2">{CATEGORY_LABELS[category] || category}</h4>
                  <div className="space-y-2">
                    {catQuestions.map((sq) => (
                      <div
                        key={sq.id}
                        className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                        onClick={() => handleToggleStandard(sq.id)}
                      >
                        <Checkbox
                          checked={selectedStandardIds.includes(sq.id)}
                          onCheckedChange={() => handleToggleStandard(sq.id)}
                        />
                        <div className="space-y-2">
                          <span className="text-sm">{sq.question_text}</span>
                          <StandardQuestionAnswerPreview question={sq} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowStandardDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmStandard}>Confirmar ({selectedStandardIds.length})</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

