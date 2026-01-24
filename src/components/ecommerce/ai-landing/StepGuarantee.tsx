import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Shield, Clock } from 'lucide-react';
import type { GuaranteeConfig } from './types';
import { cn } from '@/lib/utils';

interface StepGuaranteeProps {
  config: GuaranteeConfig;
  onConfigChange: (config: GuaranteeConfig) => void;
}

const GUARANTEE_PRESETS = [
  { days: 7, label: '7 dias' },
  { days: 15, label: '15 dias' },
  { days: 30, label: '30 dias' },
  { days: 60, label: '60 dias' },
  { days: 90, label: '90 dias' },
];

const GUARANTEE_TEXTS = {
  7: 'Teste por 7 dias. Se não gostar, devolvemos 100% do seu dinheiro.',
  15: 'Você tem 15 dias para testar. Se não for para você, devolvemos seu investimento.',
  30: 'Garantia incondicional de 30 dias. Se não ficar satisfeito, basta pedir reembolso.',
  60: 'Experimente por 60 dias com total segurança. Devolução completa sem perguntas.',
  90: 'Garantia estendida de 90 dias. Seu dinheiro de volta se não aprovar.',
};

export function StepGuarantee({ config, onConfigChange }: StepGuaranteeProps) {
  const handleDaysChange = (days: number) => {
    onConfigChange({
      ...config,
      days,
      text: GUARANTEE_TEXTS[days as keyof typeof GUARANTEE_TEXTS] || config.text,
    });
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Garantia do Produto</h2>
        <p className="text-muted-foreground">
          Configure a garantia que será exibida na página
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="h-6 w-6 text-primary" />
              <div>
                <CardTitle className="text-base">Exibir Garantia</CardTitle>
                <CardDescription>
                  Seção de garantia aumenta a confiança
                </CardDescription>
              </div>
            </div>
            <Switch
              checked={config.enabled}
              onCheckedChange={(enabled) =>
                onConfigChange({ ...config, enabled })
              }
            />
          </div>
        </CardHeader>

        {config.enabled && (
          <CardContent className="space-y-6">
            {/* Days Selection */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Prazo da Garantia
              </Label>
              <div className="flex flex-wrap gap-2">
                {GUARANTEE_PRESETS.map((preset) => (
                  <button
                    key={preset.days}
                    type="button"
                    onClick={() => handleDaysChange(preset.days)}
                    className={cn(
                      'px-4 py-2 rounded-lg border-2 font-medium transition-all',
                      config.days === preset.days
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-muted hover:border-primary/50'
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Text */}
            <div className="space-y-2">
              <Label htmlFor="guarantee-text">Texto da Garantia</Label>
              <Textarea
                id="guarantee-text"
                value={config.text}
                onChange={(e) =>
                  onConfigChange({ ...config, text: e.target.value })
                }
                placeholder="Descreva sua política de garantia..."
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                A IA pode melhorar este texto baseado no produto
              </p>
            </div>

            {/* Preview */}
            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
              <div className="text-sm font-medium">Preview</div>
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <div className="font-bold">
                    Garantia de {config.days} dias
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {config.text}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
