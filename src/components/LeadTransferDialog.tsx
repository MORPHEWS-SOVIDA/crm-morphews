import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, UserPlus } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ExistingLeadWithOwner, useTransferLeadOwnership } from '@/hooks/useLeadOwnership';
import { useAuth } from '@/hooks/useAuth';

interface LeadTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingLead: ExistingLeadWithOwner | null;
  reason: 'cadastro' | 'atendimento_whatsapp' | 'manual' | 'receptivo';
  onTransferComplete?: (leadId: string) => void;
}

export function LeadTransferDialog({
  open,
  onOpenChange,
  existingLead,
  reason,
  onTransferComplete,
}: LeadTransferDialogProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const transferOwnership = useTransferLeadOwnership();
  const [notes, setNotes] = useState('');

  if (!existingLead) return null;

  const reasonLabels: Record<string, string> = {
    cadastro: 'Tentativa de cadastro',
    atendimento_whatsapp: 'Atendimento WhatsApp',
    manual: 'Transferência manual',
    receptivo: 'Atendimento receptivo',
  };

  const handleTransfer = async () => {
    if (!user?.id) return;

    await transferOwnership.mutateAsync({
      leadId: existingLead.id,
      toUserId: user.id,
      fromUserId: existingLead.owner_user_id,
      reason,
      notes: notes || reasonLabels[reason],
    });

    onOpenChange(false);
    
    if (onTransferComplete) {
      onTransferComplete(existingLead.id);
    } else {
      navigate(`/leads/${existingLead.id}`);
    }
  };

  const handleViewLead = () => {
    onOpenChange(false);
    navigate(`/leads/${existingLead.id}`);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="w-5 h-5" />
            Lead já cadastrado
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              Este WhatsApp já está cadastrado para o lead{' '}
              <strong className="text-foreground">{existingLead.name}</strong> e está
              associado ao usuário{' '}
              <strong className="text-foreground">{existingLead.owner_name}</strong>.
            </p>
            <p className="text-sm">
              Você pode assumir este lead, ficando como responsável e tendo acesso
              a todos os dados e histórico. O usuário anterior também continuará
              tendo acesso.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3 py-2">
          <Label htmlFor="transfer-notes">Observação (opcional)</Label>
          <Textarea
            id="transfer-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex: Cliente entrou em contato comigo diretamente..."
            rows={2}
          />
        </div>

        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel className="w-full sm:w-auto">Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleViewLead}
            className="w-full sm:w-auto bg-secondary text-secondary-foreground hover:bg-secondary/80"
          >
            Apenas visualizar
          </AlertDialogAction>
          <AlertDialogAction
            onClick={handleTransfer}
            disabled={transferOwnership.isPending}
            className="w-full sm:w-auto gap-2"
          >
            <UserPlus className="w-4 h-4" />
            Assumir Lead
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
