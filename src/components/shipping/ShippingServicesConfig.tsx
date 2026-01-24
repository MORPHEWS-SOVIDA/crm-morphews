import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { 
  useEnabledServices, 
  useToggleService, 
  useUpdateServiceConfig,
  CORREIOS_SERVICES 
} from '@/hooks/useShippingQuote';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

export function ShippingServicesConfig() {
  const { data: enabledServices = [], isLoading } = useEnabledServices();
  const toggleService = useToggleService();
  const updateConfig = useUpdateServiceConfig();
  const [openService, setOpenService] = useState<string | null>(null);
  const [localConfigs, setLocalConfigs] = useState<Record<string, { picking: string; days: string }>>({});

  const getServiceData = (code: string) => {
    const service = enabledServices.find(s => s.service_code === code);
    return {
      isEnabled: service ? service.is_enabled : (code === '03220' || code === '03298'),
      pickingCostCents: service?.picking_cost_cents || 0,
      extraHandlingDays: service?.extra_handling_days || 0,
    };
  };

  const handleToggle = (code: string, name: string) => {
    const { isEnabled } = getServiceData(code);
    toggleService.mutate({
      serviceCode: code,
      serviceName: name,
      isEnabled: !isEnabled,
    });
  };

  const handleSaveConfig = (code: string, name: string) => {
    const local = localConfigs[code];
    if (!local) return;
    
    const pickingCostCents = Math.round(parseFloat(local.picking.replace(',', '.') || '0') * 100);
    const extraHandlingDays = parseInt(local.days || '0', 10);
    
    updateConfig.mutate({
      serviceCode: code,
      serviceName: name,
      pickingCostCents,
      extraHandlingDays,
    });
  };

  const initLocalConfig = (code: string) => {
    if (!localConfigs[code]) {
      const data = getServiceData(code);
      setLocalConfigs(prev => ({
        ...prev,
        [code]: {
          picking: (data.pickingCostCents / 100).toFixed(2).replace('.', ','),
          days: String(data.extraHandlingDays),
        }
      }));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium mb-1">Serviços de Frete</h4>
        <p className="text-xs text-muted-foreground">
          Selecione quais serviços serão cotados e configure custos adicionais
        </p>
      </div>
      
      <div className="space-y-2">
        {CORREIOS_SERVICES.map((service) => {
          const { isEnabled, pickingCostCents, extraHandlingDays } = getServiceData(service.code);
          const isPending = toggleService.isPending || updateConfig.isPending;
          const isOpen = openService === service.code;
          const local = localConfigs[service.code];
          
          return (
            <Collapsible 
              key={service.code}
              open={isOpen}
              onOpenChange={(open) => {
                setOpenService(open ? service.code : null);
                if (open) initLocalConfig(service.code);
              }}
            >
              <div className="border rounded-lg overflow-hidden">
                <div className="flex items-center justify-between p-3 bg-background">
                  <div className="flex-1">
                    <Label 
                      htmlFor={`service-${service.code}`}
                      className="font-medium cursor-pointer"
                    >
                      {service.name}
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {service.description}
                    </p>
                    {(pickingCostCents > 0 || extraHandlingDays > 0) && (
                      <div className="flex gap-2 mt-1">
                        {pickingCostCents > 0 && (
                          <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                            +R$ {(pickingCostCents / 100).toFixed(2).replace('.', ',')}
                          </span>
                        )}
                        {extraHandlingDays > 0 && (
                          <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                            +{extraHandlingDays} dia{extraHandlingDays > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id={`service-${service.code}`}
                      checked={isEnabled}
                      onCheckedChange={() => handleToggle(service.code, service.name)}
                      disabled={isPending}
                    />
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                </div>
                
                <CollapsibleContent>
                  <div className="p-3 pt-0 border-t bg-muted/30 space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Custos internos (não visíveis para clientes/vendedores)
                    </p>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Custo de Picking (R$)</Label>
                        <Input
                          type="text"
                          placeholder="0,00"
                          value={local?.picking || ''}
                          onChange={(e) => setLocalConfigs(prev => ({
                            ...prev,
                            [service.code]: { ...prev[service.code], picking: e.target.value }
                          }))}
                          className="h-8 mt-1"
                        />
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Valor extra por envio (ex: R$ 7,00)
                        </p>
                      </div>
                      
                      <div>
                        <Label className="text-xs">Dias Extras de Postagem</Label>
                        <Input
                          type="number"
                          min="0"
                          max="30"
                          placeholder="0"
                          value={local?.days || ''}
                          onChange={(e) => setLocalConfigs(prev => ({
                            ...prev,
                            [service.code]: { ...prev[service.code], days: e.target.value }
                          }))}
                          className="h-8 mt-1"
                        />
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Dias úteis para expedição interna
                        </p>
                      </div>
                    </div>
                    
                    <Button 
                      size="sm" 
                      onClick={() => handleSaveConfig(service.code, service.name)}
                      disabled={isPending}
                    >
                      {updateConfig.isPending ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : null}
                      Salvar
                    </Button>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}
