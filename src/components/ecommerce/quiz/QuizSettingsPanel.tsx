import { useForm } from 'react-hook-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUpdateQuiz, type Quiz } from '@/hooks/ecommerce/useQuizzes';

interface QuizSettingsPanelProps {
  quiz: Quiz;
}

const NONE_VALUE = '__none__';

export function QuizSettingsPanel({ quiz }: QuizSettingsPanelProps) {
  const updateQuiz = useUpdateQuiz();

  const form = useForm({
    defaultValues: {
      show_progress_bar: quiz.show_progress_bar,
      requires_lead_capture: quiz.requires_lead_capture,
      auto_start_followup: quiz.auto_start_followup,
      facebook_pixel_id: quiz.facebook_pixel_id || '',
      google_analytics_id: quiz.google_analytics_id || '',
      tiktok_pixel_id: quiz.tiktok_pixel_id || '',
      logo_url: quiz.logo_url || '',
    },
  });

  const handleFieldChange = async (field: string, value: unknown) => {
    const processedValue = value === NONE_VALUE ? null : value;
    await updateQuiz.mutateAsync({
      id: quiz.id,
      [field]: processedValue,
    });
  };

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      {/* Visual Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Aparência</CardTitle>
          <CardDescription>Personalize a aparência do quiz</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="logo_url">URL do Logo</Label>
            <Input
              id="logo_url"
              placeholder="https://..."
              {...form.register('logo_url')}
              onBlur={(e) => handleFieldChange('logo_url', e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="show_progress_bar">Barra de Progresso</Label>
              <p className="text-sm text-muted-foreground">
                Mostra o progresso do usuário no quiz
              </p>
            </div>
            <Switch
              id="show_progress_bar"
              checked={form.watch('show_progress_bar')}
              onCheckedChange={(checked) => handleFieldChange('show_progress_bar', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* CRM Integration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Integração CRM</CardTitle>
          <CardDescription>Configure como os leads serão criados</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="requires_lead_capture">Exigir Captura de Lead</Label>
              <p className="text-sm text-muted-foreground">
                Requer nome/WhatsApp antes de mostrar resultado
              </p>
            </div>
            <Switch
              id="requires_lead_capture"
              checked={form.watch('requires_lead_capture')}
              onCheckedChange={(checked) => handleFieldChange('requires_lead_capture', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="auto_start_followup">Iniciar Follow-up Automático</Label>
              <p className="text-sm text-muted-foreground">
                Dispara automação ao capturar lead
              </p>
            </div>
            <Switch
              id="auto_start_followup"
              checked={form.watch('auto_start_followup')}
              onCheckedChange={(checked) => handleFieldChange('auto_start_followup', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Tracking Pixels */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pixels de Rastreamento</CardTitle>
          <CardDescription>Configure os pixels para acompanhar conversões</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="facebook_pixel_id">Facebook Pixel ID</Label>
            <Input
              id="facebook_pixel_id"
              placeholder="1234567890"
              {...form.register('facebook_pixel_id')}
              onBlur={(e) => handleFieldChange('facebook_pixel_id', e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="google_analytics_id">Google Analytics ID</Label>
            <Input
              id="google_analytics_id"
              placeholder="G-XXXXXXXXXX"
              {...form.register('google_analytics_id')}
              onBlur={(e) => handleFieldChange('google_analytics_id', e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="tiktok_pixel_id">TikTok Pixel ID</Label>
            <Input
              id="tiktok_pixel_id"
              placeholder="CXXXXXXXXX"
              {...form.register('tiktok_pixel_id')}
              onBlur={(e) => handleFieldChange('tiktok_pixel_id', e.target.value)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
