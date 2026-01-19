import { useState, useEffect, useMemo } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RotateCcw } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { 
  UserPermissions, 
  PERMISSION_LABELS, 
  PERMISSION_GROUPS,
  PermissionKey,
  useUserPermissions,
  useUpdateUserPermissions,
  useApplyRoleDefaults,
} from '@/hooks/useUserPermissions';
import { useOrgFeatures, FeatureKey } from '@/hooks/usePlanFeatures';

interface UserPermissionsEditorProps {
  userId: string;
  userRole: string;
  onClose?: () => void;
}

// PermissionKey is now imported from useUserPermissions

// Mapeia grupos de permissão para as features que precisam estar ativas
const GROUP_TO_FEATURES: Record<string, FeatureKey[]> = {
  'Dashboard': ['dashboard', 'sales_dashboard'],
  'Leads': ['leads'],
  'Vendas': ['sales'],
  'Financeiro': ['financial'],
  'WhatsApp': ['whatsapp_v1', 'whatsapp_v2'],
  'Módulos': ['ai_bots', 'instagram', 'demands', 'receptive', 'integrations'],
  'Produtos': ['products', 'custom_questions'],
  'Configurações': ['settings', 'standard_questions', 'custom_questions'],
  'Equipe': ['team'],
  'Relatórios': ['sales_report', 'expedition_report'],
  'Entregas': ['deliveries'],
  'Pós-Venda': ['post_sale', 'post_sale_kanban'],
  'SAC': ['sac'],
  'Mensagens': ['scheduled_messages'],
};

// Mapeia permissões individuais para features específicas
// Se a feature está desativada para a org, a permissão não aparece
const PERMISSION_TO_FEATURE: Partial<Record<PermissionKey, FeatureKey>> = {
  'dashboard_funnel_view': 'dashboard',
  'dashboard_kanban_view': 'dashboard',
  'seller_panel_view': 'sales',
  'sales_dashboard_view': 'sales_dashboard',
  'ai_bots_view': 'ai_bots',
  'instagram_view': 'instagram',
  'demands_view': 'demands',
  'whatsapp_v2_view': 'whatsapp_v2',
  'post_sale_view': 'post_sale',
  'post_sale_manage': 'post_sale',
  'sac_view': 'sac',
  'sac_manage': 'sac',
  'sales_report_view': 'sales_report',
  'expedition_report_view': 'expedition_report',
  'settings_standard_questions': 'standard_questions',
  'scheduled_messages_view': 'scheduled_messages',
  'scheduled_messages_manage': 'scheduled_messages',
  'deliveries_view_own': 'deliveries',
  'deliveries_view_all': 'deliveries',
  'expedition_view': 'deliveries',
  'receptive_module_access': 'receptive',
  'integrations_view': 'integrations',
};

export function UserPermissionsEditor({ userId, userRole, onClose }: UserPermissionsEditorProps) {
  const { data: permissions, isLoading } = useUserPermissions(userId);
  const { data: orgFeatures, isLoading: featuresLoading } = useOrgFeatures();
  const updatePermissions = useUpdateUserPermissions();
  const applyDefaults = useApplyRoleDefaults();
  
  const [localPermissions, setLocalPermissions] = useState<Partial<UserPermissions>>({});
  const [hasChanges, setHasChanges] = useState(false);
  
  useEffect(() => {
    if (permissions) {
      setLocalPermissions(permissions);
      setHasChanges(false);
    }
  }, [permissions]);
  
  const handleToggle = (key: PermissionKey, value: boolean) => {
    setLocalPermissions(prev => ({
      ...prev,
      [key]: value,
    }));
    setHasChanges(true);
  };
  
  const handleSave = async () => {
    await updatePermissions.mutateAsync({
      userId,
      permissions: localPermissions,
    });
    setHasChanges(false);
    onClose?.();
  };
  
  const handleApplyDefaults = async () => {
    await applyDefaults.mutateAsync({ userId, role: userRole });
    setHasChanges(false);
  };

  // Verifica se um grupo deve ser exibido baseado nas features da organização
  const isGroupVisible = (group: string): boolean => {
    if (!orgFeatures) return true; // Se ainda carregando, mostra tudo
    
    const requiredFeatures = GROUP_TO_FEATURES[group];
    if (!requiredFeatures || requiredFeatures.length === 0) return true;
    
    // O grupo é visível se pelo menos uma das features está ativa
    return requiredFeatures.some(feature => orgFeatures[feature] === true);
  };

  // Verifica se uma permissão individual deve ser exibida
  const isPermissionVisible = (permKey: PermissionKey): boolean => {
    if (!orgFeatures) return true;
    
    const requiredFeature = PERMISSION_TO_FEATURE[permKey];
    if (!requiredFeature) return true; // Se não tem mapeamento, mostra
    
    return orgFeatures[requiredFeature] === true;
  };
  
  const getPermissionsByGroup = () => {
    const grouped: Record<string, { key: PermissionKey; label: string; description: string }[]> = {};
    
    Object.entries(PERMISSION_LABELS).forEach(([key, { label, description, group }]) => {
      if (!grouped[group]) grouped[group] = [];
      grouped[group].push({ key: key as PermissionKey, label, description });
    });
    
    return grouped;
  };

  // Filtra grupos e permissões baseado nas features ativas
  const filteredGroups = useMemo(() => {
    return PERMISSION_GROUPS.filter(group => isGroupVisible(group));
  }, [orgFeatures]);

  const filteredPermissions = useMemo(() => {
    const grouped = getPermissionsByGroup();
    const result: Record<string, { key: PermissionKey; label: string; description: string }[]> = {};
    
    Object.entries(grouped).forEach(([group, perms]) => {
      if (isGroupVisible(group)) {
        result[group] = perms.filter(p => isPermissionVisible(p.key));
      }
    });
    
    return result;
  }, [orgFeatures]);
  
  if (isLoading || featuresLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  if (!permissions) {
    return (
      <div className="text-center p-4 text-muted-foreground">
        <p>Permissões não encontradas para este usuário.</p>
        <Button 
          variant="outline" 
          className="mt-4"
          onClick={handleApplyDefaults}
          disabled={applyDefaults.isPending}
        >
          {applyDefaults.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Criar permissões padrão
        </Button>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Personalize as permissões deste usuário
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleApplyDefaults}
          disabled={applyDefaults.isPending}
        >
          {applyDefaults.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RotateCcw className="w-4 h-4 mr-2" />
          )}
          Restaurar padrão
        </Button>
      </div>
      
      <Accordion type="multiple" defaultValue={['Leads', 'Vendas']} className="space-y-2">
        {filteredGroups.map(group => {
          const groupPerms = filteredPermissions[group];
          if (!groupPerms || groupPerms.length === 0) return null;
          
          return (
            <AccordionItem key={group} value={group} className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{group}</span>
                  <Badge variant="secondary" className="text-xs">
                    {groupPerms.filter(p => localPermissions[p.key]).length} / {groupPerms.length}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-4">
                <div className="space-y-3">
                  {groupPerms.map(({ key, label, description }) => (
                    <div key={key} className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <Label htmlFor={key} className="text-sm font-medium cursor-pointer">
                          {label}
                        </Label>
                        <p className="text-xs text-muted-foreground truncate">
                          {description}
                        </p>
                      </div>
                      <Switch
                        id={key}
                        checked={localPermissions[key] ?? false}
                        onCheckedChange={(checked) => handleToggle(key, checked)}
                      />
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
      
      {hasChanges && (
        <div className="flex gap-2 pt-4 border-t">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => {
              setLocalPermissions(permissions);
              setHasChanges(false);
            }}
          >
            Cancelar
          </Button>
          <Button
            className="flex-1"
            onClick={handleSave}
            disabled={updatePermissions.isPending}
          >
            {updatePermissions.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salvar Permissões
          </Button>
        </div>
      )}
    </div>
  );
}
