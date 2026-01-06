import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, Bike, Pencil, Check, X, Webhook } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  useMotoboyTrackingStatuses,
  useUpdateMotoboyTrackingStatus,
} from '@/hooks/useMotoboyTracking';
import { toast } from 'sonner';

export function MotoboyTrackingStatusesManager() {
  const { data: statuses = [], isLoading } = useMotoboyTrackingStatuses();
  const updateStatus = useUpdateMotoboyTrackingStatus();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editWebhook, setEditWebhook] = useState('');

  const startEdit = (status: typeof statuses[0]) => {
    setEditingId(status.id);
    setEditLabel(status.label);
    setEditWebhook(status.webhook_url || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditLabel('');
    setEditWebhook('');
  };

  const saveEdit = async () => {
    if (!editingId) return;
    
    try {
      await updateStatus.mutateAsync({
        id: editingId,
        label: editLabel,
        webhook_url: editWebhook || null,
      });
      toast.success('Status atualizado');
      cancelEdit();
    } catch (error) {
      toast.error('Erro ao atualizar');
    }
  };

  const handleToggleActive = async (status: typeof statuses[0]) => {
    try {
      await updateStatus.mutateAsync({
        id: status.id,
        is_active: !status.is_active,
      });
      toast.success(status.is_active ? 'Status desativado' : 'Status ativado');
    } catch (error) {
      toast.error('Erro ao alterar status');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-4">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (statuses.length === 0) {
    return (
      <div className="text-center p-8 border rounded-lg border-dashed">
        <Bike className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Nenhum status de motoboy configurado</p>
        <p className="text-sm text-muted-foreground mt-2">
          Os status serão criados automaticamente quando você criar uma nova organização.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Configure os status de rastreio para entregas via motoboy. Cada status pode ter um webhook para notificações externas.
        </p>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Webhook URL</TableHead>
              <TableHead>Ativo</TableHead>
              <TableHead className="w-24">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {statuses.map((status) => (
              <TableRow key={status.id}>
                <TableCell>
                  {editingId === status.id ? (
                    <Input
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      className="max-w-[250px]"
                    />
                  ) : (
                    <div>
                      <span className="font-medium">{status.label}</span>
                      <span className="text-xs text-muted-foreground block">
                        {status.status_key}
                      </span>
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  {editingId === status.id ? (
                    <div className="flex items-center gap-2">
                      <Webhook className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <Input
                        value={editWebhook}
                        onChange={(e) => setEditWebhook(e.target.value)}
                        placeholder="https://..."
                        className="flex-1"
                      />
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground truncate block max-w-[300px]">
                      {status.webhook_url || '-'}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge 
                    variant={status.is_active ? 'default' : 'secondary'}
                    className="cursor-pointer"
                    onClick={() => handleToggleActive(status)}
                  >
                    {status.is_active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </TableCell>
                <TableCell>
                  {editingId === status.id ? (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-green-600"
                        onClick={saveEdit}
                        disabled={updateStatus.isPending}
                      >
                        {updateStatus.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={cancelEdit}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => startEdit(status)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
