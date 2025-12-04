import { Search, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useCepLookup } from '@/hooks/useCepLookup';

interface AddressFieldsProps {
  cep: string;
  street: string;
  streetNumber: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  onFieldChange: (field: string, value: string) => void;
}

export function AddressFields({
  cep,
  street,
  streetNumber,
  complement,
  neighborhood,
  city,
  state,
  onFieldChange,
}: AddressFieldsProps) {
  const { lookupCep, isLoading } = useCepLookup();

  const handleCepLookup = async () => {
    const address = await lookupCep(cep);
    if (address) {
      onFieldChange('street', address.street);
      onFieldChange('neighborhood', address.neighborhood);
      onFieldChange('city', address.city);
      onFieldChange('state', address.state);
    }
  };

  const handleCepChange = (value: string) => {
    // Format CEP as user types (00000-000)
    const cleaned = value.replace(/\D/g, '');
    let formatted = cleaned;
    if (cleaned.length > 5) {
      formatted = `${cleaned.slice(0, 5)}-${cleaned.slice(5, 8)}`;
    }
    onFieldChange('cep', formatted);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="flex-1 space-y-2">
          <Label htmlFor="cep">CEP</Label>
          <div className="flex gap-2">
            <Input
              id="cep"
              value={cep}
              onChange={(e) => handleCepChange(e.target.value)}
              placeholder="00000-000"
              maxLength={9}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleCepLookup}
              disabled={isLoading || cep.replace(/\D/g, '').length !== 8}
              title="Buscar endereço pelo CEP"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Digite o CEP e clique na lupa para preencher automaticamente
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2 space-y-2">
          <Label htmlFor="street">Rua/Logradouro</Label>
          <Input
            id="street"
            value={street}
            onChange={(e) => onFieldChange('street', e.target.value)}
            placeholder="Nome da rua"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="streetNumber">Número</Label>
          <Input
            id="streetNumber"
            value={streetNumber}
            onChange={(e) => onFieldChange('street_number', e.target.value)}
            placeholder="123"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="complement">Complemento</Label>
          <Input
            id="complement"
            value={complement}
            onChange={(e) => onFieldChange('complement', e.target.value)}
            placeholder="Apto, sala, bloco..."
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="neighborhood">Bairro</Label>
          <Input
            id="neighborhood"
            value={neighborhood}
            onChange={(e) => onFieldChange('neighborhood', e.target.value)}
            placeholder="Nome do bairro"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="city">Cidade</Label>
          <Input
            id="city"
            value={city}
            onChange={(e) => onFieldChange('city', e.target.value)}
            placeholder="Nome da cidade"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="state">Estado</Label>
          <Input
            id="state"
            value={state}
            onChange={(e) => onFieldChange('state', e.target.value)}
            placeholder="UF"
            maxLength={2}
          />
        </div>
      </div>
    </div>
  );
}
