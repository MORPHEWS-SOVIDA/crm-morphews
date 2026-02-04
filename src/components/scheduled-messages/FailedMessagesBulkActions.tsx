import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { 
  RefreshCw, 
  ArrowRightLeft, 
  Loader2, 
  AlertTriangle,
  WifiOff,
  CheckCircle,
  ChevronDown,
  MessageSquare,
} from 'lucide-react';
import { useEvolutionInstances } from '@/hooks/useEvolutionInstances';
import { 
  useRetryFailedMessagesBulk, 
  useChangeMessageInstance,
  ScheduledMessage 
} from '@/hooks/useScheduledMessages';

interface FailedMessagesBulkActionsProps {
  messages: ScheduledMessage[];
  onComplete: () => void;
}

export function FailedMessagesBulkActions({ messages, onComplete }: FailedMessagesBulkActionsProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showRetryDialog, setShowRetryDialog] = useState(false);
  const [showChangeInstanceDialog, setShowChangeInstanceDialog] = useState(false);
  const [targetInstanceId, setTargetInstanceId] = useState('');
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());

  const { instances: evolutionInstances = [] } = useEvolutionInstances();
  const retryBulk = useRetryFailedMessagesBulk();
  const changeInstance = useChangeMessageInstance();

  // Filter active WhatsApp instances
  const activeInstances = useMemo(() => 
    (evolutionInstances || []).filter(i => !i.deleted_at && i.channel_type !== 'instagram'),
    [evolutionInstances]
  );

  // Connected instances for selection
  const connectedInstances = useMemo(() => 
    activeInstances.filter(i => i.is_connected && i.status === 'active'),
    [activeInstances]
  );

  const failedMessages = messages.filter(
    m => m.status === 'failed_offline' || m.status === 'failed_other'
  );

  const failedOfflineCount = failedMessages.filter(m => m.status === 'failed_offline').length;
  const failedOtherCount = failedMessages.filter(m => m.status === 'failed_other').length;

  // Group by failure reason
  const failureReasons = new Map<string, number>();
  failedMessages.forEach(m => {
    const reason = m.failure_reason || 'Erro desconhecido';
    failureReasons.set(reason, (failureReasons.get(reason) || 0) + 1);
  });

  const sortedReasons = Array.from(failureReasons.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const toggleExpanded = (id: string) => {
    const newSet = new Set(expandedMessages);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedMessages(newSet);
  };

  const selectAll = () => {
    setSelectedIds(new Set(failedMessages.map(m => m.id)));
  };

  const selectNone = () => {
    setSelectedIds(new Set());
  };

  const selectByStatus = (status: 'failed_offline' | 'failed_other') => {
    setSelectedIds(new Set(failedMessages.filter(m => m.status === status).map(m => m.id)));
  };

  const handleRetrySelected = () => {
    if (selectedIds.size === 0) return;
    
    retryBulk.mutate(
      { ids: Array.from(selectedIds), newInstanceId: targetInstanceId || undefined },
      {
        onSuccess: () => {
          setSelectedIds(new Set());
          setShowRetryDialog(false);
          setTargetInstanceId('');
          onComplete();
        },
      }
    );
  };

  const handleChangeInstance = () => {
    if (selectedIds.size === 0 || !targetInstanceId) return;
    
    changeInstance.mutate(
      { ids: Array.from(selectedIds), newInstanceId: targetInstanceId },
      {
        onSuccess: () => {
          setSelectedIds(new Set());
          setShowChangeInstanceDialog(false);
          setTargetInstanceId('');
          onComplete();
        },
      }
    );
  };

  if (failedMessages.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
        <p>Nenhuma mensagem com falha! 🎉</p>
      </div>
    );
  }

  

  return (
    <div className="space-y-4">
      {/* Stats summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <span className="text-sm font-medium text-red-700 dark:text-red-300">
              Total Falhadas
            </span>
          </div>
          <p className="text-2xl font-bold text-red-600 mt-1">{failedMessages.length}</p>
        </div>
        
        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
              Offline
            </span>
          </div>
          <p className="text-2xl font-bold text-amber-600 mt-1">{failedOfflineCount}</p>
        </div>

        <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/30 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-slate-600" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Outros Erros
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-600 mt-1">{failedOtherCount}</p>
        </div>

        <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-green-700 dark:text-green-300">
              Inst. Conectadas
            </span>
          </div>
          <p className="text-2xl font-bold text-green-600 mt-1">{connectedInstances.length}</p>
        </div>
      </div>

      {/* Top failure reasons */}
      <div className="p-4 rounded-lg border bg-muted/50">
        <h4 className="text-sm font-medium mb-2">Principais motivos de falha:</h4>
        <div className="flex flex-wrap gap-2">
          {sortedReasons.map(([reason, count]) => (
            <Badge key={reason} variant="outline" className="text-xs">
              {reason.length > 50 ? reason.slice(0, 50) + '...' : reason} ({count})
            </Badge>
          ))}
        </div>
      </div>

      {/* Selection controls */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Selecionar:</span>
        <Button variant="outline" size="sm" onClick={selectAll}>
          Todas ({failedMessages.length})
        </Button>
        {failedOfflineCount > 0 && (
          <Button variant="outline" size="sm" onClick={() => selectByStatus('failed_offline')}>
            Offline ({failedOfflineCount})
          </Button>
        )}
        {failedOtherCount > 0 && (
          <Button variant="outline" size="sm" onClick={() => selectByStatus('failed_other')}>
            Outros ({failedOtherCount})
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={selectNone}>
          Limpar
        </Button>
        
        {selectedIds.size > 0 && (
          <Badge variant="secondary" className="ml-auto">
            {selectedIds.size} selecionadas
          </Badge>
        )}
      </div>

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap gap-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
          <Button 
            onClick={() => setShowRetryDialog(true)}
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Reagendar {selectedIds.size}
          </Button>
          <Button 
            variant="outline"
            onClick={() => setShowChangeInstanceDialog(true)}
            className="gap-2"
          >
            <ArrowRightLeft className="w-4 h-4" />
            Trocar Instância
          </Button>
        </div>
      )}

      {/* Failed messages list */}
      <ScrollArea className="h-80">
        <div className="space-y-2">
          {failedMessages.map(msg => (
            <Collapsible 
              key={msg.id} 
              open={expandedMessages.has(msg.id)}
              onOpenChange={() => toggleExpanded(msg.id)}
            >
              <div 
                className={`rounded-lg border transition-colors ${
                  selectedIds.has(msg.id) 
                    ? 'bg-primary/10 border-primary' 
                    : 'bg-background hover:bg-muted/50'
                }`}
              >
                <div 
                  className="flex items-center gap-3 p-3 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSelect(msg.id);
                  }}
                >
                  <Checkbox 
                    checked={selectedIds.has(msg.id)}
                    onCheckedChange={() => toggleSelect(msg.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{msg.lead?.name}</span>
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${
                          msg.status === 'failed_offline' 
                            ? 'border-amber-400 text-amber-600' 
                            : 'border-red-400 text-red-600'
                        }`}
                      >
                        {msg.status === 'failed_offline' ? 'Offline' : 'Falhou'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {msg.failure_reason || 'Erro desconhecido'}
                    </p>
                  </div>
                  {msg.whatsapp_instance?.name && (
                    <span className="text-xs text-muted-foreground">
                      {msg.whatsapp_instance.name}
                    </span>
                  )}
                  <CollapsibleTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <ChevronDown className={`h-4 w-4 transition-transform ${expandedMessages.has(msg.id) ? 'rotate-180' : ''}`} />
                    </Button>
                  </CollapsibleTrigger>
                </div>
                <CollapsibleContent>
                  <div className="px-3 pb-3 pt-0">
                    <div className="bg-muted/50 rounded-md p-3 border">
                      <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                        <MessageSquare className="h-3 w-3" />
                        <span>Conteúdo da mensagem:</span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap break-words">
                        {msg.final_message || <span className="italic text-muted-foreground">Sem conteúdo</span>}
                      </p>
                    </div>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          ))}
        </div>
      </ScrollArea>

      {/* Retry Dialog */}
      <Dialog open={showRetryDialog} onOpenChange={setShowRetryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reagendar {selectedIds.size} Mensagens</DialogTitle>
            <DialogDescription>
              As mensagens serão reagendadas para envio em 1 minuto. 
              Opcionalmente, selecione uma nova instância.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Nova Instância (opcional)
              </label>
              <Select value={targetInstanceId} onValueChange={setTargetInstanceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Manter instância atual" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Manter instância atual</SelectItem>
                  {activeInstances.map(inst => (
                    <SelectItem key={inst.id} value={inst.id}>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${inst.is_connected ? 'bg-green-500' : 'bg-red-500'}`} />
                        {inst.name || inst.phone_number}
                        {!inst.is_connected && <span className="text-xs text-muted-foreground">(offline)</span>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Se não selecionar, o sistema tentará automaticamente com todas as instâncias conectadas.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRetryDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleRetrySelected} disabled={retryBulk.isPending}>
              {retryBulk.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Reagendar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Instance Dialog */}
      <Dialog open={showChangeInstanceDialog} onOpenChange={setShowChangeInstanceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Trocar Instância</DialogTitle>
            <DialogDescription>
              Selecione uma nova instância para {selectedIds.size} mensagens.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nova Instância *</label>
              <Select value={targetInstanceId} onValueChange={setTargetInstanceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar instância..." />
                </SelectTrigger>
                <SelectContent>
                  {activeInstances.map(inst => (
                    <SelectItem key={inst.id} value={inst.id}>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${inst.is_connected ? 'bg-green-500' : 'bg-red-500'}`} />
                        {inst.name || inst.phone_number}
                        {!inst.is_connected && <span className="text-xs text-muted-foreground">(offline)</span>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowChangeInstanceDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleChangeInstance} 
              disabled={changeInstance.isPending || !targetInstanceId}
            >
              {changeInstance.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Trocar Instância
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
