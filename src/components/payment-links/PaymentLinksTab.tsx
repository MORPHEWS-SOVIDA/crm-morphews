import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  usePaymentLinks, 
  useCreatePaymentLink, 
  useTogglePaymentLink, 
  useDeletePaymentLink,
  PaymentLink 
} from '@/hooks/usePaymentLinks';
import { 
  Plus, 
  Link2, 
  Copy, 
  QrCode, 
  Trash2, 
  ExternalLink,
  CreditCard,
  DollarSign,
  Calendar,
  Users
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { QRCodeSVG } from 'qrcode.react';

export function PaymentLinksTab() {
  const { data: links, isLoading } = usePaymentLinks();
  const createMutation = useCreatePaymentLink();
  const toggleMutation = useTogglePaymentLink();
  const deleteMutation = useDeletePaymentLink();
  
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showQRDialog, setShowQRDialog] = useState(false);
  const [selectedLink, setSelectedLink] = useState<PaymentLink | null>(null);
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amountCents, setAmountCents] = useState<number | undefined>();
  const [allowCustomAmount, setAllowCustomAmount] = useState(true);
  const [pixEnabled, setPixEnabled] = useState(true);
  const [boletoEnabled, setBoletoEnabled] = useState(true);
  const [cardEnabled, setCardEnabled] = useState(true);
  const [maxInstallments, setMaxInstallments] = useState(12);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setAmountCents(undefined);
    setAllowCustomAmount(true);
    setPixEnabled(true);
    setBoletoEnabled(true);
    setCardEnabled(true);
    setMaxInstallments(12);
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error('Informe um título para o link');
      return;
    }

    await createMutation.mutateAsync({
      title,
      description: description || undefined,
      amount_cents: amountCents,
      allow_custom_amount: allowCustomAmount,
      pix_enabled: pixEnabled,
      boleto_enabled: boletoEnabled,
      card_enabled: cardEnabled,
      max_installments: maxInstallments,
    });

    setShowCreateDialog(false);
    resetForm();
  };

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}/pagar/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copiado!');
  };

  const showQR = (link: PaymentLink) => {
    setSelectedLink(link);
    setShowQRDialog(true);
  };

  const formatCurrency = (cents: number) => {
    return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-40" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {links?.length || 0} links criados
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Link
        </Button>
      </div>

      {!links || links.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Link2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhum link criado</h3>
            <p className="text-muted-foreground text-center mb-4">
              Crie seu primeiro link de pagamento para começar a receber
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Link
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {links.map((link) => (
            <Card key={link.id} className={!link.is_active ? 'opacity-60' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-base font-medium">{link.title}</CardTitle>
                    {link.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {link.description}
                      </p>
                    )}
                  </div>
                  <Switch
                    checked={link.is_active}
                    onCheckedChange={(checked) => 
                      toggleMutation.mutate({ id: link.id, is_active: checked })
                    }
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  {link.amount_cents ? (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      {formatCurrency(link.amount_cents)}
                    </Badge>
                  ) : (
                    <Badge variant="outline">Valor livre</Badge>
                  )}
                  {link.pix_enabled && <Badge variant="outline">PIX</Badge>}
                  {link.card_enabled && <Badge variant="outline">Cartão</Badge>}
                  {link.boleto_enabled && <Badge variant="outline">Boleto</Badge>}
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>{link.use_count} uso{link.use_count !== 1 ? 's' : ''}</span>
                  {link.max_uses && (
                    <span className="text-xs">/ {link.max_uses} máx</span>
                  )}
                </div>

                {link.expires_at && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>
                      Expira em {format(new Date(link.expires_at), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => copyLink(link.slug)}
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    Copiar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => showQR(link)}
                  >
                    <QrCode className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(`/pagar/${link.slug}`, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteMutation.mutate(link.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Link de Pagamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Criando...' : 'Criar Link'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR Code Dialog */}
      <Dialog open={showQRDialog} onOpenChange={setShowQRDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>QR Code - {selectedLink?.title}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center py-4">
            {selectedLink && (
              <>
                <QRCodeSVG 
                  value={`${window.location.origin}/pagar/${selectedLink.slug}`}
                  size={200}
                  level="H"
                />
                <p className="text-sm text-muted-foreground mt-4 text-center">
                  Escaneie o QR Code para acessar o link de pagamento
                </p>
              </>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowQRDialog(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
