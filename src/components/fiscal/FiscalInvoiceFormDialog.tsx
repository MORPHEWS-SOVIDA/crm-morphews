import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import { ChevronDown, Loader2, X, Save, Send, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { type FiscalInvoice, getStatusLabel, getStatusColor, useEmitInvoice } from '@/hooks/useFiscalInvoices';
import { useFiscalCompanies, formatCNPJ } from '@/hooks/useFiscalCompanies';
import { useSaveFiscalInvoiceDraft, useSendFiscalInvoice } from '@/hooks/useFiscalInvoiceDraft';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';

const BRAZILIAN_STATES = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT',
  'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'
];

const EMISSION_TYPES = [
  { value: 'own', label: 'Emissão Própria' },
  { value: 'export', label: 'Exportação' },
  { value: 'third_party', label: 'Emitida por Terceiros' },
  { value: 'import_xml', label: 'Importação de XML de saída' },
  { value: 'nfce', label: 'NFCe' },
];

const TAX_REGIMES = [
  { value: 'simples', label: 'Simples Nacional' },
  { value: 'simples_excess', label: 'Simples Nacional - Excesso de sublimite de receita bruta' },
  { value: 'normal', label: 'Regime Normal' },
  { value: 'mei', label: 'MEI' },
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

const TRANSPORT_TYPES = [
  { value: 'none', label: 'Não haverá transporte' },
  { value: 'registered', label: 'Transporte com logística cadastrada' },
  { value: 'manual', label: 'Inserir transportadora manualmente' },
];

interface Props {
  invoice: FiscalInvoice | null;
  onClose: () => void;
}

export function FiscalInvoiceFormDialog({ invoice, onClose }: Props) {
  const { data: companies = [] } = useFiscalCompanies();
  const saveDraft = useSaveFiscalInvoiceDraft();
  const sendInvoice = useSendFiscalInvoice();

  const [openSections, setOpenSections] = useState({
    header: true,
    recipient: true,
    items: true,
    taxes: true,
    transport: false,
    payment: false,
    additional: false,
  });

  const isOpen = invoice !== null;
  const isNew = !invoice?.id;
  // Allow editing and resending for: new, draft, pending, and rejected invoices
  const isEditable = isNew || invoice?.is_draft || invoice?.status === 'pending' || invoice?.status === 'rejected';
  const canResend = invoice?.status === 'rejected';

  // Form values from invoice - cast to partial FiscalInvoice
  const formData: Partial<FiscalInvoice> = invoice || {};

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100);
  };

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleSave = async () => {
    // Save as draft
    toast({ title: 'Salvando rascunho...' });
    // TODO: Implement save draft mutation
  };

  const handleSend = async () => {
    if (!invoice?.id) {
      toast({ title: 'Salve a nota antes de enviar', variant: 'destructive' });
      return;
    }
    await sendInvoice.mutateAsync(invoice.id);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl">
                {isNew ? 'Nova Nota Fiscal' : `Nota Fiscal ${invoice?.invoice_number || 'Rascunho'}`}
              </DialogTitle>
              {invoice?.status && !isNew && (
                <Badge className={`mt-2 ${getStatusColor(invoice.status)}`}>
                  {invoice.is_draft ? 'Rascunho' : getStatusLabel(invoice.status)}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              {isEditable && (
                <>
                  <Button variant="outline" onClick={handleSave} disabled={saveDraft.isPending}>
                    {saveDraft.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    <Save className="w-4 h-4 mr-2" />
                    Salvar
                  </Button>
                  <Button onClick={handleSend} disabled={sendInvoice.isPending}>
                    {sendInvoice.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    <Send className="w-4 h-4 mr-2" />
                    {canResend ? 'Reenviar' : 'Enviar'}
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)]">
          <div className="p-6 space-y-6">
            {/* Error Alert */}
            {invoice?.status === 'rejected' && invoice?.error_message && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Erro na emissão</AlertTitle>
                <AlertDescription>{invoice.error_message}</AlertDescription>
              </Alert>
            )}

            {/* Header Section */}
            <Collapsible open={openSections.header} onOpenChange={() => toggleSection('header')}>
              <CollapsibleTrigger className="flex items-center justify-between w-full text-left">
                <h3 className="text-lg font-semibold">Dados da Nota</h3>
                <ChevronDown className={`w-5 h-5 transition-transform ${openSections.header ? 'rotate-180' : ''}`} />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo de Saída</Label>
                    <Select defaultValue={formData.emission_type || 'own'} disabled={!isEditable}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EMISSION_TYPES.map(t => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Série</Label>
                    <Input defaultValue={formData.invoice_series || '1'} disabled={!isEditable} />
                  </div>

                  <div className="space-y-2">
                    <Label>Número</Label>
                    <Input 
                      defaultValue={formData.invoice_number || ''} 
                      disabled 
                      placeholder="Automático"
                    />
                  </div>

                  <div className="col-span-2 space-y-2">
                    <Label>Empresa Emissora</Label>
                    <Select defaultValue={formData.fiscal_company_id} disabled={!isEditable}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a empresa" />
                      </SelectTrigger>
                      <SelectContent>
                        {companies.filter(c => c.is_active).map(c => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.company_name} ({formatCNPJ(c.cnpj)})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Natureza de operação</Label>
                    <Input 
                      defaultValue={formData.nature_operation || 'Venda de mercadorias'} 
                      disabled={!isEditable}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Data de emissão</Label>
                    <Input 
                      type="date" 
                      defaultValue={formData.emission_date || format(new Date(), 'yyyy-MM-dd')}
                      disabled={!isEditable}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Hora de emissão</Label>
                    <Input 
                      type="time" 
                      defaultValue={formData.emission_time || format(new Date(), 'HH:mm:ss')}
                      disabled={!isEditable}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Data saída</Label>
                    <Input 
                      type="date" 
                      defaultValue={formData.exit_date || format(new Date(), 'yyyy-MM-dd')}
                      disabled={!isEditable}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Hora saída</Label>
                    <Input 
                      type="time" 
                      defaultValue={formData.exit_time || format(new Date(), 'HH:mm:ss')}
                      disabled={!isEditable}
                    />
                  </div>

                  <div className="col-span-2 space-y-2">
                    <Label>Código do regime tributário</Label>
                    <Select defaultValue={formData.tax_regime || 'simples'} disabled={!isEditable}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TAX_REGIMES.map(t => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Finalidade</Label>
                    <Select defaultValue={formData.purpose || 'normal'} disabled={!isEditable}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PURPOSES.map(p => (
                          <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="col-span-2 space-y-2">
                    <Label>Indicador de presença</Label>
                    <Select defaultValue={formData.presence_indicator || '9'} disabled={!isEditable}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRESENCE_INDICATORS.map(p => (
                          <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            {/* Recipient Section */}
            <Collapsible open={openSections.recipient} onOpenChange={() => toggleSection('recipient')}>
              <CollapsibleTrigger className="flex items-center justify-between w-full text-left">
                <h3 className="text-lg font-semibold">Destinatário</h3>
                <ChevronDown className={`w-5 h-5 transition-transform ${openSections.recipient ? 'rotate-180' : ''}`} />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="col-span-2 space-y-2">
                    <Label>Nome do contato</Label>
                    <Input 
                      defaultValue={formData.recipient_name || formData.sale?.lead?.name || ''} 
                      disabled={!isEditable}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Tipo da pessoa</Label>
                    <Select defaultValue={formData.recipient_type || 'juridica'} disabled={!isEditable}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="juridica">Jurídica</SelectItem>
                        <SelectItem value="fisica">Física</SelectItem>
                        <SelectItem value="estrangeiro">Estrangeiro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>CPF/CNPJ</Label>
                    <Input 
                      defaultValue={formData.recipient_cpf_cnpj || ''} 
                      disabled={!isEditable}
                    />
                  </div>

                  <div className="flex items-center space-x-2 col-span-2">
                    <Checkbox 
                      id="final_consumer" 
                      defaultChecked={formData.recipient_is_final_consumer ?? true}
                      disabled={!isEditable}
                    />
                    <Label htmlFor="final_consumer">Consumidor final</Label>
                  </div>

                  <div className="space-y-2">
                    <Label>CEP</Label>
                    <Input 
                      defaultValue={formData.recipient_cep || ''} 
                      disabled={!isEditable}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>UF</Label>
                    <Select defaultValue={formData.recipient_state || ''} disabled={!isEditable}>
                      <SelectTrigger>
                        <SelectValue placeholder="UF" />
                      </SelectTrigger>
                      <SelectContent>
                        {BRAZILIAN_STATES.map(uf => (
                          <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Município</Label>
                    <Input 
                      defaultValue={formData.recipient_city || ''} 
                      disabled={!isEditable}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Bairro</Label>
                    <Input 
                      defaultValue={formData.recipient_neighborhood || ''} 
                      disabled={!isEditable}
                    />
                  </div>

                  <div className="col-span-2 space-y-2">
                    <Label>Endereço</Label>
                    <Input 
                      defaultValue={formData.recipient_street || ''} 
                      disabled={!isEditable}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Número</Label>
                    <Input 
                      defaultValue={formData.recipient_number || ''} 
                      disabled={!isEditable}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Complemento</Label>
                    <Input 
                      defaultValue={formData.recipient_complement || ''} 
                      disabled={!isEditable}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Fone/FAX</Label>
                    <Input 
                      defaultValue={formData.recipient_phone || ''} 
                      disabled={!isEditable}
                    />
                  </div>

                  <div className="col-span-2 space-y-2">
                    <Label>E-mail</Label>
                    <Input 
                      type="email"
                      defaultValue={formData.recipient_email || ''} 
                      disabled={!isEditable}
                    />
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            {/* Items Section */}
            <Collapsible open={openSections.items} onOpenChange={() => toggleSection('items')}>
              <CollapsibleTrigger className="flex items-center justify-between w-full text-left">
                <h3 className="text-lg font-semibold">Itens da nota fiscal</h3>
                <ChevronDown className={`w-5 h-5 transition-transform ${openSections.items ? 'rotate-180' : ''}`} />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">#</TableHead>
                      <TableHead>Produto ou serviço</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>UN</TableHead>
                      <TableHead className="text-right">Qtde</TableHead>
                      <TableHead className="text-right">Preço un</TableHead>
                      <TableHead className="text-right">Preço total</TableHead>
                      <TableHead>NCM</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {formData.items && Array.isArray(formData.items) ? (
                      formData.items.map((item: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell>{item.name || item.description}</TableCell>
                          <TableCell className="font-mono text-sm">{item.code || item.sku}</TableCell>
                          <TableCell>{item.unit || 'un'}</TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(item.unit_price_cents || 0)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency((item.unit_price_cents || 0) * (item.quantity || 1))}
                          </TableCell>
                          <TableCell className="font-mono text-sm">{item.ncm}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          Nenhum item adicionado
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            {/* Tax Calculation */}
            <Collapsible open={openSections.taxes} onOpenChange={() => toggleSection('taxes')}>
              <CollapsibleTrigger className="flex items-center justify-between w-full text-left">
                <h3 className="text-lg font-semibold">Cálculo de imposto</h3>
                <ChevronDown className={`w-5 h-5 transition-transform ${openSections.taxes ? 'rotate-180' : ''}`} />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4">
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                  <div className="space-y-2">
                    <Label>Total dos Produtos (R$)</Label>
                    <Input 
                      type="number" 
                      step="0.01"
                      defaultValue={((formData.products_total_cents || formData.total_cents || 0) / 100).toFixed(2)} 
                      disabled={!isEditable}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Valor do Frete (R$)</Label>
                    <Input 
                      type="number" 
                      step="0.01"
                      defaultValue={((formData.freight_value_cents || 0) / 100).toFixed(2)} 
                      disabled={!isEditable}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Valor do Seguro (R$)</Label>
                    <Input 
                      type="number" 
                      step="0.01"
                      defaultValue={((formData.insurance_value_cents || 0) / 100).toFixed(2)} 
                      disabled={!isEditable}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Outras Despesas (R$)</Label>
                    <Input 
                      type="number" 
                      step="0.01"
                      defaultValue={((formData.other_expenses_cents || 0) / 100).toFixed(2)} 
                      disabled={!isEditable}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Desconto (R$)</Label>
                    <Input 
                      type="number" 
                      step="0.01"
                      defaultValue={((formData.discount_cents || 0) / 100).toFixed(2)} 
                      disabled={!isEditable}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-semibold">Total da Nota (R$)</Label>
                    <Input 
                      type="number" 
                      step="0.01"
                      value={(formData.total_cents / 100).toFixed(2)} 
                      disabled
                      className="font-bold"
                    />
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            {/* Transport Section */}
            <Collapsible open={openSections.transport} onOpenChange={() => toggleSection('transport')}>
              <CollapsibleTrigger className="flex items-center justify-between w-full text-left">
                <h3 className="text-lg font-semibold">Transportador/Volumes</h3>
                <ChevronDown className={`w-5 h-5 transition-transform ${openSections.transport ? 'rotate-180' : ''}`} />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="col-span-2 space-y-2">
                    <Label>Transporte</Label>
                    <Select defaultValue={formData.transport_type || 'none'} disabled={!isEditable}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TRANSPORT_TYPES.map(t => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="col-span-2 space-y-2">
                    <Label>Frete por conta</Label>
                    <Select defaultValue={formData.freight_responsibility || '9'} disabled={!isEditable}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FREIGHT_RESPONSIBILITIES.map(f => (
                          <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="col-span-2 space-y-2">
                    <Label>Nome transportadora</Label>
                    <Input defaultValue={formData.carrier_name || ''} disabled={!isEditable} />
                  </div>

                  <div className="space-y-2">
                    <Label>Placa veículo</Label>
                    <Input defaultValue={formData.vehicle_plate || ''} disabled={!isEditable} />
                  </div>

                  <div className="space-y-2">
                    <Label>UF veículo</Label>
                    <Select defaultValue={formData.vehicle_state || ''} disabled={!isEditable}>
                      <SelectTrigger>
                        <SelectValue placeholder="UF" />
                      </SelectTrigger>
                      <SelectContent>
                        {BRAZILIAN_STATES.map(uf => (
                          <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Quantidade volumes</Label>
                    <Input type="number" defaultValue={formData.volume_quantity || ''} disabled={!isEditable} />
                  </div>

                  <div className="space-y-2">
                    <Label>Peso Bruto</Label>
                    <Input type="number" step="0.001" defaultValue={formData.volume_gross_weight || ''} disabled={!isEditable} />
                  </div>

                  <div className="space-y-2">
                    <Label>Peso Líquido</Label>
                    <Input type="number" step="0.001" defaultValue={formData.volume_net_weight || ''} disabled={!isEditable} />
                  </div>

                  <div className="space-y-2">
                    <Label>Espécie</Label>
                    <Input defaultValue={formData.volume_species || ''} disabled={!isEditable} />
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            <Separator />

            {/* Additional Info */}
            <Collapsible open={openSections.additional} onOpenChange={() => toggleSection('additional')}>
              <CollapsibleTrigger className="flex items-center justify-between w-full text-left">
                <h3 className="text-lg font-semibold">Informações adicionais</h3>
                <ChevronDown className={`w-5 h-5 transition-transform ${openSections.additional ? 'rotate-180' : ''}`} />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Informações complementares</Label>
                    <Textarea 
                      rows={4}
                      defaultValue={formData.additional_info || ''} 
                      disabled={!isEditable}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Informações adicionais de interesse do fisco</Label>
                    <Textarea 
                      rows={4}
                      defaultValue={formData.fisco_info || ''} 
                      disabled={!isEditable}
                    />
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Error Message */}
            {formData.error_message && (
              <>
                <Separator />
                <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
                  <h4 className="font-medium text-destructive mb-2">Erro na emissão</h4>
                  <p className="text-sm text-destructive/80">{formData.error_message}</p>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
