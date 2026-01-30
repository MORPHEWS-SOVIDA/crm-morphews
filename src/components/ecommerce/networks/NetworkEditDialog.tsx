import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import {
  Copy, Users, ShoppingCart, Plus, X, Crown, Percent,
  DollarSign, Loader2, Check, Edit2, FileText, Store
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import {
  useNetworkMembers,
  useNetworkCheckouts,
  useAvailableCheckouts,
  useAddCheckoutToNetwork,
  useRemoveCheckoutFromNetwork,
  useNetworkLandings,
  useAvailableLandings,
  useAddLandingToNetwork,
  useRemoveLandingFromNetwork,
  useNetworkStorefronts,
  useAvailableStorefronts,
  useAddStorefrontToNetwork,
  useRemoveStorefrontFromNetwork,
  useUpdateMemberCommission,
  useUpdateMemberRole,
  useRemoveMemberFromNetwork,
  type AffiliateNetwork,
  type NetworkMember,
} from '@/hooks/ecommerce/useAffiliateNetworks';

interface NetworkEditDialogProps {
  network: AffiliateNetwork | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NetworkEditDialog({ network, open, onOpenChange }: NetworkEditDialogProps) {
  const { data: members, isLoading: membersLoading } = useNetworkMembers(network?.id || null);
  const { data: checkouts, isLoading: checkoutsLoading } = useNetworkCheckouts(network?.id || null);
  const { data: availableCheckouts, isLoading: availableCheckoutsLoading } = useAvailableCheckouts(network?.id || null);
  const { data: landings, isLoading: landingsLoading } = useNetworkLandings(network?.id || null);
  const { data: availableLandings, isLoading: availableLandingsLoading } = useAvailableLandings(network?.id || null);
  const { data: storefronts, isLoading: storefrontsLoading } = useNetworkStorefronts(network?.id || null);
  const { data: availableStorefronts, isLoading: availableStorefrontsLoading } = useAvailableStorefronts(network?.id || null);
  
  const addCheckout = useAddCheckoutToNetwork();
  const removeCheckout = useRemoveCheckoutFromNetwork();
  const addLanding = useAddLandingToNetwork();
  const removeLanding = useRemoveLandingFromNetwork();
  const addStorefront = useAddStorefrontToNetwork();
  const removeStorefront = useRemoveStorefrontFromNetwork();
  const updateCommission = useUpdateMemberCommission();
  const updateRole = useUpdateMemberRole();
  const removeMember = useRemoveMemberFromNetwork();

  const [editingMember, setEditingMember] = useState<string | null>(null);
  const [editCommissionType, setEditCommissionType] = useState<'percentage' | 'fixed'>('percentage');
  const [editCommissionValue, setEditCommissionValue] = useState<string>('');
  const [removeMemberId, setRemoveMemberId] = useState<string | null>(null);

  // Linked IDs for quick lookup
  const linkedCheckoutIds = useMemo(() => new Set(checkouts?.map(c => c.checkout_id) || []), [checkouts]);
  const linkedLandingIds = useMemo(() => new Set(landings?.map(l => l.landing_page_id) || []), [landings]);
  const linkedStorefrontIds = useMemo(() => new Set(storefronts?.map(s => s.storefront_id) || []), [storefronts]);

  // All items (available + linked)
  const allCheckouts = useMemo(() => {
    const available = availableCheckouts || [];
    const linked = checkouts?.map(c => c.checkout).filter(Boolean) || [];
    const map = new Map<string, { id: string; name: string; slug: string }>();
    [...linked, ...available].forEach(item => {
      if (item) map.set(item.id, item);
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [availableCheckouts, checkouts]);

  const allLandings = useMemo(() => {
    const available = availableLandings || [];
    const linked = landings?.map(l => l.landing_page).filter(Boolean) || [];
    const map = new Map<string, { id: string; name: string; slug: string }>();
    [...linked, ...available].forEach(item => {
      if (item) map.set(item.id, item);
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [availableLandings, landings]);

  const allStorefronts = useMemo(() => {
    const available = availableStorefronts || [];
    const linked = storefronts?.map(s => s.storefront).filter(Boolean) || [];
    const map = new Map<string, { id: string; name: string; slug: string }>();
    [...linked, ...available].forEach(item => {
      if (item) map.set(item.id, item);
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [availableStorefronts, storefronts]);

  if (!network) return null;

  const handleCopyInviteLink = () => {
    const url = `${window.location.origin}/rede/${network.invite_code}`;
    navigator.clipboard.writeText(url);
    toast.success('Link de convite copiado!');
  };

  const handleToggleCheckout = (checkoutId: string, isLinked: boolean) => {
    if (isLinked) {
      removeCheckout.mutate(
        { network_id: network.id, checkout_id: checkoutId },
        {
          onSuccess: () => toast.success('Checkout removido'),
          onError: (error: Error) => toast.error(error.message),
        }
      );
    } else {
      addCheckout.mutate(
        { network_id: network.id, checkout_id: checkoutId },
        {
          onSuccess: () => toast.success('Checkout vinculado!'),
          onError: (error: Error) => toast.error(error.message),
        }
      );
    }
  };

  const handleToggleLanding = (landingId: string, isLinked: boolean) => {
    if (isLinked) {
      removeLanding.mutate(
        { network_id: network.id, landing_page_id: landingId },
        {
          onSuccess: () => toast.success('Landing removida'),
          onError: (error: Error) => toast.error(error.message),
        }
      );
    } else {
      addLanding.mutate(
        { network_id: network.id, landing_page_id: landingId },
        {
          onSuccess: () => toast.success('Landing vinculada!'),
          onError: (error: Error) => toast.error(error.message),
        }
      );
    }
  };

  const handleToggleStorefront = (storefrontId: string, isLinked: boolean) => {
    if (isLinked) {
      removeStorefront.mutate(
        { network_id: network.id, storefront_id: storefrontId },
        {
          onSuccess: () => toast.success('Loja removida'),
          onError: (error: Error) => toast.error(error.message),
        }
      );
    } else {
      addStorefront.mutate(
        { network_id: network.id, storefront_id: storefrontId },
        {
          onSuccess: () => toast.success('Loja vinculada!'),
          onError: (error: Error) => toast.error(error.message),
        }
      );
    }
  };

  const handleStartEditCommission = (member: NetworkMember) => {
    setEditingMember(member.id);
    setEditCommissionType(member.commission_type);
    setEditCommissionValue(member.commission_value.toString());
  };

  const handleSaveCommission = (memberId: string) => {
    const value = parseFloat(editCommissionValue);
    if (isNaN(value) || value < 0) {
      toast.error('Valor inválido');
      return;
    }
    updateCommission.mutate(
      { member_id: memberId, commission_type: editCommissionType, commission_value: value },
      {
        onSuccess: () => {
          toast.success('Comissão atualizada');
          setEditingMember(null);
        },
        onError: (error: Error) => toast.error(error.message),
      }
    );
  };

  const handleToggleRole = (member: NetworkMember) => {
    const newRole = member.role === 'manager' ? 'affiliate' : 'manager';
    updateRole.mutate(
      { member_id: member.id, role: newRole },
      {
        onSuccess: () => toast.success(newRole === 'manager' ? 'Promovido a gerente!' : 'Rebaixado para afiliado'),
        onError: (error: Error) => toast.error(error.message),
      }
    );
  };

  const handleRemoveMember = () => {
    if (!removeMemberId) return;
    removeMember.mutate(removeMemberId, {
      onSuccess: () => {
        toast.success('Membro removido');
        setRemoveMemberId(null);
      },
      onError: (error: Error) => toast.error(error.message),
    });
  };

  const managers = members?.filter((m) => m.role === 'manager') || [];
  const affiliates = members?.filter((m) => m.role === 'affiliate') || [];

  const isLoadingCheckouts = checkoutsLoading || availableCheckoutsLoading;
  const isLoadingLandings = landingsLoading || availableLandingsLoading;
  const isLoadingStorefronts = storefrontsLoading || availableStorefrontsLoading;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={network.photo_url || undefined} alt={network.name} />
                <AvatarFallback className="bg-primary/10 text-primary">
                  {network.name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <DialogTitle>{network.name}</DialogTitle>
                {network.description && (
                  <p className="text-sm text-muted-foreground">{network.description}</p>
                )}
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Invite Link */}
            <div className="bg-muted/50 rounded-lg p-4 mb-4">
              <Label className="text-sm text-muted-foreground">Link de Convite</Label>
              <div className="flex items-center gap-2 mt-1">
                <code className="flex-1 text-sm bg-background px-3 py-2 rounded border truncate">
                  {window.location.origin}/rede/{network.invite_code}
                </code>
                <Button variant="outline" size="icon" onClick={handleCopyInviteLink}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Afiliados entram na rede apenas através deste link
              </p>
            </div>

            <Tabs defaultValue="checkouts" className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="checkouts" className="gap-1 text-xs">
                  <ShoppingCart className="h-3 w-3" />
                  Checkouts
                </TabsTrigger>
                <TabsTrigger value="landings" className="gap-1 text-xs">
                  <FileText className="h-3 w-3" />
                  Landings
                </TabsTrigger>
                <TabsTrigger value="storefronts" className="gap-1 text-xs">
                  <Store className="h-3 w-3" />
                  Lojas
                </TabsTrigger>
                <TabsTrigger value="members" className="gap-1 text-xs">
                  <Users className="h-3 w-3" />
                  Membros
                </TabsTrigger>
              </TabsList>

              <ScrollArea className="flex-1 mt-4">
                {/* Checkouts Tab */}
                <TabsContent value="checkouts" className="mt-0 space-y-2">
                  {isLoadingCheckouts ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mr-2" />
                      <span className="text-muted-foreground">Carregando...</span>
                    </div>
                  ) : allCheckouts.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Nenhum checkout disponível</p>
                      <p className="text-xs">Crie checkouts primeiro para vinculá-los</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {allCheckouts.map((checkout) => {
                        const isLinked = linkedCheckoutIds.has(checkout.id);
                        return (
                          <label
                            key={checkout.id}
                            className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                          >
                            <Checkbox
                              checked={isLinked}
                              onCheckedChange={() => handleToggleCheckout(checkout.id, isLinked)}
                              disabled={addCheckout.isPending || removeCheckout.isPending}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{checkout.name}</p>
                              <p className="text-xs text-muted-foreground truncate">/pay/{checkout.slug}</p>
                            </div>
                            {isLinked && (
                              <Badge variant="secondary" className="shrink-0">Vinculado</Badge>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>

                {/* Landings Tab */}
                <TabsContent value="landings" className="mt-0 space-y-2">
                  {isLoadingLandings ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mr-2" />
                      <span className="text-muted-foreground">Carregando...</span>
                    </div>
                  ) : allLandings.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Nenhuma landing page disponível</p>
                      <p className="text-xs">Crie landing pages primeiro para vinculá-las</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {allLandings.map((landing) => {
                        const isLinked = linkedLandingIds.has(landing.id);
                        return (
                          <label
                            key={landing.id}
                            className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                          >
                            <Checkbox
                              checked={isLinked}
                              onCheckedChange={() => handleToggleLanding(landing.id, isLinked)}
                              disabled={addLanding.isPending || removeLanding.isPending}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{landing.name}</p>
                              <p className="text-xs text-muted-foreground truncate">/lp/{landing.slug}</p>
                            </div>
                            {isLinked && (
                              <Badge variant="secondary" className="shrink-0">Vinculada</Badge>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>

                {/* Storefronts Tab */}
                <TabsContent value="storefronts" className="mt-0 space-y-2">
                  {isLoadingStorefronts ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mr-2" />
                      <span className="text-muted-foreground">Carregando...</span>
                    </div>
                  ) : allStorefronts.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Store className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Nenhuma loja disponível</p>
                      <p className="text-xs">Crie lojas primeiro para vinculá-las</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {allStorefronts.map((storefront) => {
                        const isLinked = linkedStorefrontIds.has(storefront.id);
                        return (
                          <label
                            key={storefront.id}
                            className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                          >
                            <Checkbox
                              checked={isLinked}
                              onCheckedChange={() => handleToggleStorefront(storefront.id, isLinked)}
                              disabled={addStorefront.isPending || removeStorefront.isPending}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{storefront.name}</p>
                              <p className="text-xs text-muted-foreground truncate">/loja/{storefront.slug}</p>
                            </div>
                            {isLinked && (
                              <Badge variant="secondary" className="shrink-0">Vinculada</Badge>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>

                {/* Members Tab */}
                <TabsContent value="members" className="mt-0 space-y-4">
                  {membersLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mr-2" />
                      <span className="text-muted-foreground">Carregando...</span>
                    </div>
                  ) : members?.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Nenhum membro ainda</p>
                      <p className="text-xs">Compartilhe o link de convite para recrutar afiliados</p>
                    </div>
                  ) : (
                    <>
                      {managers.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                            <Crown className="h-4 w-4 text-amber-500" />
                            Gerentes ({managers.length})
                          </h4>
                          <div className="space-y-2">
                            {managers.map((member) => (
                              <MemberCard
                                key={member.id}
                                member={member}
                                isEditing={editingMember === member.id}
                                editCommissionType={editCommissionType}
                                editCommissionValue={editCommissionValue}
                                onStartEdit={() => handleStartEditCommission(member)}
                                onCancelEdit={() => setEditingMember(null)}
                                onSaveEdit={() => handleSaveCommission(member.id)}
                                onChangeType={setEditCommissionType}
                                onChangeValue={setEditCommissionValue}
                                onToggleRole={() => handleToggleRole(member)}
                                onRemove={() => setRemoveMemberId(member.id)}
                                isSaving={updateCommission.isPending}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {affiliates.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                            <Users className="h-4 w-4 text-primary" />
                            Afiliados ({affiliates.length})
                          </h4>
                          <div className="space-y-2">
                            {affiliates.map((member) => (
                              <MemberCard
                                key={member.id}
                                member={member}
                                isEditing={editingMember === member.id}
                                editCommissionType={editCommissionType}
                                editCommissionValue={editCommissionValue}
                                onStartEdit={() => handleStartEditCommission(member)}
                                onCancelEdit={() => setEditingMember(null)}
                                onSaveEdit={() => handleSaveCommission(member.id)}
                                onChangeType={setEditCommissionType}
                                onChangeValue={setEditCommissionValue}
                                onToggleRole={() => handleToggleRole(member)}
                                onRemove={() => setRemoveMemberId(member.id)}
                                isSaving={updateCommission.isPending}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </TabsContent>
              </ScrollArea>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>

      {/* Remove Member Confirmation */}
      <AlertDialog open={!!removeMemberId} onOpenChange={() => setRemoveMemberId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover membro?</AlertDialogTitle>
            <AlertDialogDescription>
              O membro será desvinculado desta rede. Ele poderá entrar novamente através do link de convite.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMember}
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

// Member Card Component
interface MemberCardProps {
  member: NetworkMember;
  isEditing: boolean;
  editCommissionType: 'percentage' | 'fixed';
  editCommissionValue: string;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onChangeType: (type: 'percentage' | 'fixed') => void;
  onChangeValue: (value: string) => void;
  onToggleRole: () => void;
  onRemove: () => void;
  isSaving: boolean;
}

function MemberCard({
  member,
  isEditing,
  editCommissionType,
  editCommissionValue,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onChangeType,
  onChangeValue,
  onToggleRole,
  onRemove,
  isSaving,
}: MemberCardProps) {
  const displayName = member.affiliate?.name || member.affiliate?.email || 'Usuário';
  const displayCode = member.affiliate?.affiliate_code;

  return (
    <div className="p-3 bg-muted/30 rounded-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">
              {displayName.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{displayName}</p>
            {displayCode && (
              <p className="text-xs text-muted-foreground">Código: {displayCode}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggleRole} title={member.role === 'manager' ? 'Rebaixar' : 'Promover'}>
            <Crown className={`h-3.5 w-3.5 ${member.role === 'manager' ? 'text-amber-500' : 'text-muted-foreground'}`} />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onStartEdit}>
            <Edit2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onRemove}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {isEditing ? (
        <div className="mt-3 flex items-center gap-2">
          <div className="flex items-center border rounded-md overflow-hidden">
            <button
              type="button"
              className={`px-2 py-1 text-xs ${editCommissionType === 'percentage' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
              onClick={() => onChangeType('percentage')}
            >
              <Percent className="h-3 w-3" />
            </button>
            <button
              type="button"
              className={`px-2 py-1 text-xs ${editCommissionType === 'fixed' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
              onClick={() => onChangeType('fixed')}
            >
              <DollarSign className="h-3 w-3" />
            </button>
          </div>
          <Input
            type="number"
            value={editCommissionValue}
            onChange={(e) => onChangeValue(e.target.value)}
            className="w-24 h-8"
            placeholder={editCommissionType === 'percentage' ? '%' : 'R$'}
          />
          <Button size="sm" className="h-8" onClick={onSaveEdit} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
          </Button>
          <Button size="sm" variant="ghost" className="h-8" onClick={onCancelEdit}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <div className="mt-2 text-xs text-muted-foreground">
          Comissão: {member.commission_type === 'percentage' ? `${member.commission_value}%` : `R$ ${(member.commission_value / 100).toFixed(2)}`}
        </div>
      )}
    </div>
  );
}
