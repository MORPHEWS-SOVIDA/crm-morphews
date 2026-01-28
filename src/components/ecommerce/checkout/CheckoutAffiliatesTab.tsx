import { useState } from 'react';
import { Users, Plus, Trash2, Copy, Link2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  useCheckoutAffiliates,
  useOrganizationAffiliates,
  useLinkAffiliateToCheckout,
  useUnlinkAffiliateFromCheckout,
} from '@/hooks/ecommerce/useAffiliateLinks';
import { useMutation, useQueryClient } from '@tanstack/react-query';

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
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  
  const { data: linkedAffiliates, isLoading } = useCheckoutAffiliates(checkoutId);
  const { data: allAffiliates } = useOrganizationAffiliates();
  const linkAffiliate = useLinkAffiliateToCheckout();
  const unlinkAffiliate = useUnlinkAffiliateFromCheckout();
  
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedAffiliateId, setSelectedAffiliateId] = useState<string>('');

  // Afiliados que ainda NÃO estão vinculados a ESTE checkout específico
  // Mostramos TODOS os afiliados únicos, exceto os que já estão vinculados a este checkout
  const availableAffiliates = allAffiliates?.filter(
    (a) => !linkedAffiliates?.some(la => la.virtual_account_id === a.virtual_account_id)
  ) || [];

  const handleAddAffiliate = () => {
    if (!selectedAffiliateId) return;
    
    linkAffiliate.mutate({
      affiliateId: selectedAffiliateId,
      checkoutId,
    }, {
      onSuccess: () => {
        setShowAddDialog(false);
        setSelectedAffiliateId('');
      }
    });
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
            <Button size="sm" onClick={() => setShowAddDialog(true)}>
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
                      onClick={() => handleRemoveAffiliate(affiliate.id)}
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
              Selecione um afiliado para vincular a este checkout
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {availableAffiliates.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Todos os afiliados já estão vinculados ou não há afiliados cadastrados.
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
              onClick={handleAddAffiliate} 
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
