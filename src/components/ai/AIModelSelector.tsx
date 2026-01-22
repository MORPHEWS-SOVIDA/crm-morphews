import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Zap, Brain, Sparkles, Cpu, Rocket, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AIModel {
  key: string;
  name: string;
  shortName: string;
  provider: 'google' | 'openai';
  description: string;
  speedRating: 1 | 2 | 3; // 1 = slow, 3 = fast
  costRating: 1 | 2 | 3; // 1 = cheap, 3 = expensive
  recommended?: boolean;
  bestFor?: string;
}

export const AI_MODELS: AIModel[] = [
  {
    key: 'google/gemini-3-flash-preview',
    name: 'Gemini 3 Flash Preview',
    shortName: 'Gemini 3 Flash',
    provider: 'google',
    description: 'Novo padrão - rápido, inteligente e econômico',
    speedRating: 3,
    costRating: 1,
    recommended: true,
    bestFor: 'Chat geral'
  },
  {
    key: 'google/gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    shortName: 'Gemini 2.5 Flash',
    provider: 'google',
    description: 'Ótimo para imagens e documentos',
    speedRating: 3,
    costRating: 1,
    bestFor: 'Multimodal'
  },
  {
    key: 'google/gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    shortName: 'Gemini 2.5 Pro',
    provider: 'google',
    description: 'Máxima precisão, ideal para análises complexas',
    speedRating: 2,
    costRating: 3,
    bestFor: 'Análise detalhada'
  },
  {
    key: 'google/gemini-3-pro-preview',
    name: 'Gemini 3 Pro Preview',
    shortName: 'Gemini 3 Pro',
    provider: 'google',
    description: 'Próxima geração Pro - muito inteligente',
    speedRating: 2,
    costRating: 3,
    bestFor: 'Raciocínio complexo'
  },
  {
    key: 'openai/gpt-5.2',
    name: 'GPT-5.2',
    shortName: 'GPT-5.2',
    provider: 'openai',
    description: 'Último modelo OpenAI, raciocínio avançado',
    speedRating: 2,
    costRating: 3,
    bestFor: 'Problemas complexos'
  },
  {
    key: 'openai/gpt-5-mini',
    name: 'GPT-5 Mini',
    shortName: 'GPT-5 Mini',
    provider: 'openai',
    description: 'Equilíbrio entre qualidade e velocidade',
    speedRating: 3,
    costRating: 2,
    bestFor: 'Uso geral OpenAI'
  },
  {
    key: 'openai/gpt-5-nano',
    name: 'GPT-5 Nano',
    shortName: 'GPT-5 Nano',
    provider: 'openai',
    description: 'Ultra rápido e econômico',
    speedRating: 3,
    costRating: 1,
    bestFor: 'Alta velocidade'
  },
];

// Models optimized for vision/document tasks
export const VISION_MODELS = AI_MODELS.filter(m => 
  ['google/gemini-2.5-flash', 'google/gemini-2.5-pro', 'google/gemini-3-flash-preview', 'google/gemini-3-pro-preview', 'openai/gpt-5.2', 'openai/gpt-5-mini'].includes(m.key)
);

// Models for chat
export const CHAT_MODELS = AI_MODELS;

interface AIModelSelectorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  description?: string;
  models?: AIModel[];
  className?: string;
  compact?: boolean;
}

const SpeedIndicator = ({ rating }: { rating: number }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3].map((i) => (
      <Zap 
        key={i} 
        className={cn(
          "h-3 w-3",
          i <= rating ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/30"
        )} 
      />
    ))}
  </div>
);

const CostIndicator = ({ rating }: { rating: number }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3].map((i) => (
      <DollarSign 
        key={i} 
        className={cn(
          "h-3 w-3",
          i <= rating ? "text-green-500" : "text-muted-foreground/30"
        )} 
      />
    ))}
  </div>
);

const ProviderIcon = ({ provider }: { provider: 'google' | 'openai' }) => (
  <span className={cn(
    "text-xs font-medium px-1.5 py-0.5 rounded",
    provider === 'google' ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
  )}>
    {provider === 'google' ? 'Google' : 'OpenAI'}
  </span>
);

export function AIModelSelector({ 
  value, 
  onChange, 
  label, 
  description,
  models = AI_MODELS,
  className,
  compact = false
}: AIModelSelectorProps) {
  const selectedModel = models.find(m => m.key === value) || models[0];

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-primary" />
          <Label className="text-sm font-medium">{label}</Label>
        </div>
      )}
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
      
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className={cn("w-full", compact ? "h-9" : "h-auto min-h-[52px]")}>
          <SelectValue>
            {selectedModel && (
              <div className="flex items-center gap-2 py-1">
                {selectedModel.recommended && (
                  <Rocket className="h-4 w-4 text-primary shrink-0" />
                )}
                <span className="font-medium">{selectedModel.shortName}</span>
                {!compact && (
                  <>
                    <ProviderIcon provider={selectedModel.provider} />
                    <span className="text-xs text-muted-foreground hidden sm:inline">
                      {selectedModel.bestFor}
                    </span>
                  </>
                )}
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="w-[400px] max-w-[calc(100vw-2rem)]">
          {models.map((model) => (
            <SelectItem 
              key={model.key} 
              value={model.key}
              className="cursor-pointer"
            >
              <div className="flex flex-col gap-1 py-1">
                <div className="flex items-center gap-2">
                  {model.recommended && (
                    <Badge variant="default" className="h-5 text-[10px] px-1.5">
                      <Sparkles className="h-3 w-3 mr-1" />
                      Recomendado
                    </Badge>
                  )}
                  <span className="font-medium">{model.name}</span>
                  <ProviderIcon provider={model.provider} />
                </div>
                <p className="text-xs text-muted-foreground">{model.description}</p>
                <div className="flex items-center gap-4 mt-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground">Velocidade</span>
                    <SpeedIndicator rating={model.speedRating} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground">Custo</span>
                    <CostIndicator rating={model.costRating} />
                  </div>
                  {model.bestFor && (
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {model.bestFor}
                    </span>
                  )}
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
