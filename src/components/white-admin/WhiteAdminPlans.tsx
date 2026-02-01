import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useMyWhiteLabelConfig, useWhiteLabelPlans, useCreateWhiteLabelPlan, useUpdateWhiteLabelPlan, WhiteLabelPlan } from '@/hooks/useWhiteAdmin';
import { Package, Plus, Edit, Users, Zap, MessageSquare, ShoppingCart, FileText, BarChart3 } from 'lucide-react';

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

const defaultPlan: Partial<WhiteLabelPlan> = {
  name: '',
  description: '',
  slug: '',
  price_cents: 9900,
  setup_fee_cents: 0,
  max_users: 1,
  max_leads: null,
  max_whatsapp_instances: 1,
  max_energy_per_month: 5000,
  max_ecommerce_products: 0,
  max_storefronts: 0,
  has_ai_bots: false,
  has_whatsapp: true,
  has_email_marketing: false,
  has_ecommerce: false,
  has_erp: false,
  has_tracking: false,
  has_nfe: false,
  is_active: true,
  is_public: true,
};

export function WhiteAdminPlans() {
  const { data: wlData } = useMyWhiteLabelConfig();
  const configId = wlData?.white_label_configs?.id;
  const { data: plans, isLoading } = useWhiteLabelPlans(configId);
  const createPlan = useCreateWhiteLabelPlan();
  const updatePlan = useUpdateWhiteLabelPlan();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Partial<WhiteLabelPlan> | null>(null);
  const [formData, setFormData] = useState<Partial<WhiteLabelPlan>>(defaultPlan);
  
  const primaryColor = wlData?.white_label_configs?.primary_color || '#8B5CF6';

  const handleOpenDialog = (plan?: WhiteLabelPlan) => {
    if (plan) {
      setEditingPlan(plan);
      setFormData(plan);
    } else {
      setEditingPlan(null);
      setFormData(defaultPlan);
    }
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (!configId) return;
    
    if (editingPlan?.id) {
      updatePlan.mutate({ id: editingPlan.id, updates: formData });
    } else {
      createPlan.mutate({
        ...formData,
        white_label_config_id: configId,
      } as WhiteLabelPlan);
    }
    setIsDialogOpen(false);
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Planos</h1>
          <p className="text-muted-foreground">Crie e gerencie os planos que você oferece aos seus clientes</p>
        </div>
        
        <Button onClick={() => handleOpenDialog()} style={{ backgroundColor: primaryColor }}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Plano
        </Button>
      </div>
      
      {/* Plans Grid */}
      {isLoading ? (
        <div className="text-center py-12">Carregando...</div>
      ) : plans?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-medium mb-2">Nenhum plano criado</h3>
            <p className="text-muted-foreground mb-4">
              Crie seus planos com preços e recursos personalizados.
            </p>
            <Button onClick={() => handleOpenDialog()} style={{ backgroundColor: primaryColor }}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Primeiro Plano
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {plans?.map((plan) => (
            <Card key={plan.id} className={!plan.is_active ? 'opacity-60' : ''}>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                    <CardDescription>{plan.description || 'Sem descrição'}</CardDescription>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(plan)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold">{formatCurrency(plan.price_cents)}</span>
                  <span className="text-muted-foreground">/mês</span>
                </div>
                
                {plan.setup_fee_cents > 0 && (
                  <p className="text-sm text-muted-foreground">
                    + {formatCurrency(plan.setup_fee_cents)} de setup
                  </p>
                )}
                
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>{plan.max_users} usuário(s)</span>
                  </div>
                  
                  {plan.has_whatsapp && (
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-green-500" />
                      <span>{plan.max_whatsapp_instances} WhatsApp</span>
                    </div>
                  )}
                  
                  {plan.has_ai_bots && (
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-amber-500" />
                      <span>{plan.max_energy_per_month.toLocaleString()} energia/mês</span>
                    </div>
                  )}
                  
                  {plan.has_ecommerce && (
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="h-4 w-4 text-blue-500" />
                      <span>E-commerce ({plan.max_ecommerce_products} produtos)</span>
                    </div>
                  )}
                  
                  {plan.has_nfe && (
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-purple-500" />
                      <span>Nota Fiscal</span>
                    </div>
                  )}
                  
                  {plan.has_tracking && (
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-cyan-500" />
                      <span>Tracking & Pixels</span>
                    </div>
                  )}
                </div>
                
                <div className="flex gap-2 pt-2">
                  {plan.is_public ? (
                    <Badge variant="secondary">Público</Badge>
                  ) : (
                    <Badge variant="outline">Privado</Badge>
                  )}
                  {!plan.is_active && (
                    <Badge variant="destructive">Inativo</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPlan ? 'Editar Plano' : 'Novo Plano'}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Nome do Plano</Label>
                <Input 
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ 
                      ...formData, 
                      name: e.target.value,
                      slug: editingPlan ? formData.slug : generateSlug(e.target.value)
                    });
                  }}
                  placeholder="Ex: Plano Starter"
                />
              </div>
              <div className="space-y-2">
                <Label>Slug (URL)</Label>
                <Input 
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="plano-starter"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea 
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descrição curta do plano..."
              />
            </div>
            
            {/* Pricing */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Preço Mensal (R$)</Label>
                <Input 
                  type="number"
                  value={(formData.price_cents || 0) / 100}
                  onChange={(e) => setFormData({ ...formData, price_cents: Math.round(parseFloat(e.target.value) * 100) })}
                  step="0.01"
                />
              </div>
              <div className="space-y-2">
                <Label>Taxa de Setup (R$)</Label>
                <Input 
                  type="number"
                  value={(formData.setup_fee_cents || 0) / 100}
                  onChange={(e) => setFormData({ ...formData, setup_fee_cents: Math.round(parseFloat(e.target.value) * 100) })}
                  step="0.01"
                />
              </div>
            </div>
            
            {/* Limits */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Máx. Usuários</Label>
                <Input 
                  type="number"
                  value={formData.max_users}
                  onChange={(e) => setFormData({ ...formData, max_users: parseInt(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>WhatsApp</Label>
                <Input 
                  type="number"
                  value={formData.max_whatsapp_instances}
                  onChange={(e) => setFormData({ ...formData, max_whatsapp_instances: parseInt(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Energia/mês</Label>
                <Input 
                  type="number"
                  value={formData.max_energy_per_month}
                  onChange={(e) => setFormData({ ...formData, max_energy_per_month: parseInt(e.target.value) })}
                />
              </div>
            </div>
            
            {/* Features */}
            <div className="space-y-4">
              <Label>Features Incluídas</Label>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <span>WhatsApp</span>
                  <Switch 
                    checked={formData.has_whatsapp}
                    onCheckedChange={(v) => setFormData({ ...formData, has_whatsapp: v })}
                  />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <span>IA & Robôs</span>
                  <Switch 
                    checked={formData.has_ai_bots}
                    onCheckedChange={(v) => setFormData({ ...formData, has_ai_bots: v })}
                  />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <span>E-commerce</span>
                  <Switch 
                    checked={formData.has_ecommerce}
                    onCheckedChange={(v) => setFormData({ ...formData, has_ecommerce: v })}
                  />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <span>ERP</span>
                  <Switch 
                    checked={formData.has_erp}
                    onCheckedChange={(v) => setFormData({ ...formData, has_erp: v })}
                  />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <span>Tracking & Pixels</span>
                  <Switch 
                    checked={formData.has_tracking}
                    onCheckedChange={(v) => setFormData({ ...formData, has_tracking: v })}
                  />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <span>Nota Fiscal</span>
                  <Switch 
                    checked={formData.has_nfe}
                    onCheckedChange={(v) => setFormData({ ...formData, has_nfe: v })}
                  />
                </div>
              </div>
            </div>
            
            {/* Visibility */}
            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <Switch 
                  checked={formData.is_active}
                  onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
                />
                <Label>Plano ativo</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch 
                  checked={formData.is_public}
                  onCheckedChange={(v) => setFormData({ ...formData, is_public: v })}
                />
                <Label>Visível na página de planos</Label>
              </div>
            </div>
            
            <Button 
              onClick={handleSave}
              className="w-full"
              style={{ backgroundColor: primaryColor }}
              disabled={!formData.name || !formData.slug || createPlan.isPending || updatePlan.isPending}
            >
              {editingPlan ? 'Salvar Alterações' : 'Criar Plano'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
