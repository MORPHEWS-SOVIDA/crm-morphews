import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { 
  CheckCircle2, 
  Circle, 
  MessageSquare, 
  UserPlus, 
  TrendingUp, 
  Sparkles,
  X,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  completed: boolean;
  tip?: string;
}

interface OnboardingGuideProps {
  leadsCount: number;
  hasStageUpdates: boolean;
}

export function OnboardingGuide({ leadsCount, hasStageUpdates }: OnboardingGuideProps) {
  const { user } = useAuth();
  const [isExpanded, setIsExpanded] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);
  const [progress, setProgress] = useState<any>(null);

  useEffect(() => {
    const loadProgress = async () => {
      if (!user?.id) return;
      
      const { data } = await supabase
        .from('user_onboarding_progress')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      setProgress(data);
      
      // Check if already dismissed from localStorage
      const dismissed = localStorage.getItem('onboarding_dismissed');
      if (dismissed === 'true') {
        setIsDismissed(true);
      }
    };
    
    loadProgress();
  }, [user?.id]);

  const steps: OnboardingStep[] = [
    {
      id: 'whatsapp',
      title: 'Secretária no WhatsApp',
      description: 'Envie uma mensagem para nossa IA pelo WhatsApp',
      icon: <MessageSquare className="w-5 h-5" />,
      completed: progress?.welcome_sent || false,
      tip: 'Você pode criar leads enviando áudio, texto ou fotos de conversas!'
    },
    {
      id: 'first_lead',
      title: 'Cadastre seu primeiro lead',
      description: 'Crie um lead pelo WhatsApp ou aqui no dashboard',
      icon: <UserPlus className="w-5 h-5" />,
      completed: leadsCount >= 1,
      tip: 'Dica: "Acabei de falar com Maria, nutricionista, muito interessada"'
    },
    {
      id: 'funnel',
      title: 'Atualize o funil',
      description: 'Mova um lead pelo funil de vendas',
      icon: <TrendingUp className="w-5 h-5" />,
      completed: hasStageUpdates || progress?.first_stage_update,
      tip: 'Diga pelo WhatsApp: "Maria agendou call para amanhã"'
    },
    {
      id: 'stars',
      title: 'Classifique com estrelas',
      description: 'Use estrelas para priorizar leads (1-5)',
      icon: <Sparkles className="w-5 h-5" />,
      completed: leadsCount >= 3,
      tip: '5⭐ = Prioridade máxima | 1⭐ = Baixa energia'
    }
  ];

  const completedSteps = steps.filter(s => s.completed).length;
  const progressPercent = (completedSteps / steps.length) * 100;

  // Don't show if dismissed or all completed
  if (isDismissed || completedSteps === steps.length) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem('onboarding_dismissed', 'true');
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Primeiros Passos</CardTitle>
              <p className="text-sm text-muted-foreground">
                {completedSteps} de {steps.length} etapas concluídas
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-8 w-8"
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDismiss}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <Progress value={progressPercent} className="h-2 mt-3" />
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="pt-4">
          <div className="space-y-3">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg transition-colors",
                  step.completed 
                    ? "bg-primary/5" 
                    : "bg-muted/30 hover:bg-muted/50"
                )}
              >
                <div className={cn(
                  "mt-0.5 flex-shrink-0",
                  step.completed ? "text-primary" : "text-muted-foreground"
                )}>
                  {step.completed ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <Circle className="w-5 h-5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "font-medium text-sm",
                      step.completed ? "text-primary" : "text-foreground"
                    )}>
                      {step.title}
                    </span>
                    <span className="text-muted-foreground">
                      {step.icon}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {step.description}
                  </p>
                  {!step.completed && step.tip && (
                    <p className="text-xs text-primary/70 mt-1 italic">
                      💡 {step.tip}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-4 p-3 rounded-lg bg-primary/10 border border-primary/20">
            <p className="text-sm font-medium text-primary">
              📱 Dica: Use o WhatsApp!
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Envie áudios, textos ou prints de conversas direto no WhatsApp. 
              Nossa IA cadastra e atualiza leads automaticamente!
            </p>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
