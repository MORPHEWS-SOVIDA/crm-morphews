import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  Plus, 
  ExternalLink, 
  Copy, 
  Pencil, 
  Trash2, 
  CreditCard,
  Loader2,
  MoreHorizontal,
  Eye
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { 
  useStandaloneCheckouts, 
  useDeleteStandaloneCheckout,
  useToggleCheckoutStatus,
  type StandaloneCheckout 
} from '@/hooks/ecommerce/useStandaloneCheckouts';
import { CheckoutFormDialog } from './CheckoutFormDialog';
import { CheckoutBuilderDialog } from './CheckoutBuilderDialog';

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

const CHECKOUT_TYPE_LABELS: Record<string, string> = {
  one_step: '1 Etapa',
  two_step: '2 Etapas',
  three_step: '3 Etapas',
};

export function CheckoutsManager() {
  const { data: checkouts, isLoading } = useStandaloneCheckouts();
  const deleteCheckout = useDeleteStandaloneCheckout();
  const toggleStatus = useToggleCheckoutStatus();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCheckout, setEditingCheckout] = useState<StandaloneCheckout | null>(null);
  const [builderCheckout, setBuilderCheckout] = useState<StandaloneCheckout | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleCopyLink = (slug: string) => {
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/pay/${slug}`;
    navigator.clipboard.writeText(link);
    toast.success('Link copiado!');
  };

  const handleOpenCheckout = (slug: string) => {
    const baseUrl = window.location.origin;
    window.open(`${baseUrl}/pay/${slug}`, '_blank');
  };

  const handleToggleActive = (id: string, currentStatus: boolean) => {
    toggleStatus.mutate({ id, is_active: !currentStatus });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Crie checkouts personalizados com links diretos para venda
          </p>
        </div>
        <Button onClick={() => setIsFormOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Checkout
        </Button>
      </div>

      {/* Empty State */}
      {(!checkouts || checkouts.length === 0) && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-muted p-4 mb-4">
              <CreditCard className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Nenhum checkout criado</h3>
            <p className="text-muted-foreground text-center max-w-md mb-4">
              Crie checkouts standalone para vender produtos via link direto, 
              sem precisar de loja ou landing page.
            </p>
            <Button onClick={() => setIsFormOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Primeiro Checkout
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Checkouts Grid */}
      {checkouts && checkouts.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {checkouts.map((checkout) => (
            <Card key={checkout.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-base">{checkout.name}</CardTitle>
                    <p className="text-xs text-muted-foreground font-mono">
                      /pay/{checkout.slug}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={checkout.is_active}
                      onCheckedChange={() => handleToggleActive(checkout.id, checkout.is_active)}
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleOpenCheckout(checkout.slug)}>
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Abrir
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleCopyLink(checkout.slug)}>
                          <Copy className="h-4 w-4 mr-2" />
                          Copiar Link
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setBuilderCheckout(checkout)}>
                          <Eye className="h-4 w-4 mr-2" />
                          Editor Visual
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setEditingCheckout(checkout)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Configurações
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={() => setDeleteId(checkout.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Product info */}
                <div className="flex items-center gap-3">
                  {checkout.product?.images?.[0] && (
                    <img 
                      src={checkout.product.images[0]} 
                      alt={checkout.product.name}
                      className="h-12 w-12 rounded object-cover"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {checkout.product?.name || 'Produto não encontrado'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatCurrency(checkout.product?.price_1_unit || checkout.product?.base_price_cents || 0)}
                    </p>
                  </div>
                </div>

                {/* Badges */}
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary" className="text-xs">
                    {CHECKOUT_TYPE_LABELS[checkout.checkout_type]}
                  </Badge>
                  {checkout.order_bump_enabled && (
                    <Badge variant="outline" className="text-xs">
                      Order Bump
                    </Badge>
                  )}
                  {checkout.pix_discount_percent > 0 && (
                    <Badge variant="outline" className="text-xs text-green-600">
                      -{checkout.pix_discount_percent}% PIX
                    </Badge>
                  )}
                </div>

                {/* Payment methods */}
                <div className="flex gap-1">
                  {checkout.payment_methods.includes('pix') && (
                    <Badge variant="outline" className="text-xs">PIX</Badge>
                  )}
                  {checkout.payment_methods.includes('credit_card') && (
                    <Badge variant="outline" className="text-xs">Cartão</Badge>
                  )}
                  {checkout.payment_methods.includes('boleto') && (
                    <Badge variant="outline" className="text-xs">Boleto</Badge>
                  )}
                </div>

                {/* Quick actions */}
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleCopyLink(checkout.slug)}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copiar
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    className="flex-1"
                    onClick={() => setBuilderCheckout(checkout)}
                  >
                    <Pencil className="h-3 w-3 mr-1" />
                    Editar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Form Dialog */}
      <CheckoutFormDialog
        open={isFormOpen || !!editingCheckout}
        onOpenChange={(open) => {
          if (!open) {
            setIsFormOpen(false);
            setEditingCheckout(null);
          }
        }}
        checkout={editingCheckout}
      />

      {/* Builder Dialog */}
      {builderCheckout && (
        <CheckoutBuilderDialog
          open={!!builderCheckout}
          onOpenChange={(open) => {
            if (!open) setBuilderCheckout(null);
          }}
          checkout={builderCheckout}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir checkout?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O link de pagamento deixará de funcionar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteId) {
                  deleteCheckout.mutate(deleteId);
                  setDeleteId(null);
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
