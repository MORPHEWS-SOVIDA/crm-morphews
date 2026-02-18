import { useState } from 'react';
import { Calendar, Loader2, Zap, Coins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FollowupDateTimeEditor } from '@/components/leads/FollowupDateTimeEditor';

interface NonPurchaseReason {
  id: string;
  name: string;
  followup_hours: number;
  exclusivity_hours: number;
}

interface QuickFollowupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reasons: NonPurchaseReason[];
  purchasePotential?: number;
  onPurchasePotentialChange?: (value: number) => void;
  onSelectReason: (reasonId: string, followupDate?: Date) => Promise<void>;
  isSaving: boolean;
}

export function QuickFollowupDialog({
  open,
  onOpenChange,
  reasons,
  purchasePotential = 0,
  onPurchasePotentialChange,
  onSelectReason,
  isSaving,
}: QuickFollowupDialogProps) {
  const [pendingReasonId, setPendingReasonId] = useState<string | null>(null);
  const [localPotential, setLocalPotential] = useState(purchasePotential);
  const pendingReason = reasons.find(r => r.id === pendingReasonId);

  // Sync local state when dialog opens
  const handleOpenChange = (val: boolean) => {
    if (val) {
      setLocalPotential(purchasePotential);
    }
    if (!val) setPendingReasonId(null);
    onOpenChange(val);
  };

  const updatePotential = (cents: number) => {
    setLocalPotential(cents);
    onPurchasePotentialChange?.(cents);
  };

  const handleReasonClick = async (reason: NonPurchaseReason) => {
    if (reason.followup_hours > 0) {
      setPendingReasonId(reason.id);
    } else {
      await onSelectReason(reason.id);
      handleOpenChange(false);
    }
  };

  const handleFollowupConfirm = async (date: Date) => {
    if (!pendingReasonId) return;
    await onSelectReason(pendingReasonId, date);
    setPendingReasonId(null);
    handleOpenChange(false);
  };

  const handleCancel = () => {
    setPendingReasonId(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Zap className="w-5 h-5" />
            Sem Interesse
          </DialogTitle>
          <DialogDescription>
            Informe o potencial e selecione o motivo
          </DialogDescription>
        </DialogHeader>

        {/* Purchase Potential Input */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-sm">
            <Coins className="w-4 h-4 text-amber-500" />
            Potencial de Compra
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium pointer-events-none text-sm">
              R$
            </span>
            <Input
              type="text"
              inputMode="numeric"
              placeholder="0,00"
              value={localPotential > 0 ? (localPotential / 100).toFixed(2).replace('.', ',') : ''}
              onChange={(e) => {
                const rawValue = e.target.value;
                if (!rawValue.trim()) {
                  updatePotential(0);
                  return;
                }
                const onlyDigits = rawValue.replace(/\D/g, '');
                const cents = parseInt(onlyDigits || '0', 10);
                updatePotential(cents);
              }}
              onFocus={(e) => setTimeout(() => e.target.select(), 0)}
              className="pl-10 text-right"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Valor adicionado ao "Negociado" do lead
          </p>
        </div>

        <Separator />

        {pendingReason ? (
          <div className="space-y-4 p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  {pendingReason.name}
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Confirme a data/hora do follow-up
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                disabled={isSaving}
              >
                Cancelar
              </Button>
            </div>
            <FollowupDateTimeEditor
              suggestedHours={pendingReason.followup_hours}
              onConfirm={handleFollowupConfirm}
              disabled={isSaving}
            />
          </div>
        ) : (
          <ScrollArea className="max-h-[50vh]">
            <div className="space-y-2 pr-4">
              {reasons.map((reason) => (
                <Button
                  key={reason.id}
                  variant="outline"
                  className="w-full justify-start h-auto p-4 text-left"
                  onClick={() => handleReasonClick(reason)}
                  disabled={isSaving}
                >
                  <div className="flex-1">
                    <p className="font-medium">{reason.name}</p>
                    {reason.followup_hours > 0 && (
                      <Badge variant="secondary" className="text-xs mt-1">
                        <Calendar className="w-3 h-3 mr-1" />
                        Sugestão: {reason.followup_hours}h
                      </Badge>
                    )}
                  </div>
                  {isSaving && (
                    <Loader2 className="w-4 h-4 animate-spin ml-2" />
                  )}
                </Button>
              ))}

              {reasons.length === 0 && (
                <p className="text-center text-muted-foreground py-4">
                  Nenhum motivo cadastrado. Configure em Configurações.
                </p>
              )}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
