import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { LeadSearchSelect } from '@/components/sales/LeadSearchSelect';
import { useCreatePaymentLink } from '@/hooks/usePaymentLinks';
import { User, MapPin } from 'lucide-react';

interface Lead {
  id: string;
  name: string;
  whatsapp: string;
  email: string | null;
  cpf_cnpj?: string | null;
  city: string | null;
  state: string | null;
  street: string | null;
  street_number: string | null;
  complement: string | null;
  neighborhood: string | null;
  cep: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateClientPaymentLinkDialog({ open, onOpenChange }: Props) {
  const createMutation = useCreatePaymentLink();
  
  // Lead selection
  const [leadId, setLeadId] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amountCents, setAmountCents] = useState<number | undefined>();
  const [pixEnabled, setPixEnabled] = useState(true);
  const [boletoEnabled, setBoletoEnabled] = useState(true);
  const [cardEnabled, setCardEnabled] = useState(true);
  const [maxInstallments, setMaxInstallments] = useState(12);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setLeadId(null);
      setSelectedLead(null);
      setTitle('');
      setDescription('');
      setAmountCents(undefined);
      setPixEnabled(true);
      setBoletoEnabled(true);
      setCardEnabled(true);
      setMaxInstallments(12);
    }
  }, [open]);

  // Auto-fill title when lead is selected
  useEffect(() => {
    if (selectedLead && !title) {
      setTitle(`Cobrança - ${selectedLead.name}`);
    }
  }, [selectedLead, title]);

  const handleLeadChange = (id: string | null, lead: Lead | null) => {
    setLeadId(id);
    setSelectedLead(lead);
  };

  const handleCreate = async () => {
    if (!leadId || !selectedLead) {
      return;
    }

    if (!title.trim()) {
      return;
    }

    await createMutation.mutateAsync({
      title,
      description: description || undefined,
      amount_cents: amountCents,
      allow_custom_amount: !amountCents,
      pix_enabled: pixEnabled,
      boleto_enabled: boletoEnabled,
      card_enabled: cardEnabled,
      max_installments: maxInstallments,
      // Client-specific data
      lead_id: leadId,
      customer_name: selectedLead.name,
      customer_email: selectedLead.email || undefined,
      customer_phone: selectedLead.whatsapp,
      customer_document: selectedLead.cpf_cnpj || undefined,
      max_uses: 1, // Single use for client links
    });

    onOpenChange(false);
  };

  const hasAddress = selectedLead && (selectedLead.street || selectedLead.city);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Link para Cliente
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Lead Selection */}
          <div>
            <Label>Cliente *</Label>
            <LeadSearchSelect
              value={leadId}
              onChange={handleLeadChange}
              placeholder="Buscar cliente no CRM..."
            />
          </div>

          {/* Show selected lead info */}
          {selectedLead && (
            <div className="p-3 bg-muted rounded-lg space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{selectedLead.name}</span>
              </div>
              <div className="text-muted-foreground">
                {selectedLead.whatsapp}
                {selectedLead.email && ` • ${selectedLead.email}`}
              </div>
              {selectedLead.cpf_cnpj && (
                <div className="text-muted-foreground">
                  CPF/CNPJ: {selectedLead.cpf_cnpj}
                </div>
              )}
              {hasAddress && (
                <div className="flex items-start gap-2 text-muted-foreground pt-1 border-t">
                  <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>
                    {[
                      selectedLead.street,
                      selectedLead.street_number,
                      selectedLead.neighborhood,
                      selectedLead.city,
                      selectedLead.state
                    ].filter(Boolean).join(', ')}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Title */}
          <div>
            <Label>Título *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Consultoria, Produto X..."
            />
          </div>
          
          {/* Description */}
          <div>
            <Label>Descrição</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição opcional"
              rows={2}
            />
          </div>

          {/* Amount */}
          <div>
            <Label>Valor (deixe vazio para valor livre)</Label>
            <Input
              type="number"
              value={amountCents ? amountCents / 100 : ''}
              onChange={(e) => setAmountCents(e.target.value ? Math.round(parseFloat(e.target.value) * 100) : undefined)}
              placeholder="0,00"
              step="0.01"
            />
          </div>

          {/* Payment methods */}
          <div className="space-y-3">
            <Label>Métodos de Pagamento</Label>
            <div className="flex items-center justify-between">
              <span className="text-sm">PIX</span>
              <Switch checked={pixEnabled} onCheckedChange={setPixEnabled} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Cartão de Crédito</span>
              <Switch checked={cardEnabled} onCheckedChange={setCardEnabled} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Boleto</span>
              <Switch checked={boletoEnabled} onCheckedChange={setBoletoEnabled} />
            </div>
          </div>

          {cardEnabled && (
            <div>
              <Label>Parcelas Máximas</Label>
              <Input
                type="number"
                min={1}
                max={12}
                value={maxInstallments}
                onChange={(e) => setMaxInstallments(parseInt(e.target.value) || 1)}
              />
            </div>
          )}

          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-800 dark:text-amber-200">
            Este link é de <strong>uso único</strong> e expira após o primeiro pagamento.
            Os dados do cliente já estarão preenchidos no checkout.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleCreate} 
            disabled={createMutation.isPending || !leadId || !title.trim()}
          >
            {createMutation.isPending ? 'Criando...' : 'Criar Link'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
