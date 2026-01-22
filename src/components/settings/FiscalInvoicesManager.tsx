import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, FileText, Download, RefreshCw, XCircle, ExternalLink, Eye } from 'lucide-react';
import {
  useFiscalInvoices,
  useFiscalInvoiceEvents,
  useRefreshInvoiceStatus,
  getStatusLabel,
  getStatusColor,
  getInvoiceTypeLabel,
  type FiscalInvoice,
  type InvoiceStatus,
} from '@/hooks/useFiscalInvoices';
import { formatCNPJ } from '@/hooks/useFiscalCompanies';

export function FiscalInvoicesManager() {
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all');
  const [selectedInvoice, setSelectedInvoice] = useState<FiscalInvoice | null>(null);
  
  const { data: invoices = [], isLoading } = useFiscalInvoices(
    statusFilter !== 'all' ? { status: statusFilter } : undefined
  );
  const refreshStatus = useRefreshInvoiceStatus();

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Notas Fiscais Emitidas</h3>
          <p className="text-sm text-muted-foreground">
            Acompanhe o status das notas fiscais
          </p>
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="processing">Processando</SelectItem>
            <SelectItem value="authorized">Autorizada</SelectItem>
            <SelectItem value="rejected">Rejeitada</SelectItem>
            <SelectItem value="cancelled">Cancelada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {invoices.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              Nenhuma nota fiscal emitida ainda.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Número</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell>
                    <Badge variant="outline">
                      {getInvoiceTypeLabel(invoice.invoice_type)}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono">
                    {invoice.invoice_number || '-'}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {invoice.fiscal_company?.company_name || '-'}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {invoice.fiscal_company?.cnpj ? formatCNPJ(invoice.fiscal_company.cnpj) : '-'}
                    </div>
                  </TableCell>
                  <TableCell>{formatCurrency(invoice.total_cents)}</TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(invoice.status)}>
                      {getStatusLabel(invoice.status)}
                    </Badge>
                    {invoice.error_message && (
                      <p className="text-xs text-red-600 mt-1 max-w-[200px] truncate">
                        {invoice.error_message}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    {format(new Date(invoice.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSelectedInvoice(invoice)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
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
                        <Button
                          variant="ghost"
                          size="icon"
                          asChild
                        >
                          <a href={invoice.pdf_url} target="_blank" rel="noopener noreferrer">
                            <Download className="w-4 h-4" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Invoice Detail Dialog */}
      <InvoiceDetailDialog
        invoice={selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
      />
    </div>
  );
}

function InvoiceDetailDialog({
  invoice,
  onClose,
}: {
  invoice: FiscalInvoice | null;
  onClose: () => void;
}) {
  const { data: events = [] } = useFiscalInvoiceEvents(invoice?.id);

  if (!invoice) return null;

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100);
  };

  return (
    <Dialog open={!!invoice} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getInvoiceTypeLabel(invoice.invoice_type)}
            {invoice.invoice_number && ` #${invoice.invoice_number}`}
          </DialogTitle>
          <DialogDescription>
            Detalhes da nota fiscal
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge className={`mt-1 ${getStatusColor(invoice.status)}`}>
                {getStatusLabel(invoice.status)}
              </Badge>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Valor Total</p>
              <p className="text-xl font-bold">{formatCurrency(invoice.total_cents)}</p>
            </div>
          </div>

          {/* Error Message */}
          {invoice.error_message && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-2">
                <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
                <div>
                  <p className="font-medium text-red-800">Erro na emissão</p>
                  <p className="text-sm text-red-700 mt-1">{invoice.error_message}</p>
                </div>
              </div>
            </div>
          )}

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Empresa Emissora</p>
              <p className="font-medium">{invoice.fiscal_company?.company_name}</p>
              {invoice.fiscal_company?.cnpj && (
                <p className="text-sm font-mono">{formatCNPJ(invoice.fiscal_company.cnpj)}</p>
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Data de Emissão</p>
              <p className="font-medium">
                {format(new Date(invoice.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
            {invoice.invoice_number && (
              <div>
                <p className="text-sm text-muted-foreground">Número / Série</p>
                <p className="font-medium font-mono">
                  {invoice.invoice_number} / {invoice.invoice_series || '1'}
                </p>
              </div>
            )}
            {invoice.access_key && (
              <div className="col-span-2">
                <p className="text-sm text-muted-foreground">Chave de Acesso</p>
                <p className="font-mono text-xs break-all">{invoice.access_key}</p>
              </div>
            )}
            {invoice.protocol_number && (
              <div>
                <p className="text-sm text-muted-foreground">Protocolo</p>
                <p className="font-mono text-sm">{invoice.protocol_number}</p>
              </div>
            )}
          </div>

          {/* Downloads */}
          {(invoice.pdf_url || invoice.xml_url) && (
            <div className="flex gap-2">
              {invoice.pdf_url && (
                <Button variant="outline" asChild>
                  <a href={invoice.pdf_url} target="_blank" rel="noopener noreferrer">
                    <Download className="w-4 h-4 mr-2" />
                    Baixar PDF
                  </a>
                </Button>
              )}
              {invoice.xml_url && (
                <Button variant="outline" asChild>
                  <a href={invoice.xml_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Baixar XML
                  </a>
                </Button>
              )}
            </div>
          )}

          {/* Events Timeline */}
          {events.length > 0 && (
            <div>
              <h4 className="font-medium mb-3">Histórico de Eventos</h4>
              <div className="space-y-2">
                {events.map((event) => (
                  <div key={event.id} className="flex items-start gap-3 text-sm">
                    <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />
                    <div>
                      <p className="font-medium">{event.event_type}</p>
                      <p className="text-muted-foreground">
                        {format(new Date(event.created_at), "dd/MM/yy HH:mm:ss", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
