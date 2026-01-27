import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { 
  useUpdateQuizStep, 
  useCreateQuizOption, 
  useUpdateQuizOption, 
  useDeleteQuizOption,
  STEP_TYPE_LABELS,
  CTA_TYPE_LABELS,
  type QuizStep,
  type QuizStepOption,
  type QuizCtaType
} from '@/hooks/ecommerce/useQuizzes';

interface QuizStepEditorProps {
  step: QuizStep;
  allSteps: QuizStep[];
}

const NONE_VALUE = '__none__';

export function QuizStepEditor({ step, allSteps }: QuizStepEditorProps) {
  const updateStep = useUpdateQuizStep();
  const createOption = useCreateQuizOption();
  const updateOption = useUpdateQuizOption();
  const deleteOption = useDeleteQuizOption();

  const form = useForm({
    defaultValues: {
      title: step.title,
      subtitle: step.subtitle || '',
      image_url: step.image_url || '',
      video_url: step.video_url || '',
      capture_name: step.capture_name,
      capture_email: step.capture_email,
      capture_whatsapp: step.capture_whatsapp,
      capture_cpf: step.capture_cpf,
      result_title: step.result_title || '',
      result_description: step.result_description || '',
      result_cta_type: step.result_cta_type || '',
      result_cta_url: step.result_cta_url || '',
      result_cta_text: step.result_cta_text || 'Continuar',
      result_whatsapp_number: step.result_whatsapp_number || '',
      result_whatsapp_message: step.result_whatsapp_message || '',
      next_step_id: step.next_step_id || '',
      is_required: step.is_required,
    },
  });

  useEffect(() => {
    form.reset({
      title: step.title,
      subtitle: step.subtitle || '',
      image_url: step.image_url || '',
      video_url: step.video_url || '',
      capture_name: step.capture_name,
      capture_email: step.capture_email,
      capture_whatsapp: step.capture_whatsapp,
      capture_cpf: step.capture_cpf,
      result_title: step.result_title || '',
      result_description: step.result_description || '',
      result_cta_type: step.result_cta_type || '',
      result_cta_url: step.result_cta_url || '',
      result_cta_text: step.result_cta_text || 'Continuar',
      result_whatsapp_number: step.result_whatsapp_number || '',
      result_whatsapp_message: step.result_whatsapp_message || '',
      next_step_id: step.next_step_id || '',
      is_required: step.is_required,
    });
  }, [step, form]);

  const handleFieldChange = async (field: string, value: unknown) => {
    const processedValue = value === NONE_VALUE ? null : value;
    await updateStep.mutateAsync({
      id: step.id,
      [field]: processedValue,
    });
  };

  const handleAddOption = async () => {
    const position = (step.options?.length || 0);
    await createOption.mutateAsync({
      step_id: step.id,
      label: `Opção ${position + 1}`,
      position,
    });
  };

  const handleUpdateOption = async (optionId: string, field: string, value: unknown) => {
    const processedValue = value === NONE_VALUE ? null : value;
    await updateOption.mutateAsync({
      id: optionId,
      [field]: processedValue,
    });
  };

  const handleDeleteOption = async (optionId: string) => {
    await deleteOption.mutateAsync(optionId);
  };

  const isChoiceType = step.step_type === 'single_choice' || step.step_type === 'multiple_choice';
  const isLeadCapture = step.step_type === 'lead_capture';
  const isResult = step.step_type === 'result';
  const otherSteps = allSteps.filter(s => s.id !== step.id);

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Conteúdo da Etapa</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Tipo</Label>
              <div className="mt-1 text-sm text-muted-foreground bg-muted px-3 py-2 rounded-md">
                {STEP_TYPE_LABELS[step.step_type]}
              </div>
            </div>

            <div>
              <Label htmlFor="title">Título / Pergunta</Label>
              <Input
                id="title"
                {...form.register('title')}
                onBlur={(e) => handleFieldChange('title', e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="subtitle">Subtítulo (opcional)</Label>
              <Textarea
                id="subtitle"
                rows={2}
                {...form.register('subtitle')}
                onBlur={(e) => handleFieldChange('subtitle', e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="image_url">URL da Imagem</Label>
                <Input
                  id="image_url"
                  placeholder="https://..."
                  {...form.register('image_url')}
                  onBlur={(e) => handleFieldChange('image_url', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="video_url">URL do Vídeo</Label>
                <Input
                  id="video_url"
                  placeholder="https://youtube.com/..."
                  {...form.register('video_url')}
                  onBlur={(e) => handleFieldChange('video_url', e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Options for choice types */}
        {isChoiceType && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Opções de Resposta</CardTitle>
                <Button size="sm" onClick={handleAddOption}>
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {step.options?.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma opção adicionada
                </p>
              )}
              {step.options?.map((option, index) => (
                <OptionEditor
                  key={option.id}
                  option={option}
                  index={index}
                  otherSteps={otherSteps}
                  onUpdate={handleUpdateOption}
                  onDelete={handleDeleteOption}
                />
              ))}
            </CardContent>
          </Card>
        )}

        {/* Lead Capture Fields */}
        {isLeadCapture && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Campos a Capturar</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="capture_name">Nome</Label>
                <Switch
                  id="capture_name"
                  checked={form.watch('capture_name')}
                  onCheckedChange={(checked) => handleFieldChange('capture_name', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="capture_whatsapp">WhatsApp</Label>
                <Switch
                  id="capture_whatsapp"
                  checked={form.watch('capture_whatsapp')}
                  onCheckedChange={(checked) => handleFieldChange('capture_whatsapp', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="capture_email">E-mail</Label>
                <Switch
                  id="capture_email"
                  checked={form.watch('capture_email')}
                  onCheckedChange={(checked) => handleFieldChange('capture_email', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="capture_cpf">CPF</Label>
                <Switch
                  id="capture_cpf"
                  checked={form.watch('capture_cpf')}
                  onCheckedChange={(checked) => handleFieldChange('capture_cpf', checked)}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Result Configuration */}
        {isResult && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Configuração do Resultado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="result_title">Título do Resultado</Label>
                <Input
                  id="result_title"
                  placeholder="Parabéns! Você é..."
                  {...form.register('result_title')}
                  onBlur={(e) => handleFieldChange('result_title', e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="result_description">Descrição</Label>
                <Textarea
                  id="result_description"
                  rows={3}
                  placeholder="Baseado nas suas respostas..."
                  {...form.register('result_description')}
                  onBlur={(e) => handleFieldChange('result_description', e.target.value)}
                />
              </div>

              <Separator />

              <div>
                <Label>Ação do Botão</Label>
                <Select
                  value={form.watch('result_cta_type') || NONE_VALUE}
                  onValueChange={(value) => handleFieldChange('result_cta_type', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>Nenhuma ação</SelectItem>
                    {Object.entries(CTA_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {form.watch('result_cta_type') === 'url' && (
                <div>
                  <Label htmlFor="result_cta_url">URL de Destino</Label>
                  <Input
                    id="result_cta_url"
                    placeholder="https://..."
                    {...form.register('result_cta_url')}
                    onBlur={(e) => handleFieldChange('result_cta_url', e.target.value)}
                  />
                </div>
              )}

              {form.watch('result_cta_type') === 'whatsapp' && (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="result_whatsapp_number">Número do WhatsApp</Label>
                    <Input
                      id="result_whatsapp_number"
                      placeholder="5511999999999"
                      {...form.register('result_whatsapp_number')}
                      onBlur={(e) => handleFieldChange('result_whatsapp_number', e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Formato: código do país + DDD + número (ex: 5511999999999)
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="result_whatsapp_message">Mensagem do WhatsApp</Label>
                    <Textarea
                      id="result_whatsapp_message"
                      placeholder="Olá! Acabei de fazer o quiz e..."
                      {...form.register('result_whatsapp_message')}
                      onBlur={(e) => handleFieldChange('result_whatsapp_message', e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div>
                <Label htmlFor="result_cta_text">Texto do Botão</Label>
                <Input
                  id="result_cta_text"
                  {...form.register('result_cta_text')}
                  onBlur={(e) => handleFieldChange('result_cta_text', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Navigation */}
        {!isResult && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Navegação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Próxima Etapa (padrão)</Label>
                <Select
                  value={form.watch('next_step_id') || NONE_VALUE}
                  onValueChange={(value) => handleFieldChange('next_step_id', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Próxima na ordem" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>Próxima na ordem</SelectItem>
                    {otherSteps.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.position + 1}. {s.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Para branching condicional, configure na opção de resposta
                </p>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="is_required">Resposta Obrigatória</Label>
                <Switch
                  id="is_required"
                  checked={form.watch('is_required')}
                  onCheckedChange={(checked) => handleFieldChange('is_required', checked)}
                />
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </ScrollArea>
  );
}

// Option Editor Component
interface OptionEditorProps {
  option: QuizStepOption;
  index: number;
  otherSteps: QuizStep[];
  onUpdate: (id: string, field: string, value: unknown) => void;
  onDelete: (id: string) => void;
}

function OptionEditor({ option, index, otherSteps, onUpdate, onDelete }: OptionEditorProps) {
  return (
    <div className="flex items-start gap-2 p-3 border rounded-lg bg-muted/30">
      <GripVertical className="h-5 w-5 text-muted-foreground mt-2 flex-shrink-0" />
      
      <div className="flex-1 space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder="Emoji"
            className="w-16"
            defaultValue={option.emoji || ''}
            onBlur={(e) => onUpdate(option.id, 'emoji', e.target.value)}
          />
          <Input
            placeholder="Texto da opção"
            className="flex-1"
            defaultValue={option.label}
            onBlur={(e) => onUpdate(option.id, 'label', e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Score/Pontos</Label>
            <Input
              type="number"
              className="h-8"
              defaultValue={option.score}
              onBlur={(e) => onUpdate(option.id, 'score', parseInt(e.target.value) || 0)}
            />
          </div>
          <div>
            <Label className="text-xs">Ir para etapa</Label>
            <Select
              defaultValue={option.next_step_id || NONE_VALUE}
              onValueChange={(value) => onUpdate(option.id, 'next_step_id', value)}
            >
              <SelectTrigger className="h-8">
                <SelectValue placeholder="Próxima" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>Próxima na ordem</SelectItem>
                {otherSteps.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.position + 1}. {s.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label className="text-xs">Tag de Resultado</Label>
          <Input
            className="h-8"
            placeholder="Ex: perfil_a"
            defaultValue={option.result_tag || ''}
            onBlur={(e) => onUpdate(option.id, 'result_tag', e.target.value)}
          />
        </div>
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 flex-shrink-0"
        onClick={() => onDelete(option.id)}
      >
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}
