import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Package,
  Building2,
} from 'lucide-react';
import {
  useCreatePurchaseInvoice,
  useCreatePurchaseInvoiceItems,
  parseNFeXml,
  type ParsedXmlInvoice,
} from '@/hooks/usePurchaseInvoices';
import { formatCurrency } from '@/lib/format';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface PurchaseInvoiceImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = 'upload' | 'review' | 'success';

export function PurchaseInvoiceImportDialog({
  open,
  onOpenChange,
}: PurchaseInvoiceImportDialogProps) {
  const [step, setStep] = useState<Step>('upload');
  const [parsedInvoice, setParsedInvoice] = useState<ParsedXmlInvoice | null>(null);
  const [xmlContent, setXmlContent] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const createInvoice = useCreatePurchaseInvoice();
  const createItems = useCreatePurchaseInvoiceItems();

  const isLoading = createInvoice.isPending || createItems.isPending;

  const handleReset = () => {
    setStep('upload');
    setParsedInvoice(null);
    setXmlContent('');
    setError(null);
  };

  const handleClose = (openState: boolean) => {
    if (!openState) {
      handleReset();
    }
    onOpenChange(openState);
  };

  const handleFileSelect = useCallback((file: File) => {
    setError(null);

    if (!file.name.toLowerCase().endsWith('.xml')) {
      setError('Por favor, selecione um arquivo XML válido');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      try {
        const parsed = parseNFeXml(content);
        
        if (!parsed.number || !parsed.supplier.cnpj) {
          setError('XML inválido: não foi possível extrair os dados da nota fiscal');
          return;
        }

        setXmlContent(content);
        setParsedInvoice(parsed);
        setStep('review');
      } catch (err) {
        console.error('Erro ao parsear XML:', err);
        setError('Erro ao ler o arquivo XML. Verifique se é uma NF-e válida.');
      }
    };
    reader.onerror = () => {
      setError('Erro ao ler o arquivo');
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleImport = async () => {
    if (!parsedInvoice) return;

    try {
      // Create invoice
      const invoice = await createInvoice.mutateAsync({
        access_key: parsedInvoice.accessKey || undefined,
        number: parsedInvoice.number,
        series: parsedInvoice.series || undefined,
        issue_date: parsedInvoice.issueDate.split('T')[0],
        supplier_cnpj: parsedInvoice.supplier.cnpj,
        supplier_name: parsedInvoice.supplier.name,
        supplier_ie: parsedInvoice.supplier.ie || undefined,
        total_products_cents: parsedInvoice.totals.products,
        total_freight_cents: parsedInvoice.totals.freight,
        total_discount_cents: parsedInvoice.totals.discount,
        total_taxes_cents: parsedInvoice.totals.taxes,
        total_invoice_cents: parsedInvoice.totals.invoice,
        xml_content: xmlContent,
      });

      // Create items
      await createItems.mutateAsync(
        parsedInvoice.items.map((item) => ({
          invoice_id: invoice.id,
          item_number: item.itemNumber,
          supplier_product_code: item.productCode,
          supplier_product_name: item.productName,
          ncm: item.ncm || undefined,
          cfop: item.cfop || undefined,
          unit: item.unit,
          quantity: item.quantity,
          unit_price_cents: item.unitPriceCents,
          total_price_cents: item.totalPriceCents,
          discount_cents: item.discountCents,
          ean: item.ean || undefined,
          icms_base_cents: item.taxes.icmsBase,
          icms_value_cents: item.taxes.icmsValue,
          icms_st_cents: item.taxes.icmsSt,
          ipi_cents: item.taxes.ipi,
          pis_cents: item.taxes.pis,
          cofins_cents: item.taxes.cofins,
        }))
      );

      setStep('success');
    } catch (err) {
      console.error('Erro ao importar:', err);
      setError(err instanceof Error ? err.message : 'Erro ao importar nota fiscal');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {step === 'upload' && 'Importar Nota Fiscal (XML)'}
            {step === 'review' && 'Revisar Nota Fiscal'}
            {step === 'success' && 'Nota Importada!'}
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Faça upload do arquivo XML da NF-e de compra'}
            {step === 'review' && 'Verifique os dados antes de importar'}
            {step === 'success' && 'A nota foi importada com sucesso'}
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={cn(
                'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
                isDragging
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-primary/50'
              )}
            >
              <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
              <p className="text-sm text-muted-foreground mb-2">
                Arraste e solte o arquivo XML aqui ou
              </p>
              <Label htmlFor="xml-upload" className="cursor-pointer">
                <Input
                  id="xml-upload"
                  type="file"
                  accept=".xml"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file);
                  }}
                />
                <Button type="button" variant="outline" asChild>
                  <span>Selecionar arquivo</span>
                </Button>
              </Label>
              <p className="text-xs text-muted-foreground mt-2">
                Apenas arquivos XML de NF-e
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}
          </div>
        )}

        {step === 'review' && parsedInvoice && (
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-4">
              {/* Invoice Info */}
              <Card>
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    <span className="font-semibold">
                      Nota Fiscal #{parsedInvoice.number}
                      {parsedInvoice.series && ` (Série ${parsedInvoice.series})`}
                    </span>
                  </div>
                  
                  {parsedInvoice.accessKey && (
                    <div className="text-xs font-mono text-muted-foreground break-all">
                      Chave: {parsedInvoice.accessKey}
                    </div>
                  )}

                  <Separator />

                  <div className="flex items-start gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium">{parsedInvoice.supplier.name}</p>
                      <p className="text-sm text-muted-foreground">
                        CNPJ: {parsedInvoice.supplier.cnpj.replace(
                          /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
                          '$1.$2.$3/$4-$5'
                        )}
                      </p>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Emissão:</span>{' '}
                      {format(new Date(parsedInvoice.issueDate), 'dd/MM/yyyy', { locale: ptBR })}
                    </div>
                    <div className="text-right">
                      <span className="text-muted-foreground">Total:</span>{' '}
                      <span className="font-semibold">
                        {formatCurrency(parsedInvoice.totals.invoice)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Items */}
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Itens ({parsedInvoice.items.length})
                </h4>
                <Card>
                  <div className="divide-y">
                    {parsedInvoice.items.map((item, index) => (
                      <div key={index} className="p-3 text-sm">
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{item.productName}</p>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {item.ean && (
                                <Badge variant="outline" className="text-xs">
                                  EAN: {item.ean}
                                </Badge>
                              )}
                              <Badge variant="secondary" className="text-xs">
                                Cód: {item.productCode}
                              </Badge>
                              {item.ncm && (
                                <Badge variant="secondary" className="text-xs">
                                  NCM: {item.ncm}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-medium">
                              {formatCurrency(item.totalPriceCents)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {item.quantity} {item.unit} × {formatCurrency(item.unitPriceCents)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        {step === 'success' && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              Nota importada com sucesso!
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Agora você pode vincular os produtos e dar entrada no estoque.
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          {step === 'upload' && (
            <Button variant="outline" onClick={() => handleClose(false)}>
              Cancelar
            </Button>
          )}

          {step === 'review' && (
            <>
              <Button variant="outline" onClick={handleReset}>
                Voltar
              </Button>
              <Button onClick={handleImport} disabled={isLoading}>
                {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Importar Nota
              </Button>
            </>
          )}

          {step === 'success' && (
            <Button onClick={() => handleClose(false)}>
              Fechar
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
