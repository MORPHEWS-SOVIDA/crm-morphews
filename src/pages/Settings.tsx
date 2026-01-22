import { useState, useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Instagram, Bell, Tag, Plus, X, Loader2, Lock, Eye, EyeOff, Filter, ShieldAlert, MapPin, Truck, CreditCard, Users, Bike, Award, Database, Package, FileUp, Zap, HelpCircle, Plug2, User } from 'lucide-react';
import { useLeadSources, useCreateLeadSource, useDeleteLeadSource } from '@/hooks/useConfigOptions';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { FunnelStagesManager } from '@/components/settings/FunnelStagesManager';
import { DeliveryRegionsManager } from '@/components/settings/DeliveryRegionsManager';
import { ShippingCarriersManager } from '@/components/settings/ShippingCarriersManager';
import { PaymentMethodsManagerEnhanced } from '@/components/settings/PaymentMethodsManagerEnhanced';
import { NonPurchaseReasonsManager } from '@/components/settings/NonPurchaseReasonsManager';
import { TeamsManager } from '@/components/settings/TeamsManager';
import { StandardQuestionsManager } from '@/components/settings/StandardQuestionsManager';
import { MotoboyTrackingStatusesManager } from '@/components/settings/MotoboyTrackingStatusesManager';
import { CarrierTrackingStatusesManager } from '@/components/settings/CarrierTrackingStatusesManager';
import { ProductBrandsManager } from '@/components/settings/ProductBrandsManager';
import { useOrgAdmin } from '@/hooks/useOrgAdmin';
import { useMyPermissions } from '@/hooks/useUserPermissions';
import { useOrgFeatures } from '@/hooks/usePlanFeatures';
import { DataBackupManager } from '@/components/settings/DataBackupManager';
import { RomaneioImporter } from '@/components/settings/RomaneioImporter';
import { CustomFieldsManager } from '@/components/settings/CustomFieldsManager';
import { cn } from '@/lib/utils';

// Define setting categories with their tabs
const SETTINGS_TABS = [
  { id: 'funil', label: 'Funil', icon: Filter },
  { id: 'entregas', label: 'Entregas', icon: Truck },
  { id: 'pagamentos', label: 'Pagamentos', icon: CreditCard },
  { id: 'qualificacao', label: 'Qualificação', icon: HelpCircle },
  { id: 'equipe', label: 'Equipe', icon: Users },
  { id: 'integracoes', label: 'Integrações', icon: Plug2 },
  { id: 'conta', label: 'Minha Conta', icon: User },
] as const;

type TabId = typeof SETTINGS_TABS[number]['id'];

export default function Settings() {
  const { profile, updatePassword, user, isAdmin } = useAuth();
  const { data: isOrgAdmin, isLoading: loadingPermissions } = useOrgAdmin();
  const { data: permissions, isLoading: loadingMyPermissions } = useMyPermissions();
  const { data: orgFeatures } = useOrgFeatures();
  const { data: leadSources = [], isLoading: loadingSources } = useLeadSources();
  const createSource = useCreateLeadSource();
  const deleteSource = useDeleteLeadSource();

  const [activeTab, setActiveTab] = useState<TabId>('funil');
  const [newSource, setNewSource] = useState('');
  
  // Password change state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const handleAddSource = async () => {
    if (!newSource.trim()) return;
    try {
      await createSource.mutateAsync(newSource.trim());
      setNewSource('');
      toast({ title: 'Origem adicionada com sucesso!' });
    } catch (error: any) {
      toast({ title: 'Erro ao adicionar', description: error.message, variant: 'destructive' });
    }
  };

  const handleDeleteSource = async (id: string) => {
    try {
      await deleteSource.mutateAsync(id);
      toast({ title: 'Origem removida!' });
    } catch (error: any) {
      toast({ title: 'Erro ao remover', description: error.message, variant: 'destructive' });
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({
        title: 'Senhas não conferem',
        description: 'A nova senha e a confirmação devem ser iguais.',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: 'Senha muito curta',
        description: 'A senha deve ter pelo menos 6 caracteres.',
        variant: 'destructive',
      });
      return;
    }

    setIsChangingPassword(true);
    try {
      const { error } = await updatePassword(newPassword);
      if (error) throw error;
      
      toast({
        title: 'Senha alterada!',
        description: 'Sua senha foi atualizada com sucesso.',
      });
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast({
        title: 'Erro ao alterar senha',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Loading permissions
  if (loadingPermissions || loadingMyPermissions) {
    return (
      <Layout>
        <div className="flex items-center justify-center p-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Carregando permissões...</span>
        </div>
      </Layout>
    );
  }

  // Helper to check if user can access a specific settings section
  const canAccess = (permission: keyof typeof permissions) => {
    if (!permissions) return isAdmin || isOrgAdmin;
    return isAdmin || isOrgAdmin || permissions[permission];
  };

  // Determine which tabs should be visible based on permissions and features
  const getVisibleTabs = () => {
    const visibleTabs: typeof SETTINGS_TABS[number][] = [];
    
    // Funil tab - requires funnel_stages or lead_sources permission
    if (canAccess('settings_funnel_stages') || canAccess('settings_lead_sources')) {
      visibleTabs.push(SETTINGS_TABS[0]); // funil
    }
    
    // Entregas tab - requires delivery_regions or carriers permission + feature
    if ((canAccess('settings_delivery_regions') || canAccess('settings_carriers')) && 
        orgFeatures?.deliveries !== false) {
      visibleTabs.push(SETTINGS_TABS[1]); // entregas
    }
    
    // Pagamentos tab - requires payment_methods permission
    if (canAccess('settings_payment_methods')) {
      visibleTabs.push(SETTINGS_TABS[2]); // pagamentos
    }
    
    // Qualificação tab - requires standard_questions or non_purchase_reasons permission
    if (canAccess('settings_standard_questions') || canAccess('settings_non_purchase_reasons')) {
      visibleTabs.push(SETTINGS_TABS[3]); // qualificacao
    }
    
    // Equipe tab - requires teams permission + feature
    if (canAccess('settings_teams') && orgFeatures?.team !== false) {
      visibleTabs.push(SETTINGS_TABS[4]); // equipe
    }
    
    // Integrações tab - requires integrations permission + feature
    if ((isAdmin || isOrgAdmin || permissions?.integrations_view) && orgFeatures?.integrations !== false) {
      visibleTabs.push(SETTINGS_TABS[5]); // integracoes
    }
    
    // Conta tab - always visible (user can always change their own password)
    visibleTabs.push(SETTINGS_TABS[6]); // conta
    
    return visibleTabs;
  };

  const visibleTabs = getVisibleTabs();

  // If user has no visible tabs at all (only account), show restricted message
  if (visibleTabs.length === 1 && visibleTabs[0].id === 'conta') {
    return (
      <Layout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Configurações</h1>
            <p className="text-muted-foreground mt-1">Gerencie suas preferências</p>
          </div>

          <div className="bg-card rounded-xl p-6 shadow-card border border-amber-500/30">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-amber-500/10">
                <ShieldAlert className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Acesso restrito</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Você não tem permissão para alterar configurações desta empresa.
                  Solicite ao administrador que ajuste seu acesso caso precise realizar alterações.
                </p>
              </div>
            </div>
          </div>

          {/* User can still change their password */}
          <div className="max-w-md">
            <PasswordChangeCard
              newPassword={newPassword}
              setNewPassword={setNewPassword}
              confirmPassword={confirmPassword}
              setConfirmPassword={setConfirmPassword}
              showPassword={showPassword}
              setShowPassword={setShowPassword}
              isChangingPassword={isChangingPassword}
              onChangePassword={handleChangePassword}
            />
          </div>
        </div>
      </Layout>
    );
  }

  // Set first visible tab as active if current active is not visible
  if (!visibleTabs.find(t => t.id === activeTab)) {
    setActiveTab(visibleTabs[0]?.id || 'conta');
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Configurações</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie suas integrações e preferências
          </p>
        </div>

        {/* Tabs Navigation */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabId)} className="w-full">
          <ScrollArea className="w-full whitespace-nowrap">
            <TabsList className="inline-flex h-auto p-1 bg-muted/50 rounded-lg gap-1">
              {visibleTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    className={cn(
                      "inline-flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all",
                      "data-[state=active]:bg-background data-[state=active]:shadow-sm",
                      "data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
            <ScrollBar orientation="horizontal" className="invisible" />
          </ScrollArea>

          {/* FUNIL TAB */}
          <TabsContent value="funil" className="space-y-6 mt-6">
            {/* Etapas do Funil */}
            {canAccess('settings_funnel_stages') && (
              <div className="bg-card rounded-xl p-6 shadow-card">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <Filter className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Etapas do Funil</h2>
                    <p className="text-sm text-muted-foreground">Personalize seu funil de vendas</p>
                  </div>
                </div>
                <FunnelStagesManager />
              </div>
            )}

            {/* Custom Fields */}
            {canAccess('settings_funnel_stages') && (
              <CustomFieldsManager />
            )}

            {/* Lead Sources */}
            {canAccess('settings_lead_sources') && (
              <div className="bg-card rounded-xl p-6 shadow-card">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <Tag className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Origens de Lead</h2>
                    <p className="text-sm text-muted-foreground">Canais de aquisição</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Nova origem..."
                      value={newSource}
                      onChange={(e) => setNewSource(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddSource()}
                    />
                    <Button onClick={handleAddSource} disabled={createSource.isPending}>
                      {createSource.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    </Button>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-auto">
                    {loadingSources ? (
                      <div className="flex justify-center p-4">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      leadSources.map((source) => (
                        <div key={source.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <span className="font-medium">{source.name}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDeleteSource(source.id)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ENTREGAS TAB */}
          <TabsContent value="entregas" className="space-y-6 mt-6">
            {/* Delivery Regions */}
            {canAccess('settings_delivery_regions') && (
              <div className="bg-card rounded-xl p-6 shadow-card">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 rounded-lg bg-blue-500/10">
                    <MapPin className="w-6 h-6 text-blue-500" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Regiões de Entrega</h2>
                    <p className="text-sm text-muted-foreground">Configure as regiões atendidas por motoboy</p>
                  </div>
                </div>
                <DeliveryRegionsManager />
              </div>
            )}

            {/* Shipping Carriers */}
            {canAccess('settings_carriers') && (
              <div className="bg-card rounded-xl p-6 shadow-card">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 rounded-lg bg-green-500/10">
                    <Truck className="w-6 h-6 text-green-500" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Transportadoras</h2>
                    <p className="text-sm text-muted-foreground">Configure as transportadoras para envios</p>
                  </div>
                </div>
                <ShippingCarriersManager />
              </div>
            )}

            {/* Motoboy Tracking Statuses */}
            {canAccess('settings_carriers') && (
              <div className="bg-card rounded-xl p-6 shadow-card">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 rounded-lg bg-cyan-500/10">
                    <Bike className="w-6 h-6 text-cyan-500" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Rastreio de Motoboy</h2>
                    <p className="text-sm text-muted-foreground">Configure os status de entrega e mensagens automáticas para motoboy</p>
                  </div>
                </div>
                <MotoboyTrackingStatusesManager />
              </div>
            )}

            {/* Carrier Tracking Statuses */}
            {canAccess('settings_carriers') && (
              <div className="bg-card rounded-xl p-6 shadow-card">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 rounded-lg bg-orange-500/10">
                    <Package className="w-6 h-6 text-orange-500" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Rastreio de Transportadora</h2>
                    <p className="text-sm text-muted-foreground">Configure os status de entrega e mensagens automáticas para Correios e transportadoras</p>
                  </div>
                </div>
                <CarrierTrackingStatusesManager />
              </div>
            )}
          </TabsContent>

          {/* PAGAMENTOS TAB */}
          <TabsContent value="pagamentos" className="space-y-6 mt-6">
            {canAccess('settings_payment_methods') && (
              <div className="bg-card rounded-xl p-6 shadow-card">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 rounded-lg bg-purple-500/10">
                    <CreditCard className="w-6 h-6 text-purple-500" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Formas de Pagamento</h2>
                    <p className="text-sm text-muted-foreground">Configure as formas de pagamento disponíveis</p>
                  </div>
                </div>
                <PaymentMethodsManagerEnhanced />
              </div>
            )}
          </TabsContent>

          {/* QUALIFICAÇÃO TAB */}
          <TabsContent value="qualificacao" className="space-y-6 mt-6">
            {/* Followups Automáticos */}
            {canAccess('settings_non_purchase_reasons') && (
              <div className="bg-card rounded-xl p-6 shadow-card">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 rounded-lg bg-amber-500/10">
                    <Zap className="w-6 h-6 text-amber-500" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Followups Automáticos</h2>
                    <p className="text-sm text-muted-foreground">Configure mensagens automáticas de follow-up</p>
                  </div>
                </div>
                <NonPurchaseReasonsManager />
              </div>
            )}

            {/* Standard Questions */}
            {canAccess('settings_standard_questions') && orgFeatures?.standard_questions !== false && (
              <div className="bg-card rounded-xl p-6 shadow-card">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 rounded-lg bg-cyan-500/10">
                    <HelpCircle className="w-6 h-6 text-cyan-500" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Perguntas Padrão</h2>
                    <p className="text-sm text-muted-foreground">Perguntas pré-definidas para qualificação do lead</p>
                  </div>
                </div>
                <StandardQuestionsManager />
              </div>
            )}

            {/* Custom Questions Info */}
            {orgFeatures?.custom_questions !== false && (
              <div className="bg-card rounded-xl p-6 shadow-card">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 rounded-lg bg-purple-500/10">
                    <HelpCircle className="w-6 h-6 text-purple-500" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Perguntas Personalizadas</h2>
                    <p className="text-sm text-muted-foreground">Perguntas específicas por produto para qualificação do lead</p>
                  </div>
                </div>
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">
                    As Perguntas Personalizadas são configuradas diretamente no cadastro de cada produto.
                    Acesse <strong>Produtos</strong> → selecione um produto → seção <strong>Perguntas Personalizadas</strong>.
                  </p>
                </div>
              </div>
            )}

            {/* Product Brands */}
            {canAccess('settings_lead_sources') && (
              <div className="bg-card rounded-xl p-6 shadow-card">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 rounded-lg bg-orange-500/10">
                    <Award className="w-6 h-6 text-orange-500" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Marcas de Produtos</h2>
                    <p className="text-sm text-muted-foreground">Cadastre as marcas dos seus produtos</p>
                  </div>
                </div>
                <ProductBrandsManager />
              </div>
            )}
          </TabsContent>

          {/* EQUIPE TAB */}
          <TabsContent value="equipe" className="space-y-6 mt-6">
            {canAccess('settings_teams') && <TeamsManager />}
            
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm text-muted-foreground">
                Para gerenciar membros da equipe, editar permissões e adicionar usuários, acesse{' '}
                <a href="/equipe" className="text-primary font-medium hover:underline">
                  Minha Equipe
                </a>
                {' '}no menu lateral.
              </p>
            </div>
          </TabsContent>

          {/* INTEGRAÇÕES TAB */}
          <TabsContent value="integracoes" className="space-y-6 mt-6">
            {/* Instagram Integration */}
            <div className="bg-card rounded-xl p-6 shadow-card">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-lg bg-pink-500/10">
                  <Instagram className="w-6 h-6 text-pink-500" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Instagram DMs</h2>
                  <p className="text-sm text-muted-foreground">Veja suas mensagens no CRM</p>
                </div>
              </div>
              
              <div className="p-4 rounded-lg bg-gradient-to-br from-pink-500/10 to-purple-500/10 border border-pink-500/20 mb-4">
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">Em desenvolvimento:</span> A integração com Instagram permitirá ver e responder DMs diretamente do CRM, sem precisar trocar de aplicativo.
                </p>
              </div>

              <Button disabled className="w-full">
                Conectar Instagram
              </Button>
            </div>

            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm text-muted-foreground">
                Para criar webhooks e APIs de integração com sistemas externos, acesse{' '}
                <a href="/integracoes" className="text-primary font-medium hover:underline">
                  Integrações
                </a>
                {' '}no menu lateral.
              </p>
            </div>
          </TabsContent>

          {/* CONTA TAB */}
          <TabsContent value="conta" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Change Password */}
              <PasswordChangeCard
                newPassword={newPassword}
                setNewPassword={setNewPassword}
                confirmPassword={confirmPassword}
                setConfirmPassword={setConfirmPassword}
                showPassword={showPassword}
                setShowPassword={setShowPassword}
                isChangingPassword={isChangingPassword}
                onChangePassword={handleChangePassword}
              />

              {/* Notifications */}
              <div className="bg-card rounded-xl p-6 shadow-card">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 rounded-lg bg-funnel-convincing/20">
                    <Bell className="w-6 h-6 text-funnel-convincing-foreground" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Notificações</h2>
                    <p className="text-sm text-muted-foreground">Configure seus alertas</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Novos leads</p>
                      <p className="text-sm text-muted-foreground">Receber alerta de novos leads</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Calls agendadas</p>
                      <p className="text-sm text-muted-foreground">Lembrete antes das calls</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Pagamentos recebidos</p>
                      <p className="text-sm text-muted-foreground">Alerta de pagamentos</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>
              </div>
            </div>

            {/* Data Backup - Only for admins/owners */}
            {(isAdmin || isOrgAdmin) && (
              <div className="bg-card rounded-xl p-6 shadow-card">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 rounded-lg bg-emerald-500/10">
                    <Database className="w-6 h-6 text-emerald-500" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Backup de Dados</h2>
                    <p className="text-sm text-muted-foreground">Exporte todos os dados da sua empresa</p>
                  </div>
                </div>
                <DataBackupManager />
              </div>
            )}

            {/* Romaneio Importer - Only for admins/owners */}
            {(isAdmin || isOrgAdmin) && (
              <div className="bg-card rounded-xl p-6 shadow-card">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 rounded-lg bg-indigo-500/10">
                    <FileUp className="w-6 h-6 text-indigo-500" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Importar Romaneios</h2>
                    <p className="text-sm text-muted-foreground">Importe leads e vendas do sistema antigo</p>
                  </div>
                </div>
                <RomaneioImporter />
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}

// Extracted Password Change Card Component
function PasswordChangeCard({
  newPassword,
  setNewPassword,
  confirmPassword,
  setConfirmPassword,
  showPassword,
  setShowPassword,
  isChangingPassword,
  onChangePassword,
}: {
  newPassword: string;
  setNewPassword: (v: string) => void;
  confirmPassword: string;
  setConfirmPassword: (v: string) => void;
  showPassword: boolean;
  setShowPassword: (v: boolean) => void;
  isChangingPassword: boolean;
  onChangePassword: () => void;
}) {
  return (
    <div className="bg-card rounded-xl p-6 shadow-card">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-3 rounded-lg bg-amber-500/10">
          <Lock className="w-6 h-6 text-amber-500" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Alterar Senha</h2>
          <p className="text-sm text-muted-foreground">Mantenha sua conta segura</p>
        </div>
      </div>
      
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="new-password">Nova senha</Label>
          <div className="relative">
            <Input
              id="new-password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="confirm-password">Confirmar nova senha</Label>
          <Input
            id="confirm-password"
            type="password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>
        
        <Button 
          onClick={onChangePassword} 
          disabled={isChangingPassword || !newPassword || !confirmPassword}
          className="w-full"
        >
          {isChangingPassword ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Lock className="w-4 h-4 mr-2" />
          )}
          Alterar Senha
        </Button>
      </div>
    </div>
  );
}
