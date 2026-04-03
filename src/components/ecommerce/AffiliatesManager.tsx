import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Plus, Users, Copy, Trash2, Check, X, UserCheck, Clock, CheckCircle, XCircle, Search, ExternalLink, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface OrgAffiliate {
  id: string;
  organization_id: string;
  email: string;
  name: string;
  phone: string | null;
  affiliate_code: string;
  default_commission_type: string;
  default_commission_value: number;
  is_active: boolean;
  user_id: string | null;
  created_at: string;
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

export function AffiliatesManager() {
  const { profile } = useAuth();
  const organizationId = profile?.organization_id;
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [editAffiliate, setEditAffiliate] = useState<OrgAffiliate | null>(null);
  const [editCommType, setEditCommType] = useState('percentage');
  const [editCommValue, setEditCommValue] = useState('10');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    commission_type: 'percentage',
    commission_value: 10,
  });

  // Fetch organization_affiliates (V2)
  const { data: affiliates = [], isLoading } = useQuery({
    queryKey: ['org-affiliates-v2', organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organization_affiliates')
        .select('*')
        .eq('organization_id', organizationId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as OrgAffiliate[];
    },
  });

  // Fetch storefronts for registration links
  const { data: storefronts = [] } = useQuery({
    queryKey: ['storefronts-aff', organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_storefronts')
        .select('id, name, slug, external_site_url')
        .eq('organization_id', organizationId!)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch org slug for registration URLs
  const { data: orgSlug } = useQuery({
    queryKey: ['org-slug', organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data } = await supabase
        .from('organizations')
        .select('slug')
        .eq('id', organizationId!)
        .single();
      return data?.slug || '';
    },
  });

  // Approve
  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('organization_affiliates')
        .update({ is_active: true })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-affiliates-v2'] });
      toast.success('Afiliado aprovado!');
    },
    onError: () => toast.error('Erro ao aprovar'),
  });

  // Reject (delete)
  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('organization_affiliates')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-affiliates-v2'] });
      toast.success('Solicitação rejeitada');
    },
    onError: () => toast.error('Erro ao rejeitar'),
  });

  // Update
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const { error } = await supabase
        .from('organization_affiliates')
        .update(data)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-affiliates-v2'] });
      toast.success('Afiliado atualizado!');
      setEditAffiliate(null);
    },
    onError: () => toast.error('Erro ao atualizar'),
  });

  // Deactivate
  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('organization_affiliates')
        .update({ is_active: false })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-affiliates-v2'] });
      toast.success('Afiliado desativado');
    },
    onError: () => toast.error('Erro ao desativar'),
  });

  // Create manual affiliate
  const createMutation = useMutation({
    mutationFn: async (input: typeof formData) => {
      const { error } = await supabase
        .from('organization_affiliates')
        .insert({
          organization_id: organizationId!,
          email: input.email.toLowerCase().trim(),
          name: input.name.trim(),
          phone: input.phone || null,
          default_commission_type: input.commission_type,
          default_commission_value: input.commission_value,
          is_active: true,
          affiliate_code: 'TEMP', // trigger will override
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-affiliates-v2'] });
      toast.success('Afiliado criado!');
      setFormOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Delete
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('organization_affiliates')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-affiliates-v2'] });
      toast.success('Afiliado removido');
      setDeleteId(null);
    },
    onError: () => toast.error('Erro ao remover'),
  });

  const pending = affiliates.filter(a => !a.is_active);
  const active = affiliates.filter(a => a.is_active);

  const filtered = (list: OrgAffiliate[]) => {
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(a =>
      a.name.toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q) ||
      a.affiliate_code.toLowerCase().includes(q)
    );
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado!');
  };

  const openEdit = (aff: OrgAffiliate) => {
    setEditAffiliate(aff);
    setEditCommType(aff.default_commission_type);
    setEditCommValue(String(aff.default_commission_value));
  };

  const handleSaveEdit = () => {
    if (!editAffiliate) return;
    updateMutation.mutate({
      id: editAffiliate.id,
      data: {
        default_commission_type: editCommType,
        default_commission_value: parseFloat(editCommValue) || 10,
      },
    });
  };

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Card key={i}><CardContent className="p-4"><Skeleton className="h-12 w-full" /></CardContent></Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="flex items-center gap-3">
        <Badge variant="outline" className="gap-1 text-sm py-1 px-3">
          <Clock className="h-3 w-3" /> {pending.length} pendentes
        </Badge>
        <Badge variant="default" className="gap-1 text-sm py-1 px-3">
          <Users className="h-3 w-3" /> {active.length} ativos
        </Badge>
      </div>

      {/* Registration Links */}
      {orgSlug && storefronts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Links de Cadastro de Afiliados
            </CardTitle>
            <CardDescription>Compartilhe para afiliados se cadastrarem. Cada link é por loja.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {storefronts.map(sf => {
                const url = `${baseUrl}/cadastro-afiliado/${orgSlug}/${sf.slug}`;
                return (
                  <div key={sf.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant="secondary" className="shrink-0">{sf.name}</Badge>
                      <span className="text-xs text-muted-foreground truncate">{url}</span>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" onClick={() => copyText(url)} title="Copiar">
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => window.open(url, '_blank')} title="Abrir">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search + Create */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, email ou código..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => { setFormData({ name: '', email: '', phone: '', commission_type: 'percentage', commission_value: 10 }); setFormOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> Novo Afiliado
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue={pending.length > 0 ? 'pending' : 'active'}>
        <TabsList>
          <TabsTrigger value="pending" className="gap-1">
            <Clock className="h-4 w-4" /> Pendentes ({pending.length})
          </TabsTrigger>
          <TabsTrigger value="active" className="gap-1">
            <CheckCircle className="h-4 w-4" /> Ativos ({active.length})
          </TabsTrigger>
        </TabsList>

        {/* Pending */}
        <TabsContent value="pending" className="mt-4">
          {filtered(pending).length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhuma solicitação pendente</CardContent></Card>
          ) : (
            <div className="grid gap-3">
              {filtered(pending).map(aff => (
                <Card key={aff.id}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{aff.name}</span>
                          <Badge variant="outline" className="text-xs">{aff.affiliate_code}</Badge>
                          <Badge variant="secondary" className="text-xs">Aguardando aprovação</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">{aff.email}</div>
                        {aff.phone && <div className="text-sm text-muted-foreground">{aff.phone}</div>}
                        <div className="text-xs text-muted-foreground">
                          Solicitado em {format(new Date(aff.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="destructive" onClick={() => rejectMutation.mutate(aff.id)} disabled={rejectMutation.isPending}>
                          <XCircle className="h-4 w-4 mr-1" /> Rejeitar
                        </Button>
                        <Button size="sm" onClick={() => approveMutation.mutate(aff.id)} disabled={approveMutation.isPending}>
                          <CheckCircle className="h-4 w-4 mr-1" /> Aprovar
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Active */}
        <TabsContent value="active" className="mt-4">
          {filtered(active).length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhum afiliado ativo</h3>
                <p className="text-muted-foreground mb-4">Cadastre afiliados ou aprove solicitações pendentes</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {filtered(active).map(aff => (
                <Card key={aff.id}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{aff.name}</span>
                          <Badge variant="default" className="text-xs">{aff.affiliate_code}</Badge>
                          <Badge variant="secondary" className="text-xs">
                            {aff.default_commission_type === 'percentage'
                              ? `${aff.default_commission_value}%`
                              : `R$ ${(aff.default_commission_value / 100).toFixed(2)}`}
                          </Badge>
                          {aff.user_id && (
                            <Badge variant="outline" className="text-xs gap-1">
                              <UserCheck className="h-3 w-3" /> Vinculado
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">{aff.email}</div>
                        {aff.phone && <div className="text-sm text-muted-foreground">{aff.phone}</div>}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => copyText(aff.affiliate_code)} title="Copiar código">
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openEdit(aff)}>
                          Editar
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deactivateMutation.mutate(aff.id)} disabled={deactivateMutation.isPending}>
                          Desativar
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Afiliado</DialogTitle>
            <DialogDescription>Cadastre manualmente um afiliado (já aprovado)</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} placeholder="Nome completo" />
            </div>
            <div className="space-y-2">
              <Label>E-mail *</Label>
              <Input type="email" value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} placeholder="email@exemplo.com" />
            </div>
            <div className="space-y-2">
              <Label>WhatsApp</Label>
              <Input value={formData.phone} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))} placeholder="(11) 99999-9999" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tipo Comissão</Label>
                <Select value={formData.commission_type} onValueChange={v => setFormData(p => ({ ...p, commission_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentual (%)</SelectItem>
                    <SelectItem value="fixed">Fixo (centavos)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Valor</Label>
                <Input type="number" value={formData.commission_value} onChange={e => setFormData(p => ({ ...p, commission_value: Number(e.target.value) }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button onClick={() => createMutation.mutate(formData)} disabled={!formData.name || !formData.email || createMutation.isPending}>
              Cadastrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editAffiliate} onOpenChange={() => setEditAffiliate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Afiliado - {editAffiliate?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Código</Label>
              <Input value={editAffiliate?.affiliate_code || ''} disabled />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input value={editAffiliate?.email || ''} disabled />
            </div>
            <div className="space-y-2">
              <Label>Tipo de Comissão</Label>
              <Select value={editCommType} onValueChange={setEditCommType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentual (%)</SelectItem>
                  <SelectItem value="fixed">Fixo (centavos)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{editCommType === 'percentage' ? 'Comissão (%)' : 'Comissão (centavos)'}</Label>
              <Input type="number" value={editCommValue} onChange={e => setEditCommValue(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditAffiliate(null)}>Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={updateMutation.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover afiliado?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
