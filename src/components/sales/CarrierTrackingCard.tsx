import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Truck, Clock, User, ChevronDown, ChevronUp, Package, Copy, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  useCarrierTrackingHistory,
  useUpdateCarrierTracking,
  carrierTrackingLabels,
  carrierTrackingOrder,
  type CarrierTrackingStatus,
} from '@/hooks/useCarrierTracking';
import { useMyPermissions } from '@/hooks/useUserPermissions';
import { useUpdateSale } from '@/hooks/useSales';
import { toast } from 'sonner';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { DeliveryDateDialog } from './DeliveryDateDialog';
import { CorreiosLabelSection } from './CorreiosLabelSection';

interface CarrierTrackingCardProps {
  saleId: string;
  currentStatus: CarrierTrackingStatus | null;
  trackingCode?: string | null;
  isCancelled?: boolean;
  sale?: any; // Full sale object for Correios integration
}

const statusColors: Record<CarrierTrackingStatus, string> = {
  waiting_post: 'bg-slate-100 text-slate-700 border-slate-300',
  posted: 'bg-blue-100 text-blue-700 border-blue-300',
  in_destination_city: 'bg-cyan-100 text-cyan-700 border-cyan-300',
  attempt_1_failed: 'bg-orange-100 text-orange-700 border-orange-300',
  attempt_2_failed: 'bg-orange-200 text-orange-800 border-orange-400',
  attempt_3_failed: 'bg-red-100 text-red-700 border-red-300',
  waiting_pickup: 'bg-amber-100 text-amber-700 border-amber-300',
  returning_to_sender: 'bg-red-200 text-red-800 border-red-400',
  delivered: 'bg-green-100 text-green-700 border-green-300',
};

export function CarrierTrackingCard({
  saleId,
  currentStatus,
  trackingCode,
  isCancelled,
  sale,
}: CarrierTrackingCardProps) {
  const { data: history = [], isLoading } = useCarrierTrackingHistory(saleId);
  const updateMutation = useUpdateCarrierTracking();
  const updateSale = useUpdateSale();
  const { data: permissions } = useMyPermissions();
  const [selectedStatus, setSelectedStatus] = useState<CarrierTrackingStatus | ''>('');
  const [notes, setNotes] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [editingTrackingCode, setEditingTrackingCode] = useState(false);
  const [newTrackingCode, setNewTrackingCode] = useState(trackingCode || '');
  const [showDateDialog, setShowDateDialog] = useState(false);

  const canUpdate = permissions?.sales_dispatch || permissions?.sales_view_all;

  const handleSaveTrackingCode = async () => {
    try {
      await updateSale.mutateAsync({
        id: saleId,
        data: { tracking_code: newTrackingCode || null }
      });
      toast.success('Código de rastreio atualizado!');
      setEditingTrackingCode(false);
    } catch (error) {
      toast.error('Erro ao atualizar código');
    }
  };

  const handleUpdate = async (occurredAt?: Date) => {
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
        occurredAt: occurredAt?.toISOString(),
      });
      toast.success('Status de rastreio atualizado');
      setSelectedStatus('');
      setNotes('');
      setShowDateDialog(false);
    } catch (error) {
      toast.error('Erro ao atualizar status');
    }
  };

  const handleClickUpdate = () => {
    // If status is delivered or returning, show date dialog
    if (selectedStatus === 'delivered' || selectedStatus === 'returning_to_sender') {
      setShowDateDialog(true);
    } else {
      handleUpdate();
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rastreio Transportadora</CardTitle>
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
          <Truck className="w-5 h-5 text-primary" />
          Rastreio Transportadora
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tracking Code */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Código de Rastreio</Label>
          {editingTrackingCode ? (
            <div className="flex gap-2">
              <Input
                value={newTrackingCode}
                onChange={(e) => setNewTrackingCode(e.target.value)}
                placeholder="Ex: BR123456789BR"
                className="font-mono text-sm"
              />
              <Button size="sm" onClick={handleSaveTrackingCode} disabled={updateSale.isPending}>
                Salvar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingTrackingCode(false)}>
                Cancelar
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
              <Package className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-mono flex-1">
                {trackingCode || 'Não informado'}
              </span>
              {canUpdate && !isCancelled && (
                <>
                  {trackingCode && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => {
                        navigator.clipboard.writeText(trackingCode);
                        toast.success('Código copiado!');
                      }}
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => {
                      setNewTrackingCode(trackingCode || '');
                      setEditingTrackingCode(true);
                    }}
                  >
                    <Pencil className="w-3 h-3" />
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Current Status */}
        <div className="space-y-2">
          <span className="text-sm text-muted-foreground">Status atual:</span>
          {currentStatus ? (
            <Badge className={`${statusColors[currentStatus]} border text-sm px-3 py-1`}>
              {carrierTrackingLabels[currentStatus]}
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
            <Select value={selectedStatus} onValueChange={(v) => setSelectedStatus(v as CarrierTrackingStatus)}>
              <SelectTrigger>
                <SelectValue placeholder="Atualizar status..." />
              </SelectTrigger>
              <SelectContent>
                {carrierTrackingOrder.map(status => (
                  <SelectItem key={status} value={status}>
                    {carrierTrackingLabels[status]}
                  </SelectItem>
                ))}
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
                  onClick={handleClickUpdate}
                  disabled={updateMutation.isPending}
                  className="w-full"
                >
                  Atualizar Status
                </Button>
              </>
            )}
          </div>
        )}

        {/* Date Dialog for delivered/returned statuses */}
        <DeliveryDateDialog
          open={showDateDialog}
          onOpenChange={setShowDateDialog}
          title={selectedStatus === 'delivered' ? 'Data da Entrega' : 'Data da Devolução'}
          description="Em qual data realmente aconteceu? (importante para comissões)"
          onConfirm={(date) => handleUpdate(date)}
          isLoading={updateMutation.isPending}
        />

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
                        {carrierTrackingLabels[entry.status]}
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

        {/* Correios Label Section - only if sale is provided */}
        {sale && (
          <>
            <Separator />
            <CorreiosLabelSection sale={sale} isCancelled={isCancelled} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
