import { useState, useEffect, useMemo } from 'react';
import { Loader2, Tag, Package, MapPin, User, FileText, AlertCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  useGenerateCorreiosLabel, 
  useCorreiosConfig,
  useCorreiosServices 
} from '@/hooks/useCorreiosIntegration';

interface CorreiosLabelGeneratorProps {
  sale: any;
  onSuccess: () => void;
  onCancel: () => void;
}

// Correios dimension and weight limits per service type
// Reference: https://www.correios.com.br/enviar/encomendas/limites-de-dimensoes-e-peso
interface ServiceLimits {
  minWeight: number; // grams
  maxWeight: number; // grams
  minHeight: number; // cm
  maxHeight: number; // cm
  minWidth: number; // cm
  maxWidth: number; // cm
  minLength: number; // cm
  maxLength: number; // cm
  minSumDimensions: number; // cm (altura + largura + comprimento)
  maxSumDimensions: number; // cm
}

const SERVICE_LIMITS: Record<string, ServiceLimits> = {
  // PAC services
  '03298': { minWeight: 1, maxWeight: 30000, minHeight: 2, maxHeight: 100, minWidth: 11, maxWidth: 100, minLength: 16, maxLength: 100, minSumDimensions: 29, maxSumDimensions: 200 },
  '03085': { minWeight: 1, maxWeight: 30000, minHeight: 2, maxHeight: 100, minWidth: 11, maxWidth: 100, minLength: 16, maxLength: 100, minSumDimensions: 29, maxSumDimensions: 200 },
  // SEDEX services
  '03220': { minWeight: 1, maxWeight: 30000, minHeight: 2, maxHeight: 100, minWidth: 11, maxWidth: 100, minLength: 16, maxLength: 100, minSumDimensions: 29, maxSumDimensions: 200 },
  '03050': { minWeight: 1, maxWeight: 30000, minHeight: 2, maxHeight: 100, minWidth: 11, maxWidth: 100, minLength: 16, maxLength: 100, minSumDimensions: 29, maxSumDimensions: 200 },
  // SEDEX 10
  '03158': { minWeight: 1, maxWeight: 10000, minHeight: 2, maxHeight: 60, minWidth: 11, maxWidth: 60, minLength: 16, maxLength: 60, minSumDimensions: 29, maxSumDimensions: 150 },
  // SEDEX 12
  '03140': { minWeight: 1, maxWeight: 10000, minHeight: 2, maxHeight: 60, minWidth: 11, maxWidth: 60, minLength: 16, maxLength: 60, minSumDimensions: 29, maxSumDimensions: 150 },
  // SEDEX Hoje
  '03204': { minWeight: 1, maxWeight: 10000, minHeight: 2, maxHeight: 60, minWidth: 11, maxWidth: 60, minLength: 16, maxLength: 60, minSumDimensions: 29, maxSumDimensions: 150 },
};

// Default limits for unknown services
const DEFAULT_LIMITS: ServiceLimits = {
  minWeight: 1, maxWeight: 30000,
  minHeight: 2, maxHeight: 100,
  minWidth: 11, maxWidth: 100,
  minLength: 16, maxLength: 100,
  minSumDimensions: 29, maxSumDimensions: 200
};

export function CorreiosLabelGenerator({ sale, onSuccess, onCancel }: CorreiosLabelGeneratorProps) {
  const { data: config } = useCorreiosConfig();
  const { data: services } = useCorreiosServices();
  const generateLabel = useGenerateCorreiosLabel();

  const [formData, setFormData] = useState({
    // Recipient from sale lead
    recipient_name: '',
    recipient_cpf_cnpj: '',
    recipient_street: '',
    recipient_number: '',
    recipient_complement: '',
    recipient_neighborhood: '',
    recipient_city: '',
    recipient_state: '',
    recipient_cep: '',
    recipient_phone: '',
    recipient_email: '',
    // Package - use Correios minimum dimensions as defaults
    weight_grams: config?.default_weight_grams || 300,
    height_cm: config?.default_height_cm || 2,
    width_cm: config?.default_width_cm || 11,
    length_cm: config?.default_length_cm || 16,
    declared_value_cents: 0,
    // Service
    service_code: config?.default_service_code || '03298',
    // Invoice
    invoice_number: '',
    invoice_key: '',
  });

  // Get current service limits
  const currentLimits = useMemo(() => {
    return SERVICE_LIMITS[formData.service_code] || DEFAULT_LIMITS;
  }, [formData.service_code]);

  // Calculate dimension sum and validation
  const dimensionValidation = useMemo(() => {
    const sum = formData.height_cm + formData.width_cm + formData.length_cm;
    const isValidSum = sum >= currentLimits.minSumDimensions && sum <= currentLimits.maxSumDimensions;
    const isValidWeight = formData.weight_grams >= currentLimits.minWeight && formData.weight_grams <= currentLimits.maxWeight;
    const isValidHeight = formData.height_cm >= currentLimits.minHeight && formData.height_cm <= currentLimits.maxHeight;
    const isValidWidth = formData.width_cm >= currentLimits.minWidth && formData.width_cm <= currentLimits.maxWidth;
    const isValidLength = formData.length_cm >= currentLimits.minLength && formData.length_cm <= currentLimits.maxLength;
    
    return {
      sum,
      isValidSum,
      isValidWeight,
      isValidHeight,
      isValidWidth,
      isValidLength,
      isValid: isValidSum && isValidWeight && isValidHeight && isValidWidth && isValidLength
    };
  }, [formData, currentLimits]);

  // Pre-fill from sale data - prioritize shipping_address over lead
  // Also use correios_service_code from shipping_carrier if available
  useEffect(() => {
    if (sale) {
      const shippingAddress = sale.shipping_address;
      const lead = sale.lead;
      const carrier = sale.shipping_carrier;
      
      // Pre-select service code from carrier if available
      const carrierServiceCode = carrier?.correios_service_code;
      
      if (shippingAddress) {
        // Use shipping_address from lead_addresses (preferred)
        setFormData(prev => ({
          ...prev,
          recipient_name: lead?.name || '',
          recipient_cpf_cnpj: lead?.cpf_cnpj || '',
          recipient_street: shippingAddress.street || '',
          recipient_number: shippingAddress.street_number || '',
          recipient_complement: shippingAddress.complement || '',
          recipient_neighborhood: shippingAddress.neighborhood || '',
          recipient_city: shippingAddress.city || '',
          recipient_state: shippingAddress.state || '',
          recipient_cep: shippingAddress.cep || '',
          recipient_phone: lead?.whatsapp || '',
          recipient_email: lead?.email || '',
          declared_value_cents: sale.total_cents || 0,
          // Use carrier's correios_service_code if available
          ...(carrierServiceCode && { service_code: carrierServiceCode }),
        }));
      } else if (lead) {
        // Fallback to lead data
        setFormData(prev => ({
          ...prev,
          recipient_name: lead.name || '',
          recipient_cpf_cnpj: lead.cpf_cnpj || '',
          recipient_street: lead.street || '',
          recipient_number: lead.street_number || '',
          recipient_complement: lead.complement || '',
          recipient_neighborhood: lead.neighborhood || '',
          recipient_city: lead.city || '',
          recipient_state: lead.state || '',
          recipient_cep: lead.cep || '',
          recipient_phone: lead.whatsapp || '',
          recipient_email: lead.email || '',
          declared_value_cents: sale.total_cents || 0,
          // Use carrier's correios_service_code if available
          ...(carrierServiceCode && { service_code: carrierServiceCode }),
        }));
      } else if (carrierServiceCode) {
        // Only carrier service code available
        setFormData(prev => ({
          ...prev,
          service_code: carrierServiceCode,
        }));
      }
    }
  }, [sale]);

  // Apply minimum dimensions when service changes
  useEffect(() => {
    const limits = SERVICE_LIMITS[formData.service_code] || DEFAULT_LIMITS;
    setFormData(prev => ({
      ...prev,
      height_cm: Math.max(prev.height_cm, limits.minHeight),
      width_cm: Math.max(prev.width_cm, limits.minWidth),
      length_cm: Math.max(prev.length_cm, limits.minLength),
      weight_grams: Math.max(prev.weight_grams, limits.minWeight),
    }));
  }, [formData.service_code]);

  const handleSubmit = async () => {
    await generateLabel.mutateAsync({
      sale_id: sale.id,
      recipient: {
        name: formData.recipient_name,
        cpf_cnpj: formData.recipient_cpf_cnpj,
        street: formData.recipient_street,
        number: formData.recipient_number,
        complement: formData.recipient_complement,
        neighborhood: formData.recipient_neighborhood,
        city: formData.recipient_city,
        state: formData.recipient_state,
        cep: formData.recipient_cep,
        phone: formData.recipient_phone,
        email: formData.recipient_email,
      },
      package: {
        weight_grams: formData.weight_grams,
        height_cm: formData.height_cm,
        width_cm: formData.width_cm,
        length_cm: formData.length_cm,
        declared_value_cents: formData.declared_value_cents,
      },
      service_code: formData.service_code,
      invoice_number: formData.invoice_number || undefined,
      invoice_key: formData.invoice_key || undefined,
    });

    onSuccess();
  };

  const isValid = 
    formData.recipient_name &&
    formData.recipient_street &&
    formData.recipient_number &&
    formData.recipient_neighborhood &&
    formData.recipient_city &&
    formData.recipient_state &&
    formData.recipient_cep &&
    dimensionValidation.isValid;

  return (
    <div className="space-y-4">
      {/* Sale Info */}
      <Card className="bg-muted/50">
        <CardContent className="py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Venda #{sale.romaneio_number || sale.id.slice(0, 8)}</p>
              <p className="text-sm text-muted-foreground">
                {sale.items?.length || 0} item(s) • R$ {(sale.total_cents / 100).toFixed(2)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Service Selection */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Package className="w-4 h-4" />
          Serviço de Envio
        </Label>
        <Select
          value={formData.service_code}
          onValueChange={(value) => setFormData(prev => ({ ...prev, service_code: value }))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione o serviço" />
          </SelectTrigger>
          <SelectContent>
            {services?.map((service) => (
              <SelectItem key={service.code} value={service.code}>
                {service.name} - {service.description}
              </SelectItem>
            )) || (
              <>
                <SelectItem value="03298">PAC - Entrega econômica</SelectItem>
                <SelectItem value="03220">SEDEX - Entrega expressa</SelectItem>
              </>
            )}
          </SelectContent>
        </Select>
      </div>

      <Separator />

      {/* Recipient */}
      <div className="space-y-3">
        <Label className="flex items-center gap-2 text-base font-medium">
          <User className="w-4 h-4" />
          Destinatário
        </Label>
        
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">Nome Completo *</Label>
            <Input
              value={formData.recipient_name}
              onChange={(e) => setFormData(prev => ({ ...prev, recipient_name: e.target.value }))}
              placeholder="Nome do destinatário"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">CPF/CNPJ</Label>
            <Input
              value={formData.recipient_cpf_cnpj}
              onChange={(e) => setFormData(prev => ({ ...prev, recipient_cpf_cnpj: e.target.value }))}
              placeholder="Documento"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Telefone</Label>
            <Input
              value={formData.recipient_phone}
              onChange={(e) => setFormData(prev => ({ ...prev, recipient_phone: e.target.value }))}
              placeholder="(00) 00000-0000"
            />
          </div>
        </div>
      </div>

      {/* Address */}
      <div className="space-y-3">
        <Label className="flex items-center gap-2 text-base font-medium">
          <MapPin className="w-4 h-4" />
          Endereço de Entrega
        </Label>

        <div className="grid grid-cols-4 gap-3">
          <div className="col-span-3 space-y-1">
            <Label className="text-xs">Logradouro *</Label>
            <Input
              value={formData.recipient_street}
              onChange={(e) => setFormData(prev => ({ ...prev, recipient_street: e.target.value }))}
              placeholder="Rua, Avenida..."
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Número *</Label>
            <Input
              value={formData.recipient_number}
              onChange={(e) => setFormData(prev => ({ ...prev, recipient_number: e.target.value }))}
              placeholder="123"
            />
          </div>
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">Complemento</Label>
            <Input
              value={formData.recipient_complement}
              onChange={(e) => setFormData(prev => ({ ...prev, recipient_complement: e.target.value }))}
              placeholder="Apto, Bloco..."
            />
          </div>
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">Bairro *</Label>
            <Input
              value={formData.recipient_neighborhood}
              onChange={(e) => setFormData(prev => ({ ...prev, recipient_neighborhood: e.target.value }))}
              placeholder="Bairro"
            />
          </div>
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">Cidade *</Label>
            <Input
              value={formData.recipient_city}
              onChange={(e) => setFormData(prev => ({ ...prev, recipient_city: e.target.value }))}
              placeholder="Cidade"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">UF *</Label>
            <Input
              value={formData.recipient_state}
              onChange={(e) => setFormData(prev => ({ ...prev, recipient_state: e.target.value.toUpperCase() }))}
              placeholder="SP"
              maxLength={2}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">CEP *</Label>
            <Input
              value={formData.recipient_cep}
              onChange={(e) => setFormData(prev => ({ ...prev, recipient_cep: e.target.value }))}
              placeholder="00000-000"
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Package Dimensions */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2 text-base font-medium">
            <Package className="w-4 h-4" />
            Dimensões do Pacote
          </Label>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 text-xs text-muted-foreground cursor-help">
                <Info className="w-3 h-3" />
                <span>Limites Correios</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-xs">
              <div className="space-y-1 text-xs">
                <p><strong>Peso:</strong> {currentLimits.minWeight}g - {(currentLimits.maxWeight / 1000).toFixed(0)}kg</p>
                <p><strong>Altura:</strong> {currentLimits.minHeight}cm - {currentLimits.maxHeight}cm</p>
                <p><strong>Largura:</strong> {currentLimits.minWidth}cm - {currentLimits.maxWidth}cm</p>
                <p><strong>Comprimento:</strong> {currentLimits.minLength}cm - {currentLimits.maxLength}cm</p>
                <p><strong>Soma (A+L+C):</strong> {currentLimits.minSumDimensions}cm - {currentLimits.maxSumDimensions}cm</p>
              </div>
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className={`text-xs ${!dimensionValidation.isValidWeight ? 'text-destructive' : ''}`}>
              Peso (g) *
            </Label>
            <Input
              type="number"
              value={formData.weight_grams}
              onChange={(e) => setFormData(prev => ({ ...prev, weight_grams: Number(e.target.value) }))}
              min={currentLimits.minWeight}
              max={currentLimits.maxWeight}
              className={!dimensionValidation.isValidWeight ? 'border-destructive' : ''}
            />
            <p className="text-[10px] text-muted-foreground">
              mín: {currentLimits.minWeight}g
            </p>
          </div>
          <div className="space-y-1">
            <Label className={`text-xs ${!dimensionValidation.isValidHeight ? 'text-destructive' : ''}`}>
              Altura (cm) *
            </Label>
            <Input
              type="number"
              value={formData.height_cm}
              onChange={(e) => setFormData(prev => ({ ...prev, height_cm: Number(e.target.value) }))}
              min={currentLimits.minHeight}
              max={currentLimits.maxHeight}
              className={!dimensionValidation.isValidHeight ? 'border-destructive' : ''}
            />
            <p className="text-[10px] text-muted-foreground">
              mín: {currentLimits.minHeight}cm
            </p>
          </div>
          <div className="space-y-1">
            <Label className={`text-xs ${!dimensionValidation.isValidWidth ? 'text-destructive' : ''}`}>
              Largura (cm) *
            </Label>
            <Input
              type="number"
              value={formData.width_cm}
              onChange={(e) => setFormData(prev => ({ ...prev, width_cm: Number(e.target.value) }))}
              min={currentLimits.minWidth}
              max={currentLimits.maxWidth}
              className={!dimensionValidation.isValidWidth ? 'border-destructive' : ''}
            />
            <p className="text-[10px] text-muted-foreground">
              mín: {currentLimits.minWidth}cm
            </p>
          </div>
          <div className="space-y-1">
            <Label className={`text-xs ${!dimensionValidation.isValidLength ? 'text-destructive' : ''}`}>
              Comprimento (cm) *
            </Label>
            <Input
              type="number"
              value={formData.length_cm}
              onChange={(e) => setFormData(prev => ({ ...prev, length_cm: Number(e.target.value) }))}
              min={currentLimits.minLength}
              max={currentLimits.maxLength}
              className={!dimensionValidation.isValidLength ? 'border-destructive' : ''}
            />
            <p className="text-[10px] text-muted-foreground">
              mín: {currentLimits.minLength}cm
            </p>
          </div>
        </div>

        {/* Dimension sum indicator */}
        <div className={`text-xs p-2 rounded-md ${dimensionValidation.isValidSum ? 'bg-muted' : 'bg-destructive/10 text-destructive'}`}>
          <span className="font-medium">Soma das dimensões:</span> {dimensionValidation.sum}cm 
          {dimensionValidation.isValidSum ? (
            <span className="text-muted-foreground"> (válido: {currentLimits.minSumDimensions}-{currentLimits.maxSumDimensions}cm)</span>
          ) : (
            <span> (necessário: {currentLimits.minSumDimensions}-{currentLimits.maxSumDimensions}cm)</span>
          )}
        </div>
      </div>

      {/* Invoice (Optional) */}
      <div className="space-y-3">
        <Label className="flex items-center gap-2 text-base font-medium">
          <FileText className="w-4 h-4" />
          Nota Fiscal (Opcional)
        </Label>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Número da NF</Label>
            <Input
              value={formData.invoice_number}
              onChange={(e) => setFormData(prev => ({ ...prev, invoice_number: e.target.value }))}
              placeholder="Número"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Chave NFe (44 dígitos)</Label>
            <Input
              value={formData.invoice_key}
              onChange={(e) => setFormData(prev => ({ ...prev, invoice_key: e.target.value }))}
              placeholder="Chave de acesso"
            />
          </div>
        </div>
      </div>

      {/* Validation Errors */}
      {!dimensionValidation.isValid && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Ajuste as dimensões para atender aos limites do Correios para o serviço selecionado.
          </AlertDescription>
        </Alert>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button 
          onClick={handleSubmit} 
          disabled={generateLabel.isPending || !isValid}
        >
          {generateLabel.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Tag className="w-4 h-4 mr-2" />
          )}
          Gerar Etiqueta
        </Button>
      </div>
    </div>
  );
}
