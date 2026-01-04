import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ClipboardList, Save, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import {
  useStandardQuestions,
  useLeadStandardAnswers,
  useUpsertLeadStandardAnswers,
  StandardQuestion,
  LeadStandardQuestionAnswer,
  CATEGORY_LABELS
} from '@/hooks/useStandardQuestions';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface LeadStandardQuestionsSectionProps {
  leadId: string;
}

interface AnswerState {
  [questionId: string]: {
    selectedOptionIds?: string[];
    numericValue?: number;
    imcWeight?: number;
    imcHeight?: number;
    imcAge?: number;
  };
}

function calculateIMC(weight: number, heightCm: number): { imc: number; category: string } {
  const heightM = heightCm / 100;
  const imc = weight / (heightM * heightM);
  
  let category = '';
  if (imc < 18.5) category = 'Abaixo do peso';
  else if (imc < 25) category = 'Peso normal';
  else if (imc < 30) category = 'Sobrepeso';
  else if (imc < 35) category = 'Obesidade grau I';
  else if (imc < 40) category = 'Obesidade grau II';
  else category = 'Obesidade grau III';
  
  return { imc: Math.round(imc * 10) / 10, category };
}

export function LeadStandardQuestionsSection({ leadId }: LeadStandardQuestionsSectionProps) {
  const { data: questions, isLoading: isLoadingQuestions } = useStandardQuestions();
  const { data: existingAnswers, isLoading: isLoadingAnswers } = useLeadStandardAnswers(leadId);
  const { mutate: saveAnswers, isPending: isSaving } = useUpsertLeadStandardAnswers();
  
  const [answers, setAnswers] = useState<AnswerState>({});
  const [isOpen, setIsOpen] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('');

  // Group questions by category
  const questionsByCategory = useMemo(() => {
    if (!questions) return {};
    
    return questions.reduce((acc, q) => {
      if (!acc[q.category]) acc[q.category] = [];
      acc[q.category].push(q);
      return acc;
    }, {} as Record<string, StandardQuestion[]>);
  }, [questions]);

  const categories = Object.keys(questionsByCategory);

  // Set initial active category
  useEffect(() => {
    if (categories.length > 0 && !activeCategory) {
      setActiveCategory(categories[0]);
    }
  }, [categories, activeCategory]);

  // Initialize answers from existing data
  useEffect(() => {
    if (existingAnswers && existingAnswers.length > 0) {
      const initialAnswers: AnswerState = {};
      existingAnswers.forEach(answer => {
        initialAnswers[answer.question_id] = {
          selectedOptionIds: answer.selected_option_ids || undefined,
          numericValue: answer.numeric_value ?? undefined,
          imcWeight: answer.imc_weight ?? undefined,
          imcHeight: answer.imc_height ?? undefined,
          imcAge: answer.imc_age ?? undefined
        };
      });
      setAnswers(initialAnswers);
    }
  }, [existingAnswers]);

  // Count answered questions per category
  const answeredCountByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    
    Object.entries(questionsByCategory).forEach(([category, qs]) => {
      counts[category] = qs.filter(q => {
        const answer = answers[q.id];
        if (!answer) return false;
        
        if (q.question_type === 'imc_calculator') {
          return answer.imcWeight && answer.imcHeight && answer.imcAge;
        }
        if (q.question_type === 'number') {
          return answer.numericValue !== undefined;
        }
        return answer.selectedOptionIds && answer.selectedOptionIds.length > 0;
      }).length;
    });
    
    return counts;
  }, [questionsByCategory, answers]);

  const handleOptionToggle = (questionId: string, optionId: string, isMultiple: boolean) => {
    setAnswers(prev => {
      const current = prev[questionId]?.selectedOptionIds || [];
      
      if (isMultiple) {
        const newSelected = current.includes(optionId)
          ? current.filter(id => id !== optionId)
          : [...current, optionId];
        return { ...prev, [questionId]: { ...prev[questionId], selectedOptionIds: newSelected } };
      } else {
        return { ...prev, [questionId]: { ...prev[questionId], selectedOptionIds: [optionId] } };
      }
    });
  };

  const handleNumericChange = (questionId: string, value: number | undefined) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: { ...prev[questionId], numericValue: value }
    }));
  };

  const handleIMCChange = (questionId: string, field: 'imcWeight' | 'imcHeight' | 'imcAge', value: number | undefined) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: { ...prev[questionId], [field]: value }
    }));
  };

  const handleSave = () => {
    const answersToSave = Object.entries(answers)
      .filter(([_, answer]) => {
        return (answer.selectedOptionIds && answer.selectedOptionIds.length > 0) ||
               answer.numericValue !== undefined ||
               (answer.imcWeight && answer.imcHeight && answer.imcAge);
      })
      .map(([questionId, answer]) => {
        let imcResult: number | undefined;
        let imcCategory: string | undefined;
        
        if (answer.imcWeight && answer.imcHeight) {
          const result = calculateIMC(answer.imcWeight, answer.imcHeight);
          imcResult = result.imc;
          imcCategory = result.category;
        }
        
        return {
          questionId,
          selectedOptionIds: answer.selectedOptionIds,
          numericValue: answer.numericValue,
          imcWeight: answer.imcWeight,
          imcHeight: answer.imcHeight,
          imcAge: answer.imcAge,
          imcResult,
          imcCategory
        };
      });

    if (answersToSave.length === 0) {
      toast.info('Nenhuma resposta para salvar');
      return;
    }

    saveAnswers({ leadId, answers: answersToSave });
  };

  if (isLoadingQuestions || isLoadingAnswers) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!questions || questions.length === 0) {
    return null;
  }

  const renderQuestion = (question: StandardQuestion) => {
    const answer = answers[question.id];
    
    if (question.question_type === 'imc_calculator') {
      const imcResult = answer?.imcWeight && answer?.imcHeight
        ? calculateIMC(answer.imcWeight, answer.imcHeight)
        : null;

      return (
        <div key={question.id} className="space-y-3 p-4 border rounded-lg bg-muted/20">
          <Label className="font-medium">{question.question_text}</Label>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Peso (kg)</Label>
              <Input
                type="number"
                placeholder="70"
                value={answer?.imcWeight || ''}
                onChange={(e) => handleIMCChange(question.id, 'imcWeight', e.target.value ? Number(e.target.value) : undefined)}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Altura (cm)</Label>
              <Input
                type="number"
                placeholder="170"
                value={answer?.imcHeight || ''}
                onChange={(e) => handleIMCChange(question.id, 'imcHeight', e.target.value ? Number(e.target.value) : undefined)}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Idade</Label>
              <Input
                type="number"
                placeholder="35"
                value={answer?.imcAge || ''}
                onChange={(e) => handleIMCChange(question.id, 'imcAge', e.target.value ? Number(e.target.value) : undefined)}
              />
            </div>
          </div>
          {imcResult && (
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline">IMC: {imcResult.imc}</Badge>
              <Badge variant="secondary">{imcResult.category}</Badge>
            </div>
          )}
        </div>
      );
    }

    if (question.question_type === 'number') {
      return (
        <div key={question.id} className="space-y-2 p-4 border rounded-lg bg-muted/20">
          <Label className="font-medium">{question.question_text}</Label>
          <Input
            type="number"
            placeholder="Digite um número..."
            value={answer?.numericValue ?? ''}
            onChange={(e) => handleNumericChange(question.id, e.target.value ? Number(e.target.value) : undefined)}
            className="max-w-xs"
          />
        </div>
      );
    }

    if (question.question_type === 'single_choice') {
      return (
        <div key={question.id} className="space-y-2 p-4 border rounded-lg bg-muted/20">
          <Label className="font-medium">{question.question_text}</Label>
          <RadioGroup
            value={answer?.selectedOptionIds?.[0] || ''}
            onValueChange={(value) => handleOptionToggle(question.id, value, false)}
          >
            <div className="grid grid-cols-2 gap-2">
              {question.options?.map(option => (
                <div key={option.id} className="flex items-center space-x-2">
                  <RadioGroupItem value={option.id} id={option.id} />
                  <Label htmlFor={option.id} className="font-normal cursor-pointer">
                    {option.option_text}
                  </Label>
                </div>
              ))}
            </div>
          </RadioGroup>
        </div>
      );
    }

    // multiple_choice
    return (
      <div key={question.id} className="space-y-2 p-4 border rounded-lg bg-muted/20">
        <Label className="font-medium">{question.question_text}</Label>
        <div className="grid grid-cols-2 gap-2">
          {question.options?.map(option => (
            <div key={option.id} className="flex items-center space-x-2">
              <Checkbox
                id={option.id}
                checked={answer?.selectedOptionIds?.includes(option.id) || false}
                onCheckedChange={() => handleOptionToggle(question.id, option.id, true)}
              />
              <Label htmlFor={option.id} className="font-normal cursor-pointer">
                {option.option_text}
              </Label>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const totalAnswered = Object.values(answeredCountByCategory).reduce((a, b) => a + b, 0);
  const totalQuestions = questions.length;

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer">
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardList className="w-5 h-5 text-primary" />
                Perguntas Padrão
                {totalAnswered > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {totalAnswered}/{totalQuestions}
                  </Badge>
                )}
              </CardTitle>
              {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </CollapsibleTrigger>
        </CardHeader>
        
        <CollapsibleContent>
          <CardContent className="space-y-4">
            <Tabs value={activeCategory} onValueChange={setActiveCategory}>
              <TabsList className="w-full justify-start flex-wrap h-auto gap-1">
                {categories.map(category => (
                  <TabsTrigger key={category} value={category} className="relative">
                    {CATEGORY_LABELS[category] || category}
                    {answeredCountByCategory[category] > 0 && (
                      <Badge variant="default" className="ml-1 h-5 w-5 p-0 justify-center text-xs">
                        {answeredCountByCategory[category]}
                      </Badge>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
              
              {categories.map(category => (
                <TabsContent key={category} value={category} className="space-y-3 mt-4">
                  {questionsByCategory[category]?.map(renderQuestion)}
                </TabsContent>
              ))}
            </Tabs>

            <div className="flex justify-end pt-2">
              <Button onClick={handleSave} disabled={isSaving} size="sm">
                {isSaving ? (
                  <>Salvando...</>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Salvar respostas
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
