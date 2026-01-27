import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Check, X, PhoneCall } from 'lucide-react';
import { 
  PostSaleSurvey, 
  useUpdatePostSaleSurvey,
} from '@/hooks/usePostSaleSurveys';
import {
  useActivePostSaleQuestions,
  useSurveyResponses,
  useSavePostSaleResponses,
  type PostSaleQuestion,
} from '@/hooks/usePostSaleQuestions';
import { WhatsAppButton } from '@/components/WhatsAppButton';
import { MedicationAutocomplete } from '@/components/post-sale/MedicationAutocomplete';

interface PostSaleSurveyFormV2Props {
  survey: PostSaleSurvey;
  onComplete?: () => void;
}

export function PostSaleSurveyFormV2({ survey, onComplete }: PostSaleSurveyFormV2Props) {
  const { data: questions = [], isLoading: questionsLoading } = useActivePostSaleQuestions();
  const { data: existingResponses = [] } = useSurveyResponses(survey.id);
  const updateSurvey = useUpdatePostSaleSurvey();
  const saveResponses = useSavePostSaleResponses();

  // Responses state - map of question_id -> answer
  const [responses, setResponses] = useState<Record<string, {
    text?: string | null;
    number?: number | null;
    boolean?: boolean | null;
  }>>({});
  const [notes, setNotes] = useState(survey.notes || '');

  // Initialize from existing responses
  useEffect(() => {
    if (existingResponses.length > 0) {
      const map: typeof responses = {};
      existingResponses.forEach((r: any) => {
        map[r.question_id] = {
          text: r.answer_text,
          number: r.answer_number,
          boolean: r.answer_boolean,
        };
      });
      setResponses(map);
    }
  }, [existingResponses]);

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100);
  };

  const setResponse = (questionId: string, value: { text?: string | null; number?: number | null; boolean?: boolean | null }) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: { ...prev[questionId], ...value },
    }));
  };

  const handleComplete = async (method: 'call' | 'whatsapp') => {
    // Save responses
    const responsesToSave = questions.map(q => ({
      question_id: q.id,
      answer_text: responses[q.id]?.text ?? null,
      answer_number: responses[q.id]?.number ?? null,
      answer_boolean: responses[q.id]?.boolean ?? null,
    }));

    await saveResponses.mutateAsync({
      surveyId: survey.id,
      responses: responsesToSave,
    });

    // Update survey status
    await updateSurvey.mutateAsync({
      id: survey.id,
      notes: notes || undefined,
      status: method === 'call' ? 'completed' : 'completed',
    });

    onComplete?.();
  };

  const handleAttempt = async () => {
    await updateSurvey.mutateAsync({
      id: survey.id,
      notes: notes || undefined,
      status: 'attempted',
    });
    onComplete?.();
  };

  // Components for different question types
  const YesNoSelector = ({ question, value, onChange }: {
    question: PostSaleQuestion;
    value: boolean | null | undefined;
    onChange: (v: boolean) => void;
  }) => (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        {question.question}
        {question.is_required && <span className="text-destructive">*</span>}
      </Label>
      <div className="flex gap-2">
        <Button
          type="button"
          variant={value === true ? 'default' : 'outline'}
          className="flex-1"
          onClick={() => onChange(true)}
        >
          <Check className="w-4 h-4 mr-2" />
          Sim
        </Button>
        <Button
          type="button"
          variant={value === false ? 'default' : 'outline'}
          className="flex-1"
          onClick={() => onChange(false)}
        >
          <X className="w-4 h-4 mr-2" />
          Não
        </Button>
      </div>
    </div>
  );

  const RatingSelector = ({ question, value, onChange }: {
    question: PostSaleQuestion;
    value: number | null | undefined;
    onChange: (v: number) => void;
  }) => (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        {question.question}
        {question.is_required && <span className="text-destructive">*</span>}
      </Label>
      <div className="flex flex-wrap gap-2">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
          <Button
            key={n}
            type="button"
            variant={value === n ? 'default' : 'outline'}
            size="sm"
            className="w-10 h-10"
            onClick={() => onChange(n)}
          >
            {n}
          </Button>
        ))}
      </div>
    </div>
  );

  const TextInput = ({ question, value, onChange }: {
    question: PostSaleQuestion;
    value: string | null | undefined;
    onChange: (v: string) => void;
  }) => (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        {question.question}
        {question.is_required && <span className="text-destructive">*</span>}
      </Label>
      <Textarea
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Digite aqui..."
        rows={3}
      />
    </div>
  );

  const MedicationInput = ({ question, value, onChange }: {
    question: PostSaleQuestion;
    value: { boolean?: boolean | null; text?: string | null };
    onChange: (v: { boolean?: boolean | null; text?: string | null }) => void;
  }) => (
    <div className="space-y-3">
      <Label className="flex items-center gap-2">
        {question.question}
        {question.is_required && <span className="text-destructive">*</span>}
      </Label>
      <div className="flex gap-2">
        <Button
          type="button"
          variant={value.boolean === true ? 'default' : 'outline'}
          className="flex-1"
          onClick={() => onChange({ ...value, boolean: true })}
        >
          Sim
        </Button>
        <Button
          type="button"
          variant={value.boolean === false ? 'default' : 'outline'}
          className="flex-1"
          onClick={() => onChange({ ...value, boolean: false })}
        >
          Não
        </Button>
      </div>
      {value.boolean === true && (
        <MedicationAutocomplete
          value={value.text || ''}
          onChange={(v) => onChange({ ...value, text: v })}
          placeholder="Nome do medicamento..."
        />
      )}
    </div>
  );

  const renderQuestion = (question: PostSaleQuestion) => {
    const response = responses[question.id] || {};

    switch (question.question_type) {
      case 'yes_no':
        return (
          <YesNoSelector
            key={question.id}
            question={question}
            value={response.boolean}
            onChange={(v) => setResponse(question.id, { boolean: v })}
          />
        );
      case 'rating_0_10':
        return (
          <RatingSelector
            key={question.id}
            question={question}
            value={response.number}
            onChange={(v) => setResponse(question.id, { number: v })}
          />
        );
      case 'text':
        return (
          <TextInput
            key={question.id}
            question={question}
            value={response.text}
            onChange={(v) => setResponse(question.id, { text: v })}
          />
        );
      case 'medication':
        return (
          <MedicationInput
            key={question.id}
            question={question}
            value={response}
            onChange={(v) => setResponse(question.id, v)}
          />
        );
      default:
        return null;
    }
  };

  if (questionsLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (questions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            📞 Pesquisa Pós-Venda
          </CardTitle>
          <CardDescription>
            Nenhuma pergunta configurada. Configure as perguntas em Configurações → Qualificações.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            📞 Pesquisa Pós-Venda
          </CardTitle>
          {survey.status === 'pending' && (
            <Badge variant="outline" className="text-yellow-600 border-yellow-300">
              Pendente
            </Badge>
          )}
          {survey.status === 'attempted' && (
            <Badge variant="outline" className="text-orange-600 border-orange-300">
              Tentativa registrada
            </Badge>
          )}
          {survey.status === 'completed' && (
            <Badge variant="outline" className="text-green-600 border-green-300">
              Concluída
            </Badge>
          )}
        </div>
        {survey.sale && (
          <CardDescription>
            Venda • {formatCurrency(survey.sale.total_cents)}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Dynamic questions */}
        {questions.map(renderQuestion)}

        {/* Notes */}
        <div className="space-y-2">
          <Label>Observações</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anotações..."
            rows={3}
          />
        </div>

        {/* Actions */}
        <div className="space-y-3 pt-2">
          <p className="text-sm text-muted-foreground">Concluir pesquisa por:</p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={() => handleComplete('call')}
              disabled={updateSurvey.isPending || saveResponses.isPending}
              className="bg-primary"
            >
              {(updateSurvey.isPending || saveResponses.isPending) ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <PhoneCall className="w-4 h-4 mr-2" />
              )}
              Ligação
            </Button>
            <Button
              onClick={() => handleComplete('whatsapp')}
              disabled={updateSurvey.isPending || saveResponses.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {(updateSurvey.isPending || saveResponses.isPending) ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <span className="mr-2">📱</span>
              )}
              WhatsApp
            </Button>
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={handleAttempt}
            disabled={updateSurvey.isPending}
          >
            Registrar Tentativa
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
