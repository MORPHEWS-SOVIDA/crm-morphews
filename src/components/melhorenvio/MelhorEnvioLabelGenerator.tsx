import { useState, useEffect, useMemo } from 'react';
import { Loader2, Tag, Package, MapPin, User, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  useGenerateMelhorEnvioLabel, 
  useMelhorEnvioConfig,
  useMelhorEnvioServices 
} from '@/hooks/useMelhorEnvio';

interface MelhorEnvioLabelGeneratorProps {
  sale: any;
  onSuccess: () => void;
  onCancel: () => void;
}

export function MelhorEnvioLabelGenerator({ sale, onSuccess, onCancel }: MelhorEnvioLabelGeneratorProps) {
  const { data: config } = useMelhorEnvioConfig();
  const { data: services, isLoading: servicesLoading } = useMelhorEnvioServices();
  const generateLabel = useGenerateMelhorEnvioLabel();

  const [formData, setFormData] = useState({
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
    weight_grams: config?.default_weight_grams || 500,
    height_cm: config?.default_height_cm || 10,
    width_cm: config?.default_width_cm || 15,
    length_cm: config?.default_length_cm || 20,
    declared_value_cents: 0,
    service_id: 0,
    invoice_number: '',
    invoice_key: '',
  });

  // Pre-fill from sale data
  useEffect(() => {
    if (sale) {
      const shippingAddress = sale.shipping_address;
      const lead = sale.lead;
      const carrier = sale.shipping_carrier;
      
      const carrierServiceId = carrier?.melhor_envio_service_id;
      
      if (shippingAddress) {
        setFormData(prev => ({
          ...prev,
          recipient_name: lead?.name || '',
          recipient_cpf_cnpj: lead?.cpf_cnpj || lead?.cpf || lead?.cnpj || '',
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
          ...(carrierServiceId && { service_id: carrierServiceId }),
        }));
      } else if (lead) {
        setFormData(prev => ({
          ...prev,
          recipient_name: lead.name || '',
          recipient_cpf_cnpj: lead.cpf_cnpj || lead.cpf || lead.cnpj || '',
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
          ...(carrierServiceId && { service_id: carrierServiceId }),
        }));
      }
    }
  }, [sale]);

  const handleSubmit = async () => {
    const products = sale.items?.map((item: any) => ({
      name: item.product_name || 'Produto',
      quantity: item.quantity || 1,
      unitary_value_cents: item.unit_price_cents || 0,
    })) || [];

    await generateLabel.mutateAsync({
      sale_id: sale.id,
      service_id: formData.service_id,
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
      invoice: formData.invoice_key ? {
        number: formData.invoice_number,
        key: formData.invoice_key,
      } : undefined,
      products,
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
    formData.service_id > 0;

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
          value={formData.service_id ? String(formData.service_id) : ''}
          onValueChange={(value) => setFormData(prev => ({ ...prev, service_id: parseInt(value) }))}
        >
          <SelectTrigger>
            <SelectValue placeholder={servicesLoading ? "Carregando..." : "Selecione o serviço"} />
          </SelectTrigger>
          <SelectContent>
            {services?.map((service) => (
              <SelectItem key={service.id} value={String(service.id)}>
                {service.company?.name} - {service.name}
              </SelectItem>
            ))}
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
        <Label className="flex items-center gap-2 text-base font-medium">
          <Package className="w-4 h-4" />
          Dimensões do Pacote
        </Label>

        <div className="grid grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Peso (g) *</Label>
            <Input
              type="number"
              value={formData.weight_grams}
              onChange={(e) => setFormData(prev => ({ ...prev, weight_grams: Number(e.target.value) }))}
              min={1}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Altura (cm)</Label>
            <Input
              type="number"
              value={formData.height_cm}
              onChange={(e) => setFormData(prev => ({ ...prev, height_cm: Number(e.target.value) }))}
              min={1}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Largura (cm)</Label>
            <Input
              type="number"
              value={formData.width_cm}
              onChange={(e) => setFormData(prev => ({ ...prev, width_cm: Number(e.target.value) }))}
              min={1}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Comprimento (cm)</Label>
            <Input
              type="number"
              value={formData.length_cm}
              onChange={(e) => setFormData(prev => ({ ...prev, length_cm: Number(e.target.value) }))}
              min={1}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* DNS/Connection Warning */}
      {config?.ambiente === 'production' && (
        <Alert className="bg-amber-50 border-amber-200 my-4">
          <Info className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-sm text-amber-800">
            <strong>Atenção:</strong> Se houver erro ao gerar etiquetas, pode ser problema de conectividade com a API do Melhor Envio. 
            Tente mudar para <strong>Ambiente Sandbox</strong> nas configurações ou entre em contato com o suporte técnico.
          </AlertDescription>
        </Alert>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button
          variant="outline"
          onClick={onCancel}
          className="flex-1"
          disabled={generateLabel.isPending}
        >
          Cancelar
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!isValid || generateLabel.isPending}
          className="flex-1"
        >
          {generateLabel.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Gerando...
            </>
          ) : (
            <>
              <Tag className="w-4 h-4 mr-2" />
              Gerar Etiqueta
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
