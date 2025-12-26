import { useState, useEffect } from 'react';
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
  useUserPermissions,
  useUpdateUserPermissions,
  useApplyRoleDefaults,
} from '@/hooks/useUserPermissions';

interface UserPermissionsEditorProps {
  userId: string;
  userRole: string;
  onClose?: () => void;
}

type PermissionKey = keyof Omit<UserPermissions, 'id' | 'organization_id' | 'user_id' | 'created_at' | 'updated_at'>;

export function UserPermissionsEditor({ userId, userRole, onClose }: UserPermissionsEditorProps) {
  const { data: permissions, isLoading } = useUserPermissions(userId);
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
  
  const getPermissionsByGroup = () => {
    const grouped: Record<string, { key: PermissionKey; label: string; description: string }[]> = {};
    
    Object.entries(PERMISSION_LABELS).forEach(([key, { label, description, group }]) => {
      if (!grouped[group]) grouped[group] = [];
      grouped[group].push({ key: key as PermissionKey, label, description });
    });
    
    return grouped;
  };
  
  const groupedPermissions = getPermissionsByGroup();
  
  if (isLoading) {
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
        {PERMISSION_GROUPS.map(group => (
          <AccordionItem key={group} value={group} className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <span className="font-medium">{group}</span>
                <Badge variant="secondary" className="text-xs">
                  {groupedPermissions[group]?.filter(p => localPermissions[p.key]).length || 0} / {groupedPermissions[group]?.length || 0}
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-4">
              <div className="space-y-3">
                {groupedPermissions[group]?.map(({ key, label, description }) => (
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
        ))}
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
