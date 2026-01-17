import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Copy, 
  Plus, 
  Trash2, 
  Settings, 
  MapPin, 
  Users, 
  FileText,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Integration,
  IntegrationFieldMapping,
  IntegrationLog,
  useIntegrationFieldMappings,
  useIntegrationLogs,
  useUpdateIntegration,
  useSaveFieldMappings,
  getWebhookUrl,
  TARGET_FIELDS,
  TRANSFORM_TYPES,
} from '@/hooks/useIntegrations';
import { useProducts } from '@/hooks/useProducts';
import { useUsers } from '@/hooks/useUsers';
import { useNonPurchaseReasons } from '@/hooks/useNonPurchaseReasons';
import { useFunnelStages } from '@/hooks/useFunnelStages';
import { FUNNEL_STAGES } from '@/types/lead';

interface IntegrationDetailDialogProps {
  integration: Integration;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FieldMappingRow {
  id: string;
  source_field: string;
  target_field: string;
  transform_type: string;
}

export function IntegrationDetailDialog({ 
  integration, 
  open, 
  onOpenChange 
}: IntegrationDetailDialogProps) {
  const { data: fieldMappings } = useIntegrationFieldMappings(integration.id);
  const { data: logs } = useIntegrationLogs(integration.id, 20);
  const { data: products } = useProducts();
  const { data: users } = useUsers();
  const { data: nonPurchaseReasons } = useNonPurchaseReasons();
  const { data: funnelStages } = useFunnelStages();
  
  const updateIntegration = useUpdateIntegration();
  const saveFieldMappings = useSaveFieldMappings();

  const [activeTab, setActiveTab] = useState('config');
  const [isActive, setIsActive] = useState(integration.status === 'active');
  const [defaultStage, setDefaultStage] = useState(integration.default_stage || 'cloud');
  const [defaultProductId, setDefaultProductId] = useState(integration.default_product_id || '');
  const [defaultResponsibles, setDefaultResponsibles] = useState<string[]>(
    integration.default_responsible_user_ids || []
  );
  const [autoFollowupDays, setAutoFollowupDays] = useState(
    integration.auto_followup_days?.toString() || ''
  );
  const [nonPurchaseReasonId, setNonPurchaseReasonId] = useState(
    integration.non_purchase_reason_id || ''
  );
  
  const [mappings, setMappings] = useState<FieldMappingRow[]>([]);

  // Initialize mappings from data
  useEffect(() => {
    if (fieldMappings) {
      setMappings(fieldMappings.map(m => ({
        id: m.id,
        source_field: m.source_field,
        target_field: m.target_field,
        transform_type: m.transform_type,
      })));
    }
  }, [fieldMappings]);

  const webhookUrl = getWebhookUrl(integration.auth_token);

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast.success('URL copiada!');
  };

  const handleToggleStatus = async () => {
    const newStatus = isActive ? 'inactive' : 'active';
    await updateIntegration.mutateAsync({
      id: integration.id,
      status: newStatus,
    });
    setIsActive(!isActive);
  };

  const handleSaveConfig = async () => {
    await updateIntegration.mutateAsync({
      id: integration.id,
      default_stage: defaultStage,
      default_product_id: defaultProductId || null,
      default_responsible_user_ids: defaultResponsibles.length > 0 ? defaultResponsibles : null,
      auto_followup_days: autoFollowupDays ? parseInt(autoFollowupDays) : null,
      non_purchase_reason_id: nonPurchaseReasonId || null,
    });
    toast.success('Configurações salvas!');
  };

  const handleAddMapping = () => {
    setMappings([
      ...mappings,
      {
        id: `new-${Date.now()}`,
        source_field: '',
        target_field: 'name',
        transform_type: 'direct',
      },
    ]);
  };

  const handleRemoveMapping = (id: string) => {
    setMappings(mappings.filter(m => m.id !== id));
  };

  const handleUpdateMapping = (id: string, field: keyof FieldMappingRow, value: string) => {
    setMappings(mappings.map(m => 
      m.id === id ? { ...m, [field]: value } : m
    ));
  };

  const handleSaveMappings = async () => {
    const validMappings = mappings.filter(m => m.source_field.trim());
    await saveFieldMappings.mutateAsync({
      integrationId: integration.id,
      mappings: validMappings.map(m => ({
        source_field: m.source_field,
        target_field: m.target_field,
        transform_type: m.transform_type,
      })),
    });
  };

  const handleToggleResponsible = (userId: string) => {
    if (defaultResponsibles.includes(userId)) {
      setDefaultResponsibles(defaultResponsibles.filter(id => id !== userId));
    } else {
      setDefaultResponsibles([...defaultResponsibles, userId]);
    }
  };

  const renderLogStatus = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  // Get available stages
  const availableStages = funnelStages?.length 
    ? funnelStages.filter(s => (s as any).is_active !== false).map(s => ({ 
        value: (s as any).stage_key || (s as any).key || s.id, 
        label: (s as any).display_name || (s as any).label || (s as any).name 
      }))
    : Object.entries(FUNNEL_STAGES).map(([key, val]) => ({ value: key, label: val.label }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl">{integration.name}</DialogTitle>
              <DialogDescription>
                {integration.description || 'Configure sua integração'}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="status-toggle" className="text-sm">
                {isActive ? 'Ativa' : 'Inativa'}
              </Label>
              <Switch
                id="status-toggle"
                checked={isActive}
                onCheckedChange={handleToggleStatus}
              />
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="config" className="gap-2">
              <Settings className="h-4 w-4" />
              Configuração
            </TabsTrigger>
            <TabsTrigger value="mappings" className="gap-2">
              <MapPin className="h-4 w-4" />
              Mapeamento
            </TabsTrigger>
            <TabsTrigger value="lead" className="gap-2">
              <Users className="h-4 w-4" />
              Lead
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-2">
              <Activity className="h-4 w-4" />
              Logs
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 pr-4">
            <TabsContent value="config" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">URL do Webhook</CardTitle>
                  <CardDescription>
                    Use esta URL para receber dados de sistemas externos
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Input
                      readOnly
                      value={webhookUrl}
                      className="font-mono text-sm"
                    />
                    <Button size="icon" variant="outline" onClick={handleCopyUrl}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Configure esta URL no sistema externo (Payt, Hotmart, etc) para receber webhooks.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Token de Autenticação</CardTitle>
                  <CardDescription>
                    Token único desta integração (mantido seguro na URL)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Input
                      readOnly
                      value={integration.auth_token}
                      type="password"
                      className="font-mono"
                    />
                    <Button 
                      size="icon" 
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(integration.auth_token);
                        toast.success('Token copiado!');
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="mappings" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">Mapeamento de Campos</CardTitle>
                      <CardDescription>
                        Configure como os campos do webhook são mapeados para os campos do lead
                      </CardDescription>
                    </div>
                    <Button size="sm" onClick={handleAddMapping}>
                      <Plus className="h-4 w-4 mr-1" />
                      Adicionar
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {mappings.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Nenhum mapeamento configurado</p>
                      <p className="text-sm">O sistema tentará detectar campos automaticamente</p>
                    </div>
                  ) : (
                    mappings.map((mapping, index) => (
                      <div 
                        key={mapping.id}
                        className="grid grid-cols-12 gap-2 items-center p-2 border rounded-lg"
                      >
                        <div className="col-span-4">
                          <Input
                            placeholder="Campo origem (ex: nome_completo)"
                            value={mapping.source_field}
                            onChange={(e) => handleUpdateMapping(mapping.id, 'source_field', e.target.value)}
                          />
                        </div>
                        <div className="col-span-1 text-center text-muted-foreground">→</div>
                        <div className="col-span-3">
                          <Select
                            value={mapping.target_field}
                            onValueChange={(v) => handleUpdateMapping(mapping.id, 'target_field', v)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {TARGET_FIELDS.map(f => (
                                <SelectItem key={f.value} value={f.value}>
                                  {f.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-3">
                          <Select
                            value={mapping.transform_type}
                            onValueChange={(v) => handleUpdateMapping(mapping.id, 'transform_type', v)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {TRANSFORM_TYPES.map(t => (
                                <SelectItem key={t.value} value={t.value}>
                                  {t.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => handleRemoveMapping(mapping.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                  
                  {mappings.length > 0 && (
                    <div className="flex justify-end pt-2">
                      <Button onClick={handleSaveMappings} disabled={saveFieldMappings.isPending}>
                        {saveFieldMappings.isPending ? 'Salvando...' : 'Salvar Mapeamentos'}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="lead" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Configuração do Lead</CardTitle>
                  <CardDescription>
                    Defina como os leads serão criados a partir desta integração
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Etapa Inicial do Lead</Label>
                      <Select value={defaultStage} onValueChange={setDefaultStage}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {availableStages.map(stage => (
                            <SelectItem key={stage.value} value={stage.value}>
                              {stage.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Followup Automático (dias)</Label>
                      <Input
                        type="number"
                        min="0"
                        placeholder="Ex: 3"
                        value={autoFollowupDays}
                        onChange={(e) => setAutoFollowupDays(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Produto Associado</Label>
                    <Select
                      value={defaultProductId || '__none__'}
                      onValueChange={(v) => setDefaultProductId(v === '__none__' ? '' : v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Nenhum produto" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Nenhum</SelectItem>
                        {products?.filter(p => p.is_active).map(product => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      O lead já terá este produto associado para histórico
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Motivo de Não Compra</Label>
                    <Select
                      value={nonPurchaseReasonId || '__none__'}
                      onValueChange={(v) => setNonPurchaseReasonId(v === '__none__' ? '' : v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Nenhum motivo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Nenhum</SelectItem>
                        {nonPurchaseReasons?.filter(r => r.is_active).map(reason => (
                          <SelectItem key={reason.id} value={reason.id}>
                            {reason.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Marcar lead com este motivo para mensagens automáticas
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Responsáveis Padrão</Label>
                    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded-lg p-2">
                      {users?.map(user => (
                        <div
                          key={user.id}
                          className={`
                            flex items-center gap-2 p-2 rounded cursor-pointer transition-colors
                            ${defaultResponsibles.includes(user.id) 
                              ? 'bg-primary/10 border border-primary' 
                              : 'hover:bg-muted'
                            }
                          `}
                          onClick={() => handleToggleResponsible(user.id)}
                        >
                          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                            {user.first_name?.[0]}{user.last_name?.[0]}
                          </div>
                          <span className="text-sm truncate">
                            {user.first_name} {user.last_name}
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Leads serão atribuídos a estes responsáveis
                    </p>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button onClick={handleSaveConfig} disabled={updateIntegration.isPending}>
                      {updateIntegration.isPending ? 'Salvando...' : 'Salvar Configurações'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="logs" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Logs de Execução</CardTitle>
                  <CardDescription>
                    Últimas 20 chamadas desta integração
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!logs || logs.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Nenhum log registrado ainda</p>
                      <p className="text-sm">Os logs aparecerão aqui após receber webhooks</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {logs.map(log => (
                        <div 
                          key={log.id}
                          className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                        >
                          {renderLogStatus(log.status)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className="text-xs">
                                {log.direction === 'inbound' ? 'Entrada' : 'Saída'}
                              </Badge>
                              {log.event_type && (
                                <Badge variant="secondary" className="text-xs">
                                  {log.event_type}
                                </Badge>
                              )}
                              {log.lead_id && (
                                <Badge variant="default" className="text-xs">
                                  Lead criado
                                </Badge>
                              )}
                            </div>
                            {log.error_message && (
                              <p className="text-sm text-red-500 mt-1">
                                {log.error_message}
                              </p>
                            )}
                            {log.request_payload && (
                              <details className="mt-2">
                                <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                                  Ver payload
                                </summary>
                                <pre className="mt-1 text-xs bg-muted p-2 rounded overflow-x-auto max-h-32">
                                  {JSON.stringify(log.request_payload, null, 2)}
                                </pre>
                              </details>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1 text-sm text-muted-foreground whitespace-nowrap">
                            {log.processing_time_ms && (
                              <span className="text-xs">{log.processing_time_ms}ms</span>
                            )}
                            <span className="text-xs">
                              {formatDistanceToNow(new Date(log.created_at), { 
                                addSuffix: true, 
                                locale: ptBR 
                              })}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
