import { useState, useEffect } from 'react';
import { Loader2, Tag, Package, MapPin, User, FileText, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
    // Package
    weight_grams: config?.default_weight_grams || 500,
    height_cm: config?.default_height_cm || 10,
    width_cm: config?.default_width_cm || 15,
    length_cm: config?.default_length_cm || 20,
    declared_value_cents: 0,
    // Service
    service_code: config?.default_service_code || '03298',
    // Invoice
    invoice_number: '',
    invoice_key: '',
  });

  // Pre-fill from sale data - prioritize shipping_address over lead
  useEffect(() => {
    if (sale) {
      const shippingAddress = sale.shipping_address;
      const lead = sale.lead;
      
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
        }));
      }
    }
  }, [sale]);

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
    formData.recipient_cep;

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
        <Label className="flex items-center gap-2 text-base font-medium">
          <Package className="w-4 h-4" />
          Dimensões do Pacote
        </Label>

        <div className="grid grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Peso (g)</Label>
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
