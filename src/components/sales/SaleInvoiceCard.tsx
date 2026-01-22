import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { Label } from '@/components/ui/label';
import { Loader2, FileText, Download, RefreshCw, AlertCircle } from 'lucide-react';
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
}

export function SaleInvoiceCard({ saleId, saleTotalCents }: SaleInvoiceCardProps) {
  const { data: invoices = [], isLoading } = useSaleInvoices(saleId);
  const { data: companies = [] } = useFiscalCompanies();
  const createDraft = useCreateDraftFromSale();
  const refreshStatus = useRefreshInvoiceStatus();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<InvoiceType>('nfe');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');

  const hasActiveCompany = companies.some(c => c.is_active && c.certificate_file_path);
  const primaryCompany = companies.find(c => c.is_primary && c.is_active);

  const handleCreateDraft = async () => {
    await createDraft.mutateAsync({
      sale_id: saleId,
      invoice_type: selectedType,
      fiscal_company_id: selectedCompanyId || undefined,
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
                  <p className="text-xs text-red-600">{invoice.error_message}</p>
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

            {companies.length > 1 && (
              <div className="space-y-2">
                <Label>Empresa Emissora</Label>
                <Select
                  value={selectedCompanyId || primaryCompany?.id || ''}
                  onValueChange={setSelectedCompanyId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies
                      .filter(c => c.is_active && c.certificate_file_path)
                      .map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.company_name} ({formatCNPJ(company.cnpj)})
                          {company.is_primary && ' ★'}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
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
