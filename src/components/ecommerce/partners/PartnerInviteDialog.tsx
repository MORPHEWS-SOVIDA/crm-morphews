import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Send, Copy, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  PartnerType,
  CommissionType,
  partnerTypeLabels,
  useCreatePartnerInvitation,
} from '@/hooks/ecommerce/usePartners';

interface PartnerInviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultPartnerType: PartnerType;
}

export function PartnerInviteDialog({
  open,
  onOpenChange,
  defaultPartnerType,
}: PartnerInviteDialogProps) {
  const [formData, setFormData] = useState({
    partner_type: defaultPartnerType,
    name: '',
    email: '',
    whatsapp: '',
    document: '',
    commission_type: 'percentage' as CommissionType,
    commission_value: 10,
    responsible_for_refunds: true,
    responsible_for_chargebacks: true,
  });
  const [createdInviteCode, setCreatedInviteCode] = useState<string | null>(null);

  const createInvitation = useCreatePartnerInvitation();

  useEffect(() => {
    if (open) {
      setFormData(prev => ({
        ...prev,
        partner_type: defaultPartnerType,
        name: '',
        email: '',
        whatsapp: '',
        document: '',
        commission_type: 'percentage',
        commission_value: defaultPartnerType === 'affiliate' || defaultPartnerType === 'coproducer' ? 10 : 0,
        responsible_for_refunds: defaultPartnerType === 'affiliate' || defaultPartnerType === 'coproducer',
        responsible_for_chargebacks: defaultPartnerType === 'affiliate' || defaultPartnerType === 'coproducer',
      }));
      setCreatedInviteCode(null);
    }
  }, [open, defaultPartnerType]);

  const handleSubmit = () => {
    if (!formData.name.trim() || !formData.email.trim()) {
      toast.error('Nome e e-mail são obrigatórios');
      return;
    }

    createInvitation.mutate(formData, {
      onSuccess: (data) => {
        toast.success('Convite criado com sucesso!');
        setCreatedInviteCode(data.invite_code);
      },
      onError: (error: Error) => {
        toast.error(error.message);
      },
    });
  };

  const handleCopyLink = () => {
    if (createdInviteCode) {
      const url = `${window.location.origin}/parceiro/convite/${createdInviteCode}`;
      navigator.clipboard.writeText(url);
      toast.success('Link copiado!');
    }
  };

  const handleClose = () => {
    setCreatedInviteCode(null);
    onOpenChange(false);
  };

  // Show liability options for affiliates and coproducers
  const showLiabilityOptions = 
    formData.partner_type === 'affiliate' || 
    formData.partner_type === 'coproducer';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {createdInviteCode ? 'Convite Criado!' : `Convidar ${partnerTypeLabels[defaultPartnerType]}`}
          </DialogTitle>
          <DialogDescription>
            {createdInviteCode
              ? 'Compartilhe o link abaixo com o parceiro para ele aceitar o convite.'
              : 'Preencha os dados e envie um convite para o parceiro.'}
          </DialogDescription>
        </DialogHeader>

        {createdInviteCode ? (
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <Label className="text-xs text-muted-foreground mb-2 block">
                Link de Convite
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={`${window.location.origin}/parceiro/convite/${createdInviteCode}`}
                  className="font-mono text-sm"
                />
                <Button variant="outline" size="icon" onClick={handleCopyLink}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Este link expira em 30 dias.
              </p>
            </div>

            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-1">Próximos passos:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Envie o link para <strong>{formData.name}</strong></li>
                <li>O parceiro irá criar uma conta ou fazer login</li>
                <li>Após aceitar, ele aparecerá na lista de parceiros</li>
              </ol>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Partner Type */}
            <div className="space-y-2">
              <Label>Tipo de Parceiro</Label>
              <Select
                value={formData.partner_type}
                onValueChange={(value: PartnerType) =>
                  setFormData((p) => ({ ...p, partner_type: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="affiliate">Afiliado</SelectItem>
                  <SelectItem value="coproducer">Co-produtor</SelectItem>
                  <SelectItem value="industry">Indústria</SelectItem>
                  <SelectItem value="factory">Fábrica</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                placeholder="Nome completo ou razão social"
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label>E-mail *</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                placeholder="email@exemplo.com"
              />
            </div>

            {/* WhatsApp */}
            <div className="space-y-2">
              <Label>WhatsApp</Label>
              <Input
                value={formData.whatsapp}
                onChange={(e) => setFormData((p) => ({ ...p, whatsapp: e.target.value }))}
                placeholder="(00) 00000-0000"
              />
            </div>

            {/* Document */}
            <div className="space-y-2">
              <Label>CPF/CNPJ</Label>
              <Input
                value={formData.document}
                onChange={(e) => setFormData((p) => ({ ...p, document: e.target.value }))}
                placeholder="000.000.000-00"
              />
            </div>

            {/* Commission Type */}
            <div className="space-y-3">
              <Label>Tipo de Comissão</Label>
              <RadioGroup
                value={formData.commission_type}
                onValueChange={(value: CommissionType) =>
                  setFormData((p) => ({ ...p, commission_type: value }))
                }
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="percentage" id="percentage" />
                  <Label htmlFor="percentage" className="font-normal">
                    Porcentagem (%)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="fixed" id="fixed" />
                  <Label htmlFor="fixed" className="font-normal">
                    Valor Fixo (R$)
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Commission Value */}
            <div className="space-y-2">
              <Label>
                {formData.commission_type === 'percentage'
                  ? 'Porcentagem da Comissão (%)'
                  : 'Valor Fixo por Venda (R$)'}
              </Label>
              <Input
                type="number"
                value={
                  formData.commission_type === 'fixed'
                    ? formData.commission_value / 100
                    : formData.commission_value
                }
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    commission_value:
                      formData.commission_type === 'fixed'
                        ? Number(e.target.value) * 100
                        : Number(e.target.value),
                  }))
                }
                min={0}
                step={formData.commission_type === 'fixed' ? 0.01 : 1}
              />
            </div>

            {/* Liability Options */}
            {showLiabilityOptions && (
              <div className="space-y-3 pt-2 border-t">
                <Label className="text-sm font-medium">Responsabilidade por Estornos</Label>
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm">Responsável por Reembolsos</p>
                    <p className="text-xs text-muted-foreground">
                      Comissão será estornada em caso de reembolso
                    </p>
                  </div>
                  <Switch
                    checked={formData.responsible_for_refunds}
                    onCheckedChange={(checked) =>
                      setFormData((p) => ({ ...p, responsible_for_refunds: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm">Responsável por Chargebacks</p>
                    <p className="text-xs text-muted-foreground">
                      Comissão será estornada em caso de chargeback
                    </p>
                  </div>
                  <Switch
                    checked={formData.responsible_for_chargebacks}
                    onCheckedChange={(checked) =>
                      setFormData((p) => ({ ...p, responsible_for_chargebacks: checked }))
                    }
                  />
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {createdInviteCode ? (
            <Button onClick={handleClose}>Fechar</Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!formData.name || !formData.email || createInvitation.isPending}
                className="gap-2"
              >
                <Send className="h-4 w-4" />
                Criar Convite
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
