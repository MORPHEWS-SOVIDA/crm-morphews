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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useImplementerPlans, useCreateImplementerLink } from '@/hooks/useImplementer';

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

interface CreateCheckoutLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  implementerId: string;
}

export function CreateCheckoutLinkDialog({
  open,
  onOpenChange,
  implementerId,
}: CreateCheckoutLinkDialogProps) {
  const { data: plans, isLoading: isLoadingPlans } = useImplementerPlans();
  const createLink = useCreateImplementerLink();
  
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [implementationFee, setImplementationFee] = useState('');
  const [description, setDescription] = useState('');

  const selectedPlan = plans?.find(p => p.id === selectedPlanId);
  const implementationFeeCents = Math.round(parseFloat(implementationFee.replace(',', '.') || '0') * 100);
  const totalFirstPayment = (selectedPlan?.price_cents || 0) + implementationFeeCents;

  // Calculate earnings
  const implementerEarningsFromFee = Math.round(implementationFeeCents * 0.88); // 88% of implementation fee
  const implementerEarningsFirstMonth = Math.round((selectedPlan?.price_cents || 0) * 0.40); // 40% of first month
  const totalFirstMonthEarnings = implementerEarningsFromFee + implementerEarningsFirstMonth;

  const handleSubmit = async () => {
    if (!selectedPlanId) return;
    
    await createLink.mutateAsync({
      implementerId,
      planId: selectedPlanId,
      implementationFeeCents,
      description: description || undefined,
    });
    
    // Reset and close
    setSelectedPlanId('');
    setImplementationFee('');
    setDescription('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Criar Link de Checkout</DialogTitle>
          <DialogDescription>
            Crie um link personalizado com taxa de implementação
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Plan Selection */}
          <div className="space-y-2">
            <Label>Plano *</Label>
            <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o plano" />
              </SelectTrigger>
              <SelectContent>
                {isLoadingPlans ? (
                  <SelectItem value="loading" disabled>Carregando...</SelectItem>
                ) : (
                  plans?.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name} - {formatCurrency(plan.price_cents)}/mês
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Implementation Fee */}
          <div className="space-y-2">
            <Label>Taxa de Implementação (R$)</Label>
            <Input
              type="text"
              placeholder="Ex: 500,00"
              value={implementationFee}
              onChange={(e) => setImplementationFee(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Valor que você cobra pelo serviço de implementação. Você fica com 88%, plataforma fica com 12%.
            </p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Descrição (opcional)</Label>
            <Textarea
              placeholder="Ex: Pacote completo com treinamento"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Summary */}
          {selectedPlan && (
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <h4 className="font-medium">Resumo</h4>
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span>Mensalidade ({selectedPlan.name})</span>
                  <span>{formatCurrency(selectedPlan.price_cents)}</span>
                </div>
                {implementationFeeCents > 0 && (
                  <div className="flex justify-between">
                    <span>Taxa de Implementação</span>
                    <span>{formatCurrency(implementationFeeCents)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold border-t pt-1">
                  <span>Total 1ª Cobrança</span>
                  <span>{formatCurrency(totalFirstPayment)}</span>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t">
                <h5 className="text-sm font-medium text-green-600 mb-1">Seus Ganhos</h5>
                <div className="text-sm space-y-1">
                  {implementationFeeCents > 0 && (
                    <div className="flex justify-between">
                      <span>Implementação (88%)</span>
                      <span className="text-green-600">{formatCurrency(implementerEarningsFromFee)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>1ª Mensalidade (40%)</span>
                    <span className="text-green-600">{formatCurrency(implementerEarningsFirstMonth)}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-green-600">
                    <span>Total 1º Mês</span>
                    <span>{formatCurrency(totalFirstMonthEarnings)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground pt-1">
                    + 10% de todas as mensalidades seguintes enquanto seu plano estiver ativo
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!selectedPlanId || createLink.isPending}
          >
            {createLink.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Criar Link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
