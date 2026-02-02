import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useMyWhiteLabelConfig, useWhiteLabelPlans, useCreateWhiteLabelPlan, useUpdateWhiteLabelPlan, WhiteLabelPlan } from '@/hooks/useWhiteAdmin';
import { Package, Plus, Edit, Users, Zap, MessageSquare, ShoppingCart, FileText, BarChart3, AlertTriangle, DollarSign, TrendingUp } from 'lucide-react';

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

// ===== REGRAS DE CUSTO PARA PLATAFORMA =====
// Custos que a plataforma (super-admin) terá com cada cliente white label
const PLATFORM_COSTS = {
  // WhatsApp: 1 instância incluída, cada adicional +R$ 50/mês
  WHATSAPP_BASE_INCLUDED: 1,
  WHATSAPP_ADDITIONAL_COST_CENTS: 5000, // R$ 50,00
  
  // Energia: base de 1000 incluída (custo zero), acima disso não temos custo extra por enquanto
  ENERGY_BASE_INCLUDED: 1000,
  
  // Nota Fiscal: +R$ 150/mês (inclui 100 notas, R$ 0,10 por adicional)
  NFE_MONTHLY_COST_CENTS: 15000, // R$ 150,00
  NFE_INCLUDED_INVOICES: 100,
  NFE_ADDITIONAL_COST_CENTS: 10, // R$ 0,10 por nota adicional
  
  // Tracking & Pixels: +R$ 125/mês
  TRACKING_MONTHLY_COST_CENTS: 12500, // R$ 125,00
  
  // Usuários: 3 incluídos, cada adicional +R$ 2/mês
  USERS_BASE_INCLUDED: 3,
  USER_ADDITIONAL_COST_CENTS: 200, // R$ 2,00
};

// Calcula o custo mínimo que a plataforma terá
function calculatePlatformCost(plan: Partial<WhiteLabelPlan>): number {
  let costCents = 0;
  
  // WhatsApp adicional
  const whatsappInstances = plan.max_whatsapp_instances || 1;
  if (whatsappInstances > PLATFORM_COSTS.WHATSAPP_BASE_INCLUDED) {
    costCents += (whatsappInstances - PLATFORM_COSTS.WHATSAPP_BASE_INCLUDED) * PLATFORM_COSTS.WHATSAPP_ADDITIONAL_COST_CENTS;
  }
  
  // Nota Fiscal
  if (plan.has_nfe) {
    costCents += PLATFORM_COSTS.NFE_MONTHLY_COST_CENTS;
  }
  
  // Tracking & Pixels
  if (plan.has_tracking) {
    costCents += PLATFORM_COSTS.TRACKING_MONTHLY_COST_CENTS;
  }
  
  // Usuários adicionais
  const users = plan.max_users || 1;
  if (users > PLATFORM_COSTS.USERS_BASE_INCLUDED) {
    costCents += (users - PLATFORM_COSTS.USERS_BASE_INCLUDED) * PLATFORM_COSTS.USER_ADDITIONAL_COST_CENTS;
  }
  
  return costCents;
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
  max_energy_per_month: 1000, // Mudado de 5000 para 1000 (padrão base)
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

  // Calcula custo mínimo em tempo real
  const platformCost = useMemo(() => calculatePlatformCost(formData), [formData]);
  const sellerProfit = (formData.price_cents || 0) - platformCost;
  const isPriceValid = (formData.price_cents || 0) > platformCost;

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
    
    // Validar preço mínimo
    if (!isPriceValid) {
      return;
    }
    
    const planData = {
      ...formData,
      platform_cost_cents: platformCost, // Salvar custo da plataforma
    };
    
    if (editingPlan?.id) {
      updatePlan.mutate({ id: editingPlan.id, updates: planData });
    } else {
      createPlan.mutate({
        ...planData,
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

  // Gera breakdown detalhado dos custos
  const costBreakdown = useMemo(() => {
    const items: { label: string; cost: number; included?: string }[] = [];
    
    // WhatsApp
    const whatsappInstances = formData.max_whatsapp_instances || 1;
    if (whatsappInstances > PLATFORM_COSTS.WHATSAPP_BASE_INCLUDED) {
      const extraInstances = whatsappInstances - PLATFORM_COSTS.WHATSAPP_BASE_INCLUDED;
      items.push({
        label: `WhatsApp adicional (${extraInstances}x)`,
        cost: extraInstances * PLATFORM_COSTS.WHATSAPP_ADDITIONAL_COST_CENTS,
      });
    } else {
      items.push({
        label: 'WhatsApp',
        cost: 0,
        included: '1 instância incluída',
      });
    }
    
    // Usuários
    const users = formData.max_users || 1;
    if (users > PLATFORM_COSTS.USERS_BASE_INCLUDED) {
      const extraUsers = users - PLATFORM_COSTS.USERS_BASE_INCLUDED;
      items.push({
        label: `Usuários adicionais (${extraUsers}x)`,
        cost: extraUsers * PLATFORM_COSTS.USER_ADDITIONAL_COST_CENTS,
      });
    } else {
      items.push({
        label: 'Usuários',
        cost: 0,
        included: `até ${PLATFORM_COSTS.USERS_BASE_INCLUDED} incluídos`,
      });
    }
    
    // Nota Fiscal
    if (formData.has_nfe) {
      items.push({
        label: 'Nota Fiscal',
        cost: PLATFORM_COSTS.NFE_MONTHLY_COST_CENTS,
        included: `${PLATFORM_COSTS.NFE_INCLUDED_INVOICES} notas/mês`,
      });
    }
    
    // Tracking
    if (formData.has_tracking) {
      items.push({
        label: 'Tracking & Pixels',
        cost: PLATFORM_COSTS.TRACKING_MONTHLY_COST_CENTS,
      });
    }
    
    return items.filter(i => i.cost > 0 || i.included);
  }, [formData]);

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
                
                {/* Show platform cost and profit */}
                {plan.platform_cost_cents > 0 && (
                  <div className="text-xs text-muted-foreground border-t pt-2">
                    <div className="flex justify-between">
                      <span>Custo plataforma:</span>
                      <span>{formatCurrency(plan.platform_cost_cents)}</span>
                    </div>
                    <div className="flex justify-between text-green-600 font-medium">
                      <span>Seu lucro:</span>
                      <span>{formatCurrency(plan.price_cents - plan.platform_cost_cents)}</span>
                    </div>
                  </div>
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPlan ? 'Editar Plano' : 'Novo Plano'}</DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-6 md:grid-cols-3">
            {/* Main Form - 2 columns */}
            <div className="md:col-span-2 space-y-6">
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
                    className={!isPriceValid ? 'border-red-500' : ''}
                  />
                  {!isPriceValid && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Preço deve ser maior que {formatCurrency(platformCost)}
                    </p>
                  )}
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
                    min={1}
                    value={formData.max_users}
                    onChange={(e) => setFormData({ ...formData, max_users: parseInt(e.target.value) || 1 })}
                  />
                  <p className="text-xs text-muted-foreground">
                    {(formData.max_users || 1) <= 3 
                      ? '✓ Incluído (até 3)' 
                      : `+${formatCurrency(((formData.max_users || 1) - 3) * 200)}/mês`
                    }
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>WhatsApp</Label>
                  <Input 
                    type="number"
                    min={1}
                    value={formData.max_whatsapp_instances}
                    onChange={(e) => setFormData({ ...formData, max_whatsapp_instances: parseInt(e.target.value) || 1 })}
                  />
                  <p className="text-xs text-muted-foreground">
                    {(formData.max_whatsapp_instances || 1) <= 1 
                      ? '✓ 1 incluído' 
                      : `+${formatCurrency(((formData.max_whatsapp_instances || 1) - 1) * 5000)}/mês`
                    }
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Energia/mês</Label>
                  <Input 
                    type="number"
                    min={1000}
                    step={1000}
                    value={formData.max_energy_per_month}
                    onChange={(e) => setFormData({ ...formData, max_energy_per_month: Math.max(1000, parseInt(e.target.value) || 1000) })}
                  />
                  <p className="text-xs text-muted-foreground">Mínimo: 1.000</p>
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
                  <div className="flex items-center justify-between p-3 border rounded-lg bg-cyan-500/10">
                    <div>
                      <span>Tracking & Pixels</span>
                      <p className="text-xs text-muted-foreground">+R$ 125/mês</p>
                    </div>
                    <Switch 
                      checked={formData.has_tracking}
                      onCheckedChange={(v) => setFormData({ ...formData, has_tracking: v })}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg bg-purple-500/10">
                    <div>
                      <span>Nota Fiscal</span>
                      <p className="text-xs text-muted-foreground">+R$ 150/mês (100 notas)</p>
                    </div>
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
            </div>
            
            {/* Cost Summary - 1 column */}
            <div className="space-y-4">
              <Card className="sticky top-4">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Resumo de Custos
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Cost breakdown */}
                  <div className="space-y-2 text-sm">
                    {costBreakdown.map((item, i) => (
                      <div key={i} className="flex justify-between items-start">
                        <div>
                          <span className={item.cost > 0 ? 'text-foreground' : 'text-muted-foreground'}>
                            {item.label}
                          </span>
                          {item.included && (
                            <p className="text-xs text-muted-foreground">{item.included}</p>
                          )}
                        </div>
                        <span className={item.cost > 0 ? 'text-red-500 font-medium' : 'text-green-600'}>
                          {item.cost > 0 ? `+${formatCurrency(item.cost)}` : 'Grátis'}
                        </span>
                      </div>
                    ))}
                  </div>
                  
                  <div className="border-t pt-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Custo mínimo:</span>
                      <span className="font-bold text-red-500">{formatCurrency(platformCost)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Você cobra:</span>
                      <span className="font-bold">{formatCurrency(formData.price_cents || 0)}</span>
                    </div>
                    <div className={`flex justify-between text-sm pt-2 border-t ${isPriceValid ? 'text-green-600' : 'text-red-500'}`}>
                      <span className="flex items-center gap-1">
                        <TrendingUp className="h-4 w-4" />
                        Seu lucro:
                      </span>
                      <span className="font-bold text-lg">
                        {formatCurrency(sellerProfit)}
                      </span>
                    </div>
                  </div>
                  
                  {!isPriceValid && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-xs text-red-600">
                      <AlertTriangle className="h-4 w-4 inline mr-1" />
                      O preço deve ser maior que o custo mínimo para você ter lucro.
                    </div>
                  )}
                </CardContent>
              </Card>
              
              <Button 
                onClick={handleSave}
                className="w-full"
                style={{ backgroundColor: primaryColor }}
                disabled={!formData.name || !formData.slug || !isPriceValid || createPlan.isPending || updatePlan.isPending}
              >
                {editingPlan ? 'Salvar Alterações' : 'Criar Plano'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
