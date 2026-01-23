import { useState, useEffect } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { FUNNEL_STAGES, FunnelStage } from '@/types/lead';
import { cn } from '@/lib/utils';
import { Calendar, Clock, X } from 'lucide-react';
import { useNonPurchaseReasons, NonPurchaseReason } from '@/hooks/useNonPurchaseReasons';
import { FollowupDateTimeEditor } from '@/components/leads/FollowupDateTimeEditor';

interface StageInfo {
  name: string;
  color: string;
  textColor: string;
}

export interface StageChangeResult {
  reason: string | null;
  followupReasonId: string | null;
  followupDate: Date | null;
}

interface StageChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  previousStage: FunnelStage;
  newStage: FunnelStage;
  onConfirm: (result: StageChangeResult) => void;
  isLoading?: boolean;
  // Custom stage info from tenant (optional - falls back to FUNNEL_STAGES)
  previousStageInfo?: StageInfo;
  newStageInfo?: StageInfo;
  // Default followup reason ID for the new stage (from organization_funnel_stages)
  defaultFollowupReasonId?: string | null;
}

export function StageChangeDialog({
  open,
  onOpenChange,
  previousStage,
  newStage,
  onConfirm,
  isLoading,
  previousStageInfo,
  newStageInfo,
  defaultFollowupReasonId,
}: StageChangeDialogProps) {
  const [reason, setReason] = useState('');
  const [selectedFollowupReasonId, setSelectedFollowupReasonId] = useState<string | null>(null);
  const [showFollowupPicker, setShowFollowupPicker] = useState(false);
  const [followupDate, setFollowupDate] = useState<Date | null>(null);

  const { data: nonPurchaseReasons = [] } = useNonPurchaseReasons();

  // Get the selected follow-up reason details
  const selectedFollowup = nonPurchaseReasons.find(r => r.id === selectedFollowupReasonId);

  // Set default followup when dialog opens or default changes
  useEffect(() => {
    if (open && defaultFollowupReasonId) {
      setSelectedFollowupReasonId(defaultFollowupReasonId);
      const defaultReason = nonPurchaseReasons.find(r => r.id === defaultFollowupReasonId);
      if (defaultReason && defaultReason.followup_hours > 0) {
        setShowFollowupPicker(true);
        // Set suggested date based on followup_hours
        const suggestedDate = new Date();
        suggestedDate.setHours(suggestedDate.getHours() + defaultReason.followup_hours);
        setFollowupDate(suggestedDate);
      }
    }
  }, [open, defaultFollowupReasonId, nonPurchaseReasons]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setReason('');
      setSelectedFollowupReasonId(null);
      setShowFollowupPicker(false);
      setFollowupDate(null);
    }
  }, [open]);

  // Handle followup reason change
  const handleFollowupReasonChange = (reasonId: string) => {
    if (reasonId === 'none') {
      setSelectedFollowupReasonId(null);
      setShowFollowupPicker(false);
      setFollowupDate(null);
    } else {
      setSelectedFollowupReasonId(reasonId);
      const selectedReason = nonPurchaseReasons.find(r => r.id === reasonId);
      if (selectedReason && selectedReason.followup_hours > 0) {
        setShowFollowupPicker(true);
        const suggestedDate = new Date();
        suggestedDate.setHours(suggestedDate.getHours() + selectedReason.followup_hours);
        setFollowupDate(suggestedDate);
      } else {
        setShowFollowupPicker(false);
        setFollowupDate(null);
      }
    }
  };

  // Use custom stage info if provided, otherwise fallback to FUNNEL_STAGES
  const fallbackPrevious = FUNNEL_STAGES[previousStage];
  const fallbackNew = FUNNEL_STAGES[newStage];

  const prevInfo = previousStageInfo || {
    name: fallbackPrevious?.label || previousStage,
    color: fallbackPrevious?.color || 'bg-muted',
    textColor: fallbackPrevious?.textColor || 'text-foreground',
  };

  const newInfo = newStageInfo || {
    name: fallbackNew?.label || newStage,
    color: fallbackNew?.color || 'bg-muted',
    textColor: fallbackNew?.textColor || 'text-foreground',
  };

  const handleConfirm = () => {
    onConfirm({
      reason: reason.trim() || null,
      followupReasonId: selectedFollowupReasonId,
      followupDate: showFollowupPicker ? followupDate : null,
    });
    setReason('');
    setSelectedFollowupReasonId(null);
    setShowFollowupPicker(false);
    setFollowupDate(null);
  };

  const handleCancel = () => {
    setReason('');
    setSelectedFollowupReasonId(null);
    setShowFollowupPicker(false);
    setFollowupDate(null);
    onOpenChange(false);
  };

  // Determine if using custom colors (hex) or Tailwind classes
  const isCustomPrevColor = prevInfo.color.startsWith('#') || prevInfo.color.startsWith('rgb');
  const isCustomNewColor = newInfo.color.startsWith('#') || newInfo.color.startsWith('rgb');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Mudança de Etapa do Funil</DialogTitle>
          <DialogDescription>
            O lead está sendo movido para uma nova etapa. Configure o follow-up e adicione observações.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Stage change visualization */}
          <div className="flex items-center gap-3 flex-wrap justify-center">
            <span 
              className={cn(
                "inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium",
                !isCustomPrevColor && prevInfo.color,
                !isCustomPrevColor && prevInfo.textColor
              )}
              style={isCustomPrevColor ? { 
                backgroundColor: prevInfo.color, 
                color: prevInfo.textColor 
              } : undefined}
            >
              {prevInfo.name}
            </span>
            <span className="text-2xl text-muted-foreground">→</span>
            <span 
              className={cn(
                "inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium",
                !isCustomNewColor && newInfo.color,
                !isCustomNewColor && newInfo.textColor
              )}
              style={isCustomNewColor ? { 
                backgroundColor: newInfo.color, 
                color: newInfo.textColor 
              } : undefined}
            >
              {newInfo.name}
            </span>
          </div>

          {/* Follow-up Selector */}
          <div className="space-y-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-600" />
              <Label className="font-medium">Follow-up Automático</Label>
              {defaultFollowupReasonId && selectedFollowupReasonId === defaultFollowupReasonId && (
                <Badge variant="secondary" className="text-xs">Sugerido</Badge>
              )}
            </div>
            
            <Select 
              value={selectedFollowupReasonId || 'none'} 
              onValueChange={handleFollowupReasonChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um follow-up" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  <div className="flex items-center gap-2">
                    <X className="w-4 h-4 text-muted-foreground" />
                    <span>Não iniciar follow-up</span>
                  </div>
                </SelectItem>
                {nonPurchaseReasons.map((npr) => (
                  <SelectItem key={npr.id} value={npr.id}>
                    <div className="flex items-center gap-2">
                      <span>{npr.name}</span>
                      {npr.followup_hours > 0 && (
                        <Badge variant="outline" className="text-xs">
                          <Clock className="w-3 h-3 mr-1" />
                          {npr.followup_hours}h
                        </Badge>
                      )}
                      {npr.id === defaultFollowupReasonId && (
                        <Badge variant="secondary" className="text-xs">Preferencial</Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Follow-up Date Picker */}
            {showFollowupPicker && selectedFollowup && (
              <div className="mt-3 pt-3 border-t border-amber-200 dark:border-amber-700">
                <FollowupDateTimeEditor
                  suggestedHours={selectedFollowup.followup_hours}
                  onConfirm={(date) => setFollowupDate(date)}
                  disabled={isLoading}
                  initialDate={followupDate || undefined}
                />
              </div>
            )}
          </div>

          {/* Reason input */}
          <div className="space-y-2">
            <Label htmlFor="reason">Motivo / Observação (opcional)</Label>
            <Textarea
              id="reason"
              placeholder="Ex: Cliente demonstrou interesse após apresentação do produto..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Esta observação ficará registrada no histórico do lead.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleCancel} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? 'Salvando...' : 'Confirmar Mudança'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
