import { useState } from 'react';
import { Plus, MapPin, Trash2, Edit2, Star, StarOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
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
import { 
  useLeadAddresses, 
  useDeleteLeadAddress, 
  useSetPrimaryAddress,
  LeadAddress 
} from '@/hooks/useLeadAddresses';
import { LeadAddressForm } from './LeadAddressForm';
import { ShippingQuoteButton } from '@/components/shipping/ShippingQuoteButton';

interface LeadAddressesManagerProps {
  leadId: string;
}

export function LeadAddressesManager({ leadId }: LeadAddressesManagerProps) {
  const { data: addresses = [], isLoading } = useLeadAddresses(leadId);
  const deleteAddress = useDeleteLeadAddress();
  const setPrimary = useSetPrimaryAddress();
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<LeadAddress | null>(null);
  const [deletingAddress, setDeletingAddress] = useState<LeadAddress | null>(null);

  const handleAddNew = () => {
    setEditingAddress(null);
    setIsFormOpen(true);
  };

  const handleEdit = (address: LeadAddress) => {
    setEditingAddress(address);
    setIsFormOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingAddress) return;
    await deleteAddress.mutateAsync({ id: deletingAddress.id, leadId });
    setDeletingAddress(null);
  };

  const handleSetPrimary = async (address: LeadAddress) => {
    await setPrimary.mutateAsync({ id: address.id, leadId });
  };

  const formatAddress = (address: LeadAddress) => {
    const parts = [];
    if (address.street) {
      parts.push(`${address.street}${address.street_number ? `, ${address.street_number}` : ''}`);
    }
    if (address.complement) parts.push(address.complement);
    if (address.neighborhood) parts.push(address.neighborhood);
    if (address.city && address.state) {
      parts.push(`${address.city}/${address.state}`);
    }
    if (address.cep) parts.push(`CEP: ${address.cep}`);
    return parts.join(' - ') || 'Endereço incompleto';
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Endereços
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-16 bg-muted rounded" />
            <div className="h-16 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Endereços ({addresses.length})
          </CardTitle>
          <Button size="sm" onClick={handleAddNew}>
            <Plus className="w-4 h-4 mr-2" />
            Adicionar
          </Button>
        </CardHeader>
        <CardContent>
          {addresses.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhum endereço cadastrado</p>
              <Button variant="link" size="sm" onClick={handleAddNew}>
                Adicionar primeiro endereço
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {addresses.map((address) => (
                <div
                  key={address.id}
                  className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{address.label}</span>
                      {address.is_primary && (
                        <Badge variant="secondary" className="text-xs">
                          <Star className="w-3 h-3 mr-1" />
                          Principal
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {formatAddress(address)}
                    </p>
                    {address.delivery_notes && (
                      <p className="text-xs text-amber-600 mt-1">
                        Obs: {address.delivery_notes}
                      </p>
                    )}
                    {address.cep && (
                      <div className="mt-2">
                        <ShippingQuoteButton cep={address.cep} />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {!address.is_primary && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleSetPrimary(address)}
                        title="Definir como principal"
                      >
                        <StarOff className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleEdit(address)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => setDeletingAddress(address)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Address Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingAddress ? 'Editar Endereço' : 'Novo Endereço'}
            </DialogTitle>
          </DialogHeader>
          <LeadAddressForm
            leadId={leadId}
            address={editingAddress}
            onSuccess={() => setIsFormOpen(false)}
            onCancel={() => setIsFormOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingAddress} onOpenChange={() => setDeletingAddress(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover endereço?</AlertDialogTitle>
            <AlertDialogDescription>
              O endereço "{deletingAddress?.label}" será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
