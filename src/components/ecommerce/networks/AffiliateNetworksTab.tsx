import { useState } from 'react';
import { Plus, Network, Users, ShoppingCart, Copy, Eye, Settings, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import { useAffiliateNetworks, useDeleteNetwork, type AffiliateNetwork } from '@/hooks/ecommerce/useAffiliateNetworks';
import { NetworkCreateDialog } from './NetworkCreateDialog';
import { NetworkDetailSheet } from './NetworkDetailSheet';

export function AffiliateNetworksTab() {
  const { data: networks, isLoading } = useAffiliateNetworks();
  const deleteNetwork = useDeleteNetwork();
  
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState<AffiliateNetwork | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleCopyInviteLink = (network: AffiliateNetwork) => {
    const url = `${window.location.origin}/rede/${network.invite_code}`;
    navigator.clipboard.writeText(url);
    toast.success('Link de convite copiado!');
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteNetwork.mutate(deleteId, {
        onSuccess: () => {
          toast.success('Rede removida com sucesso');
          setDeleteId(null);
        },
        onError: (error: Error) => toast.error(error.message),
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-40" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Redes de Afiliados</h3>
          <p className="text-sm text-muted-foreground">
            Crie redes com checkouts específicos e convide afiliados via link
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Rede
        </Button>
      </div>

      {networks?.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Network className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma rede criada</h3>
            <p className="text-sm text-muted-foreground text-center mb-4 max-w-md">
              Crie redes de afiliados para organizar seus parceiros por nicho, 
              campanha ou produto. Cada rede tem checkouts vinculados e um link 
              único de convite.
            </p>
            <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Criar primeira rede
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {networks?.map((network) => (
            <Card
              key={network.id}
              className={`cursor-pointer transition-all hover:border-primary/50 hover:shadow-md ${
                !network.is_active ? 'opacity-60' : ''
              }`}
              onClick={() => setSelectedNetwork(network)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={network.photo_url || undefined} alt={network.name} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {network.name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate">{network.name}</CardTitle>
                    {network.description && (
                      <CardDescription className="line-clamp-2">
                        {network.description}
                      </CardDescription>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    <span>{network.member_count} afiliados</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <ShoppingCart className="h-4 w-4" />
                    <span>{network.checkout_count} checkouts</span>
                  </div>
                </div>

                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-1"
                    onClick={() => handleCopyInviteLink(network)}
                  >
                    <Copy className="h-3 w-3" />
                    Copiar Link
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedNetwork(network)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteId(network.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>

                {!network.is_active && (
                  <Badge variant="secondary" className="mt-3">
                    Inativa
                  </Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <NetworkCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />

      {/* Detail Sheet */}
      <NetworkDetailSheet
        network={selectedNetwork}
        open={!!selectedNetwork}
        onOpenChange={(open) => !open && setSelectedNetwork(null)}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir rede?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todos os afiliados serão 
              desvinculados desta rede.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
