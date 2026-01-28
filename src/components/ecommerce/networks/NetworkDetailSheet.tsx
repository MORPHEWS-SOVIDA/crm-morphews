import { useState } from 'react';
import { toast } from 'sonner';
import {
  Copy, Users, ShoppingCart, Plus, X, Crown, Percent,
  DollarSign, UserMinus, Loader2, Check, Edit2, Save, XCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  useNetworkMembers,
  useNetworkCheckouts,
  useAvailableCheckouts,
  useAddCheckoutToNetwork,
  useRemoveCheckoutFromNetwork,
  useUpdateMemberCommission,
  useUpdateMemberRole,
  useRemoveMemberFromNetwork,
  type AffiliateNetwork,
  type NetworkMember,
} from '@/hooks/ecommerce/useAffiliateNetworks';

interface NetworkDetailSheetProps {
  network: AffiliateNetwork | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NetworkDetailSheet({ network, open, onOpenChange }: NetworkDetailSheetProps) {
  const { data: members, isLoading: membersLoading } = useNetworkMembers(network?.id || null);
  const { data: checkouts, isLoading: checkoutsLoading } = useNetworkCheckouts(network?.id || null);
  const { data: availableCheckouts } = useAvailableCheckouts(network?.id || null);
  
  const addCheckout = useAddCheckoutToNetwork();
  const removeCheckout = useRemoveCheckoutFromNetwork();
  const updateCommission = useUpdateMemberCommission();
  const updateRole = useUpdateMemberRole();
  const removeMember = useRemoveMemberFromNetwork();

  const [selectedCheckout, setSelectedCheckout] = useState<string>('');
  const [editingMember, setEditingMember] = useState<string | null>(null);
  const [editCommissionType, setEditCommissionType] = useState<'percentage' | 'fixed'>('percentage');
  const [editCommissionValue, setEditCommissionValue] = useState<string>('');
  const [removeMemberId, setRemoveMemberId] = useState<string | null>(null);

  if (!network) return null;

  const handleCopyInviteLink = () => {
    const url = `${window.location.origin}/rede/${network.invite_code}`;
    navigator.clipboard.writeText(url);
    toast.success('Link de convite copiado!');
  };

  const handleAddCheckout = () => {
    if (!selectedCheckout) return;
    
    addCheckout.mutate(
      { network_id: network.id, checkout_id: selectedCheckout },
      {
        onSuccess: () => {
          toast.success('Checkout vinculado!');
          setSelectedCheckout('');
        },
        onError: (error: Error) => toast.error(error.message),
      }
    );
  };

  const handleRemoveCheckout = (checkoutId: string) => {
    removeCheckout.mutate(
      { network_id: network.id, checkout_id: checkoutId },
      {
        onSuccess: () => toast.success('Checkout removido'),
        onError: (error: Error) => toast.error(error.message),
      }
    );
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

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={network.photo_url || undefined} alt={network.name} />
                <AvatarFallback className="bg-primary/10 text-primary">
                  {network.name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <SheetTitle>{network.name}</SheetTitle>
                <SheetDescription>{network.description}</SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div className="mt-6">
            {/* Invite Link */}
            <div className="bg-muted/50 rounded-lg p-4 mb-6">
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

            <Tabs defaultValue="checkouts">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="checkouts" className="gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  Checkouts ({checkouts?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="members" className="gap-2">
                  <Users className="h-4 w-4" />
                  Membros ({members?.length || 0})
                </TabsTrigger>
              </TabsList>

              {/* Checkouts Tab */}
              <TabsContent value="checkouts" className="mt-4 space-y-4">
                <div className="flex items-center gap-2">
                  <Select value={selectedCheckout} onValueChange={setSelectedCheckout}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Selecionar checkout..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableCheckouts?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={handleAddCheckout}
                    disabled={!selectedCheckout || addCheckout.isPending}
                  >
                    {addCheckout.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                {checkoutsLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Carregando...
                  </div>
                ) : checkouts?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Nenhum checkout vinculado</p>
                    <p className="text-xs">Adicione checkouts que os afiliados poderão vender</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {checkouts?.map((link) => (
                      <div
                        key={link.id}
                        className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                      >
                        <div>
                          <p className="font-medium">{link.checkout?.name}</p>
                          <p className="text-xs text-muted-foreground">
                            /pay/{link.checkout?.slug}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveCheckout(link.checkout_id)}
                        >
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Members Tab */}
              <TabsContent value="members" className="mt-4 space-y-4">
                {membersLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Carregando...
                  </div>
                ) : members?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Nenhum membro ainda</p>
                    <p className="text-xs">Compartilhe o link de convite para adicionar afiliados</p>
                  </div>
                ) : (
                  <>
                    {/* Managers */}
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
                              onEditCommissionType={setEditCommissionType}
                              onEditCommissionValue={setEditCommissionValue}
                              onStartEdit={() => handleStartEditCommission(member)}
                              onSaveEdit={() => handleSaveCommission(member.id)}
                              onCancelEdit={() => setEditingMember(null)}
                              onToggleRole={() => handleToggleRole(member)}
                              onRemove={() => setRemoveMemberId(member.id)}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Affiliates */}
                    {affiliates.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                          <Users className="h-4 w-4" />
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
                              onEditCommissionType={setEditCommissionType}
                              onEditCommissionValue={setEditCommissionValue}
                              onStartEdit={() => handleStartEditCommission(member)}
                              onSaveEdit={() => handleSaveCommission(member.id)}
                              onCancelEdit={() => setEditingMember(null)}
                              onToggleRole={() => handleToggleRole(member)}
                              onRemove={() => setRemoveMemberId(member.id)}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </SheetContent>
      </Sheet>

      {/* Remove Member Confirmation */}
      <AlertDialog open={!!removeMemberId} onOpenChange={() => setRemoveMemberId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover membro?</AlertDialogTitle>
            <AlertDialogDescription>
              O afiliado será removido desta rede e não poderá mais vender os checkouts vinculados.
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

interface MemberCardProps {
  member: NetworkMember;
  isEditing: boolean;
  editCommissionType: 'percentage' | 'fixed';
  editCommissionValue: string;
  onEditCommissionType: (type: 'percentage' | 'fixed') => void;
  onEditCommissionValue: (value: string) => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onToggleRole: () => void;
  onRemove: () => void;
}

function MemberCard({
  member,
  isEditing,
  editCommissionType,
  editCommissionValue,
  onEditCommissionType,
  onEditCommissionValue,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onToggleRole,
  onRemove,
}: MemberCardProps) {
  const name = member.affiliate?.name || member.affiliate?.email || 'Sem nome';
  const email = member.affiliate?.email || '';

  return (
    <div className="p-3 bg-muted/30 rounded-lg">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{name}</span>
            {member.role === 'manager' && (
              <Badge variant="secondary" className="gap-1 text-xs">
                <Crown className="h-3 w-3" />
                Gerente
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">{email}</p>
          
          {/* Commission */}
          {isEditing ? (
            <div className="flex items-center gap-2 mt-2">
              <Select
                value={editCommissionType}
                onValueChange={(v) => onEditCommissionType(v as 'percentage' | 'fixed')}
              >
                <SelectTrigger className="w-24 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">%</SelectItem>
                  <SelectItem value="fixed">R$</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number"
                value={editCommissionValue}
                onChange={(e) => onEditCommissionValue(e.target.value)}
                className="w-20 h-8"
                step="0.01"
              />
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onSaveEdit}>
                <Check className="h-4 w-4 text-green-500" />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onCancelEdit}>
                <XCircle className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="gap-1 text-xs">
                {member.commission_type === 'percentage' ? (
                  <>
                    <Percent className="h-3 w-3" />
                    {member.commission_value}%
                  </>
                ) : (
                  <>
                    <DollarSign className="h-3 w-3" />
                    R$ {member.commission_value.toFixed(2)}
                  </>
                )}
              </Badge>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onStartEdit}>
                <Edit2 className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={onToggleRole}
            title={member.role === 'manager' ? 'Rebaixar para afiliado' : 'Promover a gerente'}
          >
            <Crown className={`h-4 w-4 ${member.role === 'manager' ? 'text-amber-500' : 'text-muted-foreground'}`} />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={onRemove}
          >
            <UserMinus className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>
    </div>
  );
}
