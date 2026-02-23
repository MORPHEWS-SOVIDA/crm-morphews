import { useState, useEffect } from 'react';
import { MapPin, Star, ChevronDown, Plus, Truck, AlertTriangle, Pencil } from 'lucide-react';
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
import { useActiveDeliveryRegions } from '@/hooks/useDeliveryConfig';
import { LeadAddressForm } from '@/components/leads/LeadAddressForm';
import { ShippingQuoteButton } from '@/components/shipping/ShippingQuoteButton';
import { cn } from '@/lib/utils';

interface AddressSelectorProps {
  leadId: string;
  value: string | null;
  onChange: (addressId: string | null, address: LeadAddress | null) => void;
}

export function AddressSelector({ leadId, value, onChange }: AddressSelectorProps) {
  const { data: addresses = [], isLoading } = useLeadAddresses(leadId);
  const deliveryRegions = useActiveDeliveryRegions();
  const [open, setOpen] = useState(false);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingAddress, setEditingAddress] = useState<LeadAddress | null>(null);

  const selectedAddress = addresses.find(a => a.id === value);

  // Get region name by ID
  const getRegionName = (regionId: string | null) => {
    if (!regionId) return null;
    const region = deliveryRegions.find(r => r.id === regionId);
    return region?.name || null;
  };

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

  const handleEditAddress = (address: LeadAddress, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen(false);
    setEditingAddress(address);
  };

  // Auto-select primary address if none selected — use useEffect to avoid setState during render
  useEffect(() => {
    if (!value && addresses.length > 0 && !isLoading) {
      const primary = addresses.find(a => a.is_primary) || addresses[0];
      if (primary) {
        onChange(primary.id, primary);
      }
    }
  }, [value, addresses, isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

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
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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

  const selectedRegionName = selectedAddress ? getRegionName(selectedAddress.delivery_region_id) : null;
  const missingRegion = selectedAddress && !selectedAddress.delivery_region_id;

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Endereço de Entrega
          </Label>
          {selectedAddress?.cep && (
            <ShippingQuoteButton cep={selectedAddress.cep} size="sm" />
          )}
        </div>
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
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{selectedAddress.label}</span>
                      {selectedAddress.is_primary && (
                        <Badge variant="secondary" className="text-xs">
                          <Star className="w-3 h-3 mr-1" />
                          Principal
                        </Badge>
                      )}
                      {selectedRegionName && (
                        <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
                          <Truck className="w-3 h-3 mr-1" />
                          {selectedRegionName}
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
          <PopoverContent className="w-[420px] p-0" align="start">
            <div className="max-h-[300px] overflow-y-auto">
              {addresses.map((address) => {
                const regionName = getRegionName(address.delivery_region_id);
                return (
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
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{address.label}</span>
                        {address.is_primary && (
                          <Badge variant="secondary" className="text-xs">
                            <Star className="w-3 h-3 mr-1" />
                            Principal
                          </Badge>
                        )}
                        {regionName ? (
                          <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
                            <Truck className="w-3 h-3 mr-1" />
                            {regionName}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-300">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Sem região
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
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 flex-shrink-0"
                      onClick={(e) => handleEditAddress(address, e)}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                  </button>
                );
              })}
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

        {/* Warning if selected address has no delivery region */}
        {missingRegion && (
          <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-400">
                Região de entrega não definida
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-500">
                Este endereço não possui região de entrega. Defina para ver dias/turnos disponíveis.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2 text-amber-700 border-amber-300 hover:bg-amber-100"
                onClick={() => setEditingAddress(selectedAddress)}
              >
                <Pencil className="w-3.5 h-3.5 mr-1" />
                Definir Região
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Add Address Dialog */}
      <Dialog open={isAddingNew} onOpenChange={setIsAddingNew}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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

      {/* Edit Address Dialog */}
      <Dialog open={!!editingAddress} onOpenChange={(open) => !open && setEditingAddress(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Endereço</DialogTitle>
          </DialogHeader>
          {editingAddress && (
            <LeadAddressForm
              leadId={leadId}
              address={editingAddress}
              onSuccess={() => {
                setEditingAddress(null);
                // Re-select the address to update the UI
                const updated = addresses.find(a => a.id === editingAddress.id);
                if (updated && value === editingAddress.id) {
                  onChange(updated.id, updated);
                }
              }}
              onCancel={() => setEditingAddress(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
