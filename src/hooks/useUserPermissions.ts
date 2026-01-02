import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface UserPermissions {
  id: string;
  organization_id: string;
  user_id: string;
  
  // Leads
  leads_view: boolean;
  leads_create: boolean;
  leads_edit: boolean;
  leads_delete: boolean;
  
  // Sales
  sales_view: boolean;
  sales_view_all: boolean;
  sales_create: boolean;
  sales_edit_draft: boolean;
  sales_confirm_payment: boolean;
  sales_validate_expedition: boolean;
  sales_dispatch: boolean;
  sales_mark_delivered: boolean;
  sales_cancel: boolean;
  
  // WhatsApp
  whatsapp_view: boolean;
  whatsapp_send: boolean;
  
  // Products & Settings
  products_view: boolean;
  products_manage: boolean;
  products_view_cost: boolean;
  settings_view: boolean;
  settings_manage: boolean;
  
  // Reports
  reports_view: boolean;
  
  // Deliveries
  deliveries_view_own: boolean;
  deliveries_view_all: boolean;
  
  // Modules
  receptive_module_access: boolean;
  
  // Team & Instagram
  team_view: boolean;
  instagram_view: boolean;
  
  // Post-Sale
  post_sale_view: boolean;
  post_sale_manage: boolean;
  
  created_at: string;
  updated_at: string;
}

export const PERMISSION_LABELS: Record<keyof Omit<UserPermissions, 'id' | 'organization_id' | 'user_id' | 'created_at' | 'updated_at'>, { label: string; description: string; group: string }> = {
  leads_view: { label: 'Ver Leads', description: 'Visualizar leads da empresa', group: 'Leads' },
  leads_create: { label: 'Criar Leads', description: 'Criar novos leads', group: 'Leads' },
  leads_edit: { label: 'Editar Leads', description: 'Editar dados de leads', group: 'Leads' },
  leads_delete: { label: 'Excluir Leads', description: 'Remover leads', group: 'Leads' },
  
  sales_view: { label: 'Ver Vendas', description: 'Visualizar vendas', group: 'Vendas' },
  sales_view_all: { label: 'Ver Vendas de Todos', description: 'Ver vendas de todos os vendedores', group: 'Vendas' },
  sales_create: { label: 'Criar Vendas', description: 'Criar novas vendas', group: 'Vendas' },
  sales_edit_draft: { label: 'Editar Rascunhos', description: 'Editar vendas em rascunho', group: 'Vendas' },
  sales_validate_expedition: { label: 'Validar Expedição', description: 'Validar vendas para envio', group: 'Vendas' },
  sales_dispatch: { label: 'Despachar', description: 'Marcar como despachado/enviado', group: 'Vendas' },
  sales_mark_delivered: { label: 'Marcar Entregue', description: 'Confirmar entrega ao cliente', group: 'Vendas' },
  sales_cancel: { label: 'Cancelar Vendas', description: 'Cancelar vendas', group: 'Vendas' },
  
  // Financeiro - agrupado
  reports_view: { label: 'Ver Financeiro', description: 'Acessar módulo financeiro e relatórios', group: 'Financeiro' },
  sales_confirm_payment: { label: 'Confirmar Pagamento', description: 'Marcar recebimentos como pagos', group: 'Financeiro' },
  
  whatsapp_view: { label: 'Ver WhatsApp', description: 'Ver conversas do WhatsApp', group: 'WhatsApp' },
  whatsapp_send: { label: 'Enviar Mensagens', description: 'Enviar mensagens pelo WhatsApp', group: 'WhatsApp' },
  
  products_view: { label: 'Ver Produtos', description: 'Visualizar produtos', group: 'Produtos' },
  products_manage: { label: 'Gerenciar Produtos', description: 'Criar/editar/excluir produtos', group: 'Produtos' },
  products_view_cost: { label: 'Ver Custo', description: 'Visualizar custo dos produtos', group: 'Produtos' },
  
  settings_view: { label: 'Ver Configurações', description: 'Acessar configurações', group: 'Configurações' },
  settings_manage: { label: 'Gerenciar Configurações', description: 'Alterar configurações', group: 'Configurações' },
  
  deliveries_view_own: { label: 'Ver Minhas Entregas', description: 'Ver entregas atribuídas a mim', group: 'Entregas' },
  deliveries_view_all: { label: 'Ver Todas Entregas', description: 'Ver todas as entregas', group: 'Entregas' },
  
  receptive_module_access: { label: 'Módulo Receptivo', description: 'Acesso ao módulo de atendimento receptivo', group: 'Módulos' },
  
  // Equipe e Instagram
  team_view: { label: 'Ver Minha Equipe', description: 'Visualizar página Minha Equipe', group: 'Equipe' },
  instagram_view: { label: 'Ver Instagram DMs', description: 'Acessar Instagram DMs', group: 'Equipe' },
  
  // Pós-Venda
  post_sale_view: { label: 'Ver Pós-Venda', description: 'Visualizar módulo de pós-venda', group: 'Pós-Venda' },
  post_sale_manage: { label: 'Gerenciar Pós-Venda', description: 'Realizar pesquisas pós-venda', group: 'Pós-Venda' },
};

export const PERMISSION_GROUPS = ['Leads', 'Vendas', 'Financeiro', 'WhatsApp', 'Produtos', 'Configurações', 'Entregas', 'Módulos', 'Equipe', 'Pós-Venda'];

// Hook to get current user's permissions
export function useMyPermissions() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['my-permissions', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('user_permissions')
        .select('*')
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
    enabled: !!user?.id,
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
export function useHasPermission(permission: keyof Omit<UserPermissions, 'id' | 'organization_id' | 'user_id' | 'created_at' | 'updated_at'>) {
  const { data: permissions } = useMyPermissions();
  return permissions?.[permission] ?? false;
}

// Helper to check multiple permissions at once
export function useHasAnyPermission(permissionList: (keyof Omit<UserPermissions, 'id' | 'organization_id' | 'user_id' | 'created_at' | 'updated_at'>)[]) {
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
        .rpc('get_default_permissions_for_role', { _role: role });
      
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
          leads_view: permsObj.leads_view ?? true,
          leads_create: permsObj.leads_create ?? true,
          leads_edit: permsObj.leads_edit ?? true,
          leads_delete: permsObj.leads_delete ?? false,
          sales_view: permsObj.sales_view ?? true,
          sales_view_all: permsObj.sales_view_all ?? false,
          sales_create: permsObj.sales_create ?? false,
          sales_edit_draft: permsObj.sales_edit_draft ?? false,
          sales_confirm_payment: permsObj.sales_confirm_payment ?? false,
          sales_validate_expedition: permsObj.sales_validate_expedition ?? false,
          sales_dispatch: permsObj.sales_dispatch ?? false,
          sales_mark_delivered: permsObj.sales_mark_delivered ?? false,
          sales_cancel: permsObj.sales_cancel ?? false,
          whatsapp_view: permsObj.whatsapp_view ?? true,
          whatsapp_send: permsObj.whatsapp_send ?? false,
          products_view: permsObj.products_view ?? true,
          products_manage: permsObj.products_manage ?? false,
          products_view_cost: permsObj.products_view_cost ?? false,
          settings_view: permsObj.settings_view ?? false,
          settings_manage: permsObj.settings_manage ?? false,
          reports_view: permsObj.reports_view ?? false,
          deliveries_view_own: permsObj.deliveries_view_own ?? false,
          deliveries_view_all: permsObj.deliveries_view_all ?? false,
          receptive_module_access: permsObj.receptive_module_access ?? false,
          team_view: permsObj.team_view ?? false,
          instagram_view: permsObj.instagram_view ?? false,
          post_sale_view: permsObj.post_sale_view ?? false,
          post_sale_manage: permsObj.post_sale_manage ?? false,
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
