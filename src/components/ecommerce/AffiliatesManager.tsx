import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Users, Copy, Trash2, Edit2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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

interface Affiliate {
  id: string;
  virtual_account_id: string;
  organization_id: string;
  affiliate_code: string;
  commission_percentage: number;
  commission_fixed_cents: number;
  is_active: boolean;
  total_sales: number;
  total_commission_cents: number;
  created_at: string;
  virtual_account?: {
    holder_name: string;
    holder_email: string;
    balance_cents: number;
  };
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

function generateAffiliateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export function AffiliatesManager() {
  const queryClient = useQueryClient();
  
  const { data: affiliates, isLoading } = useQuery({
    queryKey: ['affiliates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('affiliates')
        .select(`
          *,
          virtual_account:virtual_accounts(holder_name, holder_email, balance_cents)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as unknown as Affiliate[];
    },
  });

  const createAffiliate = useMutation({
    mutationFn: async (input: {
      name: string;
      email: string;
      document?: string;
      commission_percentage: number;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.organization_id) throw new Error('Organização não encontrada');

      // Create virtual account first
      const { data: account, error: accError } = await supabase
        .from('virtual_accounts')
        .insert({
          organization_id: profile.organization_id,
          account_type: 'affiliate',
          holder_name: input.name,
          holder_email: input.email,
          holder_document: input.document,
        })
        .select('id')
        .single();

      if (accError) throw accError;

      // Create affiliate
      const { data, error } = await supabase
        .from('affiliates')
        .insert({
          organization_id: profile.organization_id,
          virtual_account_id: account.id,
          affiliate_code: generateAffiliateCode(),
          commission_percentage: input.commission_percentage,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['affiliates'] });
      toast.success('Afiliado criado!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateAffiliate = useMutation({
    mutationFn: async ({ id, ...input }: { id: string; commission_percentage?: number; is_active?: boolean }) => {
      const { data, error } = await supabase
        .from('affiliates')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['affiliates'] });
      toast.success('Afiliado atualizado!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteAffiliate = useMutation({
    mutationFn: async (id: string) => {
      // Get virtual_account_id first
      const { data: affiliate } = await supabase
        .from('affiliates')
        .select('virtual_account_id')
        .eq('id', id)
        .single();

      // Delete affiliate
      const { error } = await supabase
        .from('affiliates')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Delete virtual account
      if (affiliate?.virtual_account_id) {
        await supabase
          .from('virtual_accounts')
          .delete()
          .eq('id', affiliate.virtual_account_id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['affiliates'] });
      toast.success('Afiliado removido');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const [formOpen, setFormOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    document: '',
    commission_percentage: 10,
  });

  const handleCreate = () => {
    setFormData({ name: '', email: '', document: '', commission_percentage: 10 });
    setFormOpen(true);
  };

  const handleSubmit = () => {
    createAffiliate.mutate(formData, {
      onSuccess: () => setFormOpen(false),
    });
  };

  const handleToggle = (affiliate: Affiliate) => {
    updateAffiliate.mutate({
      id: affiliate.id,
      is_active: !affiliate.is_active,
    });
  };

  const handleCopyLink = (code: string) => {
    const url = `${window.location.origin}?ref=${code}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copiado!');
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteAffiliate.mutate(deleteId, {
        onSuccess: () => setDeleteId(null),
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-12 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Afiliados</h3>
          <p className="text-sm text-muted-foreground">
            Gerencie afiliados e suas comissões
          </p>
        </div>
        <Button onClick={handleCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Afiliado
        </Button>
      </div>

      {affiliates?.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum afiliado</h3>
            <p className="text-muted-foreground mb-4">
              Cadastre afiliados para aumentar suas vendas
            </p>
            <Button onClick={handleCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              Cadastrar Afiliado
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {affiliates?.map((affiliate) => (
            <Card key={affiliate.id} className={!affiliate.is_active ? 'opacity-60' : ''}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {affiliate.virtual_account?.holder_name || 'Afiliado'}
                    </span>
                    <Badge variant="outline">
                      {affiliate.commission_percentage}%
                    </Badge>
                    {!affiliate.is_active && (
                      <Badge variant="secondary">Inativo</Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {affiliate.virtual_account?.holder_email}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Código: <strong>{affiliate.affiliate_code}</strong></span>
                    <span>Vendas: {affiliate.total_sales}</span>
                    <span>Comissões: {formatCurrency(affiliate.total_commission_cents)}</span>
                    <span>Saldo: {formatCurrency(affiliate.virtual_account?.balance_cents || 0)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopyLink(affiliate.affiliate_code)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggle(affiliate)}
                  >
                    {affiliate.is_active ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <X className="h-4 w-4 text-red-500" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteId(affiliate.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Afiliado</DialogTitle>
            <DialogDescription>
              Cadastre um novo afiliado para sua loja
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                placeholder="Nome completo"
              />
            </div>

            <div className="space-y-2">
              <Label>E-mail *</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                placeholder="email@exemplo.com"
              />
            </div>

            <div className="space-y-2">
              <Label>CPF/CNPJ (opcional)</Label>
              <Input
                value={formData.document}
                onChange={(e) => setFormData((p) => ({ ...p, document: e.target.value }))}
                placeholder="000.000.000-00"
              />
            </div>

            <div className="space-y-2">
              <Label>Comissão (%)</Label>
              <Input
                type="number"
                value={formData.commission_percentage}
                onChange={(e) => setFormData((p) => ({ ...p, commission_percentage: Number(e.target.value) }))}
                min={0}
                max={100}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!formData.name || !formData.email || createAffiliate.isPending}
            >
              Cadastrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover afiliado?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O saldo pendente será perdido.
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
