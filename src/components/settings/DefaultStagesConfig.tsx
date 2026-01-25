import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2, Save, UserPlus, MessageCircle, PhoneIncoming, HelpCircle } from 'lucide-react';
import { useFunnelStages } from '@/hooks/useFunnelStages';
import { useDefaultStageConfig, useUpdateDefaultStageConfig } from '@/hooks/useDefaultFunnelStages';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const NONE_VALUE = '__none__';

interface StageOption {
  id: string;
  name: string;
  color: string;
}

export function DefaultStagesConfig() {
  const { data: stages = [], isLoading: stagesLoading } = useFunnelStages();
  const { data: config, isLoading: configLoading } = useDefaultStageConfig();
  const updateConfig = useUpdateDefaultStageConfig();

  const [formData, setFormData] = useState({
    default_stage_new_lead: NONE_VALUE,
    default_stage_whatsapp: NONE_VALUE,
    default_stage_receptivo: NONE_VALUE,
    default_stage_fallback: NONE_VALUE,
  });

  // Hydrate form when config loads
  useEffect(() => {
    if (config) {
      setFormData({
        default_stage_new_lead: config.default_stage_new_lead || NONE_VALUE,
        default_stage_whatsapp: config.default_stage_whatsapp || NONE_VALUE,
        default_stage_receptivo: config.default_stage_receptivo || NONE_VALUE,
        default_stage_fallback: config.default_stage_fallback || NONE_VALUE,
      });
    }
  }, [config]);

  const handleSave = () => {
    updateConfig.mutate({
      default_stage_new_lead: formData.default_stage_new_lead === NONE_VALUE ? null : formData.default_stage_new_lead,
      default_stage_whatsapp: formData.default_stage_whatsapp === NONE_VALUE ? null : formData.default_stage_whatsapp,
      default_stage_receptivo: formData.default_stage_receptivo === NONE_VALUE ? null : formData.default_stage_receptivo,
      default_stage_fallback: formData.default_stage_fallback === NONE_VALUE ? null : formData.default_stage_fallback,
    });
  };

  // Filter to only show funnel/cloud type stages (not trash)
  const selectableStages: StageOption[] = stages
    .filter(s => s.stage_type !== 'trash')
    .sort((a, b) => a.position - b.position)
    .map(s => ({
      id: s.id,
      name: s.name,
      color: s.color,
    }));

  const isLoading = stagesLoading || configLoading;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const configItems = [
    {
      key: 'default_stage_new_lead' as const,
      label: 'Novo Lead Manual',
      description: 'Quando um vendedor cadastra lead em /leads/new',
      icon: UserPlus,
    },
    {
      key: 'default_stage_whatsapp' as const,
      label: 'WhatsApp Chat',
      description: 'Quando um lead é criado a partir de uma conversa no WhatsApp',
      icon: MessageCircle,
    },
    {
      key: 'default_stage_receptivo' as const,
      label: 'Add Receptivo',
      description: 'Quando um lead é criado no módulo de atendimento receptivo',
      icon: PhoneIncoming,
    },
    {
      key: 'default_stage_fallback' as const,
      label: 'Padrão Geral (Fallback)',
      description: 'Usado quando nenhuma configuração específica está definida',
      icon: HelpCircle,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Etapa Padrão por Entrada de Lead</CardTitle>
        <CardDescription>
          Configure em qual etapa do funil os leads devem ser colocados automaticamente, 
          dependendo de como eles entram no sistema.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <TooltipProvider>
          {configItems.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.key} className="flex items-start gap-4">
                <div className="flex-shrink-0 p-2 rounded-lg bg-muted">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <Label htmlFor={item.key} className="font-medium">
                      {item.label}
                    </Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">{item.description}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Select
                    value={formData[item.key]}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, [item.key]: value }))}
                  >
                    <SelectTrigger id={item.key} className="w-full max-w-xs">
                      <SelectValue placeholder="Selecionar etapa..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>
                        <span className="text-muted-foreground">Nenhuma (usar fallback)</span>
                      </SelectItem>
                      {selectableStages.map((stage) => (
                        <SelectItem key={stage.id} value={stage.id}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ 
                                backgroundColor: stage.color.startsWith('bg-') 
                                  ? undefined 
                                  : stage.color 
                              }}
                              {...(stage.color.startsWith('bg-') && { className: `w-3 h-3 rounded-full ${stage.color}` })}
                            />
                            <span>{stage.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            );
          })}
        </TooltipProvider>

        <div className="pt-4 flex justify-end">
          <Button onClick={handleSave} disabled={updateConfig.isPending}>
            {updateConfig.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar Configurações
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
