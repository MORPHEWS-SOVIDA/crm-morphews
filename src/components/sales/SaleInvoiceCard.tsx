import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
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
import { Loader2, FileText, Download, RefreshCw, AlertCircle, Eye, Upload } from 'lucide-react';
import {
  useSaleInvoices,
  useRefreshInvoiceStatus,
  getStatusLabel,
  getStatusColor,
  getInvoiceTypeLabel,
  type InvoiceType,
} from '@/hooks/useFiscalInvoices';
import { useFiscalCompanies, formatCNPJ } from '@/hooks/useFiscalCompanies';
import { useCreateDraftFromSale } from '@/hooks/useFiscalInvoiceDraft';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SaleInvoiceCardProps {
  saleId: string;
  saleTotalCents: number;
  invoicePdfUrl?: string | null;
  invoiceXmlUrl?: string | null;
  onUploadInvoice?: (e: React.ChangeEvent<HTMLInputElement>, type: 'pdf' | 'xml') => void;
  onViewFile?: (url: string) => void;
  onDownloadFile?: (url: string) => void;
}

export function SaleInvoiceCard({
  saleId,
  saleTotalCents,
  invoicePdfUrl,
  invoiceXmlUrl,
  onUploadInvoice,
  onViewFile,
  onDownloadFile,
}: SaleInvoiceCardProps) {
  const { data: invoices = [], isLoading } = useSaleInvoices(saleId);
  const { data: companies = [] } = useFiscalCompanies();
  const createDraft = useCreateDraftFromSale();
  const refreshStatus = useRefreshInvoiceStatus();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<InvoiceType>('nfe');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');

  const activeCompanies = companies.filter(c => c.is_active);
  const hasActiveCompany = activeCompanies.length > 0;
  const primaryCompany = companies.find(c => c.is_primary && c.is_active);
  const defaultCompanyId = primaryCompany?.id || activeCompanies[0]?.id || '';

  const handleCreateDraft = async () => {
    const companyId = selectedCompanyId || defaultCompanyId;
    await createDraft.mutateAsync({
      sale_id: saleId,
      invoice_type: selectedType,
      fiscal_company_id: companyId || undefined,
    });
    setIsDialogOpen(false);
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100);
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Carregando notas...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Notas Fiscais
        </h3>
        {hasActiveCompany ? (
          <Button size="sm" onClick={() => setIsDialogOpen(true)}>
            <FileText className="w-4 h-4 mr-1" />
            Emitir NF
          </Button>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="w-4 h-4" />
            Configure empresa em Configurações
          </div>
        )}
      </div>

      {invoices.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma nota fiscal emitida para esta venda.
        </p>
      ) : (
        <div className="space-y-2">
          {invoices.map((invoice) => (
            <div
              key={invoice.id}
              className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {getInvoiceTypeLabel(invoice.invoice_type)}
                  </Badge>
                  <Badge className={getStatusColor(invoice.status)}>
                    {getStatusLabel(invoice.status)}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  {invoice.invoice_number ? (
                    <span className="font-mono">Nº {invoice.invoice_number}</span>
                  ) : (
                    <span>
                      {format(new Date(invoice.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                    </span>
                  )}
                  <span className="mx-2">•</span>
                  <span>{formatCurrency(invoice.total_cents)}</span>
                </div>
                {invoice.error_message && (
                  <p className="text-xs text-destructive">{invoice.error_message}</p>
                )}
              </div>
              <div className="flex items-center gap-1">
                {invoice.status === 'processing' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => refreshStatus.mutate(invoice.id)}
                    disabled={refreshStatus.isPending}
                  >
                    <RefreshCw className={`w-4 h-4 ${refreshStatus.isPending ? 'animate-spin' : ''}`} />
                  </Button>
                )}
                {invoice.pdf_url && (
                  <Button variant="ghost" size="icon" asChild>
                    <a href={invoice.pdf_url} target="_blank" rel="noopener noreferrer">
                      <Download className="w-4 h-4" />
                    </a>
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Manual Upload Section */}
      {onUploadInvoice && (
        <>
          <Separator />
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5" />
              Anexar manualmente
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">NF PDF</Label>
                <Input
                  type="file"
                  accept=".pdf"
                  className="text-xs h-8"
                  onChange={(e) => onUploadInvoice(e, 'pdf')}
                />
                {invoicePdfUrl && (
                  <div className="flex items-center gap-2">
                    {onViewFile && (
                      <button
                        type="button"
                        onClick={() => onViewFile(invoicePdfUrl)}
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" />
                        Ver
                      </button>
                    )}
                    {onDownloadFile && (
                      <button
                        type="button"
                        onClick={() => onDownloadFile(invoicePdfUrl)}
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        <Download className="w-3 h-3" />
                        Baixar
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">NF XML</Label>
                <Input
                  type="file"
                  accept=".xml"
                  className="text-xs h-8"
                  onChange={(e) => onUploadInvoice(e, 'xml')}
                />
                {invoiceXmlUrl && (
                  <div className="flex items-center gap-2">
                    {onViewFile && (
                      <button
                        type="button"
                        onClick={() => onViewFile(invoiceXmlUrl)}
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" />
                        Ver
                      </button>
                    )}
                    {onDownloadFile && (
                      <button
                        type="button"
                        onClick={() => onDownloadFile(invoiceXmlUrl)}
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        <Download className="w-3 h-3" />
                        Baixar
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Emit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Emitir Nota Fiscal</DialogTitle>
            <DialogDescription>
              Valor da venda: {formatCurrency(saleTotalCents)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Tipo de Nota</Label>
              <Select value={selectedType} onValueChange={(v) => setSelectedType(v as InvoiceType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nfe">NF-e (Produtos)</SelectItem>
                  <SelectItem value="nfse">NFS-e (Serviços)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {activeCompanies.length > 0 && (
              <div className="space-y-2">
                <Label>Empresa Emissora</Label>
                <Select
                  value={selectedCompanyId || defaultCompanyId}
                  onValueChange={setSelectedCompanyId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeCompanies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.company_name} ({formatCNPJ(company.cnpj)})
                        {company.is_primary && ' ★'}
                        {!company.certificate_file_path && ' (sem certificado)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {activeCompanies.find(c => c.id === (selectedCompanyId || defaultCompanyId))?.certificate_file_path === null && (
                  <p className="text-xs text-amber-600">
                    ⚠️ Esta empresa não tem certificado. A nota será criada como rascunho.
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateDraft} disabled={createDraft.isPending}>
              {createDraft.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Gerar Nota
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
