import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LeadSearchSelect } from '@/components/sales/LeadSearchSelect';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { 
  User, 
  ShoppingBag, 
  Loader2, 
  CheckCircle2,
  Link2
} from 'lucide-react';

interface Lead {
  id: string;
  name: string;
  whatsapp: string;
  email: string | null;
  cpf_cnpj?: string | null;
  city: string | null;
  state: string | null;
  street: string | null;
  street_number: string | null;
  complement: string | null;
  neighborhood: string | null;
  cep: string | null;
}

interface Sale {
  id: string;
  total_cents: number;
  payment_status: string;
  created_at: string;
  status: string;
  products?: { name: string }[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: {
    id: string;
    amount_cents: number;
    base_amount_cents?: number | null;
    interest_amount_cents?: number | null;
    payment_link_id?: string | null;
    customer_name: string | null;
  };
}

export function LinkTransactionToSaleDialog({ open, onOpenChange, transaction }: Props) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  
  const [leadId, setLeadId] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);

  // Fetch unpaid sales for the selected lead
  const { data: unpaidSales, isLoading: loadingSales } = useQuery({
    queryKey: ['unpaid-sales-for-link', leadId, profile?.organization_id],
    queryFn: async () => {
      if (!leadId || !profile?.organization_id) return [];
      
      const { data, error } = await supabase
        .from('sales')
        .select(`
          id,
          total_cents,
          payment_status,
          created_at,
          status,
          sale_items (
            product_name
          )
        `)
        .eq('organization_id', profile.organization_id)
        .eq('lead_id', leadId)
        .in('payment_status', ['pending', 'not_paid', 'paid_now', 'will_pay_before'])
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return (data || []).map((sale: any) => ({
        id: sale.id,
        total_cents: sale.total_cents,
        payment_status: sale.payment_status,
        created_at: sale.created_at,
        status: sale.status,
        products: sale.sale_items?.map((item: any) => ({ name: item.product_name })) || []
      })) as Sale[];
    },
    enabled: !!leadId && !!profile?.organization_id,
  });

  // Mutation to link transaction to sale
  const linkMutation = useMutation({
    mutationFn: async ({ transactionId, saleId }: { transactionId: string; saleId: string }) => {
      // Update the transaction with the sale_id
      const { error: txError } = await supabase
        .from('payment_link_transactions')
        .update({ 
          sale_id: saleId,
          lead_id: leadId 
        })
        .eq('id', transactionId);
      
      if (txError) throw txError;

      // Determine if we need to adjust sale value based on interest bearer
      let saleUpdateData: Record<string, any> = {
        payment_status: 'paid',
        payment_confirmed_at: new Date().toISOString(),
        payment_notes: `Vinculado à transação #${transactionId.slice(0, 8)}`,
      };

      // If company absorbs interest, update sale total to base amount (without interest)
      const interestAmount = transaction.interest_amount_cents || 0;
      if (interestAmount > 0 && transaction.payment_link_id) {
        const { data: linkData } = await supabase
          .from('payment_links')
          .select('interest_bearer')
          .eq('id', transaction.payment_link_id)
          .single();

        if (linkData?.interest_bearer === 'seller') {
          // Company pays interest: sale value = base amount (what we actually receive)
          const baseAmount = transaction.base_amount_cents || (transaction.amount_cents - interestAmount);
          saleUpdateData.total_cents = baseAmount;
          saleUpdateData.payment_notes = `Vinculado à transação #${transactionId.slice(0, 8)} | Juros absorvidos pela empresa: ${formatCurrency(interestAmount)}`;
        }
        // If client pays interest: sale value stays the same (interest goes to bank, not revenue)
      }

      const { error: saleError } = await supabase
        .from('sales')
        .update(saleUpdateData)
        .eq('id', saleId);
      
      if (saleError) throw saleError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-link-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['unpaid-sales-for-link'] });
      toast.success('Transação vinculada à venda com sucesso!');
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleLeadChange = (id: string | null, lead: Lead | null) => {
    setLeadId(id);
    setSelectedLead(lead);
    setSelectedSaleId(null);
  };

  const handleLink = () => {
    if (!selectedSaleId) return;
    linkMutation.mutate({ transactionId: transaction.id, saleId: selectedSaleId });
  };

  const formatCurrency = (cents: number) => {
    return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const resetState = () => {
    setLeadId(null);
    setSelectedLead(null);
    setSelectedSaleId(null);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetState(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Vincular a uma Venda
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Transaction info */}
          <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
            <div className="text-sm text-muted-foreground">Transação</div>
            <div className="font-medium">{formatCurrency(transaction.amount_cents)}</div>
            {transaction.customer_name && (
              <div className="text-sm text-muted-foreground">{transaction.customer_name}</div>
            )}
          </div>

          {/* Lead Search */}
          <div>
            <label className="text-sm font-medium mb-2 block">Buscar Cliente</label>
            <LeadSearchSelect
              value={leadId}
              onChange={handleLeadChange}
              placeholder="Buscar por nome ou telefone..."
            />
          </div>

          {/* Selected Lead Info */}
          {selectedLead && (
            <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span className="font-medium">{selectedLead.name}</span>
              </div>
              <div className="text-muted-foreground">{selectedLead.whatsapp}</div>
            </div>
          )}

          {/* Sales List */}
          {leadId && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Vendas Pendentes</label>
              
              {loadingSales ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : unpaidSales && unpaidSales.length > 0 ? (
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {unpaidSales.map((sale) => (
                    <div
                      key={sale.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedSaleId === sale.id 
                          ? 'border-primary bg-primary/5' 
                          : 'hover:border-primary/50'
                      }`}
                      onClick={() => setSelectedSaleId(sale.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{formatCurrency(sale.total_cents)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {sale.payment_status === 'not_paid' ? 'Não pago' : 
                             sale.payment_status === 'paid_now' ? 'Pago na hora' :
                             sale.payment_status === 'will_pay_before' ? 'Pagará antes' : 'Pendente'}
                          </Badge>
                          {selectedSaleId === sale.id && (
                            <CheckCircle2 className="h-4 w-4 text-primary" />
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {format(new Date(sale.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        {sale.products && sale.products.length > 0 && (
                          <span className="ml-2">• {sale.products.map(p => p.name).join(', ')}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  <ShoppingBag className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  Nenhuma venda pendente encontrada
                </div>
              )}
            </div>
          )}

          {/* Action Button */}
          <Button 
            className="w-full" 
            onClick={handleLink}
            disabled={!selectedSaleId || linkMutation.isPending}
          >
            {linkMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Vinculando...
              </>
            ) : (
              <>
                <Link2 className="h-4 w-4 mr-2" />
                Vincular Transação à Venda
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
