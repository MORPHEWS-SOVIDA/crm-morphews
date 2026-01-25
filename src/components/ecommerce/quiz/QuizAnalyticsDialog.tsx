import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Eye, Users, CheckCircle, MousePointer, TrendingDown, ArrowRight } from 'lucide-react';
import { useQuizAnalytics, useQuiz } from '@/hooks/ecommerce/useQuizzes';

interface QuizAnalyticsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quizId: string;
}

export function QuizAnalyticsDialog({ open, onOpenChange, quizId }: QuizAnalyticsDialogProps) {
  const { data: analytics, isLoading: loadingAnalytics } = useQuizAnalytics(quizId);
  const { data: quiz, isLoading: loadingQuiz } = useQuiz(quizId);

  const isLoading = loadingAnalytics || loadingQuiz;

  const metrics = [
    {
      label: 'Visualizações',
      value: analytics?.total_views || 0,
      icon: Eye,
      color: 'text-blue-500',
    },
    {
      label: 'Iniciados',
      value: analytics?.total_started || 0,
      icon: Users,
      color: 'text-purple-500',
    },
    {
      label: 'Completados',
      value: analytics?.total_completed || 0,
      icon: CheckCircle,
      color: 'text-green-500',
    },
    {
      label: 'Leads Capturados',
      value: analytics?.total_leads || 0,
      icon: Users,
      color: 'text-orange-500',
    },
    {
      label: 'Cliques CTA',
      value: analytics?.total_cta_clicks || 0,
      icon: MousePointer,
      color: 'text-pink-500',
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            Métricas do Quiz: {quiz?.name}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : (
          <ScrollArea className="max-h-[calc(90vh-120px)]">
            <div className="space-y-6 p-1">
              {/* Overview Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {metrics.map(metric => (
                  <Card key={metric.label}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <metric.icon className={`h-4 w-4 ${metric.color}`} />
                        <span className="text-xs text-muted-foreground">{metric.label}</span>
                      </div>
                      <p className="text-2xl font-bold">{metric.value}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Conversion Rates */}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Taxa de Conclusão</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Iniciados → Completados</span>
                        <span className="font-medium">
                          {analytics?.completion_rate.toFixed(1)}%
                        </span>
                      </div>
                      <Progress value={analytics?.completion_rate || 0} />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Taxa de Captura</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Iniciados → Leads</span>
                        <span className="font-medium">
                          {analytics?.lead_capture_rate.toFixed(1)}%
                        </span>
                      </div>
                      <Progress value={analytics?.lead_capture_rate || 0} />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Step Funnel */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingDown className="h-4 w-4" />
                    Funil por Etapa
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {analytics?.step_analytics.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhum dado de etapas ainda
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {analytics?.step_analytics.map((step, index) => (
                        <div key={step.step_id} className="relative">
                          <div className="flex items-center gap-4">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                              {index + 1}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-medium truncate max-w-[200px]">
                                  {step.step_title}
                                </span>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs">
                                    {step.views} views
                                  </Badge>
                                  <Badge variant="outline" className="text-xs text-green-600">
                                    {step.completions} ok
                                  </Badge>
                                  {step.drop_offs > 0 && (
                                    <Badge variant="outline" className="text-xs text-red-600">
                                      {step.drop_offs} saídas
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Progress 
                                  value={step.pass_rate} 
                                  className="flex-1 h-2"
                                />
                                <span className="text-xs text-muted-foreground w-12">
                                  {step.pass_rate.toFixed(0)}%
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          {index < (analytics?.step_analytics.length || 0) - 1 && (
                            <div className="ml-4 mt-2 mb-2 flex items-center text-muted-foreground">
                              <ArrowRight className="h-4 w-4" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
