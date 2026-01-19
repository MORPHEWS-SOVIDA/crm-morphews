import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface UserPermissions {
  id: string;
  organization_id: string;
  user_id: string;
  
  // User experience preferences
  default_landing_page: string | null;
  hide_sidebar: boolean;
  
  // Dashboard (separate views)
  dashboard_funnel_view: boolean;
  dashboard_kanban_view: boolean;
  seller_panel_view: boolean;
  sales_dashboard_view: boolean;
  
  // Leads
  leads_view: boolean;
  leads_view_only_own: boolean;
  leads_create: boolean;
  leads_edit: boolean;
  leads_delete: boolean;
  leads_hide_new_button: boolean;
  
  // Sales
  sales_view: boolean;
  sales_view_all: boolean;
  sales_create: boolean;
  sales_edit_draft: boolean;
  sales_confirm_payment: boolean;
  sales_validate_expedition: boolean;
  sales_dispatch: boolean;
  sales_mark_delivered: boolean;
  sales_mark_printed: boolean;
  sales_cancel: boolean;
  sales_hide_new_button: boolean;
  
  // WhatsApp
  whatsapp_view: boolean;
  whatsapp_send: boolean;
  whatsapp_v2_view: boolean;
  whatsapp_manage_view: boolean;
  
  // AI Bots
  ai_bots_view: boolean;
  
  // Demands
  demands_view: boolean;
  
  // Products & Settings
  products_view: boolean;
  products_manage: boolean;
  products_view_cost: boolean;
  settings_view: boolean;
  settings_manage: boolean;
  
  // Granular Settings Permissions
  settings_funnel_stages: boolean;
  settings_delivery_regions: boolean;
  settings_carriers: boolean;
  settings_payment_methods: boolean;
  settings_non_purchase_reasons: boolean;
  settings_standard_questions: boolean;
  settings_teams: boolean;
  settings_lead_sources: boolean;
  
  // Reports
  reports_view: boolean;
  sales_report_view: boolean;
  expedition_report_view: boolean;
  
  // Deliveries / Expedition
  deliveries_view_own: boolean;
  deliveries_view_all: boolean;
  expedition_view: boolean;
  
  // Modules
  receptive_module_access: boolean;
  instagram_view: boolean;
  integrations_view: boolean;
  
  // Team Management
  team_view: boolean;
  team_add_member: boolean;
  team_edit_member: boolean;
  team_delete_member: boolean;
  team_change_permissions: boolean;
  team_change_role: boolean;
  team_change_commission: boolean;
  team_toggle_manager: boolean;
  
  // Post-Sale
  post_sale_view: boolean;
  post_sale_manage: boolean;
  
  // SAC
  sac_view: boolean;
  sac_manage: boolean;
  
  // Scheduled Messages
  scheduled_messages_view: boolean;
  scheduled_messages_manage: boolean;
  
  created_at: string;
  updated_at: string;
}

// Campos que não são permissões (são preferências de UX)
type NonPermissionFields = 'id' | 'organization_id' | 'user_id' | 'created_at' | 'updated_at' | 'default_landing_page' | 'hide_sidebar';

export type PermissionKey = keyof Omit<UserPermissions, NonPermissionFields>;

export const PERMISSION_LABELS: Record<PermissionKey, { label: string; description: string; group: string }> = {
  // Dashboard
  dashboard_funnel_view: { label: 'Dashboard Funil', description: 'Visualizar dashboard no modo funil', group: 'Dashboard' },
  dashboard_kanban_view: { label: 'Dashboard Kanban', description: 'Visualizar dashboard no modo kanban', group: 'Dashboard' },
  seller_panel_view: { label: 'Meu Painel', description: 'Acessar painel do vendedor', group: 'Dashboard' },
  sales_dashboard_view: { label: 'Dashboard Vendas', description: 'Acessar ranking de vendas e métricas', group: 'Dashboard' },
  
  // Leads
  leads_view: { label: 'Ver Leads', description: 'Visualizar leads da empresa', group: 'Leads' },
  leads_view_only_own: { label: 'Ver Somente Seus Leads', description: 'Limitar visibilidade apenas aos leads que é responsável', group: 'Leads' },
  leads_create: { label: 'Criar Leads', description: 'Criar novos leads', group: 'Leads' },
  leads_edit: { label: 'Editar Leads', description: 'Editar dados de leads', group: 'Leads' },
  leads_delete: { label: 'Excluir Leads', description: 'Remover leads', group: 'Leads' },
  leads_hide_new_button: { label: 'Ocultar Botão Novo Lead', description: 'Força o vendedor a cadastrar leads pelo Add Receptivo', group: 'Leads' },
  
  // Vendas
  sales_view: { label: 'Ver Vendas', description: 'Visualizar vendas', group: 'Vendas' },
  sales_view_all: { label: 'Ver Vendas de Todos', description: 'Ver vendas de todos os vendedores', group: 'Vendas' },
  sales_create: { label: 'Criar Vendas', description: 'Criar novas vendas', group: 'Vendas' },
  sales_edit_draft: { label: 'Editar Rascunhos', description: 'Editar vendas em rascunho', group: 'Vendas' },
  sales_mark_printed: { label: 'Marcar Impresso', description: 'Marcar venda como impressa para expedição', group: 'Vendas' },
  sales_dispatch: { label: 'Despachar', description: 'Marcar como despachado/enviado', group: 'Vendas' },
  sales_mark_delivered: { label: 'Marcar Entregue', description: 'Confirmar entrega ao cliente', group: 'Vendas' },
  sales_cancel: { label: 'Cancelar Vendas', description: 'Cancelar vendas', group: 'Vendas' },
  sales_hide_new_button: { label: 'Ocultar Botão Nova Venda', description: 'Força o vendedor a cadastrar vendas pelo Add Receptivo', group: 'Vendas' },
  
  // Financeiro
  reports_view: { label: 'Ver Financeiro', description: 'Acessar módulo financeiro e relatórios', group: 'Financeiro' },
  sales_confirm_payment: { label: 'Confirmar Pagamento', description: 'Marcar recebimentos como pagos', group: 'Financeiro' },
  
  // WhatsApp
  whatsapp_view: { label: 'WhatsApp 1.0 (DMs)', description: 'Acessar Chat WhatsApp 1.0', group: 'WhatsApp' },
  whatsapp_send: { label: 'Enviar Mensagens', description: 'Enviar mensagens pelo WhatsApp', group: 'WhatsApp' },
  whatsapp_v2_view: { label: 'WhatsApp 2.0', description: 'Acessar WhatsApp 2.0 (novo)', group: 'WhatsApp' },
  whatsapp_manage_view: { label: 'Gerenciar WhatsApp', description: 'Acessar configurações e instâncias WhatsApp', group: 'WhatsApp' },
  
  // Módulos
  ai_bots_view: { label: 'Robôs de IA', description: 'Acessar e gerenciar robôs de IA', group: 'Módulos' },
  instagram_view: { label: 'Ver Instagram DMs', description: 'Acessar Instagram DMs', group: 'Módulos' },
  demands_view: { label: 'Demandas', description: 'Acessar módulo de demandas/tarefas', group: 'Módulos' },
  receptive_module_access: { label: 'Módulo Receptivo', description: 'Acesso ao módulo de atendimento receptivo', group: 'Módulos' },
  integrations_view: { label: 'Integrações', description: 'Acessar página de integrações e webhooks', group: 'Módulos' },
  
  // Produtos
  products_view: { label: 'Ver Produtos', description: 'Visualizar produtos', group: 'Produtos' },
  products_manage: { label: 'Gerenciar Produtos', description: 'Criar/editar/excluir produtos', group: 'Produtos' },
  products_view_cost: { label: 'Ver Custo', description: 'Visualizar custo dos produtos', group: 'Produtos' },
  
  // Configurações
  settings_view: { label: 'Ver Configurações', description: 'Acessar página de configurações', group: 'Configurações' },
  settings_manage: { label: 'Gerenciar Configurações', description: 'Alterar configurações gerais', group: 'Configurações' },
  settings_funnel_stages: { label: 'Etapas do Funil', description: 'Gerenciar etapas do funil de vendas', group: 'Configurações' },
  settings_delivery_regions: { label: 'Regiões de Entrega', description: 'Gerenciar regiões de entrega motoboy', group: 'Configurações' },
  settings_carriers: { label: 'Transportadoras', description: 'Gerenciar transportadoras', group: 'Configurações' },
  settings_payment_methods: { label: 'Formas de Pagamento', description: 'Gerenciar métodos de pagamento', group: 'Configurações' },
  settings_non_purchase_reasons: { label: 'Motivos de Não Compra', description: 'Gerenciar motivos de não compra', group: 'Configurações' },
  settings_standard_questions: { label: 'Perguntas Sovida', description: 'Gerenciar Perguntas Sovida', group: 'Configurações' },
  settings_teams: { label: 'Times', description: 'Gerenciar times da organização', group: 'Configurações' },
  settings_lead_sources: { label: 'Origens de Lead', description: 'Gerenciar origens de lead', group: 'Configurações' },
  
  // Relatórios
  sales_report_view: { label: 'Relatório de Vendas', description: 'Ver relatório de vendas', group: 'Relatórios' },
  expedition_report_view: { label: 'Relatório de Expedição', description: 'Ver relatório de expedição/romaneio', group: 'Relatórios' },
  
  // Entregas
  deliveries_view_own: { label: 'Ver Minhas Entregas', description: 'Ver entregas atribuídas a mim', group: 'Entregas' },
  deliveries_view_all: { label: 'Ver Todas Entregas', description: 'Ver todas as entregas', group: 'Entregas' },
  expedition_view: { label: 'Expedição', description: 'Acessar tela de separação/conferência de pedidos', group: 'Entregas' },
  sales_validate_expedition: { label: 'Validar Expedição', description: 'Marcar pedido como separado', group: 'Entregas' },
  
  // Equipe
  team_view: { label: 'Ver Minha Equipe', description: 'Visualizar página Minha Equipe', group: 'Equipe' },
  team_add_member: { label: 'Adicionar Usuário', description: 'Adicionar novos usuários à equipe', group: 'Equipe' },
  team_edit_member: { label: 'Editar Usuário', description: 'Editar dados de usuários da equipe', group: 'Equipe' },
  team_delete_member: { label: 'Excluir Usuário', description: 'Remover usuários da equipe', group: 'Equipe' },
  team_change_permissions: { label: 'Alterar Permissões', description: 'Modificar permissões dos usuários', group: 'Equipe' },
  team_change_role: { label: 'Alterar Papel', description: 'Alterar cargo/papel dos usuários', group: 'Equipe' },
  team_change_commission: { label: 'Alterar Comissão (%)', description: 'Modificar percentual de comissão', group: 'Equipe' },
  team_toggle_manager: { label: 'Tornar/Destornar Gerente', description: 'Definir usuário como gerente de vendas', group: 'Equipe' },
  
  // Pós-Venda
  post_sale_view: { label: 'Ver Pós-Venda', description: 'Visualizar módulo de pós-venda', group: 'Pós-Venda' },
  post_sale_manage: { label: 'Gerenciar Pós-Venda', description: 'Realizar pesquisas pós-venda', group: 'Pós-Venda' },
  
  // SAC
  sac_view: { label: 'Ver SAC', description: 'Acessar módulo de SAC e chamados', group: 'SAC' },
  sac_manage: { label: 'Gerenciar SAC', description: 'Criar e gerenciar chamados SAC', group: 'SAC' },
  
  // Mensagens
  scheduled_messages_view: { label: 'Ver Mensagens Agendadas', description: 'Visualizar mensagens agendadas', group: 'Mensagens' },
  scheduled_messages_manage: { label: 'Gerenciar Mensagens Agendadas', description: 'Cancelar e reagendar mensagens', group: 'Mensagens' },
};

export const PERMISSION_GROUPS = ['Dashboard', 'Leads', 'Vendas', 'Financeiro', 'WhatsApp', 'Produtos', 'Configurações', 'Relatórios', 'Entregas', 'Módulos', 'Equipe', 'Pós-Venda', 'SAC', 'Mensagens'];

// Hook to get current user's permissions
export function useMyPermissions() {
  const { user } = useAuth();
  const { tenantId } = useTenant();
  
  return useQuery({
    queryKey: ['my-permissions', tenantId, user?.id],
    queryFn: async () => {
      if (!user?.id || !tenantId) return null;
      
      const { data, error } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('organization_id', tenantId)
        .eq('user_id', user.id)
        .single();
      
      if (error) {
        // If no permissions found, return default (all false except view)
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }
      
      return data as UserPermissions;
    },
    enabled: !!user?.id && !!tenantId,
  });
}

// Hook to get all user permissions for the organization (admin view)
export function useOrgUserPermissions() {
  const { tenantId } = useTenant();
  
  return useQuery({
    queryKey: ['org-user-permissions', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      
      const { data, error } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('organization_id', tenantId);
      
      if (error) throw error;
      return data as UserPermissions[];
    },
    enabled: !!tenantId,
  });
}

// Hook to get permissions for a specific user
export function useUserPermissions(userId: string | undefined) {
  const { tenantId } = useTenant();
  
  return useQuery({
    queryKey: ['user-permissions', tenantId, userId],
    queryFn: async () => {
      if (!tenantId || !userId) return null;
      
      const { data, error } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('organization_id', tenantId)
        .eq('user_id', userId)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }
      
      return data as UserPermissions;
    },
    enabled: !!tenantId && !!userId,
  });
}

// Mutation to update user permissions
export function useUpdateUserPermissions() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  
  return useMutation({
    mutationFn: async ({ userId, permissions }: { userId: string; permissions: Partial<UserPermissions> }) => {
      if (!tenantId) throw new Error('Tenant não encontrado');
      
      const { error } = await supabase
        .from('user_permissions')
        .update({
          ...permissions,
          updated_at: new Date().toISOString(),
        })
        .eq('organization_id', tenantId)
        .eq('user_id', userId);
      
      if (error) throw error;
    },
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ['user-permissions'] });
      queryClient.invalidateQueries({ queryKey: ['my-permissions'] });
      queryClient.invalidateQueries({ queryKey: ['org-user-permissions'] });
      toast.success('Permissões atualizadas!');
    },
    onError: (error: any) => {
      toast.error('Erro ao atualizar permissões', { description: error.message });
    },
  });
}

// Helper hook to check if current user has a specific permission
export function useHasPermission(permission: PermissionKey) {
  const { data: permissions } = useMyPermissions();
  return permissions?.[permission] ?? false;
}

// Helper to check multiple permissions at once
export function useHasAnyPermission(permissionList: PermissionKey[]) {
  const { data: permissions } = useMyPermissions();
  if (!permissions) return false;
  return permissionList.some(p => permissions[p]);
}

// Apply role-based default permissions
export function useApplyRoleDefaults() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      if (!tenantId) throw new Error('Tenant não encontrado');
      
      // Get default permissions for role from the database function
      const { data: defaultPerms, error: funcError } = await supabase
        .rpc('get_default_permissions_for_role', { p_role: role });
      
      if (funcError) throw funcError;
      
      if (!defaultPerms || typeof defaultPerms !== 'object') {
        throw new Error('Permissões padrão não encontradas');
      }
      
      const permsObj = defaultPerms as Record<string, boolean>;
      
      // Update user permissions with defaults
      const { error } = await supabase
        .from('user_permissions')
        .upsert({
          organization_id: tenantId,
          user_id: userId,
          // Dashboard permissions
          dashboard_funnel_view: permsObj.dashboard_funnel_view ?? true,
          dashboard_kanban_view: permsObj.dashboard_kanban_view ?? true,
          seller_panel_view: permsObj.seller_panel_view ?? true,
          // Leads
          leads_view: permsObj.leads_view ?? true,
          leads_view_only_own: permsObj.leads_view_only_own ?? false,
          leads_create: permsObj.leads_create ?? true,
          leads_edit: permsObj.leads_edit ?? true,
          leads_delete: permsObj.leads_delete ?? false,
          leads_hide_new_button: permsObj.leads_hide_new_button ?? false,
          // Sales
          sales_view: permsObj.sales_view ?? true,
          sales_view_all: permsObj.sales_view_all ?? false,
          sales_create: permsObj.sales_create ?? false,
          sales_edit_draft: permsObj.sales_edit_draft ?? false,
          sales_confirm_payment: permsObj.sales_confirm_payment ?? false,
          sales_validate_expedition: permsObj.sales_validate_expedition ?? false,
          sales_dispatch: permsObj.sales_dispatch ?? false,
          sales_mark_delivered: permsObj.sales_mark_delivered ?? false,
          sales_mark_printed: permsObj.sales_mark_printed ?? false,
          sales_cancel: permsObj.sales_cancel ?? false,
          sales_hide_new_button: permsObj.sales_hide_new_button ?? false,
          // WhatsApp
          whatsapp_view: permsObj.whatsapp_view ?? true,
          whatsapp_send: permsObj.whatsapp_send ?? false,
          whatsapp_v2_view: permsObj.whatsapp_v2_view ?? false,
          whatsapp_manage_view: permsObj.whatsapp_manage_view ?? false,
          // Modules
          ai_bots_view: permsObj.ai_bots_view ?? false,
          demands_view: permsObj.demands_view ?? false,
          instagram_view: permsObj.instagram_view ?? false,
          receptive_module_access: permsObj.receptive_module_access ?? false,
          // Products
          products_view: permsObj.products_view ?? true,
          products_manage: permsObj.products_manage ?? false,
          products_view_cost: permsObj.products_view_cost ?? false,
          // Settings
          settings_view: permsObj.settings_view ?? false,
          settings_manage: permsObj.settings_manage ?? false,
          settings_funnel_stages: permsObj.settings_funnel_stages ?? false,
          settings_delivery_regions: permsObj.settings_delivery_regions ?? false,
          settings_carriers: permsObj.settings_carriers ?? false,
          settings_payment_methods: permsObj.settings_payment_methods ?? false,
          settings_non_purchase_reasons: permsObj.settings_non_purchase_reasons ?? false,
          settings_standard_questions: permsObj.settings_standard_questions ?? false,
          settings_teams: permsObj.settings_teams ?? false,
          settings_lead_sources: permsObj.settings_lead_sources ?? false,
          // Reports
          reports_view: permsObj.reports_view ?? false,
          sales_report_view: permsObj.sales_report_view ?? false,
          expedition_report_view: permsObj.expedition_report_view ?? false,
          // Deliveries
          deliveries_view_own: permsObj.deliveries_view_own ?? false,
          deliveries_view_all: permsObj.deliveries_view_all ?? false,
          // Team
          team_view: permsObj.team_view ?? false,
          team_add_member: permsObj.team_add_member ?? false,
          team_edit_member: permsObj.team_edit_member ?? false,
          team_delete_member: permsObj.team_delete_member ?? false,
          team_change_permissions: permsObj.team_change_permissions ?? false,
          team_change_role: permsObj.team_change_role ?? false,
          team_change_commission: permsObj.team_change_commission ?? false,
          team_toggle_manager: permsObj.team_toggle_manager ?? false,
          // Post-sale
          post_sale_view: permsObj.post_sale_view ?? false,
          post_sale_manage: permsObj.post_sale_manage ?? false,
          // SAC
          sac_view: permsObj.sac_view ?? false,
          sac_manage: permsObj.sac_manage ?? false,
          // Scheduled Messages
          scheduled_messages_view: permsObj.scheduled_messages_view ?? false,
          scheduled_messages_manage: permsObj.scheduled_messages_manage ?? false,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'organization_id,user_id',
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-permissions'] });
      queryClient.invalidateQueries({ queryKey: ['org-user-permissions'] });
      toast.success('Permissões padrão aplicadas!');
    },
    onError: (error: any) => {
      toast.error('Erro ao aplicar permissões', { description: error.message });
    },
  });
}
