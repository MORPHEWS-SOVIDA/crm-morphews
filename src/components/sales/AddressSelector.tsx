import { useState } from 'react';
import { MapPin, Star, ChevronDown, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useLeadAddresses, LeadAddress } from '@/hooks/useLeadAddresses';
import { LeadAddressForm } from '@/components/leads/LeadAddressForm';
import { cn } from '@/lib/utils';

interface AddressSelectorProps {
  leadId: string;
  value: string | null;
  onChange: (addressId: string | null, address: LeadAddress | null) => void;
}

export function AddressSelector({ leadId, value, onChange }: AddressSelectorProps) {
  const { data: addresses = [], isLoading } = useLeadAddresses(leadId);
  const [open, setOpen] = useState(false);
  const [isAddingNew, setIsAddingNew] = useState(false);

  const selectedAddress = addresses.find(a => a.id === value);

  const formatAddress = (address: LeadAddress) => {
    const parts = [];
    if (address.street) {
      parts.push(`${address.street}${address.street_number ? `, ${address.street_number}` : ''}`);
    }
    if (address.neighborhood) parts.push(address.neighborhood);
    if (address.city && address.state) {
      parts.push(`${address.city}/${address.state}`);
    }
    return parts.join(' - ') || 'Endereço incompleto';
  };

  const handleSelect = (address: LeadAddress) => {
    onChange(address.id, address);
    setOpen(false);
  };

  const handleAddNew = () => {
    setOpen(false);
    setIsAddingNew(true);
  };

  // Auto-select primary address if none selected
  if (!value && addresses.length > 0 && !isLoading) {
    const primary = addresses.find(a => a.is_primary) || addresses[0];
    if (primary) {
      onChange(primary.id, primary);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <MapPin className="w-4 h-4" />
          Endereço de Entrega
        </Label>
        <div className="h-10 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  if (addresses.length === 0) {
    return (
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <MapPin className="w-4 h-4" />
          Endereço de Entrega
        </Label>
        <div className="p-4 border border-dashed rounded-lg text-center">
          <MapPin className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground mb-2">
            Nenhum endereço cadastrado para este cliente
          </p>
          <Button size="sm" variant="outline" onClick={() => setIsAddingNew(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Adicionar Endereço
          </Button>
        </div>
        
        <Dialog open={isAddingNew} onOpenChange={setIsAddingNew}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Novo Endereço</DialogTitle>
            </DialogHeader>
            <LeadAddressForm
              leadId={leadId}
              onSuccess={() => setIsAddingNew(false)}
              onCancel={() => setIsAddingNew(false)}
            />
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <MapPin className="w-4 h-4" />
          Endereço de Entrega
        </Label>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between h-auto min-h-10 text-left"
            >
              {selectedAddress ? (
                <div className="flex items-start gap-2 py-1">
                  <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{selectedAddress.label}</span>
                      {selectedAddress.is_primary && (
                        <Badge variant="secondary" className="text-xs">
                          <Star className="w-3 h-3 mr-1" />
                          Principal
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {formatAddress(selectedAddress)}
                    </p>
                  </div>
                </div>
              ) : (
                <span className="text-muted-foreground">Selecione um endereço...</span>
              )}
              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[400px] p-0" align="start">
            <div className="max-h-[300px] overflow-y-auto">
              {addresses.map((address) => (
                <button
                  key={address.id}
                  type="button"
                  onClick={() => handleSelect(address)}
                  className={cn(
                    "w-full flex items-start gap-3 p-3 text-left hover:bg-muted transition-colors border-b last:border-b-0",
                    value === address.id && "bg-muted"
                  )}
                >
                  <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{address.label}</span>
                      {address.is_primary && (
                        <Badge variant="secondary" className="text-xs">
                          <Star className="w-3 h-3 mr-1" />
                          Principal
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {formatAddress(address)}
                    </p>
                    {address.delivery_notes && (
                      <p className="text-xs text-amber-600 mt-1">
                        Obs: {address.delivery_notes}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
            <div className="border-t p-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-start text-primary"
                onClick={handleAddNew}
              >
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Novo Endereço
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Add Address Dialog */}
      <Dialog open={isAddingNew} onOpenChange={setIsAddingNew}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo Endereço</DialogTitle>
          </DialogHeader>
          <LeadAddressForm
            leadId={leadId}
            onSuccess={() => setIsAddingNew(false)}
            onCancel={() => setIsAddingNew(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
