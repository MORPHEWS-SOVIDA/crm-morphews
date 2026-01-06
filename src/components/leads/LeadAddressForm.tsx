import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { AddressFields } from '@/components/AddressFields';
import { 
  useCreateLeadAddress, 
  useUpdateLeadAddress,
  LeadAddress 
} from '@/hooks/useLeadAddresses';

interface LeadAddressFormProps {
  leadId: string;
  address?: LeadAddress | null;
  onSuccess: ((addressData?: any) => void);
  onCancel: () => void;
  isNewLeadMode?: boolean;
}

export function LeadAddressForm({ leadId, address, onSuccess, onCancel, isNewLeadMode = false }: LeadAddressFormProps) {
  const createAddress = useCreateLeadAddress();
  const updateAddress = useUpdateLeadAddress();
  const isEditing = !!address;

  const [formData, setFormData] = useState({
    label: '',
    is_primary: false,
    cep: '',
    street: '',
    street_number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    google_maps_link: '',
    delivery_notes: '',
  });

  useEffect(() => {
    if (address) {
      const cep = address.cep || '';
      setFormData({
        label: address.label || '',
        is_primary: address.is_primary || false,
        cep: cep.length === 8 ? `${cep.slice(0, 5)}-${cep.slice(5)}` : cep,
        street: address.street || '',
        street_number: address.street_number || '',
        complement: address.complement || '',
        neighborhood: address.neighborhood || '',
        city: address.city || '',
        state: address.state || '',
        google_maps_link: address.google_maps_link || '',
        delivery_notes: address.delivery_notes || '',
      });
    }
  }, [address]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const dataToSave = {
      label: formData.label || 'Endereço',
      is_primary: formData.is_primary,
      cep: formData.cep.replace(/\D/g, '') || undefined,
      street: formData.street || undefined,
      street_number: formData.street_number || undefined,
      complement: formData.complement || undefined,
      neighborhood: formData.neighborhood || undefined,
      city: formData.city || undefined,
      state: formData.state || undefined,
      google_maps_link: formData.google_maps_link || undefined,
      delivery_notes: formData.delivery_notes || undefined,
    };

    // In new lead mode, just return the data without saving
    if (isNewLeadMode) {
      onSuccess(dataToSave);
      return;
    }

    if (isEditing && address) {
      await updateAddress.mutateAsync({ id: address.id, ...dataToSave });
    } else {
      await createAddress.mutateAsync({ lead_id: leadId, ...dataToSave });
    }

    onSuccess();
  };

  const updateField = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const isPending = createAddress.isPending || updateAddress.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="label">Rótulo do Endereço *</Label>
        <Input
          id="label"
          value={formData.label}
          onChange={(e) => updateField('label', e.target.value)}
          placeholder="Ex: Casa, Trabalho, Escritório..."
          required
        />
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="is_primary"
          checked={formData.is_primary}
          onCheckedChange={(checked) => updateField('is_primary', !!checked)}
        />
        <Label htmlFor="is_primary" className="text-sm font-normal cursor-pointer">
          Definir como endereço principal
        </Label>
      </div>

      <div className="border-t pt-4">
        <AddressFields
          cep={formData.cep}
          street={formData.street}
          streetNumber={formData.street_number}
          complement={formData.complement}
          neighborhood={formData.neighborhood}
          city={formData.city}
          state={formData.state}
          onFieldChange={(field, value) => updateField(field, value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="delivery_notes">Observações de Entrega</Label>
        <Textarea
          id="delivery_notes"
          value={formData.delivery_notes}
          onChange={(e) => updateField('delivery_notes', e.target.value)}
          placeholder="Referências para entrega: portão verde, casa de esquina, etc."
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="google_maps_link">Link do Google Maps</Label>
        <Input
          id="google_maps_link"
          value={formData.google_maps_link}
          onChange={(e) => updateField('google_maps_link', e.target.value)}
          placeholder="https://maps.google.com/..."
        />
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {isEditing ? 'Salvar' : 'Adicionar'}
        </Button>
      </div>
    </form>
  );
}
