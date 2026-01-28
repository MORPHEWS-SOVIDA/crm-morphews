import { useState } from 'react';
import { Users, Plus, Trash2, Copy, Link2, Info, Mail, Search, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
  useCheckoutAffiliatesV2,
  useOrganizationAffiliatesV2,
  useLinkAffiliateToCheckoutV2,
  useUnlinkAffiliateFromCheckoutV2,
  useCreateAffiliate,
  useFindAffiliateByEmail,
  useUpdateCheckoutAffiliateCommission,
} from '@/hooks/ecommerce/useOrganizationAffiliatesV2';

interface CheckoutAffiliatesTabProps {
  checkoutId: string;
  checkoutSlug: string;
  attributionModel: string;
  onAttributionModelChange: (model: string) => void;
}

function formatCommission(type: string, value: number) {
  if (type === 'percentage') return `${value}%`;
  return `R$ ${(value / 100).toFixed(2)}`;
}

export function CheckoutAffiliatesTab({
  checkoutId,
  checkoutSlug,
  attributionModel,
  onAttributionModelChange,
}: CheckoutAffiliatesTabProps) {
  const { data: linkedAffiliates, isLoading } = useCheckoutAffiliatesV2(checkoutId);
  const { data: allAffiliates } = useOrganizationAffiliatesV2();
  const linkAffiliate = useLinkAffiliateToCheckoutV2();
  const unlinkAffiliate = useUnlinkAffiliateFromCheckoutV2();
  const createAffiliate = useCreateAffiliate();
  const findByEmail = useFindAffiliateByEmail();
  const updateCommission = useUpdateCheckoutAffiliateCommission();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addMode, setAddMode] = useState<'select' | 'email' | 'new'>('select');
  
  // Select mode
  const [selectedAffiliateId, setSelectedAffiliateId] = useState<string>('');
  
  // Email search mode
  const [searchEmail, setSearchEmail] = useState('');
  const [foundAffiliate, setFoundAffiliate] = useState<any>(null);
  const [searchError, setSearchError] = useState('');
  
  // New affiliate mode
  const [newAffiliateEmail, setNewAffiliateEmail] = useState('');
  const [newAffiliateName, setNewAffiliateName] = useState('');
  const [newAffiliatePhone, setNewAffiliatePhone] = useState('');

  // Afiliados que ainda NÃO estão vinculados a este checkout
  const availableAffiliates = allAffiliates?.filter(
    (a) => !linkedAffiliates?.some(la => la.affiliate_id === a.id)
  ) || [];

  const resetDialog = () => {
    setSelectedAffiliateId('');
    setSearchEmail('');
    setFoundAffiliate(null);
    setSearchError('');
    setNewAffiliateEmail('');
    setNewAffiliateName('');
    setNewAffiliatePhone('');
    setAddMode('select');
  };

  const handleOpenDialog = () => {
    resetDialog();
    setShowAddDialog(true);
  };

  const handleSearchByEmail = async () => {
    if (!searchEmail.trim()) return;
    
    setSearchError('');
    setFoundAffiliate(null);
    
    try {
      const result = await findByEmail.mutateAsync(searchEmail);
      if (result) {
        // Verificar se já está vinculado
        const alreadyLinked = linkedAffiliates?.some(la => la.affiliate_id === result.id);
        if (alreadyLinked) {
          setSearchError('Este afiliado já está vinculado a este checkout');
        } else {
          setFoundAffiliate(result);
        }
      } else {
        setSearchError('Nenhum afiliado encontrado com este e-mail. Você pode cadastrar um novo.');
      }
    } catch (error) {
      setSearchError('Erro ao buscar afiliado');
    }
  };

  const handleLinkFoundAffiliate = () => {
    if (!foundAffiliate) return;
    
    linkAffiliate.mutate({
      affiliateId: foundAffiliate.id,
      checkoutId,
    }, {
      onSuccess: () => {
        setShowAddDialog(false);
        resetDialog();
      }
    });
  };

  const handleLinkSelected = () => {
    if (!selectedAffiliateId) return;
    
    linkAffiliate.mutate({
      affiliateId: selectedAffiliateId,
      checkoutId,
    }, {
      onSuccess: () => {
        setShowAddDialog(false);
        resetDialog();
      }
    });
  };

  const handleCreateAndLink = async () => {
    if (!newAffiliateEmail.trim() || !newAffiliateName.trim()) {
      toast.error('Preencha e-mail e nome do afiliado');
      return;
    }

    try {
      const newAffiliate = await createAffiliate.mutateAsync({
        email: newAffiliateEmail,
        name: newAffiliateName,
        phone: newAffiliatePhone || undefined,
      });

      // Vincular ao checkout
      await linkAffiliate.mutateAsync({
        affiliateId: newAffiliate.id,
        checkoutId,
      });

      setShowAddDialog(false);
      resetDialog();
    } catch (error) {
      // Erro já tratado pelo hook
    }
  };

  const handleRemoveAffiliate = (linkId: string) => {
    unlinkAffiliate.mutate({ linkId, checkoutId });
  };

  const handleCopyLink = (affiliateCode: string) => {
    const link = `${window.location.origin}/pay/${checkoutSlug}?ref=${affiliateCode}`;
    navigator.clipboard.writeText(link);
    toast.success('Link copiado!');
  };

  return (
    <div className="space-y-6">
      {/* Attribution Model */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Modelo de Atribuição</CardTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p><strong>Último clique:</strong> O afiliado que trouxe o cliente por último recebe a comissão.</p>
                  <p className="mt-2"><strong>Primeiro clique:</strong> O afiliado que apresentou o produto pela primeira vez recebe a comissão.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <CardDescription>
            Define qual afiliado recebe a comissão quando o cliente veio por múltiplos links
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Select value={attributionModel} onValueChange={onAttributionModelChange}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="last_click">Último Clique</SelectItem>
                <SelectItem value="first_click">Primeiro Clique</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">
              {attributionModel === 'last_click' 
                ? 'Afiliado mais recente ganha' 
                : 'Primeiro afiliado a indicar ganha'}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Linked Affiliates */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                Afiliados Vinculados
              </CardTitle>
              <CardDescription>
                Afiliados que podem promover este checkout
              </CardDescription>
            </div>
            <Button size="sm" onClick={handleOpenDialog}>
              <Plus className="h-4 w-4 mr-1" />
              Adicionar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : linkedAffiliates?.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhum afiliado vinculado</p>
              <p className="text-xs">Adicione afiliados para que possam promover este checkout</p>
            </div>
          ) : (
            <div className="space-y-3">
              {linkedAffiliates?.map((link) => (
                <div
                  key={link.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">
                        {link.affiliate?.name || 'Afiliado'}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {link.affiliate?.email}
                    </div>
                    <div className="flex items-center gap-1 text-xs">
                      <Link2 className="h-3 w-3 flex-shrink-0" />
                      <code className="bg-muted px-1.5 py-0.5 rounded truncate">
                        ?ref={link.affiliate?.affiliate_code}
                      </code>
                    </div>
                  </div>
                  
                  {/* Edição de comissão inline */}
                  <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                    <Select
                      value={link.commission_type}
                      onValueChange={(v) => {
                        updateCommission.mutate({
                          linkId: link.id,
                          checkoutId,
                          commissionType: v as 'percentage' | 'fixed',
                          commissionValue: link.commission_value,
                        });
                      }}
                    >
                      <SelectTrigger className="w-20 h-8 text-xs">
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
                      step={link.commission_type === 'percentage' ? '0.5' : '1'}
                      className="w-20 h-8 text-xs"
                      value={link.commission_value}
                      onChange={(e) => {
                        updateCommission.mutate({
                          linkId: link.id,
                          checkoutId,
                          commissionType: link.commission_type,
                          commissionValue: parseFloat(e.target.value) || 0,
                        });
                      }}
                    />
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => link.affiliate?.affiliate_code && handleCopyLink(link.affiliate.affiliate_code)}
                      title="Copiar link"
                      className="h-8 w-8"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveAffiliate(link.id)}
                      title="Remover"
                      className="text-destructive hover:text-destructive h-8 w-8"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Affiliate Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Afiliado</DialogTitle>
            <DialogDescription>
              Vincule um afiliado existente ou cadastre um novo
            </DialogDescription>
          </DialogHeader>

          <Tabs value={addMode} onValueChange={(v) => setAddMode(v as any)} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="select">Selecionar</TabsTrigger>
              <TabsTrigger value="email">Buscar por E-mail</TabsTrigger>
              <TabsTrigger value="new">Novo Afiliado</TabsTrigger>
            </TabsList>

            {/* Select from existing */}
            <TabsContent value="select" className="space-y-4 mt-4">
              {availableAffiliates.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum afiliado disponível. Cadastre um novo ou busque por e-mail.
                </p>
              ) : (
                <div className="space-y-2">
                  <Label>Selecione um afiliado</Label>
                  <Select value={selectedAffiliateId} onValueChange={setSelectedAffiliateId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um afiliado" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableAffiliates.map((affiliate) => (
                        <SelectItem key={affiliate.id} value={affiliate.id}>
                          <div className="flex items-center gap-2">
                            <span>{affiliate.name}</span>
                            <span className="text-muted-foreground text-xs">
                              ({formatCommission(affiliate.default_commission_type, affiliate.default_commission_value)})
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
                  disabled={!selectedAffiliateId || linkAffiliate.isPending}
                >
                  {linkAffiliate.isPending ? 'Adicionando...' : 'Adicionar'}
                </Button>
              </DialogFooter>
            </TabsContent>

            {/* Search by email */}
            <TabsContent value="email" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>E-mail do afiliado</Label>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="afiliado@exemplo.com"
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

              {foundAffiliate && (
                <div className="p-3 border rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-green-600" />
                    <span className="font-medium">{foundAffiliate.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {foundAffiliate.email} • {formatCommission(foundAffiliate.default_commission_type, foundAffiliate.default_commission_value)}
                  </p>
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleLinkFoundAffiliate} 
                  disabled={!foundAffiliate || linkAffiliate.isPending}
                >
                  {linkAffiliate.isPending ? 'Adicionando...' : 'Adicionar'}
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
                    placeholder="afiliado@exemplo.com"
                    value={newAffiliateEmail}
                    onChange={(e) => setNewAffiliateEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Nome *</Label>
                  <Input
                    placeholder="Nome do afiliado"
                    value={newAffiliateName}
                    onChange={(e) => setNewAffiliateName(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Telefone (opcional)</Label>
                  <Input
                    placeholder="(00) 00000-0000"
                    value={newAffiliatePhone}
                    onChange={(e) => setNewAffiliatePhone(e.target.value)}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleCreateAndLink} 
                  disabled={!newAffiliateEmail || !newAffiliateName || createAffiliate.isPending || linkAffiliate.isPending}
                >
                  <UserPlus className="h-4 w-4 mr-1" />
                  {createAffiliate.isPending ? 'Cadastrando...' : 'Cadastrar e Vincular'}
                </Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
