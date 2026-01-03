import { useState } from 'react';
import { Plus, Pencil, Trash2, CreditCard, Banknote, Calendar, Building2, Percent, Clock, FileCheck, ChevronDown, ChevronUp, Gift, QrCode, Link, Globe, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  usePaymentMethodsEnhanced,
  useCreatePaymentMethodEnhanced,
  useUpdatePaymentMethodEnhanced,
  useDeletePaymentMethodEnhanced,
  useBankDestinations,
  useCnpjDestinations,
  useCostCenters,
  useAcquirers,
  useCreateBankDestination,
  useCreateCnpjDestination,
  useCreateCostCenter,
  useCreateAcquirer,
  PaymentMethodEnhanced,
  PaymentCategory,
  PaymentTiming,
  InstallmentFlow,
  CardTransactionType,
  PAYMENT_CATEGORY_LABELS,
  PAYMENT_TIMING_LABELS,
  INSTALLMENT_FLOW_LABELS,
  TRANSACTION_TYPE_LABELS,
  CATEGORIES_REQUIRING_TRANSACTION_DATA,
  BOLETO_CATEGORIES,
} from '@/hooks/usePaymentMethodsEnhanced';

const formatCurrency = (cents: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
};

const getCategoryIcon = (category: PaymentCategory | null) => {
  switch (category) {
    case 'cash': return <Banknote className="h-4 w-4" />;
    case 'pix': return <QrCode className="h-4 w-4" />;
    case 'card_machine': return <CreditCard className="h-4 w-4" />;
    case 'payment_link': return <Link className="h-4 w-4" />;
    case 'ecommerce': return <Globe className="h-4 w-4" />;
    case 'boleto_prepaid':
    case 'boleto_postpaid':
    case 'boleto_installment': return <FileText className="h-4 w-4" />;
    case 'gift': return <Gift className="h-4 w-4" />;
    default: return <CreditCard className="h-4 w-4" />;
  }
};

interface TransactionFeeFormData {
  transaction_type: CardTransactionType;
  fee_percentage: number;
  fee_fixed_cents: number;
  settlement_days: number;
  is_enabled: boolean;
}

interface FormData {
  name: string;
  category: PaymentCategory | '';
  payment_timing: PaymentTiming;
  installment_flow: InstallmentFlow | null;
  max_installments: number;
  min_installment_value_cents: number;
  bank_destination_id: string | null;
  cnpj_destination_id: string | null;
  cost_center_id: string | null;
  acquirer_id: string | null;
  fee_percentage: number;
  fee_fixed_cents: number;
  settlement_days: number;
  anticipation_fee_percentage: number;
  requires_proof: boolean;
  transaction_fees: TransactionFeeFormData[];
}

const ALL_TRANSACTION_TYPES: CardTransactionType[] = ['debit', 'credit_cash', 'credit_installment', 'credit_predate', 'pix'];

const getDefaultTransactionFees = (): TransactionFeeFormData[] => {
  return ALL_TRANSACTION_TYPES.map(type => ({
    transaction_type: type,
    fee_percentage: 0,
    fee_fixed_cents: 0,
    settlement_days: type === 'debit' ? 1 : type === 'pix' ? 0 : 30,
    is_enabled: false,
  }));
};

export function PaymentMethodsManagerEnhanced() {
  const { data: paymentMethods, isLoading } = usePaymentMethodsEnhanced();
  const { data: bankDestinations = [] } = useBankDestinations();
  const { data: cnpjDestinations = [] } = useCnpjDestinations();
  const { data: costCenters = [] } = useCostCenters();
  const { data: acquirers = [] } = useAcquirers();
  
  const createMutation = useCreatePaymentMethodEnhanced();
  const updateMutation = useUpdatePaymentMethodEnhanced();
  const deleteMutation = useDeletePaymentMethodEnhanced();
  const createBankMutation = useCreateBankDestination();
  const createCnpjMutation = useCreateCnpjDestination();
  const createCostCenterMutation = useCreateCostCenter();
  const createAcquirerMutation = useCreateAcquirer();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingMethod, setEditingMethod] = useState<PaymentMethodEnhanced | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [expandedMethod, setExpandedMethod] = useState<string | null>(null);
  
  // New item dialogs
  const [newBankName, setNewBankName] = useState('');
  const [showNewBankDialog, setShowNewBankDialog] = useState(false);
  const [newCnpj, setNewCnpj] = useState('');
  const [showNewCnpjDialog, setShowNewCnpjDialog] = useState(false);
  const [newCostCenter, setNewCostCenter] = useState('');
  const [showNewCostCenterDialog, setShowNewCostCenterDialog] = useState(false);
  const [newAcquirer, setNewAcquirer] = useState('');
  const [showNewAcquirerDialog, setShowNewAcquirerDialog] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    name: '',
    category: '',
    payment_timing: 'cash',
    installment_flow: null,
    max_installments: 1,
    min_installment_value_cents: 0,
    bank_destination_id: null,
    cnpj_destination_id: null,
    cost_center_id: null,
    acquirer_id: null,
    fee_percentage: 0,
    fee_fixed_cents: 0,
    settlement_days: 0,
    anticipation_fee_percentage: 0,
    requires_proof: false,
    transaction_fees: getDefaultTransactionFees(),
  });

  const resetForm = () => {
    setFormData({
      name: '',
      category: '',
      payment_timing: 'cash',
      installment_flow: null,
      max_installments: 1,
      min_installment_value_cents: 0,
      bank_destination_id: null,
      cnpj_destination_id: null,
      cost_center_id: null,
      acquirer_id: null,
      fee_percentage: 0,
      fee_fixed_cents: 0,
      settlement_days: 0,
      anticipation_fee_percentage: 0,
      requires_proof: false,
      transaction_fees: getDefaultTransactionFees(),
    });
    setEditingMethod(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const handleOpenEdit = (method: PaymentMethodEnhanced) => {
    setEditingMethod(method);
    
    // Map existing transaction fees
    const existingFees = method.transaction_fees || [];
    const transactionFees = ALL_TRANSACTION_TYPES.map(type => {
      const existing = existingFees.find(f => f.transaction_type === type);
      if (existing) {
        return {
          transaction_type: type,
          fee_percentage: existing.fee_percentage,
          fee_fixed_cents: existing.fee_fixed_cents,
          settlement_days: existing.settlement_days,
          is_enabled: existing.is_enabled,
        };
      }
      return {
        transaction_type: type,
        fee_percentage: 0,
        fee_fixed_cents: 0,
        settlement_days: type === 'debit' ? 1 : type === 'pix' ? 0 : 30,
        is_enabled: false,
      };
    });
    
    setFormData({
      name: method.name,
      category: method.category || '',
      payment_timing: method.payment_timing,
      installment_flow: method.installment_flow,
      max_installments: method.max_installments,
      min_installment_value_cents: method.min_installment_value_cents,
      bank_destination_id: method.bank_destination_id,
      cnpj_destination_id: method.cnpj_destination_id,
      cost_center_id: method.cost_center_id,
      acquirer_id: method.acquirer_id,
      fee_percentage: method.fee_percentage,
      fee_fixed_cents: method.fee_fixed_cents || 0,
      settlement_days: method.settlement_days,
      anticipation_fee_percentage: method.anticipation_fee_percentage || 0,
      requires_proof: method.requires_proof,
      transaction_fees: transactionFees,
    });
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.category) {
      return;
    }
    
    const enabledFees = formData.transaction_fees.filter(f => f.is_enabled);
    
    const payload = {
      name: formData.name,
      category: formData.category as PaymentCategory,
      payment_timing: formData.payment_timing,
      installment_flow: formData.payment_timing === 'installments' ? formData.installment_flow : null,
      max_installments: formData.max_installments,
      min_installment_value_cents: formData.min_installment_value_cents,
      bank_destination_id: formData.bank_destination_id,
      cnpj_destination_id: formData.cnpj_destination_id,
      cost_center_id: formData.cost_center_id,
      acquirer_id: formData.acquirer_id,
      fee_percentage: formData.fee_percentage,
      fee_fixed_cents: formData.fee_fixed_cents,
      settlement_days: formData.settlement_days,
      anticipation_fee_percentage: formData.installment_flow === 'anticipation' ? formData.anticipation_fee_percentage : 0,
      requires_proof: formData.requires_proof,
      transaction_fees: enabledFees,
    };
    
    if (editingMethod) {
      await updateMutation.mutateAsync({ id: editingMethod.id, ...payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
    
    setIsFormOpen(false);
    resetForm();
  };

  const handleToggleActive = async (method: PaymentMethodEnhanced) => {
    await updateMutation.mutateAsync({ 
      id: method.id, 
      is_active: !method.is_active 
    });
  };

  const handleDelete = async () => {
    if (deleteConfirmId) {
      await deleteMutation.mutateAsync(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  const handleCreateBank = async () => {
    if (newBankName.trim()) {
      const result = await createBankMutation.mutateAsync(newBankName.trim());
      setFormData({ ...formData, bank_destination_id: result.id });
      setNewBankName('');
      setShowNewBankDialog(false);
    }
  };

  const handleCreateCnpj = async () => {
    if (newCnpj.trim()) {
      const result = await createCnpjMutation.mutateAsync(newCnpj.trim());
      setFormData({ ...formData, cnpj_destination_id: result.id });
      setNewCnpj('');
      setShowNewCnpjDialog(false);
    }
  };

  const handleCreateCostCenter = async () => {
    if (newCostCenter.trim()) {
      const result = await createCostCenterMutation.mutateAsync(newCostCenter.trim());
      setFormData({ ...formData, cost_center_id: result.id });
      setNewCostCenter('');
      setShowNewCostCenterDialog(false);
    }
  };

  const handleCreateAcquirer = async () => {
    if (newAcquirer.trim()) {
      const result = await createAcquirerMutation.mutateAsync(newAcquirer.trim());
      setFormData({ ...formData, acquirer_id: result.id });
      setNewAcquirer('');
      setShowNewAcquirerDialog(false);
    }
  };

  const updateTransactionFee = (type: CardTransactionType, field: keyof TransactionFeeFormData, value: any) => {
    setFormData({
      ...formData,
      transaction_fees: formData.transaction_fees.map(fee => 
        fee.transaction_type === type ? { ...fee, [field]: value } : fee
      ),
    });
  };

  const requiresTransactionData = formData.category && CATEGORIES_REQUIRING_TRANSACTION_DATA.includes(formData.category as PaymentCategory);
  const isBoletoCategory = formData.category && BOLETO_CATEGORIES.includes(formData.category as PaymentCategory);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72 mt-2" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Formas de Pagamento
              </CardTitle>
              <CardDescription>
                Configure as formas de pagamento com categorias e taxas para conciliação bancária
              </CardDescription>
            </div>
            <Button onClick={handleOpenCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Forma
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {paymentMethods?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CreditCard className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhuma forma de pagamento cadastrada</p>
              <p className="text-sm">Clique em "Nova Forma" para começar</p>
            </div>
          ) : (
            <div className="space-y-3">
              {paymentMethods?.map((method) => (
                <div key={method.id} className="border rounded-lg overflow-hidden">
                  <div
                    className={`flex items-center justify-between p-4 ${
                      method.is_active ? 'bg-card' : 'bg-muted/50 opacity-60'
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {getCategoryIcon(method.category)}
                        <span className="font-medium">{method.name}</span>
                        {method.category && (
                          <Badge variant="secondary">
                            {PAYMENT_CATEGORY_LABELS[method.category]}
                          </Badge>
                        )}
                        <Badge variant={method.is_active ? 'default' : 'outline'}>
                          {PAYMENT_TIMING_LABELS[method.payment_timing]}
                        </Badge>
                        {method.payment_timing === 'installments' && (
                          <Badge variant="outline">até {method.max_installments}x</Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                        {method.bank_destination?.name && (
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {method.bank_destination.name}
                          </span>
                        )}
                        {method.fee_percentage > 0 && (
                          <span className="flex items-center gap-1">
                            <Percent className="h-3 w-3" />
                            {method.fee_percentage}%
                          </span>
                        )}
                        {method.settlement_days > 0 && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {method.settlement_days}d
                          </span>
                        )}
                        {method.requires_proof && (
                          <span className="flex items-center gap-1">
                            <FileCheck className="h-3 w-3" />
                            Comprovante
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {method.transaction_fees && method.transaction_fees.length > 0 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setExpandedMethod(expandedMethod === method.id ? null : method.id)}
                        >
                          {expandedMethod === method.id ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                      <Switch
                        checked={method.is_active}
                        onCheckedChange={() => handleToggleActive(method)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEdit(method)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteConfirmId(method.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* Expanded transaction fees */}
                  {expandedMethod === method.id && method.transaction_fees && method.transaction_fees.length > 0 && (
                    <div className="border-t bg-muted/30 p-4">
                      <p className="text-sm font-medium mb-2">Taxas por Tipo de Transação:</p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {method.transaction_fees.filter(f => f.is_enabled).map(fee => (
                          <div key={fee.transaction_type} className="text-sm bg-background rounded p-2">
                            <span className="font-medium">{TRANSACTION_TYPE_LABELS[fee.transaction_type]}</span>
                            <div className="text-muted-foreground">
                              {fee.fee_percentage}% 
                              {fee.fee_fixed_cents > 0 && ` + ${formatCurrency(fee.fee_fixed_cents)}`}
                              {' • '}{fee.settlement_days}d
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={(open) => {
        if (!open) resetForm();
        setIsFormOpen(open);
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingMethod ? 'Editar Forma de Pagamento' : 'Nova Forma de Pagamento'}
            </DialogTitle>
            <DialogDescription>
              Configure a categoria e detalhes da forma de pagamento
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Step 1: Category Selection */}
            <div className="space-y-2">
              <Label>Categoria *</Label>
              <Select
                value={formData.category}
                onValueChange={(value: PaymentCategory) => {
                  setFormData({ 
                    ...formData, 
                    category: value,
                    // Reset transaction fees when category changes
                    transaction_fees: getDefaultTransactionFees(),
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a categoria..." />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PAYMENT_CATEGORY_LABELS) as PaymentCategory[]).map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      <div className="flex items-center gap-2">
                        {getCategoryIcon(cat)}
                        {PAYMENT_CATEGORY_LABELS[cat]}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.category && (
              <>
                {/* Name */}
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Forma de Pagamento *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Cartão Cielo, Pix Santander..."
                    required
                  />
                </div>

                {/* Payment Timing - Hide for card_machine since it's defined per transaction type */}
                {formData.category !== 'card_machine' && (
                  <div className="space-y-2">
                    <Label>Tipo de Pagamento *</Label>
                    <Select
                      value={formData.payment_timing}
                      onValueChange={(value: PaymentTiming) => setFormData({ ...formData, payment_timing: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">
                          <div className="flex items-center gap-2">
                            <Banknote className="h-4 w-4" />
                            À Vista
                          </div>
                        </SelectItem>
                        <SelectItem value="term">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            A Prazo
                          </div>
                        </SelectItem>
                        <SelectItem value="installments">
                          <div className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4" />
                            Parcelado
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Installment options - Show for non-card_machine with installments timing */}
                {formData.payment_timing === 'installments' && formData.category !== 'card_machine' && (
                  <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                    <div className="space-y-2">
                      <Label>Fluxo de Recebimento *</Label>
                      <Select
                        value={formData.installment_flow || ''}
                        onValueChange={(value: InstallmentFlow) => setFormData({ ...formData, installment_flow: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Como você recebe da operadora?" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="anticipation">
                            Antecipação automática
                          </SelectItem>
                          <SelectItem value="receive_per_installment">
                            Receber no fluxo de parcelas
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {formData.installment_flow === 'receive_per_installment' 
                          ? 'Ex: Venda em 6x → recebe em 30/60/90/120/150/180 dias'
                          : 'A operadora antecipa o valor total em uma única parcela'}
                      </p>
                    </div>
                    
                    {/* Anticipation fee - only show when anticipation is selected */}
                    {formData.installment_flow === 'anticipation' && (
                      <div className="space-y-2">
                        <Label>Taxa de Antecipação (%)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={formData.anticipation_fee_percentage || 0}
                          onChange={(e) => setFormData({ 
                            ...formData, 
                            anticipation_fee_percentage: Number(e.target.value) 
                          })}
                          placeholder="0,00"
                        />
                        <p className="text-xs text-muted-foreground">
                          Esta taxa será somada à taxa da transação para calcular o valor líquido
                        </p>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Máximo de Parcelas</Label>
                        <Select
                          value={String(formData.max_installments)}
                          onValueChange={(value) => setFormData({ ...formData, max_installments: Number(value) })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => (
                              <SelectItem key={n} value={String(n)}>
                                {n}x
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Valor Mínimo Parcela (R$)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={(formData.min_installment_value_cents || 0) / 100}
                          onChange={(e) => setFormData({ 
                            ...formData, 
                            min_installment_value_cents: Math.round(Number(e.target.value) * 100) 
                          })}
                          placeholder="0,00"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <Separator />

                {/* Bank & CNPJ Destination */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Banco Destino</Label>
                    <div className="flex gap-2">
                      <Select
                        value={formData.bank_destination_id || 'none'}
                        onValueChange={(value) => setFormData({ ...formData, bank_destination_id: value === 'none' ? null : value })}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Selecionar banco..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhum</SelectItem>
                          {bankDestinations.map(bank => (
                            <SelectItem key={bank.id} value={bank.id}>
                              {bank.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button type="button" variant="outline" size="icon" onClick={() => setShowNewBankDialog(true)}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>CNPJ Destino</Label>
                    <div className="flex gap-2">
                      <Select
                        value={formData.cnpj_destination_id || 'none'}
                        onValueChange={(value) => setFormData({ ...formData, cnpj_destination_id: value === 'none' ? null : value })}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Selecionar CNPJ..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhum</SelectItem>
                          {cnpjDestinations.map(cnpj => (
                            <SelectItem key={cnpj.id} value={cnpj.id}>
                              {cnpj.cnpj}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button type="button" variant="outline" size="icon" onClick={() => setShowNewCnpjDialog(true)}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Cost Center */}
                <div className="space-y-2">
                  <Label>Centro de Custo</Label>
                  <div className="flex gap-2">
                    <Select
                      value={formData.cost_center_id || 'none'}
                      onValueChange={(value) => setFormData({ ...formData, cost_center_id: value === 'none' ? null : value })}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Selecionar centro de custo..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {costCenters.map(cc => (
                          <SelectItem key={cc.id} value={cc.id}>
                            {cc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="outline" size="icon" onClick={() => setShowNewCostCenterDialog(true)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Transaction Fees for Card-based categories */}
                {requiresTransactionData && (
                  <>
                    <Separator />
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-base font-semibold">Tipos de Transação</Label>
                          <p className="text-sm text-muted-foreground">
                            Marque os tipos aceitos e configure taxas e prazo de compensação
                          </p>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        {formData.transaction_fees.map(fee => (
                          <div key={fee.transaction_type} className="border rounded-lg p-3">
                            <div className="flex items-center gap-3 mb-2">
                              <Checkbox
                                checked={fee.is_enabled}
                                onCheckedChange={(checked) => updateTransactionFee(fee.transaction_type, 'is_enabled', !!checked)}
                              />
                              <span className="font-medium">{TRANSACTION_TYPE_LABELS[fee.transaction_type]}</span>
                            </div>
                            
                            {fee.is_enabled && (
                              <div className="grid grid-cols-3 gap-3 ml-6">
                                <div className="space-y-1">
                                  <Label className="text-xs">Taxa (%)</Label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={fee.fee_percentage}
                                    onChange={(e) => updateTransactionFee(fee.transaction_type, 'fee_percentage', Number(e.target.value))}
                                    className="h-8"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Taxa extra (R$)</Label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={fee.fee_fixed_cents / 100}
                                    onChange={(e) => updateTransactionFee(fee.transaction_type, 'fee_fixed_cents', Math.round(Number(e.target.value) * 100))}
                                    className="h-8"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Dias p/ Compensar</Label>
                                  <Input
                                    type="number"
                                    min="0"
                                    value={fee.settlement_days}
                                    onChange={(e) => updateTransactionFee(fee.transaction_type, 'settlement_days', Number(e.target.value))}
                                    className="h-8"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Acquirer (Card Operator) */}
                      <div className="space-y-2">
                        <Label>Adquirente (Operadora)</Label>
                        <div className="flex gap-2">
                          <Select
                            value={formData.acquirer_id || 'none'}
                            onValueChange={(value) => setFormData({ ...formData, acquirer_id: value === 'none' ? null : value })}
                          >
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Ex: Cielo, Stone, PagSeguro..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Nenhuma</SelectItem>
                              {acquirers.map(acq => (
                                <SelectItem key={acq.id} value={acq.id}>
                                  {acq.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button type="button" variant="outline" size="icon" onClick={() => setShowNewAcquirerDialog(true)}>
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Boleto fees */}
                {isBoletoCategory && (
                  <>
                    <Separator />
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Taxa (%)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={formData.fee_percentage || 0}
                          onChange={(e) => setFormData({ ...formData, fee_percentage: Number(e.target.value) })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Taxa fixa (R$)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={(formData.fee_fixed_cents || 0) / 100}
                          onChange={(e) => setFormData({ ...formData, fee_fixed_cents: Math.round(Number(e.target.value) * 100) })}
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* General settings */}
                {!requiresTransactionData && !isBoletoCategory && formData.category !== 'gift' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Taxa (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={formData.fee_percentage || 0}
                        onChange={(e) => setFormData({ ...formData, fee_percentage: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Dias p/ Compensação</Label>
                      <Input
                        type="number"
                        min="0"
                        value={formData.settlement_days || 0}
                        onChange={(e) => setFormData({ ...formData, settlement_days: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 pt-2">
                  <Switch
                    id="requires_proof"
                    checked={formData.requires_proof}
                    onCheckedChange={(checked) => setFormData({ ...formData, requires_proof: checked })}
                  />
                  <Label htmlFor="requires_proof" className="cursor-pointer">
                    Exige comprovante de pagamento
                  </Label>
                </div>
              </>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={!formData.category || !formData.name || createMutation.isPending || updateMutation.isPending}
              >
                {editingMethod ? 'Salvar' : 'Criar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir forma de pagamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A forma de pagamento será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* New Bank Dialog */}
      <Dialog open={showNewBankDialog} onOpenChange={setShowNewBankDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Adicionar Banco</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={newBankName}
              onChange={(e) => setNewBankName(e.target.value)}
              placeholder="Nome do banco..."
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewBankDialog(false)}>Cancelar</Button>
              <Button onClick={handleCreateBank} disabled={!newBankName.trim() || createBankMutation.isPending}>
                Adicionar
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* New CNPJ Dialog */}
      <Dialog open={showNewCnpjDialog} onOpenChange={setShowNewCnpjDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Adicionar CNPJ</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={newCnpj}
              onChange={(e) => setNewCnpj(e.target.value)}
              placeholder="00.000.000/0000-00"
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewCnpjDialog(false)}>Cancelar</Button>
              <Button onClick={handleCreateCnpj} disabled={!newCnpj.trim() || createCnpjMutation.isPending}>
                Adicionar
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Cost Center Dialog */}
      <Dialog open={showNewCostCenterDialog} onOpenChange={setShowNewCostCenterDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Adicionar Centro de Custo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={newCostCenter}
              onChange={(e) => setNewCostCenter(e.target.value)}
              placeholder="Nome do centro de custo..."
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewCostCenterDialog(false)}>Cancelar</Button>
              <Button onClick={handleCreateCostCenter} disabled={!newCostCenter.trim() || createCostCenterMutation.isPending}>
                Adicionar
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Acquirer Dialog */}
      <Dialog open={showNewAcquirerDialog} onOpenChange={setShowNewAcquirerDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Adicionar Adquirente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={newAcquirer}
              onChange={(e) => setNewAcquirer(e.target.value)}
              placeholder="Ex: Cielo, Stone, Getnet..."
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewAcquirerDialog(false)}>Cancelar</Button>
              <Button onClick={handleCreateAcquirer} disabled={!newAcquirer.trim() || createAcquirerMutation.isPending}>
                Adicionar
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
