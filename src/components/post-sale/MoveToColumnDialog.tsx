import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { POST_SALE_COLUMNS, PostSaleContactStatus } from '@/hooks/usePostSaleKanban';

interface MoveToColumnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetColumn: PostSaleContactStatus | null;
  onConfirm: (reason: string) => void;
  isLoading?: boolean;
}

export function MoveToColumnDialog({
  open,
  onOpenChange,
  targetColumn,
  onConfirm,
  isLoading = false,
}: MoveToColumnDialogProps) {
  const [reason, setReason] = useState('');
  
  const column = POST_SALE_COLUMNS.find(c => c.id === targetColumn);

  const handleConfirm = () => {
    onConfirm(reason);
    setReason('');
  };

  const handleClose = () => {
    setReason('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mover para: {column?.label}</DialogTitle>
          <DialogDescription>
            Informe o motivo da mudança de status (opcional)
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="reason">Motivo da movimentação</Label>
            <Textarea
              id="reason"
              placeholder="Ex: Cliente pediu para retornar mais tarde..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading}>
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Confirmar Mudança
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
