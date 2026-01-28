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
import { AlertTriangle, Store, Bike, Truck, CalendarDays, Loader2, Zap, Clock, RefreshCw, Check, Package, Save } from 'lucide-react';
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
import { useShippingQuote, MELHOR_ENVIO_SERVICES, ShippingQuote, formatShippingPrice } from '@/hooks/useShippingQuote';
import { toast } from 'sonner';

interface DeliveryTypeSelectorProps {
  leadRegionId: string | null;
  leadCpfCnpj?: string | null;
  leadCep?: string | null;
  onMissingCpf?: () => void;
  onUpdateCpf?: (cpf: string) => void;
  value: {
    type: DeliveryType;
    regionId: string | null;
    scheduledDate: Date | null;
    scheduledShift: 'morning' | 'afternoon' | 'full_day' | null;
    carrierId: string | null;
    shippingCost: number;
  };
  onChange: (value: DeliveryTypeSelectorProps['value']) => void;
}

export function DeliveryTypeSelector({
  leadRegionId,
  leadCpfCnpj,
  leadCep,
  onMissingCpf,
  onUpdateCpf,
  value,
  onChange,
}: DeliveryTypeSelectorProps) {
  // Local state for inline CPF input
  const [inlineCpf, setInlineCpf] = useState('');
  const { data: regions = [] } = useDeliveryRegions();
  const carriers = useActiveShippingCarriers();
  const { getQuotes, isLoading: isQuoteLoading } = useShippingQuote();

  // State for all shipping quotes (Melhor Envio)
  const [shippingQuotes, setShippingQuotes] = useState<ShippingQuote[]>([]);
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [quotesError, setQuotesError] = useState<string | null>(null);
  const [selectedQuoteServiceId, setSelectedQuoteServiceId] = useState<string | null>(null);

  const activeRegions = regions.filter(r => r.is_active);
  const selectedRegion = activeRegions.find(r => r.id === (value.regionId || leadRegionId));
  const selectedCarrier = carriers.find(c => c.id === value.carrierId);

  // Check if carrier is integrated (has melhor_envio service linked)
  const isCarrierIntegrated = (carrier: ShippingCarrier | undefined) => {
    return !!carrier?.correios_service_code;
  };

  const getServiceInfo = (code: string | null) => {
    if (!code) return null;
    const serviceId = parseInt(code);
    return MELHOR_ENVIO_SERVICES.find(s => s.id === serviceId);
  };

  // Fetch all available shipping quotes
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

    try {
      const quotes = await getQuotes({
        destination_cep: cleanCep,
      });
      setShippingQuotes(quotes.filter(q => !q.error));
      
      if (quotes.length === 0 || quotes.every(q => q.error)) {
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
  const handleSelectQuote = (quote: ShippingQuote) => {
    setSelectedQuoteServiceId(quote.service_code);
    
    // Find matching carrier or use the first integrated carrier
    const matchingCarrier = carriers.find(c => c.correios_service_code === quote.service_code);
    
    onChange({
      ...value,
      carrierId: matchingCarrier?.id || value.carrierId,
      shippingCost: quote.price_cents,
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
    
    onChange({
      ...value,
      type,
      regionId: type === 'motoboy' ? (leadRegionId || value.regionId) : null,
      scheduledDate: null,
      scheduledShift: null,
      carrierId: null,
      shippingCost: 0,
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

            <Label
              htmlFor="delivery-carrier"
              className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                value.type === 'carrier' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
              }`}
            >
              <RadioGroupItem value="carrier" id="delivery-carrier" />
              <Truck className="w-5 h-5" />
              <span>{DELIVERY_TYPES.carrier}</span>
            </Label>
          </RadioGroup>
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
            {/* CPF Required Warning with Inline Input */}
            {!leadCpfCnpj && (
              <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 space-y-2">
                  <p className="text-sm font-medium text-red-800 dark:text-red-400">
                    CPF/CNPJ obrigatório para Transportadora
                  </p>
                  <p className="text-xs text-red-700 dark:text-red-500">
                    Para gerar etiquetas de envio pelo Melhor Envio, é necessário informar o CPF ou CNPJ do cliente.
                  </p>
                  
                  {/* Inline CPF Input */}
                  {onUpdateCpf ? (
                    <div className="flex gap-2 mt-2">
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
                      className="text-sm text-red-700 dark:text-red-400 font-medium hover:underline mt-2"
                    >
                      → Atualizar CPF do cliente agora
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Ver Frete Button - Integrated Options */}
            {hasIntegratedOptions && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-green-600" />
                    Frete Integrado (Melhor Envio)
                  </Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchShippingQuotes}
                    disabled={quotesLoading || !leadCep}
                  >
                    {quotesLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                    ) : shippingQuotes.length > 0 ? (
                      <RefreshCw className="w-4 h-4 mr-1.5" />
                    ) : (
                      <Truck className="w-4 h-4 mr-1.5" />
                    )}
                    {shippingQuotes.length > 0 ? 'Atualizar' : 'Ver Frete'}
                  </Button>
                </div>

                {!leadCep && (
                  <p className="text-sm text-amber-600">
                    Selecione um endereço com CEP válido para consultar frete
                  </p>
                )}

                {quotesError && (
                  <p className="text-sm text-red-600">{quotesError}</p>
                )}

                {/* Shipping Quote Cards */}
                {shippingQuotes.length > 0 && (
                  <div className="grid gap-2">
                    {shippingQuotes.map((quote) => {
                      const isSelected = selectedQuoteServiceId === quote.service_code;
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
                              {quote.company_picture && (
                                <img 
                                  src={quote.company_picture} 
                                  alt={quote.company_name} 
                                  className="w-6 h-6 object-contain"
                                />
                              )}
                              <div>
                                <span className="font-medium text-sm">{quote.service_name}</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="font-bold text-primary">
                                {formatShippingPrice(quote.price_cents)}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>
                                {quote.delivery_range?.min && quote.delivery_range?.max && quote.delivery_range.min !== quote.delivery_range.max
                                  ? `${quote.delivery_range.min}-${quote.delivery_range.max} dias úteis`
                                  : `${quote.delivery_days} dia${quote.delivery_days !== 1 ? 's' : ''} útil`}
                              </span>
                            </div>
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
                      <span>Frete selecionado: <strong>{formatShippingPrice(value.shippingCost)}</strong></span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Manual Carriers Section */}
            {manualCarriers.length > 0 && (
              <div className="space-y-3">
                {hasIntegratedOptions && (
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">ou transportadora manual</span>
                    </div>
                  </div>
                )}

                <div>
                  <Label>Transportadora Manual</Label>
                  <Select 
                    value={!selectedQuoteServiceId && value.carrierId ? value.carrierId : ''} 
                    onValueChange={(carrierId) => {
                      const carrier = manualCarriers.find(c => c.id === carrierId);
                      setSelectedQuoteServiceId(null);
                      onChange({
                        ...value,
                        carrierId,
                        shippingCost: carrier?.cost_cents || 0,
                      });
                    }}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Selecione transportadora manual" />
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
              </div>
            )}

            {/* Editable shipping cost - Always visible */}
            <div>
              <Label>Custo de Frete Cobrado</Label>
              <CurrencyInput
                value={value.shippingCost}
                onChange={(cents) => onChange({ ...value, shippingCost: cents })}
                className="mt-1"
                placeholder="0,00"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {selectedQuoteServiceId 
                  ? 'Valor da cotação (editável para ajustes)'
                  : 'Valor a ser cobrado do cliente pelo frete'}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
