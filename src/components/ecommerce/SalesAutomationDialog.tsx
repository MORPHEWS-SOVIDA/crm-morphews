import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUsers } from '@/hooks/useUsers';
import { useNonPurchaseReasons } from '@/hooks/useNonPurchaseReasons';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Settings, User } from 'lucide-react';

interface AutomationConfig {
  id: string;
  organization_id: string;
  default_seller_id: string | null;
  cart_recovery_reason_id: string | null;
  lead_funnel_stage_id: string | null;
  paid_notification_funnel_stage_id: string | null;
  notify_team_on_payment: boolean;
}

export function SalesAutomationDialog() {
  const { profile } = useAuth();
  const organizationId = profile?.organization_id;
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  
  const { data: users = [] } = useUsers();
  const { data: nonPurchaseReasons = [] } = useNonPurchaseReasons();
  
  const { data: funnelStages } = useQuery({
    queryKey: ['funnel-stages', organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organization_funnel_stages')
        .select('id, name, position')
        .eq('organization_id', organizationId!)
        .order('position');
      
      if (error) throw error;
      return data;
    },
  });
  
  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['ecommerce-automation-config', organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ecommerce_automation_config')
        .select('*')
        .eq('organization_id', organizationId!)
        .maybeSingle();
      
      if (error) throw error;
      return data as AutomationConfig | null;
    },
  });
  
  const [configForm, setConfigForm] = useState<Partial<AutomationConfig>>({});
  
  useEffect(() => {
    if (open && config) {
      setConfigForm({
        default_seller_id: config.default_seller_id || null,
        paid_notification_funnel_stage_id: config.paid_notification_funnel_stage_id || null,
        notify_team_on_payment: config.notify_team_on_payment ?? true,
      });
    } else if (open && !config) {
      setConfigForm({
        default_seller_id: null,
        paid_notification_funnel_stage_id: null,
        notify_team_on_payment: true,
      });
    }
  }, [open, config]);
  
  const saveConfig = useMutation({
    mutationFn: async (newConfig: Partial<AutomationConfig>) => {
      if (config?.id) {
        const { error } = await supabase
          .from('ecommerce_automation_config')
          .update(newConfig)
          .eq('id', config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('ecommerce_automation_config')
          .insert({
            organization_id: organizationId!,
            ...newConfig,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ecommerce-automation-config'] });
      toast.success('Configurações salvas com sucesso');
      setOpen(false);
    },
    onError: () => {
      toast.error('Erro ao salvar configurações');
    },
  });
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Settings className="h-4 w-4" />
          Configurações de Automação
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Configurações de Automação de Vendas</DialogTitle>
          <DialogDescription>
            Configure atribuição de vendedor e etapa do funil para vendas online
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 pt-4">
          {/* Seller Assignment */}
          <div className="space-y-3">
            <Label className="text-base font-semibold flex items-center gap-2">
              <User className="h-4 w-4" />
              Atribuição de Vendedor
            </Label>
            <div className="space-y-2">
              <Label>Vendedor padrão para vendas via e-commerce:</Label>
              <Select
                value={configForm.default_seller_id || '__none__'}
                onValueChange={(v) => setConfigForm({ ...configForm, default_seller_id: v === '__none__' ? null : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um vendedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum (distribuição automática)</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.user_id} value={user.user_id}>
                      {user.first_name} {user.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Todas as vendas criadas serão atribuídas a este vendedor
              </p>
            </div>
          </div>

          {/* Funnel Stage for Sales */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Venda Confirmada</Label>
            <div className="space-y-2">
              <Label>Mover lead para etapa do funil:</Label>
              <Select
                value={configForm.paid_notification_funnel_stage_id || '__none__'}
                onValueChange={(v) => setConfigForm({ ...configForm, paid_notification_funnel_stage_id: v === '__none__' ? null : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Manter etapa atual" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Manter etapa atual</SelectItem>
                  {funnelStages?.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>{stage.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Quando o pagamento é confirmado, o lead será movido para esta etapa
              </p>
            </div>
            
            <div className="flex items-center justify-between">
              <Label>Notificar equipe quando pagamento é confirmado</Label>
              <Switch
                checked={configForm.notify_team_on_payment}
                onCheckedChange={(v) => setConfigForm({ ...configForm, notify_team_on_payment: v })}
              />
            </div>
          </div>

          <Button 
            className="w-full" 
            onClick={() => saveConfig.mutate(configForm)}
            disabled={saveConfig.isPending}
          >
            {saveConfig.isPending ? 'Salvando...' : 'Salvar Configurações'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
