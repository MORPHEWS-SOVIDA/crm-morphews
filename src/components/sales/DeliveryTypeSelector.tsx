import { useState, useEffect, useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertTriangle, Store, Bike, Truck, CalendarDays, Loader2, Clock, RefreshCw, Check, Package, Save, Gift, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  useDeliveryRegions,
  useActiveShippingCarriers,
  DeliveryType,
  DELIVERY_TYPES,
  getAvailableDeliveryDates,
  formatShift,
  ShippingCarrier,
} from '@/hooks/useDeliveryConfig';
import { formatCurrency } from '@/hooks/useSales';
import { MELHOR_ENVIO_SERVICES, ShippingQuote } from '@/hooks/useShippingQuote';
import { useCorreiosSimpleQuote, CorreiosQuote } from '@/hooks/useCorreiosSimpleQuote';
import { toast } from 'sonner';

interface DeliveryTypeSelectorProps {
  leadRegionId: string | null;
  leadCpfCnpj?: string | null;
  leadCep?: string | null;
  hasValidAddress?: boolean; // Whether lead has a valid address for carrier delivery
  onMissingCpf?: () => void;
  onUpdateCpf?: (cpf: string) => void;
  onAddAddress?: () => void; // Callback to open add address dialog
  value: {
    type: DeliveryType;
    regionId: string | null;
    scheduledDate: Date | null;
    scheduledShift: 'morning' | 'afternoon' | 'full_day' | null;
    carrierId: string | null;
    shippingCost: number;
    freeShipping?: boolean;
    shippingCostReal?: number;
    selectedQuoteServiceId?: string | null;
  };
  onChange: (value: DeliveryTypeSelectorProps['value']) => void;
}

export function DeliveryTypeSelector({
  leadRegionId,
  leadCpfCnpj,
  leadCep,
  hasValidAddress = true,
  onMissingCpf,
  onUpdateCpf,
  onAddAddress,
  value,
  onChange,
}: DeliveryTypeSelectorProps) {
  // Local state for inline CPF input
  const [inlineCpf, setInlineCpf] = useState('');
  const { data: regions = [] } = useDeliveryRegions();
  const carriers = useActiveShippingCarriers();
  const { getQuotes: getCorreiosQuotes, isLoading: isCorreiosLoading } = useCorreiosSimpleQuote();

  // State for all shipping quotes (Correios)
  const [shippingQuotes, setShippingQuotes] = useState<CorreiosQuote[]>([]);
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [quotesError, setQuotesError] = useState<string | null>(null);
  const [selectedQuoteServiceId, setSelectedQuoteServiceId] = useState<string | null>(null);
  const [proceedWithoutMelhorEnvio, setProceedWithoutMelhorEnvio] = useState(false);
  const [hasAttemptedQuote, setHasAttemptedQuote] = useState(false);

  const activeRegions = regions.filter(r => r.is_active);
  const selectedRegion = activeRegions.find(r => r.id === (value.regionId || leadRegionId));
  const selectedCarrier = carriers.find(c => c.id === value.carrierId);

  // Auto-switch away from carrier if no valid address
  useEffect(() => {
    if (value.type === 'carrier' && !hasValidAddress) {
      onChange({
        ...value,
        type: 'pickup',
        carrierId: null,
        shippingCost: 0,
        shippingCostReal: 0,
        selectedQuoteServiceId: null,
      });
    }
  }, [hasValidAddress]);

  // Check if carrier is integrated (has melhor_envio service linked)
  const isCarrierIntegrated = (carrier: ShippingCarrier | undefined) => {
    return !!carrier?.correios_service_code;
  };

  const getServiceInfo = (code: string | null) => {
    if (!code) return null;
    const serviceId = parseInt(code);
    return MELHOR_ENVIO_SERVICES.find(s => s.id === serviceId);
  };

  // Fetch all available shipping quotes using Correios
  const fetchShippingQuotes = async () => {
    if (!leadCep) {
      toast.error('CEP do endereço não disponível');
      return;
    }

    const cleanCep = leadCep.replace(/\D/g, '');
    if (cleanCep.length !== 8) {
      toast.error('CEP inválido');
      return;
    }

    setQuotesLoading(true);
    setQuotesError(null);
    setHasAttemptedQuote(true);

    try {
      const quotes = await getCorreiosQuotes({
        destination_cep: cleanCep,
      });
      setShippingQuotes(quotes.filter(q => !q.error));
      
      if (quotes.length === 0) {
        setQuotesError('Nenhum serviço disponível para este CEP');
      }
    } catch (error) {
      setQuotesError(error instanceof Error ? error.message : 'Erro ao consultar frete');
      toast.error('Erro ao consultar frete');
    } finally {
      setQuotesLoading(false);
    }
  };

  // Handle quote selection
  const handleSelectQuote = (quote: CorreiosQuote) => {
    setSelectedQuoteServiceId(quote.service_code);
    
    // Find matching carrier by service code
    const matchingCarrier = carriers.find(c => c.correios_service_code === quote.service_code);
    
    onChange({
      ...value,
      carrierId: matchingCarrier?.id || value.carrierId,
      shippingCost: value.freeShipping ? 0 : quote.price_cents,
      shippingCostReal: quote.price_cents, // Always store real cost
      selectedQuoteServiceId: quote.service_code,
      freeShipping: value.freeShipping ?? false,
    });
  };

  // Get available dates for selected region
  const availableDates = selectedRegion
    ? getAvailableDeliveryDates(selectedRegion.id, regions)
    : [];

  // Group available dates by date string for calendar (unique dates)
  const availableDateStrings = [...new Set(availableDates.map(d => format(d.date, 'yyyy-MM-dd')))];

  // Get available shifts for the selected date
  const shiftsForSelectedDate = useMemo(() => {
    if (!value.scheduledDate) return [];
    const dateStr = format(value.scheduledDate, 'yyyy-MM-dd');
    return availableDates
      .filter(d => format(d.date, 'yyyy-MM-dd') === dateStr)
      .map(d => d.shift);
  }, [value.scheduledDate, availableDates]);

  const handleTypeChange = (type: DeliveryType) => {
    // Reset shipping quotes when type changes
    setShippingQuotes([]);
    setSelectedQuoteServiceId(null);
    setProceedWithoutMelhorEnvio(false);
    setHasAttemptedQuote(false);
    setQuotesError(null);
    
    onChange({
      ...value,
      type,
      regionId: type === 'motoboy' ? (leadRegionId || value.regionId) : null,
      scheduledDate: null,
      scheduledShift: null,
      carrierId: null,
      shippingCost: 0,
      freeShipping: false,
      shippingCostReal: 0,
      selectedQuoteServiceId: null,
    });
  };

  const handleRegionChange = (regionId: string) => {
    onChange({
      ...value,
      regionId,
      scheduledDate: null,
      scheduledShift: null,
    });
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) {
      onChange({ ...value, scheduledDate: null, scheduledShift: null });
      return;
    }

    const dateStr = format(date, 'yyyy-MM-dd');
    const matchingShifts = availableDates
      .filter(d => format(d.date, 'yyyy-MM-dd') === dateStr)
      .map(d => d.shift);

    // If only one shift available, auto-select it
    if (matchingShifts.length === 1) {
      onChange({
        ...value,
        scheduledDate: date,
        scheduledShift: matchingShifts[0],
      });
    } else {
      // Multiple shifts - user needs to choose
      onChange({
        ...value,
        scheduledDate: date,
        scheduledShift: null,
      });
    }
  };

  const handleShiftChange = (shift: 'morning' | 'afternoon' | 'full_day') => {
    onChange({
      ...value,
      scheduledShift: shift,
    });
  };

  // Manual carrier (non-integrated)
  const manualCarriers = carriers.filter(c => !isCarrierIntegrated(c));
  const hasIntegratedOptions = carriers.some(c => isCarrierIntegrated(c));

  return (
    <Card>
      <CardContent className="pt-6 space-y-6">
        <div>
          <Label className="text-base font-semibold mb-4 block">Tipo de Entrega</Label>
          <RadioGroup
            value={value.type}
            onValueChange={(v) => handleTypeChange(v as DeliveryType)}
            className="grid grid-cols-1 sm:grid-cols-3 gap-3"
          >
            <Label
              htmlFor="delivery-pickup"
              className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                value.type === 'pickup' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
              }`}
            >
              <RadioGroupItem value="pickup" id="delivery-pickup" />
              <Store className="w-5 h-5" />
              <span>{DELIVERY_TYPES.pickup}</span>
            </Label>

            <Label
              htmlFor="delivery-motoboy"
              className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                value.type === 'motoboy' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
              }`}
            >
              <RadioGroupItem value="motoboy" id="delivery-motoboy" />
              <Bike className="w-5 h-5" />
              <span>{DELIVERY_TYPES.motoboy}</span>
            </Label>

            <div className="relative">
              <Label
                htmlFor="delivery-carrier"
                className={`flex items-center gap-3 p-4 rounded-lg border transition-colors ${
                  !hasValidAddress 
                    ? 'opacity-50 cursor-not-allowed bg-muted/30' 
                    : value.type === 'carrier' 
                      ? 'border-primary bg-primary/5 cursor-pointer' 
                      : 'hover:bg-muted/50 cursor-pointer'
                }`}
                onClick={(e) => {
                  if (!hasValidAddress) {
                    e.preventDefault();
                    e.stopPropagation();
                  }
                }}
              >
                <RadioGroupItem 
                  value="carrier" 
                  id="delivery-carrier" 
                  disabled={!hasValidAddress}
                />
                <Truck className="w-5 h-5" />
                <span>{DELIVERY_TYPES.carrier}</span>
              </Label>
              {!hasValidAddress && (
                <p className="text-xs text-amber-600 dark:text-amber-500 mt-1 ml-1">
                  Adicione um endereço primeiro
                </p>
              )}
            </div>
          </RadioGroup>

          {/* Alert when carrier is selected but no valid address */}
          {value.type === 'carrier' && !hasValidAddress && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-400">
                  Endereço obrigatório para transportadora
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-500">
                  Adicione um endereço completo para utilizar esta opção de entrega.
                </p>
                {onAddAddress && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2 text-amber-700 border-amber-300 hover:bg-amber-100"
                    onClick={onAddAddress}
                  >
                    <MapPin className="w-3.5 h-3.5 mr-1" />
                    Adicionar Endereço
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Motoboy Options */}
        {value.type === 'motoboy' && (
          <div className="space-y-4 border-t pt-4">
            <div>
              <Label>Região de Entrega</Label>
              {activeRegions.length === 0 ? (
                <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg mt-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-400">
                      Nenhuma região cadastrada
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-500">
                      Configure regiões de entrega nas Configurações.
                    </p>
                  </div>
                </div>
              ) : (
                <Select
                  value={value.regionId || leadRegionId || ''}
                  onValueChange={handleRegionChange}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione a região" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeRegions.map((region) => (
                      <SelectItem key={region.id} value={region.id}>
                        {region.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {(value.regionId || leadRegionId) && selectedRegion && (
              <div>
                <Label className="flex items-center gap-2">
                  <CalendarDays className="w-4 h-4" />
                  Data de Entrega
                </Label>
                
                {availableDates.length === 0 ? (
                  <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg mt-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-400">
                        Nenhum dia configurado
                      </p>
                      <p className="text-xs text-amber-700 dark:text-amber-500">
                        Esta região não tem dias de entrega configurados.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2">
                    <Calendar
                      mode="single"
                      selected={value.scheduledDate || undefined}
                      onSelect={handleDateSelect}
                      locale={ptBR}
                      disabled={(date) => {
                        const dateStr = format(date, 'yyyy-MM-dd');
                        return !availableDateStrings.includes(dateStr);
                      }}
                      className="rounded-md border"
                    />

                    {value.scheduledDate && (
                      <div className="mt-2 p-3 bg-muted/50 rounded-lg space-y-2">
                        <p className="text-sm">
                          <span className="font-medium">Data:</span>{' '}
                          {format(value.scheduledDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                        </p>
                        
                        {/* Show shift selector if multiple shifts available */}
                        {shiftsForSelectedDate.length > 1 && !value.scheduledShift ? (
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Selecione o turno:</Label>
                            <RadioGroup
                              value={value.scheduledShift || ''}
                              onValueChange={(v) => handleShiftChange(v as 'morning' | 'afternoon' | 'full_day')}
                              className="flex flex-wrap gap-2"
                            >
                              {shiftsForSelectedDate.map((shift) => (
                                <Label
                                  key={shift}
                                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-colors ${
                                    value.scheduledShift === shift
                                      ? 'border-primary bg-primary/5'
                                      : 'hover:bg-muted/50'
                                  }`}
                                >
                                  <RadioGroupItem value={shift} />
                                  <span>{formatShift(shift)}</span>
                                </Label>
                              ))}
                            </RadioGroup>
                          </div>
                        ) : shiftsForSelectedDate.length > 1 && value.scheduledShift ? (
                          <div className="space-y-2">
                            <p className="text-sm">
                              <span className="font-medium">Turno:</span>{' '}
                              <Badge variant="outline">{formatShift(value.scheduledShift)}</Badge>
                            </p>
                            <button
                              type="button"
                              onClick={() => onChange({ ...value, scheduledShift: null })}
                              className="text-xs text-primary hover:underline"
                            >
                              Alterar turno
                            </button>
                          </div>
                        ) : value.scheduledShift ? (
                          <p className="text-sm">
                            <span className="font-medium">Turno:</span>{' '}
                            <Badge variant="outline">{formatShift(value.scheduledShift)}</Badge>
                          </p>
                        ) : null}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Delivery Cost for Motoboy */}
            <div>
              <Label>Custo de Entrega</Label>
              <CurrencyInput
                value={value.shippingCost}
                onChange={(cents) => onChange({ ...value, shippingCost: cents })}
                className="mt-1"
                placeholder="0,00"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Valor a ser cobrado do cliente pela entrega
              </p>
            </div>
          </div>
        )}

        {/* Carrier Options */}
        {value.type === 'carrier' && (
          <div className="space-y-4 border-t pt-4">
            {/* CPF notice - non-blocking, just informational */}
            {!leadCpfCnpj && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-1" />
                <div className="flex-1 space-y-2">
                  <p className="text-sm text-amber-800 dark:text-amber-400">
                    CPF/CNPJ não informado — necessário para gerar etiquetas integradas.
                  </p>
                  {onUpdateCpf ? (
                    <div className="flex gap-2">
                      <Input
                        value={inlineCpf}
                        onChange={(e) => setInlineCpf(e.target.value)}
                        placeholder="Digite o CPF/CNPJ"
                        className="h-8 text-sm bg-white dark:bg-gray-900"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="default"
                        onClick={() => {
                          if (inlineCpf.trim()) {
                            onUpdateCpf(inlineCpf.trim());
                            setInlineCpf('');
                          }
                        }}
                        disabled={!inlineCpf.trim()}
                        className="h-8"
                      >
                        <Save className="w-3.5 h-3.5 mr-1" />
                        Salvar
                      </Button>
                    </div>
                  ) : onMissingCpf && (
                    <button
                      type="button"
                      onClick={onMissingCpf}
                      className="text-sm text-amber-700 dark:text-amber-400 font-medium hover:underline"
                    >
                      → Atualizar CPF do cliente agora
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* === SECTION 1: Custo de Frete (ALWAYS visible, FIRST) === */}
            {!value.freeShipping && (
              <div>
                <Label className="text-base font-semibold">Custo de Frete</Label>
                <CurrencyInput
                  value={value.shippingCost}
                  onChange={(cents) => onChange({ ...value, shippingCost: cents, shippingCostReal: cents })}
                  className="mt-1"
                  placeholder="0,00"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedQuoteServiceId 
                    ? 'Valor da cotação (editável para ajustes)'
                    : 'Informe o valor do frete a ser cobrado do cliente'}
                </p>
              </div>
            )}

            {/* Free shipping checkbox */}
            <div className="flex items-center space-x-3 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
              <Checkbox
                id="free-shipping"
                checked={value.freeShipping || false}
                onCheckedChange={(checked) => {
                  const realCost = value.shippingCostReal || value.shippingCost || 0;
                  onChange({
                    ...value,
                    freeShipping: !!checked,
                    shippingCostReal: realCost,
                    shippingCost: checked ? 0 : realCost,
                  });
                }}
              />
              <div className="flex-1">
                <label htmlFor="free-shipping" className="flex items-center gap-2 text-sm font-medium text-green-800 dark:text-green-200 cursor-pointer">
                  <Gift className="h-4 w-4" />
                  Isentar frete para o cliente
                </label>
                <p className="text-xs text-green-600 dark:text-green-400">
                  O cliente não será cobrado, mas o custo real é preservado
                </p>
              </div>
            </div>

            {/* Show real cost when free shipping is enabled */}
            {value.freeShipping && (value.shippingCostReal || 0) > 0 && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    Custo real do frete (interno):
                  </span>
                  <span className="text-sm font-bold text-amber-700 dark:text-amber-300">
                    {formatCurrency(value.shippingCostReal || 0)}
                  </span>
                </div>
              </div>
            )}

            {/* Manual tracking info */}
            <div className="p-2.5 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5" />
                O código de rastreio pode ser adicionado depois na tela da venda
              </p>
            </div>

            {/* === SECTION 2: Transportadoras cadastradas (if any) === */}
            {manualCarriers.length > 0 && (
              <div>
                <Label>Transportadora Cadastrada (opcional)</Label>
                <Select 
                  value={!selectedQuoteServiceId && value.carrierId ? value.carrierId : ''} 
                  onValueChange={(carrierId) => {
                    const carrier = manualCarriers.find(c => c.id === carrierId);
                    setSelectedQuoteServiceId(null);
                    onChange({
                      ...value,
                      carrierId,
                      shippingCost: value.freeShipping ? 0 : (carrier?.cost_cents || 0),
                      shippingCostReal: carrier?.cost_cents || 0,
                    });
                  }}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione transportadora (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {manualCarriers.map((carrier) => (
                      <SelectItem key={carrier.id} value={carrier.id}>
                        <div className="flex items-center gap-2">
                          <span>{carrier.name}</span>
                          <span className="text-xs text-muted-foreground">
                            ({formatCurrency(carrier.cost_cents)} • {carrier.estimated_days}d)
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* === SECTION 3: Cotação Correios (OPTIONAL, collapsible) === */}
            {hasIntegratedOptions && leadCep && (
              <details className="group border rounded-lg">
                <summary className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors list-none">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Package className="w-4 h-4 text-yellow-600" />
                    Cotação Correios (PAC / SEDEX)
                  </div>
                  <Badge variant="outline" className="text-xs">Opcional</Badge>
                </summary>
                <div className="p-3 pt-0 space-y-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchShippingQuotes}
                    disabled={quotesLoading}
                    className="w-full"
                  >
                    {quotesLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                    ) : shippingQuotes.length > 0 ? (
                      <RefreshCw className="w-4 h-4 mr-1.5" />
                    ) : (
                      <Truck className="w-4 h-4 mr-1.5" />
                    )}
                    {shippingQuotes.length > 0 ? 'Atualizar Cotação' : 'Consultar Frete Correios'}
                  </Button>

                  {quotesError && (
                    <p className="text-xs text-destructive">{quotesError}</p>
                  )}

                  {/* Shipping Quote Cards */}
                  {shippingQuotes.length > 0 && (
                    <div className="grid gap-2">
                      {shippingQuotes.map((quote) => {
                        const isSelected = selectedQuoteServiceId === quote.service_code;
                        const isPac = quote.service_name.toLowerCase().includes('pac');
                        return (
                          <div
                            key={quote.service_code}
                            onClick={() => handleSelectQuote(quote)}
                            className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                              isSelected
                                ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                                : 'border-muted hover:border-primary/50 hover:bg-muted/50'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {isSelected && <Check className="w-4 h-4 text-primary" />}
                                <Package className={`w-5 h-5 ${isPac ? 'text-blue-600' : 'text-red-600'}`} />
                                <span className="font-medium text-sm">{quote.service_name}</span>
                              </div>
                              <span className="font-bold text-primary">
                                {formatCurrency(quote.price_cents)}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                <span>
                                  {quote.delivery_days} dia{quote.delivery_days !== 1 ? 's' : ''} úteis
                                </span>
                              </div>
                              {quote.picking_cost_cents > 0 && (
                                <span>
                                  (inclui R$ {(quote.picking_cost_cents / 100).toFixed(2)} de manuseio)
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Show selected shipping info */}
                  {selectedQuoteServiceId && value.shippingCost > 0 && (
                    <div className="p-2 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
                      <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
                        <Check className="w-4 h-4" />
                        <span>Frete selecionado: <strong>{formatCurrency(value.shippingCost)}</strong></span>
                      </div>
                    </div>
                  )}
                </div>
              </details>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
