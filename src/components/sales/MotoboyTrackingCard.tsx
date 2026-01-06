import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bike, Clock, User, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  useMotoboyTrackingHistory,
  useUpdateMotoboyTracking,
  useMotoboyTrackingStatuses,
  motoboyTrackingOrder,
  getMotoboyStatusLabel,
  type MotoboyTrackingStatus,
} from '@/hooks/useMotoboyTracking';
import { useMyPermissions } from '@/hooks/useUserPermissions';
import { toast } from 'sonner';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface MotoboyTrackingCardProps {
  saleId: string;
  currentStatus: MotoboyTrackingStatus | null;
  isCancelled?: boolean;
}

const statusColors: Record<MotoboyTrackingStatus, string> = {
  waiting_expedition: 'bg-slate-100 text-slate-700 border-slate-300',
  expedition_ready: 'bg-blue-100 text-blue-700 border-blue-300',
  handed_to_motoboy: 'bg-cyan-100 text-cyan-700 border-cyan-300',
  next_delivery: 'bg-purple-100 text-purple-700 border-purple-300',
  special_delay: 'bg-orange-100 text-orange-700 border-orange-300',
  call_motoboy: 'bg-amber-100 text-amber-700 border-amber-300',
  delivered: 'bg-green-100 text-green-700 border-green-300',
  returned: 'bg-red-100 text-red-700 border-red-300',
};

export function MotoboyTrackingCard({
  saleId,
  currentStatus,
  isCancelled,
}: MotoboyTrackingCardProps) {
  const { data: history = [], isLoading } = useMotoboyTrackingHistory(saleId);
  const { data: statusConfigs = [] } = useMotoboyTrackingStatuses();
  const updateMutation = useUpdateMotoboyTracking();
  const { data: permissions } = useMyPermissions();
  const [selectedStatus, setSelectedStatus] = useState<MotoboyTrackingStatus | ''>('');
  const [notes, setNotes] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  const canUpdate = permissions?.sales_dispatch || permissions?.sales_view_all || permissions?.deliveries_view_own;

  // Filter active statuses from config
  const activeStatuses = statusConfigs.filter(s => s.is_active);

  const handleUpdate = async () => {
    if (!selectedStatus) {
      toast.error('Selecione um status');
      return;
    }

    if (isCancelled) {
      toast.error('Venda cancelada não pode ser alterada');
      return;
    }

    try {
      await updateMutation.mutateAsync({
        saleId,
        status: selectedStatus,
        notes: notes || undefined,
      });
      toast.success('Status de entrega atualizado');
      setSelectedStatus('');
      setNotes('');
    } catch (error) {
      toast.error('Erro ao atualizar status');
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rastreio Motoboy</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse h-20 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Bike className="w-5 h-5 text-primary" />
          Rastreio Motoboy
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Status */}
        <div className="space-y-2">
          <span className="text-sm text-muted-foreground">Status atual:</span>
          {currentStatus ? (
            <Badge className={`${statusColors[currentStatus]} border text-sm px-3 py-1`}>
              {getMotoboyStatusLabel(currentStatus, statusConfigs)}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              Nenhum status definido
            </Badge>
          )}
        </div>

        {/* Update Form */}
        {canUpdate && !isCancelled && (
          <div className="space-y-3 pt-3 border-t">
            <Select value={selectedStatus} onValueChange={(v) => setSelectedStatus(v as MotoboyTrackingStatus)}>
              <SelectTrigger>
                <SelectValue placeholder="Atualizar status..." />
              </SelectTrigger>
              <SelectContent>
                {activeStatuses.length > 0 ? (
                  activeStatuses.map(config => (
                    <SelectItem key={config.status_key} value={config.status_key}>
                      {config.label}
                    </SelectItem>
                  ))
                ) : (
                  motoboyTrackingOrder.map(status => (
                    <SelectItem key={status} value={status}>
                      {getMotoboyStatusLabel(status, statusConfigs)}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>

            {selectedStatus && (
              <>
                <Textarea
                  placeholder="Observação (opcional)"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="h-16 text-sm"
                />
                <Button
                  size="sm"
                  onClick={handleUpdate}
                  disabled={updateMutation.isPending}
                  className="w-full"
                >
                  Atualizar Status
                </Button>
              </>
            )}
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <Collapsible open={showHistory} onOpenChange={setShowHistory}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between">
                <span>Histórico ({history.length})</span>
                {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-2 mt-2 max-h-64 overflow-y-auto">
                {history.map(entry => (
                  <div key={entry.id} className="p-2 bg-muted/30 rounded text-sm space-y-1">
                    <div className="flex items-center justify-between">
                      <Badge className={`${statusColors[entry.status]} border text-xs`}>
                        {getMotoboyStatusLabel(entry.status, statusConfigs)}
                      </Badge>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(new Date(entry.created_at), "dd/MM HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    {entry.changed_by_profile && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {`${entry.changed_by_profile.first_name || ''} ${entry.changed_by_profile.last_name || ''}`.trim()}
                      </span>
                    )}
                    {entry.notes && (
                      <p className="text-xs text-muted-foreground">{entry.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}
