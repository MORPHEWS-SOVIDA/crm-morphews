import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Link2, Copy, QrCode, ExternalLink, Loader2 } from 'lucide-react';
import { useCreatePaymentLink } from '@/hooks/usePaymentLinks';
import { useMyPermissions } from '@/hooks/useUserPermissions';
import { useAuth } from '@/hooks/useAuth';
import { useOrgFeatures } from '@/hooks/usePlanFeatures';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';

interface QuickPaymentLinkButtonProps {
  leadId?: string;
  leadName?: string;
  leadPhone?: string;
  leadEmail?: string;
  defaultAmount?: number;
  productName?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  /** When true, auto-opens dialog with amount pre-filled */
  autoOpenWithAmount?: boolean;
  /** Custom label for the button */
  label?: string;
  /** Hide the button text, show only icon */
  iconOnly?: boolean;
}

export function QuickPaymentLinkButton({
  leadId,
  leadName,
  leadPhone,
  leadEmail,
  defaultAmount,
  productName,
  variant = 'outline',
  size = 'sm',
  className,
  autoOpenWithAmount = false,
  label = 'Cobrar via Link',
  iconOnly = false,
}: QuickPaymentLinkButtonProps) {
  const { isAdmin } = useAuth();
  const { data: permissions } = useMyPermissions();
  const { data: orgFeatures } = useOrgFeatures();
  const createMutation = useCreatePaymentLink();
  
  const [showDialog, setShowDialog] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [createdLink, setCreatedLink] = useState<{ slug: string; title: string } | null>(null);
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amountCents, setAmountCents] = useState<number | undefined>(defaultAmount);
  const [pixEnabled, setPixEnabled] = useState(true);
  const [cardEnabled, setCardEnabled] = useState(true);
  const [boletoEnabled, setBoletoEnabled] = useState(true);

  // Check permissions
  const canCreateLinks = isAdmin || permissions?.payment_links_create;
  const hasFeature = orgFeatures?.payment_links !== false;

  if (!canCreateLinks || !hasFeature) {
    return null;
  }

  const resetForm = () => {
    setTitle(productName ? `Pagamento - ${productName}` : '');
    setDescription('');
    setAmountCents(defaultAmount);
    setPixEnabled(true);
    setCardEnabled(true);
    setBoletoEnabled(true);
    setCreatedLink(null);
    setShowQR(false);
  };

  const handleOpen = () => {
    resetForm();
    if (productName) {
      setTitle(`Pagamento - ${productName}`);
    } else if (leadName) {
      setTitle(`Cobrança - ${leadName}`);
    }
    setShowDialog(true);
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error('Informe um título');
      return;
    }

    const result = await createMutation.mutateAsync({
      title,
      description: description || undefined,
      amount_cents: amountCents,
      allow_custom_amount: !amountCents,
      pix_enabled: pixEnabled,
      boleto_enabled: boletoEnabled,
      card_enabled: cardEnabled,
      lead_id: leadId,
      customer_name: leadName,
      customer_email: leadEmail,
      customer_phone: leadPhone,
    });

    if (result) {
      setCreatedLink({ slug: result.slug, title: result.title });
    }
  };

  const getLinkUrl = (slug: string) => `${window.location.origin}/pagar/${slug}`;

  const copyLink = () => {
    if (createdLink) {
      navigator.clipboard.writeText(getLinkUrl(createdLink.slug));
      toast.success('Link copiado!');
    }
  };

  const formatCurrency = (cents: number) => {
    return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={handleOpen}
        className={className}
      >
        <Link2 className={iconOnly ? "h-4 w-4" : "h-4 w-4 mr-2"} />
        {!iconOnly && label}
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {createdLink ? 'Link Criado!' : 'Gerar Link de Pagamento'}
            </DialogTitle>
            {!createdLink && (
              <DialogDescription>
                Crie um link de cobrança para enviar ao cliente
              </DialogDescription>
            )}
          </DialogHeader>

          {createdLink ? (
            <div className="space-y-4 py-4">
              {showQR ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="p-4 bg-white rounded-lg shadow">
                    <QRCodeSVG value={getLinkUrl(createdLink.slug)} size={180} level="H" />
                  </div>
                  <p className="text-sm text-muted-foreground text-center">
                    Escaneie o QR Code para acessar o link
                  </p>
                  <Button variant="outline" onClick={() => setShowQR(false)}>
                    Voltar
                  </Button>
                </div>
              ) : (
                <>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Link de pagamento:</p>
                    <p className="font-mono text-sm break-all">{getLinkUrl(createdLink.slug)}</p>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button className="flex-1" onClick={copyLink}>
                      <Copy className="h-4 w-4 mr-2" />
                      Copiar Link
                    </Button>
                    <Button variant="outline" onClick={() => setShowQR(true)}>
                      <QrCode className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => window.open(getLinkUrl(createdLink.slug), '_blank')}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>

                  <Button 
                    variant="ghost" 
                    className="w-full" 
                    onClick={() => {
                      resetForm();
                    }}
                  >
                    Criar outro link
                  </Button>
                </>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-4 py-4">
                <div>
                  <Label>Título *</Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex: Consultoria, Produto X..."
                  />
                </div>

                <div>
                  <Label>Descrição</Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Descrição opcional"
                    rows={2}
                  />
                </div>

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

                {leadName && (
                  <div className="p-3 bg-muted rounded-lg text-sm">
                    <p className="text-muted-foreground">Cliente vinculado:</p>
                    <p className="font-medium">{leadName}</p>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowDialog(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreate} disabled={createMutation.isPending}>
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    'Criar Link'
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
