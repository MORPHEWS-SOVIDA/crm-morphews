import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FileText,
  Building2,
  Package,
  CheckCircle2,
  Link2,
  AlertCircle,
  Loader2,
  PackagePlus,
  SkipForward,
} from 'lucide-react';
import {
  usePurchaseInvoiceItems,
  useLinkInvoiceItemToProduct,
  useSkipInvoiceItem,
  useProcessInvoiceStock,
  type PurchaseInvoice,
  type PurchaseInvoiceItem,
} from '@/hooks/usePurchaseInvoices';
import { useProducts } from '@/hooks/useProducts';
import { useStockLocations, useDefaultStockLocation } from '@/hooks/useStockLocations';
import { formatCurrency } from '@/lib/format';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface PurchaseInvoiceDetailDialogProps {
  invoice: PurchaseInvoice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const LINK_STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pendente', variant: 'secondary' },
  linked: { label: 'Vinculado', variant: 'default' },
  created: { label: 'Criado', variant: 'default' },
  skipped: { label: 'Ignorado', variant: 'outline' },
};

export function PurchaseInvoiceDetailDialog({
  invoice,
  open,
  onOpenChange,
}: PurchaseInvoiceDetailDialogProps) {
  const [selectedProducts, setSelectedProducts] = useState<Record<string, string>>({});

  const { data: items, isLoading: loadingItems } = usePurchaseInvoiceItems(invoice?.id);
  const { data: products } = useProducts();
  const { data: locations } = useStockLocations();
  const { data: defaultLocation } = useDefaultStockLocation();

  const linkItem = useLinkInvoiceItemToProduct();
  const skipItem = useSkipInvoiceItem();
  const processStock = useProcessInvoiceStock();

  const isProcessing = linkItem.isPending || skipItem.isPending || processStock.isPending;

  const pendingItems = items?.filter(i => i.link_status === 'pending') || [];
  const linkedItems = items?.filter(i => ['linked', 'created'].includes(i.link_status) && !i.stock_entered) || [];
  const canProcessStock = linkedItems.length > 0 && invoice?.status !== 'completed';

  const handleLinkProduct = async (item: PurchaseInvoiceItem) => {
    const productId = selectedProducts[item.id];
    if (!productId || !invoice) return;

    await linkItem.mutateAsync({
      itemId: item.id,
      productId,
      saveMapping: true,
      supplierCnpj: invoice.supplier_cnpj,
      supplierProductCode: item.supplier_product_code || undefined,
    });

    // Clear selection after linking
    setSelectedProducts(prev => {
      const next = { ...prev };
      delete next[item.id];
      return next;
    });
  };

  const handleSkipItem = async (itemId: string) => {
    await skipItem.mutateAsync(itemId);
  };

  const handleProcessStock = async () => {
    if (!invoice) return;
    await processStock.mutateAsync(invoice.id);
  };

  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Nota Fiscal #{invoice.number}
            {invoice.series && ` (Série ${invoice.series})`}
          </DialogTitle>
          <DialogDescription>
            Vincule os produtos e dê entrada no estoque
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-4">
            {/* Invoice Summary */}
            <Card>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-start gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">{invoice.supplier_name}</p>
                    <p className="text-sm text-muted-foreground">
                      CNPJ: {invoice.supplier_cnpj.replace(
                        /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
                        '$1.$2.$3/$4-$5'
                      )}
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Emissão:</span>{' '}
                    {format(new Date(invoice.issue_date), 'dd/MM/yyyy', { locale: ptBR })}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status:</span>{' '}
                    <Badge variant={invoice.status === 'completed' ? 'default' : 'secondary'}>
                      {invoice.status === 'completed' ? 'Concluída' : 'Pendente'}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <span className="text-muted-foreground">Total:</span>{' '}
                    <span className="font-semibold">
                      {formatCurrency(invoice.total_invoice_cents)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Items to Link */}
            {loadingItems ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* Pending Items */}
                {pendingItems.length > 0 && (
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-amber-500" />
                        Itens Pendentes de Vínculo ({pendingItems.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="divide-y">
                        {pendingItems.map((item) => (
                          <div key={item.id} className="py-3 space-y-2">
                            <div className="flex justify-between items-start gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">
                                  {item.supplier_product_name}
                                </p>
                                <div className="flex flex-wrap gap-1.5 mt-1">
                                  {item.ean && (
                                    <Badge variant="outline" className="text-xs">
                                      EAN: {item.ean}
                                    </Badge>
                                  )}
                                  <Badge variant="secondary" className="text-xs">
                                    Cód: {item.supplier_product_code}
                                  </Badge>
                                </div>
                              </div>
                              <div className="text-right shrink-0 text-sm">
                                <p className="font-medium">
                                  {item.quantity} {item.unit}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatCurrency(item.unit_price_cents)}/un
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <Select
                                value={selectedProducts[item.id] || ''}
                                onValueChange={(value) =>
                                  setSelectedProducts(prev => ({ ...prev, [item.id]: value }))
                                }
                              >
                                <SelectTrigger className="flex-1 h-9">
                                  <SelectValue placeholder="Selecionar produto..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {products?.map((product) => (
                                    <SelectItem key={product.id} value={product.id}>
                                      <div className="flex items-center gap-2">
                                        <span>{product.name}</span>
                                        {product.barcode_ean && (
                                          <span className="text-xs text-muted-foreground">
                                            ({product.barcode_ean})
                                          </span>
                                        )}
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button
                                size="sm"
                                onClick={() => handleLinkProduct(item)}
                                disabled={!selectedProducts[item.id] || isProcessing}
                              >
                                <Link2 className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleSkipItem(item.id)}
                                disabled={isProcessing}
                                title="Ignorar este item"
                              >
                                <SkipForward className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Linked Items (ready for stock entry) */}
                {linkedItems.length > 0 && (
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <PackagePlus className="h-4 w-4 text-green-500" />
                        Prontos para Entrada ({linkedItems.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="divide-y">
                        {linkedItems.map((item) => (
                          <div key={item.id} className="py-2 flex justify-between items-center gap-2 text-sm">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                              <span className="font-medium">{item.product?.name}</span>
                            </div>
                            <div className="text-muted-foreground">
                              {item.quantity} {item.unit} × {formatCurrency(item.unit_price_cents)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Already processed items */}
                {items?.some(i => i.stock_entered) && (
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                        <Package className="h-4 w-4" />
                        Já Entregues no Estoque
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="divide-y">
                        {items?.filter(i => i.stock_entered).map((item) => (
                          <div key={item.id} className="py-2 flex justify-between items-center gap-2 text-sm text-muted-foreground">
                            <span>{item.product?.name || item.supplier_product_name}</span>
                            <Badge variant="outline">Entrada OK</Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="flex justify-between items-center gap-2 pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            {locations && locations.length > 0 && defaultLocation && (
              <span>Local de entrada: {defaultLocation.name}</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
            {canProcessStock && (
              <Button onClick={handleProcessStock} disabled={isProcessing}>
                {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <PackagePlus className="h-4 w-4 mr-2" />
                Dar Entrada no Estoque ({linkedItems.length})
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
