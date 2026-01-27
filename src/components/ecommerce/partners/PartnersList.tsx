import { useState } from 'react';
import { toast } from 'sonner';
import { 
  Plus, Check, X, Trash2, UserCheck, 
  DollarSign, AlertTriangle, Wallet, Eye 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
  PartnerAssociation,
  PartnerType,
  partnerTypeLabels,
  formatCommission,
  useUpdatePartnerAssociation,
  useDeletePartnerAssociation,
} from '@/hooks/ecommerce/usePartners';
import { PartnerDetailSheet } from './PartnerDetailSheet';

interface PartnersListProps {
  partners: PartnerAssociation[];
  partnerType: PartnerType;
  isLoading: boolean;
  onInvite: () => void;
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

export function PartnersList({ partners, partnerType, isLoading, onInvite }: PartnersListProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedPartner, setSelectedPartner] = useState<PartnerAssociation | null>(null);
  
  const updateAssociation = useUpdatePartnerAssociation();
  const deleteAssociation = useDeletePartnerAssociation();

  const handleToggleActive = (partner: PartnerAssociation) => {
    updateAssociation.mutate(
      { id: partner.id, is_active: !partner.is_active },
      {
        onSuccess: () => toast.success(`${partnerTypeLabels[partnerType]} ${partner.is_active ? 'desativado' : 'ativado'}!`),
        onError: (error: Error) => toast.error(error.message),
      }
    );
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteAssociation.mutate(deleteId, {
        onSuccess: () => {
          toast.success(`${partnerTypeLabels[partnerType]} removido`);
          setDeleteId(null);
        },
        onError: (error: Error) => toast.error(error.message),
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (partners.length === 0) {
    return (
      <div className="text-center py-12 border-2 border-dashed rounded-lg">
        <p className="text-muted-foreground mb-4">
          Nenhum {partnerTypeLabels[partnerType].toLowerCase()} cadastrado
        </p>
        <Button onClick={onInvite} className="gap-2">
          <Plus className="h-4 w-4" />
          Convidar {partnerTypeLabels[partnerType]}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={onInvite} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Convidar {partnerTypeLabels[partnerType]}
        </Button>
      </div>

      {partners.map((partner) => (
        <div
          key={partner.id}
          className={`flex items-center justify-between p-4 border rounded-lg transition-all cursor-pointer hover:border-primary/50 hover:bg-muted/30 ${
            !partner.is_active ? 'opacity-60 bg-muted/50' : ''
          }`}
          onClick={() => setSelectedPartner(partner)}
        >
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`font-medium ${!partner.virtual_account?.holder_name ? 'text-muted-foreground italic' : ''}`}>
                {partner.virtual_account?.holder_name || 'Sem nome cadastrado'}
              </span>
              
              {partner.virtual_account?.user_id && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  <UserCheck className="h-3 w-3" />
                  Conta Morphews
                </Badge>
              )}
              
              {!partner.is_active && (
                <Badge variant="outline" className="text-xs">Inativo</Badge>
              )}
            </div>
            
            <div className={`text-sm ${!partner.virtual_account?.holder_email ? 'text-muted-foreground italic' : 'text-muted-foreground'}`}>
              {partner.virtual_account?.holder_email || 'E-mail não informado'}
            </div>
            
            <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
              {/* Commission */}
              <span className="flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                {formatCommission(partner.commission_type, partner.commission_value)}
              </span>
              
              {/* Affiliate Code */}
              {partner.affiliate_code && (
                <span>
                  Código: <strong>{partner.affiliate_code}</strong>
                </span>
              )}
              
              {/* Liability */}
              {(partner.responsible_for_refunds || partner.responsible_for_chargebacks) && (
                <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-3 w-3" />
                  {partner.responsible_for_refunds && partner.responsible_for_chargebacks
                    ? 'Responsável por estornos'
                    : partner.responsible_for_refunds
                    ? 'Responsável por reembolsos'
                    : 'Responsável por chargebacks'}
                </span>
              )}
              
              {/* Balance */}
              <span className="flex items-center gap-1">
                <Wallet className="h-3 w-3" />
                Saldo: {formatCurrency(partner.virtual_account?.balance_cents || 0)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            {/* View Details */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedPartner(partner)}
              title="Ver detalhes"
            >
              <Eye className="h-4 w-4" />
            </Button>

            {/* Toggle Active */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleToggleActive(partner)}
              title={partner.is_active ? 'Desativar' : 'Ativar'}
            >
              {partner.is_active ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <X className="h-4 w-4 text-red-500" />
              )}
            </Button>

            {/* Delete */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDeleteId(partner.id)}
              title="Remover"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      ))}

      {/* Partner Detail Sheet */}
      <PartnerDetailSheet
        partner={selectedPartner}
        open={!!selectedPartner}
        onOpenChange={(open) => !open && setSelectedPartner(null)}
      />

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover {partnerTypeLabels[partnerType]}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O parceiro perderá acesso à sua conta virtual
              e não poderá mais solicitar saques.
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
    </div>
  );
}
