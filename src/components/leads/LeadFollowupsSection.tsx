import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Calendar, 
  Check, 
  Plus, 
  User,
  Bell,
  Phone,
  PartyPopper,
  Timer,
  XCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useLeadFollowups, useCreateFollowup, useCompleteFollowup } from '@/hooks/useLeadFollowups';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface LeadFollowupsSectionProps {
  leadId: string;
}

const FOLLOWUP_RESULTS = [
  {
    key: 'client_called_first',
    emoji: '📞',
    label: 'Cliente me ligou antes!',
    description: 'Eles vieram até você',
    color: 'bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/30',
    textColor: 'text-blue-700 dark:text-blue-300',
    icon: Phone,
  },
  {
    key: 'success',
    emoji: '🎉',
    label: 'Consegui contato!',
    description: 'Valeu a pena o follow-up',
    color: 'bg-green-500/10 hover:bg-green-500/20 border-green-500/30',
    textColor: 'text-green-700 dark:text-green-300',
    icon: PartyPopper,
  },
  {
    key: 'keep_trying',
    emoji: '⏰',
    label: 'Ainda não atendeu',
    description: 'Fica aí mais tempo...',
    color: 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30',
    textColor: 'text-amber-700 dark:text-amber-300',
    icon: Timer,
  },
  {
    key: 'give_up',
    emoji: '😅',
    label: 'Encerra esse aí',
    description: 'Não vai rolar...',
    color: 'bg-red-500/10 hover:bg-red-500/20 border-red-500/30',
    textColor: 'text-red-700 dark:text-red-300',
    icon: XCircle,
  },
];

const getResultInfo = (resultKey: string | null) => {
  return FOLLOWUP_RESULTS.find(r => r.key === resultKey) || null;
};

export function LeadFollowupsSection({ leadId }: LeadFollowupsSectionProps) {
  const { data: followups = [], isLoading } = useLeadFollowups(leadId);
  const createFollowup = useCreateFollowup();
  const completeFollowup = useCompleteFollowup();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isResultDialogOpen, setIsResultDialogOpen] = useState(false);
  const [selectedFollowupId, setSelectedFollowupId] = useState<string | null>(null);
  const [newFollowup, setNewFollowup] = useState({
    date: '',
    time: '',
    reason: '',
    notes: '',
  });

  const pendingFollowups = followups.filter(f => !f.completed_at);
  const completedFollowups = followups.filter(f => f.completed_at);

  const handleCreate = async () => {
    if (!newFollowup.date || !newFollowup.time) {
      toast({ title: 'Preencha data e hora', variant: 'destructive' });
      return;
    }

    const scheduledAt = new Date(`${newFollowup.date}T${newFollowup.time}`);
    
    await createFollowup.mutateAsync({
      lead_id: leadId,
      scheduled_at: scheduledAt,
      reason: newFollowup.reason || undefined,
      notes: newFollowup.notes || undefined,
    });

    setIsDialogOpen(false);
    setNewFollowup({ date: '', time: '', reason: '', notes: '' });
    toast({ title: 'Follow-up agendado! 📅' });
  };

  const openResultDialog = (followupId: string) => {
    setSelectedFollowupId(followupId);
    setIsResultDialogOpen(true);
  };

  const handleSelectResult = async (resultKey: string) => {
    if (!selectedFollowupId) return;
    
    const resultInfo = getResultInfo(resultKey);
    await completeFollowup.mutateAsync({ 
      id: selectedFollowupId, 
      result: resultKey,
      notes: resultInfo?.label 
    });
    
    setIsResultDialogOpen(false);
    setSelectedFollowupId(null);
    
    const messages = {
      client_called_first: 'Que legal! O cliente veio até você 📞',
      success: 'Boa! Follow-up deu certo! 🎉',
      keep_trying: 'Beleza, vamos aguardar mais um pouco ⏰',
      give_up: 'Sem problemas, partiu pro próximo! 💪',
    };
    toast({ title: messages[resultKey as keyof typeof messages] || 'Follow-up atualizado!' });
  };

  const getSourceLabel = (sourceType: string) => {
    switch (sourceType) {
      case 'receptive': return '📥 Receptivo';
      case 'sale_lost': return '💔 Venda perdida';
      default: return '✏️ Manual';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Follow-ups
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Carregando...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Follow-ups
              {pendingFollowups.length > 0 && (
                <Badge variant="secondary" className="animate-pulse">
                  🔔 {pendingFollowups.length}
                </Badge>
              )}
            </CardTitle>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus className="w-4 h-4 mr-1" />
                  Agendar
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>📅 Agendar Follow-up</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Data</Label>
                      <Input
                        type="date"
                        value={newFollowup.date}
                        onChange={(e) => setNewFollowup(prev => ({ ...prev, date: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Hora</Label>
                      <Input
                        type="time"
                        value={newFollowup.time}
                        onChange={(e) => setNewFollowup(prev => ({ ...prev, time: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Motivo</Label>
                    <Input
                      placeholder="Ex: Retornar sobre proposta"
                      value={newFollowup.reason}
                      onChange={(e) => setNewFollowup(prev => ({ ...prev, reason: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Observações</Label>
                    <Textarea
                      placeholder="Anotações adicionais..."
                      value={newFollowup.notes}
                      onChange={(e) => setNewFollowup(prev => ({ ...prev, notes: e.target.value }))}
                    />
                  </div>
                  <Button 
                    onClick={handleCreate} 
                    disabled={createFollowup.isPending}
                    className="w-full"
                  >
                    Agendar Follow-up 🚀
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {followups.length === 0 ? (
            <div className="text-center py-8">
              <span className="text-4xl mb-2 block">📭</span>
              <p className="text-muted-foreground text-sm">
                Nenhum follow-up agendado ainda
              </p>
            </div>
          ) : (
            <>
              {/* Pending followups */}
              {pendingFollowups.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <span>⏳</span> Pendentes
                  </h4>
                  {pendingFollowups.map((followup) => {
                    const scheduledDate = new Date(followup.scheduled_at);
                    const isOverdue = scheduledDate < new Date();
                    
                    return (
                      <div 
                        key={followup.id} 
                        className={cn(
                          "p-4 rounded-xl border-2 transition-all",
                          isOverdue 
                            ? 'border-red-400 bg-red-50 dark:bg-red-950/30 shadow-red-100 dark:shadow-none' 
                            : 'border-primary/20 bg-primary/5 hover:border-primary/40'
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Calendar className="w-4 h-4 text-muted-foreground" />
                              <span className={cn(
                                "font-semibold",
                                isOverdue ? 'text-red-600 dark:text-red-400' : 'text-foreground'
                              )}>
                                {format(scheduledDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                              </span>
                              {isOverdue && (
                                <Badge variant="destructive" className="text-xs animate-pulse">
                                  🔥 Atrasado!
                                </Badge>
                              )}
                            </div>
                            {followup.reason && (
                              <p className="text-sm text-foreground mb-2 font-medium">
                                💬 {followup.reason}
                              </p>
                            )}
                            <div className="flex items-center gap-3 flex-wrap">
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {followup.user_name}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {getSourceLabel(followup.source_type)}
                              </Badge>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => openResultDialog(followup.id)}
                            disabled={completeFollowup.isPending}
                            className="shrink-0"
                          >
                            <Check className="w-4 h-4 mr-1" />
                            Resultado
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Completed followups */}
              {completedFollowups.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <span>✅</span> Histórico
                  </h4>
                  {completedFollowups.slice(0, 5).map((followup) => {
                    const resultInfo = getResultInfo((followup as any).result);
                    
                    return (
                      <div 
                        key={followup.id} 
                        className={cn(
                          "p-3 rounded-xl border transition-all",
                          resultInfo?.color || 'bg-muted/30 border-muted'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{resultInfo?.emoji || '✓'}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={cn("text-sm font-medium", resultInfo?.textColor)}>
                                {resultInfo?.label || 'Concluído'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>
                                {format(new Date(followup.scheduled_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                              </span>
                              <span>•</span>
                              <span>{followup.user_name}</span>
                            </div>
                            {followup.reason && (
                              <p className="text-xs text-muted-foreground mt-1 truncate">
                                {followup.reason}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Result Selection Dialog */}
      <Dialog open={isResultDialogOpen} onOpenChange={setIsResultDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-xl">
              🎯 Como foi o follow-up?
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            {FOLLOWUP_RESULTS.map((result) => (
              <button
                key={result.key}
                onClick={() => handleSelectResult(result.key)}
                disabled={completeFollowup.isPending}
                className={cn(
                  "flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left",
                  result.color,
                  "hover:scale-[1.02] active:scale-[0.98]",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                <span className="text-3xl">{result.emoji}</span>
                <div className="flex-1">
                  <p className={cn("font-semibold", result.textColor)}>
                    {result.label}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {result.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
