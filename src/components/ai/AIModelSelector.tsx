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
  speedRating: 1 | 2 | 3;
  costRating: 1 | 2 | 3;
  recommended?: boolean;
  bestFor?: string;
}

export const AI_MODELS: AIModel[] = [
  {
    key: 'anthropic/claude-3.5-sonnet',
    name: 'Claude Sonnet',
    shortName: 'Claude Sonnet',
    provider: 'openai' as any,
    description: 'Raciocínio avançado, melhor compreensão e respostas mais naturais. Ideal para vendas complexas',
    speedRating: 2,
    costRating: 3,
    recommended: true,
    bestFor: 'Recomendado'
  },
  {
    key: 'google/gemini-3-flash-preview',
    name: 'Gemini Flash',
    shortName: 'Gemini Flash',
    provider: 'google',
    description: 'Respostas rápidas com boa qualidade. Equilíbrio entre custo e performance',
    speedRating: 3,
    costRating: 2,
    bestFor: 'Velocidade'
  },
  {
    key: 'openai/gpt-5-nano',
    name: 'Econômico',
    shortName: 'Econômico',
    provider: 'google' as any,
    description: 'Menor consumo de energia. Bom para FAQs simples e respostas curtas',
    speedRating: 3,
    costRating: 1,
    bestFor: 'Economia'
  },
];

// Models optimized for vision/document tasks
export const VISION_MODELS = AI_MODELS;

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

export function AIModelSelector({ 
  value, 
  onChange, 
  label, 
  description,
  models = AI_MODELS,
  className,
  compact = false
}: AIModelSelectorProps) {
  // Map old model keys to new ones
  const normalizedValue = models.find(m => m.key === value)?.key || models[0].key;
  const selectedModel = models.find(m => m.key === normalizedValue) || models[0];

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
      
      <Select value={normalizedValue} onValueChange={onChange}>
        <SelectTrigger className={cn("w-full", compact ? "h-9" : "h-auto min-h-[52px]")}>
          <SelectValue>
            {selectedModel && (
              <div className="flex items-center gap-2 py-1">
                {selectedModel.recommended && (
                  <Rocket className="h-4 w-4 text-primary shrink-0" />
                )}
                <span className="font-medium">{selectedModel.shortName}</span>
                {!compact && (
                  <span className="text-xs text-muted-foreground hidden sm:inline">
                    {selectedModel.bestFor}
                  </span>
                )}
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="w-[380px] max-w-[calc(100vw-2rem)]">
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