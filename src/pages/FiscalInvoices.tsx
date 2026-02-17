import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  FileText,
  Search,
  Filter,
  Send,
  Printer,
  Download,
  RefreshCw,
  MoreVertical,
  Plus,
  X,
  Mail,
  FileDown,
  Eye,
  Loader2,
  AlertCircle,
  Ban,
  Settings,
  AlertTriangle,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  useFiscalInvoices,
  useRefreshInvoiceStatus,
  useRefreshAllProcessingInvoices,
  getStatusLabel,
  getStatusColor,
  type InvoiceStatus,
  type FiscalInvoice,
} from '@/hooks/useFiscalInvoices';
import { useSendFiscalInvoice } from '@/hooks/useFiscalInvoiceDraft';
import { toast } from '@/hooks/use-toast';
import { InvalidateNumbersDialog } from '@/components/fiscal/InvalidateNumbersDialog';
import { FiscalAutoSendConfigDialog } from '@/components/fiscal/FiscalAutoSendConfigDialog';

// Helper to check for missing required fields in a draft invoice
function getMissingFields(invoice: any): string[] {
  const missing: string[] = [];
  if (!invoice.recipient_name) missing.push('Nome');
  if (!invoice.recipient_cpf_cnpj) missing.push('CPF/CNPJ');
  if (!invoice.recipient_cep) missing.push('CEP');
  if (!invoice.recipient_city) missing.push('Cidade');
  if (!invoice.recipient_state) missing.push('Estado');
  if (!invoice.recipient_street) missing.push('Logradouro');
  if (!invoice.recipient_neighborhood) missing.push('Bairro');
  return missing;
}

export default function FiscalInvoices() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(true);
  const [showInvalidateDialog, setShowInvalidateDialog] = useState(false);
  const [showAutoSendDialog, setShowAutoSendDialog] = useState(false);

  const { data: invoices = [], isLoading } = useFiscalInvoices(
    statusFilter !== 'all' ? { status: statusFilter } : undefined
  );
  const refreshStatus = useRefreshInvoiceStatus();
  const refreshAllProcessing = useRefreshAllProcessingInvoices();
  const sendInvoice = useSendFiscalInvoice();

  // Count processing invoices
  const processingCount = useMemo(() => 
    invoices.filter(inv => inv.status === 'processing').length,
    [invoices]
  );

  // Filter invoices by search
  const filteredInvoices = useMemo(() => {
    if (!searchQuery.trim()) return invoices;
    const query = searchQuery.toLowerCase();
    return invoices.filter(inv => {
      const invAny = inv as any;
      return (
        inv.invoice_number?.toLowerCase().includes(query) ||
        inv.sale?.lead?.name?.toLowerCase().includes(query) ||
        inv.fiscal_company?.company_name?.toLowerCase().includes(query) ||
        invAny.recipient_name?.toLowerCase().includes(query)
      );
    });
  }, [invoices, searchQuery]);

  // Calculate summary
  const summary = useMemo(() => ({
    count: filteredInvoices.length,
    totalCents: filteredInvoices.reduce((sum, inv) => sum + (inv.total_cents || 0), 0),
  }), [filteredInvoices]);

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredInvoices.map(inv => inv.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(i => i !== id));
    }
  };

  const handleBatchSend = async () => {
    const pendingIds = selectedIds.filter(id => {
      const inv = invoices.find(i => i.id === id) as any;
      return inv?.status === 'pending' || inv?.is_draft;
    });
    if (pendingIds.length === 0) {
      toast({ title: 'Selecione notas pendentes para enviar', variant: 'destructive' });
      return;
    }

    toast({ title: `Enviando ${pendingIds.length} notas...` });

    const results = await Promise.allSettled(
      pendingIds.map((id) => sendInvoice.mutateAsync(id))
    );

    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[];

    if (failed.length > 0) {
      const firstError = failed[0]?.reason as Error | unknown;
      const message = firstError instanceof Error ? firstError.message : String(firstError);
      toast({
        title: `${successCount} enviadas, ${failed.length} falharam`,
        description: message,
        variant: 'destructive',
      });
    } else {
      toast({ title: `${successCount} notas enviadas para processamento!` });
    }

    setSelectedIds([]);
  };

  const handleBatchPrint = async () => {
    const authorizedIds = selectedIds.filter(id => {
      const inv = invoices.find(i => i.id === id);
      return inv?.status === 'authorized' && inv?.pdf_url;
    });
    if (authorizedIds.length === 0) {
      toast({ title: 'Selecione notas autorizadas para imprimir', variant: 'destructive' });
      return;
    }
    // Open PDF URLs in new tabs
    authorizedIds.forEach(id => {
      const inv = invoices.find(i => i.id === id);
      if (inv?.pdf_url) window.open(inv.pdf_url, '_blank');
    });
  };

  const handleBatchExportXML = async () => {
    const authorizedIds = selectedIds.filter(id => {
      const inv = invoices.find(i => i.id === id);
      return inv?.status === 'authorized' && inv?.xml_url;
    });
    if (authorizedIds.length === 0) {
      toast({ title: 'Selecione notas autorizadas para exportar', variant: 'destructive' });
      return;
    }
    authorizedIds.forEach(id => {
      const inv = invoices.find(i => i.id === id);
      if (inv?.xml_url) window.open(inv.xml_url, '_blank');
    });
  };

  return (
    <Layout>
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Notas Fiscais de Saída</h1>
              <p className="text-sm text-muted-foreground">
                Gerencie suas NF-e e NFS-e
              </p>
            </div>
          </div>
          <Button onClick={() => navigate('/notas-fiscais/nova')}>
            <Plus className="w-4 h-4 mr-2" />
            Incluir nota fiscal
          </Button>
        </div>

        {/* Filters + Actions Bar */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por nome, CPF/CNPJ ou nº da nota"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as InvoiceStatus | 'all')}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Situação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
              <SelectItem value="processing">Processando</SelectItem>
              <SelectItem value="authorized">Autorizada</SelectItem>
              <SelectItem value="rejected">Rejeitada</SelectItem>
              <SelectItem value="cancelled">Cancelada</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="w-4 h-4 mr-2" />
            Filtrar
          </Button>

          {searchQuery && (
            <Button variant="ghost" size="sm" onClick={() => setSearchQuery('')}>
              <X className="w-4 h-4 mr-1" />
              Limpar
            </Button>
          )}
        </div>

        {/* Main Content */}
        <div className="flex gap-6">
          {/* Table */}
          <Card className="flex-1">
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredInvoices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <FileText className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">Nenhuma nota fiscal encontrada</p>
                  <p className="text-sm text-muted-foreground">
                    Emita notas a partir das vendas ou clique em "Incluir nota fiscal"
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={selectedIds.length === filteredInvoices.length && filteredInvoices.length > 0}
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead>Número</TableHead>
                      <TableHead>Data emissão</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Situação</TableHead>
                      <TableHead className="text-right">Valor (R$)</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoices.map((invoice) => {
                      const invAny = invoice as any;
                      const missingFields = invAny.is_draft ? getMissingFields(invAny) : [];
                      const hasMissing = missingFields.length > 0;
                      return (
                      <TableRow
                        key={invoice.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/notas-fiscais/${invoice.id}`)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.includes(invoice.id)}
                            onCheckedChange={(checked) => handleSelectOne(invoice.id, !!checked)}
                          />
                        </TableCell>
                        <TableCell className="font-mono">
                          {invoice.invoice_number || (invAny.is_draft ? 'Rascunho' : '—')}
                        </TableCell>
                        <TableCell>
                          {format(new Date(invoice.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {invAny.recipient_name || invoice.sale?.lead?.name || '—'}
                            {hasMissing && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs">
                                    <p className="font-semibold text-amber-600">Campos obrigatórios faltando:</p>
                                    <p className="text-xs">{missingFields.join(', ')}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1.5">
                                  <Badge className={getStatusColor(invoice.status)}>
                                    {invAny.is_draft ? 'Rascunho' : getStatusLabel(invoice.status)}
                                  </Badge>
                                  {invoice.status === 'rejected' && invoice.error_message && (
                                    <AlertCircle className="w-4 h-4 text-destructive" />
                                  )}
                                </div>
                              </TooltipTrigger>
                              {invoice.error_message && (
                                <TooltipContent className="max-w-xs">
                                  <p className="font-semibold text-destructive">Erro na emissão</p>
                                  <p className="text-xs">{invoice.error_message}</p>
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(invoice.total_cents)}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => navigate(`/notas-fiscais/${invoice.id}`)}>
                                <Eye className="w-4 h-4 mr-2" />
                                Visualizar
                              </DropdownMenuItem>
                              {invoice.status === 'processing' && (
                                <DropdownMenuItem onClick={() => refreshStatus.mutate(invoice.id)}>
                                  <RefreshCw className="w-4 h-4 mr-2" />
                                  Atualizar Status
                                </DropdownMenuItem>
                              )}
                              {invoice.pdf_url && (
                                <DropdownMenuItem asChild>
                                  <a href={invoice.pdf_url} target="_blank" rel="noopener noreferrer">
                                    <Printer className="w-4 h-4 mr-2" />
                                    {invoice.pdf_url.includes('homologacao') ? 'Espelho NF-e (Teste)' : 'DANFE'}
                                  </a>
                                </DropdownMenuItem>
                              )}
                              {invoice.xml_url && (
                                <DropdownMenuItem asChild>
                                  <a href={invoice.xml_url} target="_blank" rel="noopener noreferrer">
                                    <FileDown className="w-4 h-4 mr-2" />
                                    XML
                                  </a>
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Actions Sidebar */}
          <Card className="w-72 shrink-0 h-fit sticky top-6">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">Ações</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-4 space-y-1">
              {/* Batch actions on selected */}
              <p className="text-[11px] font-medium text-muted-foreground px-2 pt-1 pb-1">Selecionadas</p>
              <Button
                variant="ghost"
                className="w-full justify-start text-sm h-9 px-3 gap-2.5 font-normal"
                disabled={selectedIds.length === 0 || sendInvoice.isPending}
                onClick={handleBatchSend}
              >
                {sendInvoice.isPending ? (
                  <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 shrink-0" />
                )}
                <span className="truncate">Enviar NF-es selecionadas</span>
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start text-sm h-9 px-3 gap-2.5 font-normal"
                disabled={selectedIds.length === 0}
                onClick={handleBatchPrint}
              >
                <Printer className="w-4 h-4 shrink-0" />
                <span className="truncate">Imprimir NF-es selecionadas</span>
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start text-sm h-9 px-3 gap-2.5 font-normal"
                disabled={selectedIds.length === 0}
              >
                <Mail className="w-4 h-4 shrink-0" />
                <span className="truncate">Enviar para loja virtual</span>
              </Button>

              <Separator className="!my-2.5" />

              {/* General actions */}
              <p className="text-[11px] font-medium text-muted-foreground px-2 pt-1 pb-1">Geral</p>
              <Button
                variant="ghost"
                className="w-full justify-start text-sm h-9 px-3 gap-2.5 font-normal"
                disabled={processingCount === 0 || refreshAllProcessing.isPending}
                onClick={() => refreshAllProcessing.mutate()}
              >
                {refreshAllProcessing.isPending ? (
                  <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 shrink-0" />
                )}
                <span className="truncate">Atualizar em processamento</span>
                {processingCount > 0 && (
                  <Badge variant="secondary" className="ml-auto text-[10px] h-5 px-1.5">
                    {processingCount}
                  </Badge>
                )}
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start text-sm h-9 px-3 gap-2.5 font-normal"
                onClick={() => {
                  const pending = invoices.filter(i => i.status === 'pending');
                  if (pending.length === 0) {
                    toast({ title: 'Não há notas pendentes' });
                    return;
                  }
                  toast({ title: `${pending.length} notas pendentes` });
                }}
              >
                <Send className="w-4 h-4 shrink-0" />
                <span className="truncate">Enviar notas pendentes</span>
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start text-sm h-9 px-3 gap-2.5 font-normal"
                disabled={selectedIds.length === 0}
                onClick={handleBatchPrint}
              >
                <FileText className="w-4 h-4 shrink-0" />
                <span className="truncate">Gerar PDF DANFE</span>
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start text-sm h-9 px-3 gap-2.5 font-normal"
                disabled={selectedIds.length === 0}
                onClick={handleBatchExportXML}
              >
                <Download className="w-4 h-4 shrink-0" />
                <span className="truncate">Exportar XML</span>
              </Button>

              <Separator className="!my-2.5" />

              <p className="text-[11px] font-medium text-muted-foreground px-2 pt-1 pb-1">Outros</p>
              <Button
                variant="ghost"
                className="w-full justify-start text-sm h-9 px-3 gap-2.5 font-normal text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                onClick={() => setShowInvalidateDialog(true)}
              >
                <Ban className="w-4 h-4 shrink-0" />
                <span className="truncate">Inutilizar numeração</span>
              </Button>

              <Separator className="!my-2.5" />

              <p className="text-[11px] font-medium text-muted-foreground px-2 pt-1 pb-1">Configurações</p>
              <Button
                variant="ghost"
                className="w-full justify-start text-sm h-9 px-3 gap-2.5 font-normal"
                onClick={() => setShowAutoSendDialog(true)}
              >
                <Settings className="w-4 h-4 shrink-0" />
                <span className="truncate">Envio automático</span>
              </Button>

              <Separator className="!my-2.5" />

              {/* Summary */}
              <div className="text-sm space-y-1.5 px-2 pt-1">
                <div className="flex justify-between text-muted-foreground">
                  <span>Quantidade</span>
                  <span className="font-semibold text-foreground">{summary.count}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Valor total</span>
                  <span className="font-semibold text-foreground">
                    {formatCurrency(summary.totalCents)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Dialogs */}
        <InvalidateNumbersDialog 
          open={showInvalidateDialog} 
          onOpenChange={setShowInvalidateDialog} 
        />
        <FiscalAutoSendConfigDialog
          open={showAutoSendDialog}
          onClose={() => setShowAutoSendDialog(false)}
        />

      </div>
    </Layout>
  );
}
