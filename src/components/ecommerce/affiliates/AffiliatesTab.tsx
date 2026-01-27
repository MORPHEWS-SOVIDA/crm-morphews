import { useState } from 'react';
import { Users, Plus, Trash2, Copy, Link2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

interface AffiliateLink {
  id: string;
  affiliate_code: string;
  partner_type: string;
  commission_type: string;
  commission_value: number;
  is_active: boolean;
  virtual_account: {
    id: string;
    holder_name: string;
    holder_email: string;
  } | null;
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
    queryFn: async (): Promise<AffiliateLink[]> => {
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
          virtual_account:virtual_accounts(id, holder_name, holder_email)
        `)
        .eq('organization_id', profile.organization_id)
        .eq('partner_type', 'affiliate');

      // Apply the correct filter based on asset type
      if (assetType === 'checkout') {
        query = query.eq('linked_checkout_id', assetId);
      } else if (assetType === 'landing') {
        query = query.eq('linked_landing_id', assetId);
      } else if (assetType === 'storefront') {
        // Storefront linking not yet supported in DB
        return [];
      } else if (assetType === 'quiz') {
        // Quiz linking not yet supported in DB
        return [];
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as unknown as AffiliateLink[];
    },
    enabled: !!assetId && !!profile?.organization_id,
  });
}

// Hook para buscar todos os afiliados da org (sem vínculo específico)
function useOrganizationAffiliates() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ['organization-affiliates-general', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      // Buscar afiliados que NÃO têm vínculo específico (são "gerais")
      const { data, error } = await supabase
        .from('partner_associations')
        .select(`
          id,
          affiliate_code,
          partner_type,
          commission_type,
          commission_value,
          linked_checkout_id,
          linked_landing_id,
          linked_product_id,
          is_active,
          virtual_account:virtual_accounts(id, holder_name, holder_email)
        `)
        .eq('organization_id', profile.organization_id)
        .eq('partner_type', 'affiliate')
        .eq('is_active', true)
        .is('linked_checkout_id', null)
        .is('linked_landing_id', null);

      if (error) throw error;
      return data as unknown as AffiliateLink[];
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
  const { data: allAffiliates } = useOrganizationAffiliates();
  
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedAffiliateId, setSelectedAffiliateId] = useState<string>('');

  // Link affiliate mutation
  const linkAffiliate = useMutation({
    mutationFn: async ({ affiliateId }: { affiliateId: string }) => {
      if (!profile?.organization_id) throw new Error('No organization');

      // Fetch the affiliate
      const { data: affiliate, error: fetchError } = await supabase
        .from('partner_associations')
        .select('*')
        .eq('id', affiliateId)
        .single();

      if (fetchError) throw fetchError;

      // Create new association linked to this specific asset
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
        linked_product_id: null,
      };

      const { error } = await supabase
        .from('partner_associations')
        .insert(insertData);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset-affiliates', assetType, assetId] });
      toast.success('Afiliado vinculado!');
      setShowAddDialog(false);
      setSelectedAffiliateId('');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao vincular afiliado');
    },
  });

  // Unlink affiliate mutation
  const unlinkAffiliate = useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await supabase
        .from('partner_associations')
        .delete()
        .eq('id', linkId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset-affiliates', assetType, assetId] });
      toast.success('Afiliado removido');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao remover afiliado');
    },
  });

  const handleCopyLink = (affiliateCode: string) => {
    const prefix = getAssetLinkPrefix(assetType);
    const link = `${window.location.origin}${prefix}${assetSlug}?ref=${affiliateCode}`;
    navigator.clipboard.writeText(link);
    toast.success('Link copiado!');
  };

  // Afiliados que ainda não estão vinculados a este asset
  const availableAffiliates = allAffiliates?.filter(
    (a) => !linkedAffiliates?.some(la => la.virtual_account?.id === a.virtual_account?.id)
  ) || [];

  const assetTypeLabel = {
    checkout: 'Checkout',
    landing: 'Landing Page',
    storefront: 'Loja',
    quiz: 'Quiz',
  }[assetType];

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
                Afiliados que podem promover este {assetTypeLabel.toLowerCase()}
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Adicionar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : linkedAffiliates?.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhum afiliado vinculado</p>
              <p className="text-xs">Adicione afiliados para que possam promover este {assetTypeLabel.toLowerCase()}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {linkedAffiliates?.map((affiliate) => (
                <div
                  key={affiliate.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {affiliate.virtual_account?.holder_name || 'Afiliado'}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {formatCommission(affiliate.commission_type, affiliate.commission_value)}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {affiliate.virtual_account?.holder_email}
                    </div>
                    <div className="flex items-center gap-1 text-xs">
                      <Link2 className="h-3 w-3" />
                      <code className="bg-muted px-1.5 py-0.5 rounded">
                        ?ref={affiliate.affiliate_code}
                      </code>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleCopyLink(affiliate.affiliate_code)}
                      title="Copiar link"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => unlinkAffiliate.mutate(affiliate.id)}
                      title="Remover"
                      className="text-destructive hover:text-destructive"
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Afiliado</DialogTitle>
            <DialogDescription>
              Selecione um afiliado para vincular a este {assetTypeLabel.toLowerCase()}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {availableAffiliates.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Todos os afiliados já estão vinculados ou não há afiliados cadastrados.
                <br />
                <span className="text-xs">
                  Cadastre afiliados em E-commerce → Afiliados antes de vinculá-los aqui.
                </span>
              </p>
            ) : (
              <Select value={selectedAffiliateId} onValueChange={setSelectedAffiliateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um afiliado" />
                </SelectTrigger>
                <SelectContent>
                  {availableAffiliates.map((affiliate) => (
                    <SelectItem key={affiliate.id} value={affiliate.id}>
                      <div className="flex items-center gap-2">
                        <span>{affiliate.virtual_account?.holder_name}</span>
                        <span className="text-muted-foreground text-xs">
                          ({formatCommission(affiliate.commission_type, affiliate.commission_value)})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => linkAffiliate.mutate({ affiliateId: selectedAffiliateId })}
              disabled={!selectedAffiliateId || linkAffiliate.isPending}
            >
              {linkAffiliate.isPending ? 'Adicionando...' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
