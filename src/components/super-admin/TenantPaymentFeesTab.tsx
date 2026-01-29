import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, Building2, Pencil, CreditCard, QrCode, FileText, Percent, DollarSign, Clock, Info } from 'lucide-react';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface Organization {
  id: string;
  name: string;
  slug: string;
}

interface TenantPaymentFees {
  id: string;
  organization_id: string;
  pix_fee_percentage: number;
  pix_fee_fixed_cents: number;
  pix_release_days: number;
  pix_enabled: boolean;
  card_fee_percentage: number;
  card_fee_fixed_cents: number;
  card_release_days: number;
  card_enabled: boolean;
  max_installments: number;
  installment_fees: Record<string, number>;
  installment_fee_passed_to_buyer: boolean;
  boleto_fee_percentage: number;
  boleto_fee_fixed_cents: number;
  boleto_release_days: number;
  boleto_enabled: boolean;
  boleto_expiration_days: number;
  allow_save_card: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const DEFAULT_INSTALLMENT_FEES: Record<string, number> = {
  "2": 3.49,
  "3": 4.29,
  "4": 4.99,
  "5": 5.49,
  "6": 5.99,
  "7": 6.49,
  "8": 6.99,
  "9": 7.49,
  "10": 7.99,
  "11": 8.49,
  "12": 8.99,
};

export function TenantPaymentFeesTab() {
  const queryClient = useQueryClient();
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingFees, setEditingFees] = useState<TenantPaymentFees | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    pix_fee_percentage: 1.5,
    pix_fee_fixed_cents: 0,
    pix_release_days: 2,
    pix_enabled: true,
    card_fee_percentage: 4.99,
    card_fee_fixed_cents: 100, // R$ 1,00 padrão para anti-fraude
    card_release_days: 14,
    card_enabled: true,
    max_installments: 12,
    installment_fees: DEFAULT_INSTALLMENT_FEES,
    installment_fee_passed_to_buyer: true,
    boleto_fee_percentage: 0,
    boleto_fee_fixed_cents: 350,
    boleto_release_days: 2,
    boleto_enabled: true,
    boleto_expiration_days: 3,
    allow_save_card: true,
    notes: '',
  });

  // Fetch organizations
  const { data: organizations, isLoading: orgsLoading } = useQuery({
    queryKey: ['super-admin-orgs-for-fees'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name, slug')
        .order('name');
      if (error) throw error;
      return data as Organization[];
    },
  });

  // Fetch all tenant fees
  const { data: allFees, isLoading: feesLoading } = useQuery({
    queryKey: ['all-tenant-payment-fees'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_payment_fees')
        .select('*');
      if (error) throw error;
      return data as TenantPaymentFees[];
    },
  });

  // Create/update fees
  const saveMutation = useMutation({
    mutationFn: async (data: { organization_id: string; fees: typeof formData }) => {
      const payload = {
        organization_id: data.organization_id,
        pix_fee_percentage: data.fees.pix_fee_percentage,
        pix_fee_fixed_cents: data.fees.pix_fee_fixed_cents,
        pix_release_days: data.fees.pix_release_days,
        pix_enabled: data.fees.pix_enabled,
        card_fee_percentage: data.fees.card_fee_percentage,
        card_fee_fixed_cents: data.fees.card_fee_fixed_cents,
        card_release_days: data.fees.card_release_days,
        card_enabled: data.fees.card_enabled,
        max_installments: data.fees.max_installments,
        installment_fees: data.fees.installment_fees,
        installment_fee_passed_to_buyer: data.fees.installment_fee_passed_to_buyer,
        boleto_fee_percentage: data.fees.boleto_fee_percentage,
        boleto_fee_fixed_cents: data.fees.boleto_fee_fixed_cents,
        boleto_release_days: data.fees.boleto_release_days,
        boleto_enabled: data.fees.boleto_enabled,
        boleto_expiration_days: data.fees.boleto_expiration_days,
        allow_save_card: data.fees.allow_save_card,
        notes: data.fees.notes || null,
      };

      // Check if exists
      const existing = allFees?.find(f => f.organization_id === data.organization_id);
      
      if (existing) {
        const { error } = await supabase
          .from('tenant_payment_fees')
          .update(payload)
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('tenant_payment_fees')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-tenant-payment-fees'] });
      toast.success('Taxas salvas com sucesso!');
      setShowEditDialog(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleEditOrg = (orgId: string) => {
    setSelectedOrgId(orgId);
    const existing = allFees?.find(f => f.organization_id === orgId);
    
    if (existing) {
      setFormData({
        pix_fee_percentage: Number(existing.pix_fee_percentage),
        pix_fee_fixed_cents: existing.pix_fee_fixed_cents,
        pix_release_days: existing.pix_release_days,
        pix_enabled: existing.pix_enabled,
        card_fee_percentage: Number(existing.card_fee_percentage),
        card_fee_fixed_cents: existing.card_fee_fixed_cents,
        card_release_days: existing.card_release_days,
        card_enabled: existing.card_enabled,
        max_installments: existing.max_installments,
        installment_fees: existing.installment_fees as Record<string, number>,
        installment_fee_passed_to_buyer: existing.installment_fee_passed_to_buyer,
        boleto_fee_percentage: Number(existing.boleto_fee_percentage),
        boleto_fee_fixed_cents: existing.boleto_fee_fixed_cents,
        boleto_release_days: existing.boleto_release_days,
        boleto_enabled: existing.boleto_enabled,
        boleto_expiration_days: existing.boleto_expiration_days,
        allow_save_card: existing.allow_save_card,
        notes: existing.notes || '',
      });
      setEditingFees(existing);
    } else {
      // Reset to defaults
      setFormData({
        pix_fee_percentage: 1.5,
        pix_fee_fixed_cents: 0,
        pix_release_days: 2,
        pix_enabled: true,
        card_fee_percentage: 4.99,
        card_fee_fixed_cents: 0,
        card_release_days: 14,
        card_enabled: true,
        max_installments: 12,
        installment_fees: DEFAULT_INSTALLMENT_FEES,
        installment_fee_passed_to_buyer: true,
        boleto_fee_percentage: 0,
        boleto_fee_fixed_cents: 350,
        boleto_release_days: 2,
        boleto_enabled: true,
        boleto_expiration_days: 3,
        allow_save_card: true,
        notes: '',
      });
      setEditingFees(null);
    }
    
    setShowEditDialog(true);
  };

  const handleSubmit = () => {
    if (!selectedOrgId) {
      toast.error('Selecione uma organização');
      return;
    }
    saveMutation.mutate({
      organization_id: selectedOrgId,
      fees: formData,
    });
  };

  const getOrgFees = (orgId: string) => allFees?.find(f => f.organization_id === orgId);
  const getOrgName = (orgId: string) => organizations?.find(o => o.id === orgId)?.name || orgId;

  if (orgsLoading || feesLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Percent className="h-5 w-5" />
            Taxas por Tenant
          </CardTitle>
          <CardDescription>
            Configure taxas específicas para cada organização. Taxas diferentes para PIX, Cartão e Boleto.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organização</TableHead>
                <TableHead className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <QrCode className="h-4 w-4" />
                    PIX
                  </div>
                </TableHead>
                <TableHead className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <CreditCard className="h-4 w-4" />
                    Cartão
                  </div>
                </TableHead>
                <TableHead className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <FileText className="h-4 w-4" />
                    Boleto
                  </div>
                </TableHead>
                <TableHead className="text-center">Parcelas</TableHead>
                <TableHead className="text-center">Liberação</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {organizations?.map((org) => {
                const fees = getOrgFees(org.id);
                return (
                  <TableRow key={org.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{org.name}</div>
                          <div className="text-xs text-muted-foreground">{org.slug}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {fees ? (
                        <div>
                          <Badge variant={fees.pix_enabled ? 'default' : 'secondary'}>
                            {fees.pix_fee_percentage}%
                          </Badge>
                          {fees.pix_fee_fixed_cents > 0 && (
                            <span className="text-xs text-muted-foreground ml-1">
                              + R${(fees.pix_fee_fixed_cents / 100).toFixed(2)}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Padrão</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {fees ? (
                        <div>
                          <Badge variant={fees.card_enabled ? 'default' : 'secondary'}>
                            {fees.card_fee_percentage}%
                          </Badge>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Padrão</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {fees ? (
                        <div>
                          <Badge variant={fees.boleto_enabled ? 'default' : 'secondary'}>
                            R${(fees.boleto_fee_fixed_cents / 100).toFixed(2)}
                          </Badge>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Padrão</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {fees ? (
                        <span className="text-sm">até {fees.max_installments}x</span>
                      ) : (
                        <span className="text-muted-foreground text-sm">12x</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {fees ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <div className="flex items-center gap-1 text-sm">
                                <Clock className="h-3 w-3" />
                                {fees.card_release_days}d
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>PIX: {fees.pix_release_days} dias</p>
                              <p>Cartão: {fees.card_release_days} dias</p>
                              <p>Boleto: {fees.boleto_release_days} dias</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <span className="text-muted-foreground text-sm">14d</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditOrg(org.id)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Configurar Taxas - {getOrgName(selectedOrgId)}
            </DialogTitle>
          </DialogHeader>
          
          <Tabs defaultValue="pix" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="pix" className="gap-1">
                <QrCode className="h-4 w-4" />
                PIX
              </TabsTrigger>
              <TabsTrigger value="card" className="gap-1">
                <CreditCard className="h-4 w-4" />
                Cartão
              </TabsTrigger>
              <TabsTrigger value="boleto" className="gap-1">
                <FileText className="h-4 w-4" />
                Boleto
              </TabsTrigger>
              <TabsTrigger value="general" className="gap-1">
                <Info className="h-4 w-4" />
                Geral
              </TabsTrigger>
            </TabsList>

            {/* PIX Tab */}
            <TabsContent value="pix" className="space-y-4 pt-4">
              <div className="flex items-center justify-between">
                <Label>PIX Habilitado</Label>
                <Switch
                  checked={formData.pix_enabled}
                  onCheckedChange={(v) => setFormData(prev => ({ ...prev, pix_enabled: v }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Taxa Percentual (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.pix_fee_percentage}
                    onChange={(e) => setFormData(prev => ({ ...prev, pix_fee_percentage: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Taxa Fixa (centavos)</Label>
                  <Input
                    type="number"
                    value={formData.pix_fee_fixed_cents}
                    onChange={(e) => setFormData(prev => ({ ...prev, pix_fee_fixed_cents: parseInt(e.target.value) || 0 }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Dias para Liberação</Label>
                <Input
                  type="number"
                  value={formData.pix_release_days}
                  onChange={(e) => setFormData(prev => ({ ...prev, pix_release_days: parseInt(e.target.value) || 2 }))}
                />
              </div>
            </TabsContent>

            {/* Card Tab */}
            <TabsContent value="card" className="space-y-4 pt-4">
              <div className="flex items-center justify-between">
                <Label>Cartão Habilitado</Label>
                <Switch
                  checked={formData.card_enabled}
                  onCheckedChange={(v) => setFormData(prev => ({ ...prev, card_enabled: v }))}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Taxa Percentual (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.card_fee_percentage}
                    onChange={(e) => setFormData(prev => ({ ...prev, card_fee_percentage: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Taxa Fixa (centavos)</Label>
                  <Input
                    type="number"
                    value={formData.card_fee_fixed_cents}
                    onChange={(e) => setFormData(prev => ({ ...prev, card_fee_fixed_cents: parseInt(e.target.value) || 0 }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    R$ {(formData.card_fee_fixed_cents / 100).toFixed(2)} (anti-fraude)
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Dias para Liberação</Label>
                  <Input
                    type="number"
                    value={formData.card_release_days}
                    onChange={(e) => setFormData(prev => ({ ...prev, card_release_days: parseInt(e.target.value) || 14 }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Máximo de Parcelas</Label>
                <Input
                  type="number"
                  min={1}
                  max={18}
                  value={formData.max_installments}
                  onChange={(e) => setFormData(prev => ({ ...prev, max_installments: parseInt(e.target.value) || 12 }))}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Juros Repassado ao Comprador</Label>
                  <p className="text-xs text-muted-foreground">
                    Se ativo, o comprador paga os juros do parcelamento
                  </p>
                </div>
                <Switch
                  checked={formData.installment_fee_passed_to_buyer}
                  onCheckedChange={(v) => setFormData(prev => ({ ...prev, installment_fee_passed_to_buyer: v }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Taxas por Parcela (%)</Label>
                <div className="grid grid-cols-6 gap-2">
                  {Array.from({ length: 11 }, (_, i) => i + 2).map(num => (
                    <div key={num} className="space-y-1">
                      <Label className="text-xs">{num}x</Label>
                      <Input
                        type="number"
                        step="0.01"
                        className="h-8 text-xs"
                        value={formData.installment_fees[String(num)] || 0}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          installment_fees: {
                            ...prev.installment_fees,
                            [String(num)]: parseFloat(e.target.value) || 0,
                          },
                        }))}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* Boleto Tab */}
            <TabsContent value="boleto" className="space-y-4 pt-4">
              <div className="flex items-center justify-between">
                <Label>Boleto Habilitado</Label>
                <Switch
                  checked={formData.boleto_enabled}
                  onCheckedChange={(v) => setFormData(prev => ({ ...prev, boleto_enabled: v }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Taxa Percentual (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.boleto_fee_percentage}
                    onChange={(e) => setFormData(prev => ({ ...prev, boleto_fee_percentage: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Taxa Fixa (centavos)</Label>
                  <Input
                    type="number"
                    value={formData.boleto_fee_fixed_cents}
                    onChange={(e) => setFormData(prev => ({ ...prev, boleto_fee_fixed_cents: parseInt(e.target.value) || 0 }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    R$ {(formData.boleto_fee_fixed_cents / 100).toFixed(2)}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Dias para Liberação</Label>
                  <Input
                    type="number"
                    value={formData.boleto_release_days}
                    onChange={(e) => setFormData(prev => ({ ...prev, boleto_release_days: parseInt(e.target.value) || 2 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Validade do Boleto (dias)</Label>
                  <Input
                    type="number"
                    value={formData.boleto_expiration_days}
                    onChange={(e) => setFormData(prev => ({ ...prev, boleto_expiration_days: parseInt(e.target.value) || 3 }))}
                  />
                </div>
              </div>
            </TabsContent>

            {/* General Tab */}
            <TabsContent value="general" className="space-y-4 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Permitir Salvar Cartão</Label>
                  <p className="text-xs text-muted-foreground">
                    Habilita One-Click para compras futuras
                  </p>
                </div>
                <Switch
                  checked={formData.allow_save_card}
                  onCheckedChange={(v) => setFormData(prev => ({ ...prev, allow_save_card: v }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Observações</Label>
                <Input
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Notas internas sobre este tenant..."
                />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Salvando...' : 'Salvar Taxas'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
