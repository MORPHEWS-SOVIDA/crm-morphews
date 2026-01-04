import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, GripVertical } from 'lucide-react';

export interface DynamicQuestion {
  id?: string;
  question_text: string;
  position: number;
}

interface DynamicQuestionsManagerProps {
  questions: DynamicQuestion[];
  onChange: (questions: DynamicQuestion[]) => void;
}

export function DynamicQuestionsManager({ questions, onChange }: DynamicQuestionsManagerProps) {
  const addQuestion = () => {
    const newPosition = questions.length;
    onChange([
      ...questions,
      { question_text: '', position: newPosition }
    ]);
  };

  const updateQuestion = (index: number, text: string) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], question_text: text };
    onChange(updated);
  };

  const removeQuestion = (index: number) => {
    const updated = questions.filter((_, i) => i !== index);
    // Reorder positions
    onChange(updated.map((q, i) => ({ ...q, position: i })));
  };

  const moveQuestion = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= questions.length) return;
    
    const updated = [...questions];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    // Reorder positions
    onChange(updated.map((q, i) => ({ ...q, position: i })));
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Adicione perguntas que serão respondidas sobre o cliente ao negociar este produto.
      </p>

      {questions.length === 0 ? (
        <div className="border border-dashed rounded-lg p-6 text-center">
          <p className="text-muted-foreground mb-3">Nenhuma pergunta cadastrada</p>
          <Button type="button" variant="outline" size="sm" onClick={addQuestion}>
            <Plus className="w-4 h-4 mr-2" />
            Adicionar primeira pergunta
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {questions.map((question, index) => (
            <div key={question.id || index} className="flex gap-2 items-start">
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
                  <span className="text-sm font-medium text-muted-foreground">
                    Pergunta {index + 1}
                  </span>
                </div>
                <Textarea
                  value={question.question_text}
                  onChange={(e) => updateQuestion(index, e.target.value)}
                  placeholder="Digite a pergunta..."
                  rows={2}
                  className="resize-none"
                />
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
          ))}
        </div>
      )}

      {questions.length > 0 && (
        <Button type="button" variant="outline" size="sm" onClick={addQuestion}>
          <Plus className="w-4 h-4 mr-2" />
          Adicionar pergunta
        </Button>
      )}
    </div>
  );
}
