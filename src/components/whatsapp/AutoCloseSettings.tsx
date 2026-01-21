import { useState, useEffect } from "react";
import { 
  Clock, 
  MessageSquare, 
  Star, 
  Calendar,
  Bot,
  User,
  Info
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger 
} from "@/components/ui/tooltip";
import { 
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger 
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AutoCloseConfig {
  auto_close_enabled: boolean;
  auto_close_bot_minutes: number;
  auto_close_assigned_minutes: number;
  auto_close_only_business_hours: boolean;
  auto_close_business_start: string;
  auto_close_business_end: string;
  auto_close_send_message: boolean;
  auto_close_message_template: string;
  satisfaction_survey_enabled: boolean;
  satisfaction_survey_message: string;
}

interface AutoCloseSettingsProps {
  config: AutoCloseConfig;
  onChange: (config: AutoCloseConfig) => void;
}

const DEFAULT_CLOSE_MESSAGE = 'Olá! Como não recebemos resposta, estamos encerrando este atendimento. Caso precise, é só nos chamar novamente! 😊';
const DEFAULT_SURVEY_MESSAGE = 'De 0 a 10, como você avalia este atendimento? Sua resposta nos ajuda a melhorar! 🙏';

export function AutoCloseSettings({ config, onChange }: AutoCloseSettingsProps) {
  const [isOpen, setIsOpen] = useState(config.auto_close_enabled);

  const updateConfig = (partial: Partial<AutoCloseConfig>) => {
    onChange({ ...config, ...partial });
  };

  const formatMinutesToDisplay = (minutes: number): string => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}min`;
  };

  return (
    <div className="space-y-4">
      {/* Toggle principal */}
      <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
        <div className="flex items-center gap-3">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <div>
            <Label className="text-sm font-medium">Encerramento Automático</Label>
            <p className="text-xs text-muted-foreground">
              Fechar conversas inativas automaticamente
            </p>
          </div>
        </div>
        <Switch 
          checked={config.auto_close_enabled}
          onCheckedChange={(checked) => {
            updateConfig({ auto_close_enabled: checked });
            setIsOpen(checked);
          }}
        />
      </div>

      {config.auto_close_enabled && (
        <div className="space-y-4 pl-2 border-l-2 border-primary/20">
          {/* Timeout diferenciado */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-xs">
                <Bot className="h-3.5 w-3.5 text-purple-500" />
                Conversas com Robô
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="5"
                  max="1440"
                  value={config.auto_close_bot_minutes}
                  onChange={(e) => updateConfig({ 
                    auto_close_bot_minutes: parseInt(e.target.value) || 60 
                  })}
                  className="w-20 h-8 text-sm"
                />
                <span className="text-xs text-muted-foreground">
                  min ({formatMinutesToDisplay(config.auto_close_bot_minutes)})
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-xs">
                <User className="h-3.5 w-3.5 text-blue-500" />
                Conversas Atribuídas
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="30"
                  max="2880"
                  value={config.auto_close_assigned_minutes}
                  onChange={(e) => updateConfig({ 
                    auto_close_assigned_minutes: parseInt(e.target.value) || 480 
                  })}
                  className="w-20 h-8 text-sm"
                />
                <span className="text-xs text-muted-foreground">
                  min ({formatMinutesToDisplay(config.auto_close_assigned_minutes)})
                </span>
              </div>
            </div>
          </div>

          {/* Horário comercial */}
          <div className="space-y-3 p-3 border rounded-lg">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4" />
                Só em horário comercial
              </Label>
              <Switch 
                checked={config.auto_close_only_business_hours}
                onCheckedChange={(checked) => updateConfig({ 
                  auto_close_only_business_hours: checked 
                })}
              />
            </div>
            
            {config.auto_close_only_business_hours && (
              <div className="flex items-center gap-3 mt-2">
                <Input
                  type="time"
                  value={config.auto_close_business_start}
                  onChange={(e) => updateConfig({ auto_close_business_start: e.target.value })}
                  className="w-28 h-8 text-sm"
                />
                <span className="text-xs text-muted-foreground">até</span>
                <Input
                  type="time"
                  value={config.auto_close_business_end}
                  onChange={(e) => updateConfig({ auto_close_business_end: e.target.value })}
                  className="w-28 h-8 text-sm"
                />
              </div>
            )}
          </div>

          {/* Mensagem de encerramento */}
          <div className="space-y-3 p-3 border rounded-lg">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2 text-sm">
                <MessageSquare className="h-4 w-4" />
                Enviar mensagem ao encerrar
              </Label>
              <Switch 
                checked={config.auto_close_send_message}
                onCheckedChange={(checked) => updateConfig({ 
                  auto_close_send_message: checked 
                })}
              />
            </div>
            
            {config.auto_close_send_message && (
              <Textarea
                value={config.auto_close_message_template}
                onChange={(e) => updateConfig({ auto_close_message_template: e.target.value })}
                placeholder={DEFAULT_CLOSE_MESSAGE}
                rows={2}
                className="text-sm"
              />
            )}
          </div>

          {/* Pesquisa de satisfação */}
          <div className={cn(
            "space-y-3 p-3 border rounded-lg",
            config.satisfaction_survey_enabled && "border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20"
          )}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-500" />
                <Label className="text-sm">Pesquisa de Satisfação (NPS)</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3.5 w-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-xs">
                        Ao encerrar, o cliente recebe uma pergunta de 0 a 10.
                        Se responder com uma nota, ela é registrada e a conversa 
                        permanece fechada. Notas ≤6 ficam marcadas para revisão.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Switch 
                checked={config.satisfaction_survey_enabled}
                onCheckedChange={(checked) => updateConfig({ 
                  satisfaction_survey_enabled: checked,
                  // Se ativar pesquisa, precisa ativar envio de mensagem também
                  auto_close_send_message: checked ? true : config.auto_close_send_message
                })}
              />
            </div>
            
            {config.satisfaction_survey_enabled && (
              <>
                <Textarea
                  value={config.satisfaction_survey_message}
                  onChange={(e) => updateConfig({ satisfaction_survey_message: e.target.value })}
                  placeholder={DEFAULT_SURVEY_MESSAGE}
                  rows={2}
                  className="text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  💡 Respostas como "8", "oito", "nota 9" são detectadas automaticamente e não reabrem a conversa.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
