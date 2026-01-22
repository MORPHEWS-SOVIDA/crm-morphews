import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { 
  ChevronDown, 
  ChevronLeft, 
  Loader2, 
  Save, 
  Send, 
  AlertCircle,
  FileText,
  Download,
  Printer,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  useFiscalInvoice, 
  useFiscalInvoiceEvents,
  useRefreshInvoiceStatus,
  getStatusLabel, 
  getStatusColor,
  type FiscalInvoice,
} from '@/hooks/useFiscalInvoices';
import { useFiscalCompanies, formatCNPJ } from '@/hooks/useFiscalCompanies';
import { useSaveFiscalInvoiceDraft, useSendFiscalInvoice } from '@/hooks/useFiscalInvoiceDraft';
import { toast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

const BRAZILIAN_STATES = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT',
  'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'
];

const PURPOSES = [
  { value: 'normal', label: 'NF-e normal' },
  { value: 'complementar', label: 'NF-e complementar' },
  { value: 'ajuste', label: 'NF-e de ajuste' },
  { value: 'devolucao', label: 'Devolução de mercadoria' },
];

const PRESENCE_INDICATORS = [
  { value: '0', label: '0 - Não se aplica' },
  { value: '1', label: '1 - Operação presencial' },
  { value: '2', label: '2 - Operação não presencial, pela Internet' },
  { value: '3', label: '3 - Operação não presencial, Teleatendimento' },
  { value: '4', label: '4 - NFC-e em operação com entrega em domicílio' },
  { value: '5', label: '5 - Operação presencial, fora do estabelecimento' },
  { value: '9', label: '9 - Operação não presencial, outros' },
];

const FREIGHT_RESPONSIBILITIES = [
  { value: '0', label: '0 - Contratação do Frete por conta do Remetente (CIF)' },
  { value: '1', label: '1 - Contratação do Frete por conta do Destinatário (FOB)' },
  { value: '2', label: '2 - Contratação do Frete por conta de Terceiros' },
  { value: '3', label: '3 - Transporte Próprio por conta do Remetente' },
  { value: '4', label: '4 - Transporte Próprio por conta do Destinatário' },
  { value: '9', label: '9 - Sem Ocorrência de Transporte' },
];

export default function FiscalInvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const { data: invoice, isLoading } = useFiscalInvoice(id);
  const { data: events = [] } = useFiscalInvoiceEvents(id);
  const { data: companies = [] } = useFiscalCompanies();
  const sendInvoice = useSendFiscalInvoice();
  const refreshStatus = useRefreshInvoiceStatus();

  const [openSections, setOpenSections] = useState({
    header: true,
    recipient: true,
    items: true,
    taxes: false,
    transport: false,
    additional: false,
    events: false,
  });

  const isEditable = invoice?.is_draft || invoice?.status === 'pending' || invoice?.status === 'rejected';
  const canResend = invoice?.status === 'rejected';

  const formatCurrency = (cents: number | null | undefined) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format((cents || 0) / 100);
  };

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleSend = async () => {
    if (!invoice?.id) {
      toast({ title: 'Nota não encontrada', variant: 'destructive' });
      return;
    }
    await sendInvoice.mutateAsync(invoice.id);
  };

  const handleRefresh = async () => {
    if (!invoice?.id) return;
    await refreshStatus.mutateAsync(invoice.id);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copiado!' });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'authorized':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'rejected':
      case 'cancelled':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'processing':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      default:
        return <FileText className="w-5 h-5 text-muted-foreground" />;
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto py-6 space-y-6">
          <Skeleton className="h-10 w-48" />
          <div className="grid grid-cols-3 gap-6">
            <Skeleton className="h-40 col-span-2" />
            <Skeleton className="h-40" />
          </div>
          <Skeleton className="h-60" />
        </div>
      </Layout>
    );
  }

  if (!invoice) {
    return (
      <Layout>
        <div className="container mx-auto py-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Nota não encontrada</AlertTitle>
            <AlertDescription>
              A nota fiscal solicitada não foi encontrada ou você não tem permissão para visualizá-la.
            </AlertDescription>
          </Alert>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/notas-fiscais')}>
            <ChevronLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
        </div>
      </Layout>
    );
  }

  const selectedCompany = companies.find(c => c.id === invoice.fiscal_company_id);
  const items = Array.isArray(invoice.items) ? invoice.items : [];

  return (
    <Layout>
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/notas-fiscais')}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                {getStatusIcon(invoice.status)}
                <h1 className="text-2xl font-bold">
                  {invoice.invoice_number 
                    ? `Nota Fiscal #${invoice.invoice_number}` 
                    : `Ref: ${invoice.focus_nfe_ref}`}
                </h1>
                <Badge className={getStatusColor(invoice.status)}>
                  {invoice.is_draft ? 'Rascunho' : getStatusLabel(invoice.status)}
                </Badge>
              </div>
              <p className="text-muted-foreground mt-1">
                {invoice.invoice_type?.toUpperCase()} • Criada em {format(new Date(invoice.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {invoice.status === 'processing' && (
              <Button variant="outline" onClick={handleRefresh} disabled={refreshStatus.isPending}>
                {refreshStatus.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                <RefreshCw className="w-4 h-4 mr-2" />
                Atualizar Status
              </Button>
            )}
            {invoice.pdf_url && (
              <Button variant="outline" asChild>
                <a href={invoice.pdf_url} target="_blank" rel="noopener noreferrer">
                  <Printer className="w-4 h-4 mr-2" />
                  DANFE
                </a>
              </Button>
            )}
            {invoice.xml_url && (
              <Button variant="outline" asChild>
                <a href={invoice.xml_url} target="_blank" rel="noopener noreferrer">
                  <Download className="w-4 h-4 mr-2" />
                  XML
                </a>
              </Button>
            )}
            {isEditable && (
              <Button onClick={handleSend} disabled={sendInvoice.isPending}>
                {sendInvoice.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                <Send className="w-4 h-4 mr-2" />
                {canResend ? 'Reenviar' : 'Enviar para SEFAZ'}
              </Button>
            )}
          </div>
        </div>

        {/* Error Alert */}
        {invoice.status === 'rejected' && invoice.error_message && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Erro na emissão</AlertTitle>
            <AlertDescription className="whitespace-pre-wrap">{invoice.error_message}</AlertDescription>
          </Alert>
        )}

        {/* Focus NFe Response Details */}
        {invoice.focus_nfe_response && typeof invoice.focus_nfe_response === 'object' && (
          <Card className="border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-950/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-600" />
                Resposta da SEFAZ
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {(invoice.focus_nfe_response as any).mensagem_sefaz && (
                <p><strong>Mensagem:</strong> {(invoice.focus_nfe_response as any).mensagem_sefaz}</p>
              )}
              {(invoice.focus_nfe_response as any).status_sefaz && (
                <p><strong>Código:</strong> {(invoice.focus_nfe_response as any).status_sefaz}</p>
              )}
              {(invoice.focus_nfe_response as any).erros && Array.isArray((invoice.focus_nfe_response as any).erros) && (
                <div>
                  <strong>Erros:</strong>
                  <ul className="list-disc list-inside mt-1">
                    {((invoice.focus_nfe_response as any).erros as any[]).map((err, i) => (
                      <li key={i}>{err.campo}: {err.mensagem}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Header / Company Section */}
            <Collapsible open={openSections.header} onOpenChange={() => toggleSection('header')}>
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">Dados da Nota</CardTitle>
                      <ChevronDown className={`w-5 h-5 transition-transform ${openSections.header ? 'rotate-180' : ''}`} />
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-muted-foreground text-xs">Número</Label>
                      <p className="font-medium">{invoice.invoice_number || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Série</Label>
                      <p className="font-medium">{invoice.invoice_series || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Tipo</Label>
                      <p className="font-medium">{invoice.invoice_type?.toUpperCase()}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Natureza da Operação</Label>
                      <p className="font-medium">{invoice.nature_operation || 'Venda de mercadorias'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Finalidade</Label>
                      <p className="font-medium">
                        {PURPOSES.find(p => p.value === invoice.purpose)?.label || 'NF-e normal'}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Indicador de Presença</Label>
                      <p className="font-medium">
                        {PRESENCE_INDICATORS.find(p => p.value === invoice.presence_indicator)?.label || '0 - Não se aplica'}
                      </p>
                    </div>
                    {invoice.access_key && (
                      <div className="col-span-full">
                        <Label className="text-muted-foreground text-xs">Chave de Acesso</Label>
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-muted px-2 py-1 rounded font-mono">{invoice.access_key}</code>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(invoice.access_key!)}>
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                    {selectedCompany && (
                      <div className="col-span-full border-t pt-4 mt-2">
                        <Label className="text-muted-foreground text-xs">Empresa Emitente</Label>
                        <p className="font-medium">{selectedCompany.company_name}</p>
                        <p className="text-sm text-muted-foreground">{formatCNPJ(selectedCompany.cnpj)}</p>
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* Recipient Section */}
            <Collapsible open={openSections.recipient} onOpenChange={() => toggleSection('recipient')}>
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">Destinatário</CardTitle>
                      <ChevronDown className={`w-5 h-5 transition-transform ${openSections.recipient ? 'rotate-180' : ''}`} />
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="col-span-2">
                      <Label className="text-muted-foreground text-xs">Nome</Label>
                      <p className="font-medium">{invoice.recipient_name || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">CPF/CNPJ</Label>
                      <p className="font-medium">{invoice.recipient_cpf_cnpj || '-'}</p>
                    </div>
                    <div className="col-span-2">
                      <Label className="text-muted-foreground text-xs">Endereço</Label>
                      <p className="font-medium">
                        {[invoice.recipient_street, invoice.recipient_number, invoice.recipient_complement]
                          .filter(Boolean).join(', ') || '-'}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Bairro</Label>
                      <p className="font-medium">{invoice.recipient_neighborhood || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">Cidade</Label>
                      <p className="font-medium">{invoice.recipient_city || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">UF</Label>
                      <p className="font-medium">{invoice.recipient_state || '-'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">CEP</Label>
                      <p className="font-medium">{invoice.recipient_cep || '-'}</p>
                    </div>
                    {invoice.recipient_email && (
                      <div>
                        <Label className="text-muted-foreground text-xs">E-mail</Label>
                        <p className="font-medium">{invoice.recipient_email}</p>
                      </div>
                    )}
                    {invoice.recipient_phone && (
                      <div>
                        <Label className="text-muted-foreground text-xs">Telefone</Label>
                        <p className="font-medium">{invoice.recipient_phone}</p>
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* Items Section */}
            <Collapsible open={openSections.items} onOpenChange={() => toggleSection('items')}>
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">Itens ({items.length})</CardTitle>
                      <ChevronDown className={`w-5 h-5 transition-transform ${openSections.items ? 'rotate-180' : ''}`} />
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produto</TableHead>
                          <TableHead className="text-center">Qtd</TableHead>
                          <TableHead className="text-right">Unitário</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item: any, index: number) => (
                          <TableRow key={index}>
                            <TableCell>
                              <p className="font-medium">{item.product_name || item.name || item.product?.name}</p>
                              <p className="text-xs text-muted-foreground">
                                NCM: {item.ncm || item.product?.fiscal_ncm || '-'} | CFOP: {item.cfop || '-'}
                              </p>
                            </TableCell>
                            <TableCell className="text-center">{item.quantity}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.unit_price_cents)}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(item.total_cents)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* Transport Section */}
            <Collapsible open={openSections.transport} onOpenChange={() => toggleSection('transport')}>
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">Transporte</CardTitle>
                      <ChevronDown className={`w-5 h-5 transition-transform ${openSections.transport ? 'rotate-180' : ''}`} />
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="col-span-full">
                      <Label className="text-muted-foreground text-xs">Modalidade do Frete</Label>
                      <p className="font-medium">
                        {FREIGHT_RESPONSIBILITIES.find(f => f.value === invoice.freight_responsibility)?.label 
                          || '9 - Sem Ocorrência de Transporte'}
                      </p>
                    </div>
                    {invoice.carrier_name && (
                      <>
                        <div className="col-span-2">
                          <Label className="text-muted-foreground text-xs">Transportadora</Label>
                          <p className="font-medium">{invoice.carrier_name}</p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground text-xs">CPF/CNPJ</Label>
                          <p className="font-medium">{invoice.carrier_cpf_cnpj || '-'}</p>
                        </div>
                      </>
                    )}
                    {invoice.volume_quantity && (
                      <>
                        <div>
                          <Label className="text-muted-foreground text-xs">Volumes</Label>
                          <p className="font-medium">{invoice.volume_quantity}</p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground text-xs">Peso Bruto</Label>
                          <p className="font-medium">{invoice.volume_gross_weight?.toFixed(3) || '-'} kg</p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground text-xs">Peso Líquido</Label>
                          <p className="font-medium">{invoice.volume_net_weight?.toFixed(3) || '-'} kg</p>
                        </div>
                      </>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* Events / History Section */}
            <Collapsible open={openSections.events} onOpenChange={() => toggleSection('events')}>
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">Histórico de Eventos</CardTitle>
                      <ChevronDown className={`w-5 h-5 transition-transform ${openSections.events ? 'rotate-180' : ''}`} />
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent>
                    {events.length === 0 ? (
                      <p className="text-muted-foreground text-sm">Nenhum evento registrado.</p>
                    ) : (
                      <div className="space-y-3">
                        {events.map((event) => (
                          <div key={event.id} className="flex items-start gap-3 border-l-2 border-muted pl-4 py-2">
                            <div className="flex-1">
                              <p className="font-medium text-sm">{event.event_type}</p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(event.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          </div>

          {/* Sidebar - Summary */}
          <div className="space-y-6">
            {/* Values Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Resumo de Valores</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Produtos</span>
                  <span className="font-medium">{formatCurrency(invoice.products_total_cents)}</span>
                </div>
                {(invoice.freight_value_cents ?? 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Frete</span>
                    <span className="font-medium">{formatCurrency(invoice.freight_value_cents)}</span>
                  </div>
                )}
                {(invoice.insurance_value_cents ?? 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Seguro</span>
                    <span className="font-medium">{formatCurrency(invoice.insurance_value_cents)}</span>
                  </div>
                )}
                {(invoice.discount_cents ?? 0) > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Desconto</span>
                    <span className="font-medium">-{formatCurrency(invoice.discount_cents)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-lg">
                  <span className="font-semibold">Total</span>
                  <span className="font-bold">{formatCurrency(invoice.total_cents)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Quick Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Informações</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <Label className="text-muted-foreground text-xs">Referência Interna</Label>
                  <div className="flex items-center gap-2">
                    <code className="text-xs bg-muted px-2 py-1 rounded">{invoice.focus_nfe_ref}</code>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(invoice.focus_nfe_ref)}>
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                {invoice.protocol_number && (
                  <div>
                    <Label className="text-muted-foreground text-xs">Protocolo</Label>
                    <p className="font-medium">{invoice.protocol_number}</p>
                  </div>
                )}
                {invoice.sale_id && (
                  <div>
                    <Label className="text-muted-foreground text-xs">Venda Vinculada</Label>
                    <Button variant="link" className="h-auto p-0" onClick={() => navigate(`/vendas/${invoice.sale_id}`)}>
                      Ver venda <ExternalLink className="w-3 h-3 ml-1" />
                    </Button>
                  </div>
                )}
                {invoice.authorized_at && (
                  <div>
                    <Label className="text-muted-foreground text-xs">Autorizada em</Label>
                    <p className="font-medium">
                      {format(new Date(invoice.authorized_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Additional Info */}
            {invoice.additional_info && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Informações Adicionais</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{invoice.additional_info}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
