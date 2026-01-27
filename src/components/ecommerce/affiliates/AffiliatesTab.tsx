import { useState } from 'react';
import { Users, Copy, Link2, Info, Percent, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type AssetType = 'checkout' | 'landing' | 'storefront' | 'quiz';

interface AffiliatesTabProps {
  assetType: AssetType;
  assetId: string;
  assetSlug: string;
  attributionModel?: string;
  onAttributionModelChange?: (model: string) => void;
}

interface AffiliateData {
  id: string;
  affiliate_code: string;
  partner_type: string;
  commission_type: string;
  commission_value: number;
  is_active: boolean;
  virtual_account_id: string;
  virtual_account: {
    id: string;
    holder_name: string;
    holder_email: string;
  } | null;
}

interface LinkedAffiliate extends AffiliateData {
  linkId: string;
  customCommissionValue?: number;
}

function formatCommission(type: string, value: number) {
  if (type === 'percentage') return `${value}%`;
  return `R$ ${(value / 100).toFixed(2)}`;
}

function getAssetLinkPrefix(assetType: AssetType): string {
  switch (assetType) {
    case 'checkout': return '/pay/';
    case 'landing': return '/l/';
    case 'storefront': return '/loja/';
    case 'quiz': return '/quiz/';
    default: return '/';
  }
}

function getLinkedColumnName(assetType: AssetType): string {
  switch (assetType) {
    case 'checkout': return 'linked_checkout_id';
    case 'landing': return 'linked_landing_id';
    case 'storefront': return 'linked_storefront_id';
    case 'quiz': return 'linked_quiz_id';
    default: return '';
  }
}

// Hook para buscar afiliados vinculados a um asset
function useAssetAffiliates(assetType: AssetType, assetId: string | null) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['asset-affiliates', assetType, assetId],
    queryFn: async (): Promise<LinkedAffiliate[]> => {
      if (!assetId || !profile?.organization_id) return [];

      let query = supabase
        .from('partner_associations')
        .select(`
          id,
          affiliate_code,
          partner_type,
          commission_type,
          commission_value,
          is_active,
          virtual_account_id,
          virtual_account:virtual_accounts(id, holder_name, holder_email)
        `)
        .eq('organization_id', profile.organization_id);

      // Apply the correct filter based on asset type
      if (assetType === 'checkout') {
        query = query.eq('linked_checkout_id', assetId);
      } else if (assetType === 'landing') {
        query = query.eq('linked_landing_id', assetId);
      } else if (assetType === 'storefront') {
        query = query.eq('linked_storefront_id', assetId);
      } else if (assetType === 'quiz') {
        query = query.eq('linked_quiz_id', assetId);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      return (data || []).map((item: any) => ({
        ...item,
        linkId: item.id,
        customCommissionValue: item.commission_value,
      })) as LinkedAffiliate[];
    },
    enabled: !!assetId && !!profile?.organization_id,
  });
}

// Hook para buscar todos os afiliados da org (sem vínculo específico - gerais)
function useOrganizationAffiliates() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['organization-affiliates-all', profile?.organization_id],
    queryFn: async (): Promise<AffiliateData[]> => {
      if (!profile?.organization_id) return [];

      // Buscar afiliados gerais (sem vínculo específico)
      const { data, error } = await supabase
        .from('partner_associations')
        .select(`
          id,
          affiliate_code,
          partner_type,
          commission_type,
          commission_value,
          is_active,
          virtual_account_id,
          virtual_account:virtual_accounts(id, holder_name, holder_email)
        `)
        .eq('organization_id', profile.organization_id)
        .eq('partner_type', 'affiliate')
        .eq('is_active', true)
        .is('linked_checkout_id', null)
        .is('linked_landing_id', null)
        .is('linked_storefront_id', null)
        .is('linked_quiz_id', null);

      if (error) throw error;
      return (data || []) as unknown as AffiliateData[];
    },
    enabled: !!profile?.organization_id,
  });
}

export function AffiliatesTab({
  assetType,
  assetId,
  assetSlug,
  attributionModel = 'last_click',
  onAttributionModelChange,
}: AffiliatesTabProps) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const columnName = getLinkedColumnName(assetType);
  
  const { data: linkedAffiliates, isLoading } = useAssetAffiliates(assetType, assetId);
  const { data: allAffiliates, isLoading: isLoadingAll } = useOrganizationAffiliates();
  
  // Estado para edição de comissão
  const [editingCommission, setEditingCommission] = useState<string | null>(null);
  const [commissionValue, setCommissionValue] = useState<string>('');

  // Set de IDs de afiliados já vinculados
  const linkedVirtualAccountIds = new Set(
    linkedAffiliates?.map(la => la.virtual_account?.id).filter(Boolean) || []
  );

  // Toggle affiliate mutation
  const toggleAffiliate = useMutation({
    mutationFn: async ({ affiliate, isLinked }: { affiliate: AffiliateData; isLinked: boolean }) => {
      if (!profile?.organization_id) throw new Error('No organization');

      if (isLinked) {
        // Remove - encontrar o link e deletar
        const link = linkedAffiliates?.find(la => la.virtual_account?.id === affiliate.virtual_account?.id);
        if (link) {
          const { error } = await supabase
            .from('partner_associations')
            .delete()
            .eq('id', link.linkId);
          if (error) throw error;
        }
      } else {
        // Adicionar - criar nova associação
        const insertData = {
          virtual_account_id: affiliate.virtual_account_id,
          organization_id: profile.organization_id,
          partner_type: 'affiliate' as const,
          commission_type: affiliate.commission_type,
          commission_value: affiliate.commission_value,
          affiliate_code: affiliate.affiliate_code,
          is_active: true,
          linked_checkout_id: assetType === 'checkout' ? assetId : null,
          linked_landing_id: assetType === 'landing' ? assetId : null,
          linked_storefront_id: assetType === 'storefront' ? assetId : null,
          linked_quiz_id: assetType === 'quiz' ? assetId : null,
        };

        const { error } = await supabase
          .from('partner_associations')
          .insert([insertData]);

        if (error) throw error;
      }
    },
    onSuccess: (_, { isLinked }) => {
      queryClient.invalidateQueries({ queryKey: ['asset-affiliates', assetType, assetId] });
      toast.success(isLinked ? 'Afiliado removido' : 'Afiliado vinculado!');
    },
    onError: (error: any) => {
      console.error('Toggle affiliate error:', error);
      toast.error(error.message || 'Erro ao atualizar afiliado');
    },
  });

  // Update commission mutation
  const updateCommission = useMutation({
    mutationFn: async ({ linkId, newValue }: { linkId: string; newValue: number }) => {
      const { error } = await supabase
        .from('partner_associations')
        .update({ commission_value: newValue })
        .eq('id', linkId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset-affiliates', assetType, assetId] });
      toast.success('Comissão atualizada!');
      setEditingCommission(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao atualizar comissão');
    },
  });

  const handleCopyLink = (affiliateCode: string) => {
    const prefix = getAssetLinkPrefix(assetType);
    const link = `${window.location.origin}${prefix}${assetSlug}?ref=${affiliateCode}`;
    navigator.clipboard.writeText(link);
    toast.success('Link copiado!');
  };

  const handleSaveCommission = (linkId: string) => {
    const value = parseFloat(commissionValue);
    if (isNaN(value) || value < 0) {
      toast.error('Valor de comissão inválido');
      return;
    }
    updateCommission.mutate({ linkId, newValue: value });
  };

  const assetTypeLabel = {
    checkout: 'Checkout',
    landing: 'Landing Page',
    storefront: 'Loja',
    quiz: 'Quiz',
  }[assetType];

  // Combinar afiliados gerais com os já vinculados para mostrar lista completa
  const allAffiliatesList = allAffiliates || [];

  return (
    <div className="space-y-6">
      {/* Attribution Model */}
      {onAttributionModelChange && (
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
      )}

      {/* Lista de Afiliados com Checkboxes */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                Afiliados Disponíveis
              </CardTitle>
              <CardDescription>
                Marque os afiliados que podem promover este {assetTypeLabel.toLowerCase()}
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs">
              {linkedAffiliates?.length || 0} vinculados
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading || isLoadingAll ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : allAffiliatesList.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhum afiliado cadastrado</p>
              <p className="text-xs">Cadastre afiliados em E-commerce → Parceiros primeiro</p>
            </div>
          ) : (
            <div className="space-y-2">
              {allAffiliatesList.map((affiliate) => {
                const isLinked = linkedVirtualAccountIds.has(affiliate.virtual_account?.id);
                const linkedData = linkedAffiliates?.find(
                  la => la.virtual_account?.id === affiliate.virtual_account?.id
                );
                const isEditing = editingCommission === linkedData?.linkId;

                return (
                  <div
                    key={affiliate.id}
                    className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${
                      isLinked 
                        ? 'bg-primary/5 border-primary/30' 
                        : 'hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={isLinked}
                        onCheckedChange={() => {
                          toggleAffiliate.mutate({ affiliate, isLinked });
                        }}
                        disabled={toggleAffiliate.isPending}
                        className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                      />
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">
                            {affiliate.virtual_account?.holder_name || 'Afiliado'}
                          </span>
                          {isLinked && (
                            <Check className="h-4 w-4 text-primary" />
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {affiliate.virtual_account?.holder_email}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {isLinked && linkedData && (
                        <>
                          {isEditing ? (
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                step="0.01"
                                value={commissionValue}
                                onChange={(e) => setCommissionValue(e.target.value)}
                                className="w-20 h-8 text-sm"
                                placeholder="%"
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleSaveCommission(linkedData.linkId)}
                                disabled={updateCommission.isPending}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditingCommission(null)}
                              >
                                ✕
                              </Button>
                            </div>
                          ) : (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 gap-1 text-xs"
                                    onClick={() => {
                                      setEditingCommission(linkedData.linkId);
                                      setCommissionValue(String(linkedData.customCommissionValue || linkedData.commission_value));
                                    }}
                                  >
                                    <Percent className="h-3 w-3" />
                                    {formatCommission(linkedData.commission_type, linkedData.customCommissionValue || linkedData.commission_value)}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  Clique para editar comissão
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}

                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => handleCopyLink(linkedData.affiliate_code)}
                                  title="Copiar link"
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                Copiar link de afiliado
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </>
                      )}
                      
                      {!isLinked && (
                        <Badge variant="secondary" className="text-xs bg-muted text-muted-foreground">
                          {formatCommission(affiliate.commission_type, affiliate.commission_value)}
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Afiliados Vinculados - Links Rápidos */}
      {linkedAffiliates && linkedAffiliates.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              Links de Divulgação
            </CardTitle>
            <CardDescription>
              Links prontos para cada afiliado vinculado
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {linkedAffiliates.map((affiliate) => (
                <div
                  key={affiliate.linkId}
                  className="flex items-center justify-between p-2 bg-muted/50 rounded-md"
                >
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">{affiliate.virtual_account?.holder_name}</span>
                    <code className="bg-background px-1.5 py-0.5 rounded text-xs border">
                      ?ref={affiliate.affiliate_code}
                    </code>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopyLink(affiliate.affiliate_code)}
                    className="h-7 gap-1"
                  >
                    <Copy className="h-3 w-3" />
                    Copiar
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
