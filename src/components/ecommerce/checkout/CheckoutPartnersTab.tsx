import { useState } from 'react';
import { Factory, Building2, Users2, Plus, Trash2, Info, Search, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  useOrganizationPartnersV2,
  useCheckoutPartnerV2,
  useLinkPartnerToCheckout,
  useUnlinkPartnerFromCheckout,
  useCreatePartner,
  useFindPartnerByEmail,
  useUpdateCheckoutPartnerCommission,
  PartnerType,
  OrganizationPartner,
} from '@/hooks/ecommerce/useOrganizationPartnersV2';

interface CheckoutPartnersTabProps {
  checkoutId: string;
}

function formatCommission(type: string, value: number) {
  if (type === 'percentage') return `${value}%`;
  return `R$ ${value.toFixed(2)}`;
}

// =============================================================================
// PARTNER SECTION COMPONENT
// =============================================================================

interface PartnerSectionProps {
  checkoutId: string;
  partnerType: PartnerType;
  title: string;
  description: string;
  icon: React.ReactNode;
  iconColor: string;
}

function PartnerSection({ checkoutId, partnerType, title, description, icon, iconColor }: PartnerSectionProps) {
  const { data: allPartners, isLoading: loadingPartners } = useOrganizationPartnersV2(partnerType);
  const { data: linkedPartner, isLoading: loadingLinked } = useCheckoutPartnerV2(checkoutId, partnerType);
  
  const linkPartner = useLinkPartnerToCheckout();
  const unlinkPartner = useUnlinkPartnerFromCheckout();
  const createPartner = useCreatePartner();
  const findByEmail = useFindPartnerByEmail();
  const updateCommission = useUpdateCheckoutPartnerCommission();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addMode, setAddMode] = useState<'select' | 'email' | 'new'>('select');

  // Select mode
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('');

  // Email search mode
  const [searchEmail, setSearchEmail] = useState('');
  const [foundPartner, setFoundPartner] = useState<any>(null);
  const [searchError, setSearchError] = useState('');

  // New partner mode
  const [newPartnerEmail, setNewPartnerEmail] = useState('');
  const [newPartnerName, setNewPartnerName] = useState('');
  const [newPartnerPhone, setNewPartnerPhone] = useState('');
  const [newCommissionType, setNewCommissionType] = useState<'percentage' | 'fixed'>('percentage');
  const [newCommissionValue, setNewCommissionValue] = useState(10);

  // Commission edit
  const [editCommissionType, setEditCommissionType] = useState<'percentage' | 'fixed'>('percentage');
  const [editCommissionValue, setEditCommissionValue] = useState(0);

  const availablePartners = allPartners?.filter(
    (p) => p.virtual_account_id !== linkedPartner?.virtual_account_id
  ) || [];

  const isLoading = loadingPartners || loadingLinked;

  const resetDialog = () => {
    setSelectedPartnerId('');
    setSearchEmail('');
    setFoundPartner(null);
    setSearchError('');
    setNewPartnerEmail('');
    setNewPartnerName('');
    setNewPartnerPhone('');
    setNewCommissionType('percentage');
    setNewCommissionValue(10);
    setAddMode('select');
  };

  const handleOpenDialog = () => {
    resetDialog();
    setShowAddDialog(true);
  };

  const handleSearchByEmail = async () => {
    if (!searchEmail.trim()) return;

    setSearchError('');
    setFoundPartner(null);

    try {
      const result = await findByEmail.mutateAsync({ email: searchEmail, partnerType });
      if (result) {
        if (result.virtual_account_id === linkedPartner?.virtual_account_id) {
          setSearchError('Este parceiro já está vinculado a este checkout');
        } else {
          setFoundPartner(result);
        }
      } else {
        setSearchError('Nenhum parceiro encontrado com este e-mail. Você pode cadastrar um novo.');
      }
    } catch (error) {
      setSearchError('Erro ao buscar parceiro');
    }
  };

  const handleLinkFoundPartner = async () => {
    if (!foundPartner) return;

    // Se não tem association, criar primeiro
    if (!foundPartner.has_association) {
      try {
        await createPartner.mutateAsync({
          email: foundPartner.email,
          name: foundPartner.name,
          partnerType,
          commissionType: newCommissionType,
          commissionValue: newCommissionValue,
        });
      } catch (error) {
        return;
      }
    }

    await linkPartner.mutateAsync({
      virtualAccountId: foundPartner.virtual_account_id,
      checkoutId,
      partnerType,
      commissionType: foundPartner.default_commission_type || newCommissionType,
      commissionValue: foundPartner.default_commission_value || newCommissionValue,
    });

    setShowAddDialog(false);
    resetDialog();
  };

  const handleLinkSelected = async () => {
    if (!selectedPartnerId) return;

    const selectedPartner = allPartners?.find(p => p.virtual_account_id === selectedPartnerId);
    if (!selectedPartner) return;

    await linkPartner.mutateAsync({
      virtualAccountId: selectedPartnerId,
      checkoutId,
      partnerType,
      commissionType: selectedPartner.default_commission_type,
      commissionValue: selectedPartner.default_commission_value,
    });

    setShowAddDialog(false);
    resetDialog();
  };

  const handleCreateAndLink = async () => {
    if (!newPartnerEmail.trim() || !newPartnerName.trim()) {
      toast.error('Preencha e-mail e nome do parceiro');
      return;
    }

    try {
      const newPartner = await createPartner.mutateAsync({
        email: newPartnerEmail,
        name: newPartnerName,
        phone: newPartnerPhone || undefined,
        partnerType,
        commissionType: newCommissionType,
        commissionValue: newCommissionValue,
      });

      // Vincular ao checkout
      await linkPartner.mutateAsync({
        virtualAccountId: newPartner.id,
        checkoutId,
        partnerType,
        commissionType: newCommissionType,
        commissionValue: newCommissionValue,
      });

      setShowAddDialog(false);
      resetDialog();
    } catch (error) {
      // Erro já tratado pelo hook
    }
  };

  const handleRemovePartner = () => {
    unlinkPartner.mutate({ checkoutId, partnerType });
  };

  const handleUpdateCommission = () => {
    updateCommission.mutate({
      checkoutId,
      partnerType,
      commissionType: editCommissionType,
      commissionValue: editCommissionValue,
    });
  };

  // Sync edit fields when linked partner changes
  useState(() => {
    if (linkedPartner) {
      setEditCommissionType(linkedPartner.commission_type);
      setEditCommissionValue(linkedPartner.commission_value);
    }
  });

  return (
    <Card>
      <CardHeader className="py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={iconColor}>{icon}</div>
            <CardTitle className="text-sm">{title}</CardTitle>
            <Badge variant="secondary" className="text-xs">Ganha em toda venda</Badge>
          </div>
          {!linkedPartner && (
            <Button size="sm" variant="outline" onClick={handleOpenDialog} disabled={isLoading}>
              <Plus className="h-4 w-4 mr-1" />
              Adicionar
            </Button>
          )}
        </div>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : linkedPartner ? (
          <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{linkedPartner.partner?.name || 'Parceiro'}</span>
                <Badge variant="secondary" className="text-xs">
                  {formatCommission(linkedPartner.commission_type, linkedPartner.commission_value)}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                {linkedPartner.partner?.email}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Commission edit */}
              <div className="flex items-center gap-1">
                <Select
                  value={linkedPartner.commission_type}
                  onValueChange={(v) => {
                    updateCommission.mutate({
                      checkoutId,
                      partnerType,
                      commissionType: v as 'percentage' | 'fixed',
                      commissionValue: linkedPartner.commission_value,
                    });
                  }}
                >
                  <SelectTrigger className="w-24 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">%</SelectItem>
                    <SelectItem value="fixed">R$</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min="0"
                  step={linkedPartner.commission_type === 'percentage' ? '0.5' : '1'}
                  className="w-20 h-8 text-xs"
                  value={linkedPartner.commission_value}
                  onChange={(e) => {
                    updateCommission.mutate({
                      checkoutId,
                      partnerType,
                      commissionType: linkedPartner.commission_type,
                      commissionValue: parseFloat(e.target.value) || 0,
                    });
                  }}
                />
              </div>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRemovePartner}
                title="Remover"
                className="text-destructive hover:text-destructive h-8 w-8"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-muted-foreground">
            <p className="text-sm">Nenhum {title.toLowerCase()} vinculado</p>
            <p className="text-xs">Clique em "Adicionar" para vincular</p>
          </div>
        )}
      </CardContent>

      {/* Add Partner Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar {title}</DialogTitle>
            <DialogDescription>
              Vincule um parceiro existente ou cadastre um novo
            </DialogDescription>
          </DialogHeader>

          <Tabs value={addMode} onValueChange={(v) => setAddMode(v as any)} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="select">Selecionar</TabsTrigger>
              <TabsTrigger value="email">Buscar E-mail</TabsTrigger>
              <TabsTrigger value="new">Novo</TabsTrigger>
            </TabsList>

            {/* Select from existing */}
            <TabsContent value="select" className="space-y-4 mt-4">
              {availablePartners.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum {title.toLowerCase()} disponível. Cadastre um novo ou busque por e-mail.
                </p>
              ) : (
                <div className="space-y-2">
                  <Label>Selecione um {title.toLowerCase()}</Label>
                  <Select value={selectedPartnerId} onValueChange={setSelectedPartnerId}>
                    <SelectTrigger>
                      <SelectValue placeholder={`Selecione um ${title.toLowerCase()}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {availablePartners.map((partner) => (
                        <SelectItem key={partner.virtual_account_id} value={partner.virtual_account_id}>
                          <div className="flex items-center gap-2">
                            <span>{partner.name}</span>
                            <span className="text-muted-foreground text-xs">
                              ({formatCommission(partner.default_commission_type, partner.default_commission_value)})
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleLinkSelected}
                  disabled={!selectedPartnerId || linkPartner.isPending}
                >
                  {linkPartner.isPending ? 'Adicionando...' : 'Adicionar'}
                </Button>
              </DialogFooter>
            </TabsContent>

            {/* Search by email */}
            <TabsContent value="email" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>E-mail do parceiro</Label>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="parceiro@exemplo.com"
                    value={searchEmail}
                    onChange={(e) => setSearchEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearchByEmail()}
                  />
                  <Button
                    variant="secondary"
                    onClick={handleSearchByEmail}
                    disabled={findByEmail.isPending}
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {searchError && (
                <p className="text-sm text-amber-600">{searchError}</p>
              )}

              {foundPartner && (
                <div className="p-3 border rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2">
                    {icon}
                    <span className="font-medium">{foundPartner.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {foundPartner.email}
                    {foundPartner.has_association && (
                      <> • {formatCommission(foundPartner.default_commission_type, foundPartner.default_commission_value)}</>
                    )}
                  </p>
                  {!foundPartner.has_association && (
                    <p className="text-xs text-amber-600 mt-1">
                      Este contato existe mas não está cadastrado como {title.toLowerCase()}. Será criado ao vincular.
                    </p>
                  )}
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleLinkFoundPartner}
                  disabled={!foundPartner || linkPartner.isPending || createPartner.isPending}
                >
                  {linkPartner.isPending || createPartner.isPending ? 'Adicionando...' : 'Adicionar'}
                </Button>
              </DialogFooter>
            </TabsContent>

            {/* Create new */}
            <TabsContent value="new" className="space-y-4 mt-4">
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>E-mail *</Label>
                  <Input
                    type="email"
                    placeholder="parceiro@exemplo.com"
                    value={newPartnerEmail}
                    onChange={(e) => setNewPartnerEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Nome *</Label>
                  <Input
                    placeholder={`Nome do ${title.toLowerCase()}`}
                    value={newPartnerName}
                    onChange={(e) => setNewPartnerName(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label>Tipo Comissão</Label>
                    <Select value={newCommissionType} onValueChange={(v) => setNewCommissionType(v as any)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">% da venda</SelectItem>
                        <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>{newCommissionType === 'percentage' ? 'Percentual (%)' : 'Valor (R$)'}</Label>
                    <Input
                      type="number"
                      min="0"
                      step={newCommissionType === 'percentage' ? '0.5' : '1'}
                      value={newCommissionValue}
                      onChange={(e) => setNewCommissionValue(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleCreateAndLink}
                  disabled={!newPartnerEmail || !newPartnerName || createPartner.isPending || linkPartner.isPending}
                >
                  <UserPlus className="h-4 w-4 mr-1" />
                  {createPartner.isPending ? 'Cadastrando...' : 'Cadastrar e Vincular'}
                </Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function CheckoutPartnersTab({ checkoutId }: CheckoutPartnersTabProps) {
  return (
    <div className="space-y-4">
      {/* Info Banner */}
      <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/30">
        <CardContent className="py-3 flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-700 dark:text-blue-300">
            <strong>Parceiros Fixos:</strong> Estes parceiros recebem comissão em <strong>TODAS</strong> as vendas deste checkout,
            independente de qual afiliado divulgou. Os afiliados (aba ao lado) só ganham quando a venda vem pelo link deles.
          </div>
        </CardContent>
      </Card>

      {/* Industry */}
      <PartnerSection
        checkoutId={checkoutId}
        partnerType="industry"
        title="Indústria"
        description="Fornecedor principal que recebe comissão fixa ou % em cada venda"
        icon={<Building2 className="h-4 w-4" />}
        iconColor="text-purple-500"
      />

      {/* Factory */}
      <PartnerSection
        checkoutId={checkoutId}
        partnerType="factory"
        title="Fábrica"
        description="Fabricante do produto que recebe valor por unidade vendida"
        icon={<Factory className="h-4 w-4" />}
        iconColor="text-orange-500"
      />

      {/* Coproducer */}
      <PartnerSection
        checkoutId={checkoutId}
        partnerType="coproducer"
        title="Co-produtor"
        description="Parceiro que ajuda na criação/promoção e recebe % de cada venda"
        icon={<Users2 className="h-4 w-4" />}
        iconColor="text-green-500"
      />
    </div>
  );
}
