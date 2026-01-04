import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Loader2, Pencil, X, Check } from 'lucide-react';
import { useStandardQuestions, CATEGORY_LABELS, type StandardQuestion } from '@/hooks/useStandardQuestions';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

type QuestionType = 'single_choice' | 'multiple_choice' | 'number' | 'imc_calculator';
type CategoryType = 'dores_articulares' | 'emagrecimento' | 'diabetes' | 'saude_geral';

const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: 'single_choice', label: 'Escolha Única' },
  { value: 'multiple_choice', label: 'Múltipla Escolha' },
  { value: 'number', label: 'Número' },
  { value: 'imc_calculator', label: 'Calculadora IMC' },
];

const CATEGORIES: { value: CategoryType; label: string }[] = [
  { value: 'dores_articulares', label: 'Dores Articulares' },
  { value: 'emagrecimento', label: 'Emagrecimento' },
  { value: 'diabetes', label: 'Diabetes' },
  { value: 'saude_geral', label: 'Saúde Geral' },
];

interface FormData {
  question_text: string;
  question_type: QuestionType;
  category: CategoryType;
  options: string[];
}

export function StandardQuestionsManager() {
  const { data: questions = [], isLoading } = useStandardQuestions();
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<StandardQuestion | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const [formData, setFormData] = useState<FormData>({
    question_text: '',
    question_type: 'single_choice',
    category: 'saude_geral',
    options: [],
  });

  const resetForm = () => {
    setFormData({
      question_text: '',
      question_type: 'single_choice',
      category: 'saude_geral',
      options: [],
    });
    setEditingQuestion(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (question: StandardQuestion) => {
    setEditingQuestion(question);
    setFormData({
      question_text: question.question_text,
      question_type: question.question_type as QuestionType,
      category: question.category as CategoryType,
      options: question.options?.map(o => o.option_text) || [],
    });
    setIsDialogOpen(true);
  };

  const handleAddOption = () => {
    setFormData(prev => ({
      ...prev,
      options: [...prev.options, '']
    }));
  };

  const handleUpdateOption = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      options: prev.options.map((o, i) => i === index ? value : o)
    }));
  };

  const handleRemoveOption = (index: number) => {
    setFormData(prev => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index)
    }));
  };

  const handleSave = async () => {
    if (!tenantId || !formData.question_text.trim()) return;

    const needsOptions = ['single_choice', 'multiple_choice'].includes(formData.question_type);
    if (needsOptions && formData.options.filter(o => o.trim()).length < 2) {
      toast.error('Adicione pelo menos 2 opções para perguntas de escolha');
      return;
    }

    setIsSaving(true);
    try {
      if (editingQuestion) {
        // Update existing question
        const { error: updateError } = await supabase
          .from('standard_questions')
          .update({
            question_text: formData.question_text,
            question_type: formData.question_type,
            category: formData.category,
          })
          .eq('id', editingQuestion.id);

        if (updateError) throw updateError;

        // Delete old options and insert new ones
        if (needsOptions) {
          await supabase
            .from('standard_question_options')
            .delete()
            .eq('question_id', editingQuestion.id);

          const optionsToInsert = formData.options
            .filter(o => o.trim())
            .map((text, index) => ({
              question_id: editingQuestion.id,
              option_text: text.trim(),
              position: index,
            }));

          if (optionsToInsert.length > 0) {
            const { error: optionsError } = await supabase
              .from('standard_question_options')
              .insert(optionsToInsert);

            if (optionsError) throw optionsError;
          }
        }

        toast.success('Pergunta atualizada!');
      } else {
        // Create new question
        const maxPosition = questions.length > 0 
          ? Math.max(...questions.map(q => q.position)) + 1 
          : 0;

        const { data: newQuestion, error: insertError } = await supabase
          .from('standard_questions')
          .insert([{
            organization_id: tenantId,
            question_text: formData.question_text,
            question_type: formData.question_type,
            category: formData.category,
            position: maxPosition,
            is_active: true,
            is_system: false,
          }])
          .select()
          .single();

        if (insertError) throw insertError;

        // Insert options if needed
        if (needsOptions && newQuestion) {
          const optionsToInsert = formData.options
            .filter(o => o.trim())
            .map((text, index) => ({
              question_id: newQuestion.id,
              option_text: text.trim(),
              position: index,
            }));

          if (optionsToInsert.length > 0) {
            const { error: optionsError } = await supabase
              .from('standard_question_options')
              .insert(optionsToInsert);

            if (optionsError) throw optionsError;
          }
        }

        toast.success('Pergunta criada!');
      }

      queryClient.invalidateQueries({ queryKey: ['standard-questions'] });
      setIsDialogOpen(false);
      resetForm();
    } catch (error: any) {
      console.error('Error saving question:', error);
      toast.error('Erro ao salvar pergunta');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (questionId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta pergunta?')) return;

    try {
      // Delete options first
      await supabase
        .from('standard_question_options')
        .delete()
        .eq('question_id', questionId);

      // Delete question
      const { error } = await supabase
        .from('standard_questions')
        .delete()
        .eq('id', questionId);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['standard-questions'] });
      toast.success('Pergunta excluída!');
    } catch (error) {
      console.error('Error deleting question:', error);
      toast.error('Erro ao excluir pergunta');
    }
  };

  // Group questions by category
  const groupedQuestions = questions.reduce((acc, q) => {
    if (!acc[q.category]) acc[q.category] = [];
    acc[q.category].push(q);
    return acc;
  }, {} as Record<string, StandardQuestion[]>);

  const needsOptions = ['single_choice', 'multiple_choice'].includes(formData.question_type);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Perguntas padrão podem ser adicionadas a produtos para coleta de informações do cliente.
        </p>
        <Button onClick={openCreateDialog} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Nova Pergunta
        </Button>
      </div>

      {questions.length === 0 ? (
        <div className="border border-dashed rounded-lg p-6 text-center">
          <p className="text-muted-foreground">Nenhuma pergunta padrão configurada</p>
        </div>
      ) : (
        <Accordion type="multiple" defaultValue={Object.keys(groupedQuestions)} className="space-y-2">
          {Object.entries(groupedQuestions).map(([category, catQuestions]) => (
            <AccordionItem key={category} value={category} className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{CATEGORY_LABELS[category] || category}</span>
                  <Badge variant="secondary">{catQuestions.length}</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 pb-2">
                  {catQuestions.map((question) => (
                    <div
                      key={question.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium">{question.question_text}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {QUESTION_TYPES.find(t => t.value === question.question_type)?.label || question.question_type}
                          </Badge>
                          {question.is_system && (
                            <Badge variant="secondary" className="text-xs">Sistema</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEditDialog(question)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        {!question.is_system && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(question.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingQuestion ? 'Editar Pergunta' : 'Nova Pergunta Padrão'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Pergunta *</label>
              <Textarea
                value={formData.question_text}
                onChange={(e) => setFormData(prev => ({ ...prev, question_text: e.target.value }))}
                placeholder="Digite a pergunta..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Tipo</label>
                <Select
                  value={formData.question_type}
                  onValueChange={(value: QuestionType) => setFormData(prev => ({ ...prev, question_type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {QUESTION_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Categoria</label>
                <Select
                  value={formData.category}
                  onValueChange={(value: CategoryType) => setFormData(prev => ({ ...prev, category: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {needsOptions && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Opções</label>
                <div className="space-y-2">
                  {formData.options.map((option, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        value={option}
                        onChange={(e) => handleUpdateOption(index, e.target.value)}
                        placeholder={`Opção ${index + 1}`}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveOption(index)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddOption}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar Opção
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              {editingQuestion ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
