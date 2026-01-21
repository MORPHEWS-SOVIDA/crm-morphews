import React, { useState, useEffect, useMemo } from 'react';
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
  ExternalLink,
  Wand2,
  ShoppingCart,
  Eye,
  ArrowRight,
  Play,
  Loader2,
  AlertCircle
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

interface DetectedField {
  key: string;
  value: any;
  suggested_target: string | null;
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
  
  // New fields for sales support
  const [eventMode, setEventMode] = useState<'lead' | 'sale' | 'both' | 'sac'>(
    (integration as any).event_mode || 'lead'
  );
  const [saleStatusOnCreate, setSaleStatusOnCreate] = useState(
    integration.sale_status_on_create || 'rascunho'
  );
  const [saleTag, setSaleTag] = useState(
    integration.sale_tag || 'VENDA ONLINE'
  );
  
  // SAC configuration
  const [sacCategory, setSacCategory] = useState<string>(
    (integration as any).sac_category || ''
  );
  const [sacSubcategory, setSacSubcategory] = useState<string>(
    (integration as any).sac_subcategory || ''
  );
  const [sacPriority, setSacPriority] = useState<string>(
    (integration as any).sac_priority || 'normal'
  );
  
  const [mappings, setMappings] = useState<FieldMappingRow[]>([]);
  const [showPayloadViewer, setShowPayloadViewer] = useState(false);
  const [detectedFields, setDetectedFields] = useState<DetectedField[]>([]);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [hasUnsavedMappings, setHasUnsavedMappings] = useState(false);

  // Initialize mappings from data
  useEffect(() => {
    if (fieldMappings) {
      setMappings(fieldMappings.map(m => ({
        id: m.id,
        source_field: m.source_field,
        target_field: m.target_field,
        transform_type: m.transform_type,
      })));
      setHasUnsavedMappings(false);
    }
  }, [fieldMappings]);

  // Show payload viewer automatically if there are mappings (keep configuration visible)
  useEffect(() => {
    if (fieldMappings && fieldMappings.length > 0) {
      setShowPayloadViewer(false); // Keep closed initially but show mappings
    }
  }, [fieldMappings]);

  // Get last payload for auto-mapping - look at ANY log, not just success
  // This allows field detection even when webhooks are failing
  const lastPayload = useMemo(() => {
    if (!logs || logs.length === 0) return null;
    
    // Priority: success/test logs first, then any log with request_payload
    const successLog = logs.find(l => 
      l.status === 'success' || (l.status as string) === 'test' || (l.status as string) === 'ping'
    );
    if (successLog?.request_payload) return successLog.request_payload;
    
    // Fall back to any log with a payload (including errors)
    const anyLogWithPayload = logs.find(l => l.request_payload && typeof l.request_payload === 'object');
    return anyLogWithPayload?.request_payload || null;
  }, [logs]);

  // Auto-detect fields from last payload - ALWAYS works, shows ALL fields
  const autoDetectFields = () => {
    if (!lastPayload) {
      toast.error('Nenhum payload recebido ainda. Envie um webhook primeiro.');
      return;
    }

    const payload = typeof lastPayload === 'object' ? lastPayload : {};
    const detected: DetectedField[] = [];
    
    // Known field aliases for auto-suggestion - only suggest fields that EXIST in our schema
    // Note: 'cpf' is NOT a valid field in leads table, so we removed it
    const fieldAliases: Record<string, string[]> = {
      name: ['name', 'nome', 'nome_completo', 'full_name', 'fullName', 'customer_name', 'customerName', 'buyer_name', 'buyerName', 'contact_name'],
      email: ['email', 'e-mail', 'mail', 'customer_email', 'customerEmail', 'buyer_email', 'buyerEmail', 'contact_email'],
      whatsapp: ['whatsapp', 'phone', 'phone_number', 'phoneNumber', 'telefone', 'celular', 'mobile', 'tel', 'fone', 'customer_phone', 'customerPhone', 'buyer_phone', 'contact_phone', 'numero_telefone', 'numero_whatsapp'],
      observations: ['observations', 'observacoes', 'notes', 'notas', 'observacao', 'comments', 'comentarios', 'message', 'mensagem'],
      address_street: ['street', 'rua', 'endereco', 'address', 'logradouro', 'street_name', 'streetName'],
      address_number: ['number', 'numero', 'street_number', 'streetNumber', 'num', 'house_number'],
      address_complement: ['complement', 'complemento', 'comp', 'apartment', 'apto', 'suite'],
      address_neighborhood: ['neighborhood', 'bairro', 'district', 'zona'],
      address_city: ['city', 'cidade', 'municipio', 'town'],
      address_state: ['state', 'estado', 'uf', 'province', 'region'],
      address_cep: ['cep', 'zipcode', 'zip', 'postal_code', 'postalCode', 'zip_code', 'zipCode', 'codigo_postal'],
      sale_product_name: ['product_name', 'productName', 'item_name', 'itemName', 'product.name', 'offer.name', 'product_title'],
      sale_product_sku: ['sku', 'product_sku', 'productSku', 'product_code', 'productCode', 'product.code', 'item_sku'],
      sale_total_cents: ['total', 'valor', 'value', 'amount', 'price', 'total_price', 'totalPrice', 'full_price', 'preco'],
      sale_external_id: ['order_id', 'orderId', 'pedido_id', 'transaction_id', 'transactionId', 'external_id', 'externalId', 'transaction', 'id_pedido'],
    };

    const flattenPayload = (obj: any, prefix = ''): void => {
      if (!obj || typeof obj !== 'object') return;
      
      for (const key of Object.keys(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        const value = obj[key];
        
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
          flattenPayload(value, fullKey);
        } else {
          // Try to suggest a target field based on key name
          let suggested: string | null = null;
          const lowerKey = key.toLowerCase().replace(/[_\s-]/g, '');
          
          for (const [target, aliases] of Object.entries(fieldAliases)) {
            if (aliases.some(a => a.replace(/[_\s-]/g, '') === lowerKey)) {
              suggested = target;
              break;
            }
          }
          
          // Add ALL fields to detected list - user will choose to map or ignore
          detected.push({
            key: fullKey,
            value: value,
            suggested_target: suggested, // null means user needs to decide
          });
        }
      }
    };

    // Handle body_raw if present (from wrapped payload)
    let actualPayload = payload;
    try {
      if (payload.body_raw && typeof payload.body_raw === 'string') {
        actualPayload = JSON.parse(payload.body_raw);
      }
    } catch {
      // Keep original payload if parsing fails
    }
    
    flattenPayload(actualPayload);
    
    // Always show results, even if empty
    setDetectedFields(detected);
    setShowPayloadViewer(true);
    
    if (detected.length === 0) {
      toast.info('Nenhum campo encontrado no payload. Verifique os logs.');
    } else {
      toast.success(`${detected.length} campos detectados! Configure o mapeamento abaixo.`);
    }
  };

  // Apply detected field as mapping
  const applyDetectedField = (field: DetectedField, targetField: string) => {
    if (targetField === '__ignore__') return;
    
    const existingIndex = mappings.findIndex(m => m.target_field === targetField);
    
    if (existingIndex >= 0) {
      // Update existing mapping
      setMappings(mappings.map((m, i) => 
        i === existingIndex 
          ? { ...m, source_field: field.key }
          : m
      ));
    } else {
      // Add new mapping
      setMappings([
        ...mappings,
        {
          id: `new-${Date.now()}`,
          source_field: field.key,
          target_field: targetField,
          transform_type: targetField === 'whatsapp' ? 'phone_normalize' : 'direct',
        },
      ]);
    }
    
    setHasUnsavedMappings(true);
    toast.success(`Campo "${field.key}" mapeado para "${targetField}"`);
  };

  // Reset mappings to detect new fields
  const resetMappings = () => {
    setMappings([]);
    setDetectedFields([]);
    setShowPayloadViewer(false);
    setHasUnsavedMappings(true);
    toast.info('Mapeamentos resetados. Clique em "Ver Dados Recebidos" para recomeçar.');
  };

  const webhookUrl = getWebhookUrl(integration.auth_token);
  const webhookTestUrl = `${webhookUrl}&test=1`;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast.success('URL copiada!');
  };

  const handleTestWebhook = async () => {
    setIsTesting(true);
    setTestResult(null);
    
    try {
      const response = await fetch(webhookTestUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          test: true, 
          source: 'crm_test',
          timestamp: new Date().toISOString(),
          sample_data: {
            name: 'Teste CRM',
            whatsapp: '5511999999999',
            email: 'teste@exemplo.com'
          }
        }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setTestResult({ 
          success: true, 
          message: 'Webhook funcionando! O teste foi registrado nos logs.' 
        });
        toast.success('Webhook funcionando corretamente!');
      } else {
        setTestResult({ 
          success: false, 
          message: data.error || 'Erro ao testar webhook' 
        });
        toast.error(data.error || 'Erro ao testar webhook');
      }
    } catch (error) {
      setTestResult({ 
        success: false, 
        message: 'Erro de conexão. Verifique sua internet.' 
      });
      toast.error('Erro ao conectar com o webhook');
    } finally {
      setIsTesting(false);
    }
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
      event_mode: eventMode,
      sale_status_on_create: saleStatusOnCreate,
      sale_tag: saleTag,
      sac_category: sacCategory || null,
      sac_subcategory: sacSubcategory || null,
      sac_priority: sacPriority || 'normal',
    } as any);
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
    setHasUnsavedMappings(true);
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
    setHasUnsavedMappings(false);
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
      case 'test':
      case 'ping':
        return <Eye className="h-4 w-4 text-blue-500" />;
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

  // Get already mapped target fields to disable duplicates
  const usedTargetFields = useMemo(() => {
    return new Set(mappings.map(m => m.target_field));
  }, [mappings]);

  // Group target fields
  const groupedTargetFields = useMemo(() => {
    const groups: Record<string, typeof TARGET_FIELDS> = {
      lead: [],
      address: [],
      sale: [],
      custom: [],
    };
    
    TARGET_FIELDS.forEach(field => {
      const group = (field as any).group || 'lead';
      if (groups[group]) {
        groups[group].push(field);
      }
    });
    
    return groups;
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] sm:max-h-[90vh] flex flex-col overflow-hidden">
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
          <TabsList className="grid w-full grid-cols-5">
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
            <TabsTrigger value="sales" className="gap-2">
              <ShoppingCart className="h-4 w-4" />
              Vendas
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-2">
              <Activity className="h-4 w-4" />
              Logs
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 pr-4 touch-pan-y" style={{ WebkitOverflowScrolling: 'touch' }}>
            <TabsContent value="config" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">URLs do Webhook</CardTitle>
                  <CardDescription>
                    Cole estas URLs no sistema externo (Payt, Hotmart, etc)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* URL de Teste */}
                  <div className="p-4 border-2 border-dashed border-blue-500/50 rounded-lg bg-blue-500/5">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="secondary" className="bg-blue-500/20 text-blue-700 dark:text-blue-400">
                        1º PASSO - TESTE
                      </Badge>
                    </div>
                    <Label className="text-sm font-medium mb-2 block">URL de Teste (use primeiro!)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        readOnly
                        value={webhookTestUrl}
                        className="font-mono text-xs bg-background"
                      />
                      <Button 
                        size="icon" 
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(webhookTestUrl);
                          toast.success('URL de teste copiada!');
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      ✅ Use esta URL para testar na Payt. Ela registra nos logs mas <strong>não cria leads/vendas</strong>.
                    </p>
                  </div>

                  {/* URL de Produção */}
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="secondary" className="bg-green-500/20 text-green-700 dark:text-green-400">
                        2º PASSO - PRODUÇÃO
                      </Badge>
                    </div>
                    <Label className="text-sm font-medium mb-2 block">URL de Produção</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        readOnly
                        value={webhookUrl}
                        className="font-mono text-xs"
                      />
                      <Button size="icon" variant="outline" onClick={handleCopyUrl}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      ⚠️ Após validar o teste, troque para esta URL. Ela <strong>cria leads/vendas de verdade</strong>.
                    </p>
                  </div>

                  {/* Testar conexão do CRM */}
                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <Label className="text-sm font-medium">Testar Conexão (do CRM)</Label>
                        <p className="text-xs text-muted-foreground">Verifica se nosso servidor está funcionando</p>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={handleTestWebhook}
                        disabled={isTesting}
                      >
                        {isTesting ? (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4 mr-1" />
                        )}
                        {isTesting ? 'Testando...' : 'Testar'}
                      </Button>
                    </div>
                    
                    {testResult && (
                      <div className={`p-3 rounded-lg flex items-start gap-2 ${
                        testResult.success 
                          ? 'bg-green-500/10 text-green-700 dark:text-green-400' 
                          : 'bg-red-500/10 text-red-700 dark:text-red-400'
                      }`}>
                        {testResult.success ? (
                          <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                        ) : (
                          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                        )}
                        <span className="text-sm">{testResult.message}</span>
                      </div>
                    )}
                  </div>

                  <div className="p-3 bg-muted rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                      <div className="text-xs text-muted-foreground">
                        <p className="font-medium mb-1">Como configurar na Payt:</p>
                        <ol className="list-decimal list-inside space-y-0.5">
                          <li>Copie a <strong>URL de Teste</strong> acima</li>
                          <li>Cole na Payt e clique em Salvar</li>
                          <li>Volte aqui e veja a aba "Logs" - deve aparecer o evento de teste</li>
                          <li>Se funcionou, troque para a <strong>URL de Produção</strong> na Payt</li>
                        </ol>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Modo de Evento</CardTitle>
                  <CardDescription>
                    O sistema sempre busca o lead pelo WhatsApp antes de criar ou atualizar
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { value: 'lead', label: 'Criar/Atualizar Lead', desc: 'Cria ou atualiza lead existente', icon: '👤' },
                      { value: 'sale', label: 'Lead + Venda', desc: 'Cria/atualiza lead e gera venda', icon: '💰' },
                      { value: 'both', label: 'Lead + Venda (Completo)', desc: 'Lead + venda com todos os dados', icon: '📦' },
                      { value: 'sac', label: 'Lead + SAC', desc: 'Cria/atualiza lead e abre chamado', icon: '🎧' },
                    ].map(mode => (
                      <div
                        key={mode.value}
                        onClick={() => setEventMode(mode.value as any)}
                        className={`
                          p-3 rounded-lg border-2 cursor-pointer transition-all
                          ${eventMode === mode.value 
                            ? 'border-primary bg-primary/5' 
                            : 'border-muted hover:border-muted-foreground/50'
                          }
                        `}
                      >
                        <div className="text-xl mb-1">{mode.icon}</div>
                        <div className="font-medium text-sm">{mode.label}</div>
                        <div className="text-xs text-muted-foreground">{mode.desc}</div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Info box explaining the logic */}
                  <div className="p-3 bg-blue-500/10 rounded-lg text-sm">
                    <p className="font-medium text-blue-700 dark:text-blue-400 mb-1 flex items-center gap-1">
                      <span>💡</span> Como funciona:
                    </p>
                    <ul className="text-xs text-muted-foreground space-y-0.5">
                      <li>• O WhatsApp é a <strong>chave única</strong> para identificar o cliente</li>
                      <li>• Se o lead já existe: atualiza os dados e adiciona observações</li>
                      <li>• Se não existe: cria um novo lead automaticamente</li>
                      <li>• Vendas e SAC são sempre vinculados ao lead encontrado/criado</li>
                    </ul>
                  </div>
                  
                  {/* SAC Configuration - only show when SAC mode is selected */}
                  {eventMode === 'sac' && (
                    <div className="border-t pt-4 space-y-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-purple-600">
                        <span>🎧</span>
                        Configuração do Chamado SAC
                      </div>
                      
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Categoria do Chamado *</Label>
                          <Select value={sacCategory} onValueChange={(v) => {
                            setSacCategory(v);
                            setSacSubcategory(''); // Reset subcategory when category changes
                          }}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a categoria" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="complaint">Reclamação</SelectItem>
                              <SelectItem value="question">Dúvida</SelectItem>
                              <SelectItem value="request">Solicitação</SelectItem>
                              <SelectItem value="financial">Financeiro</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Subcategoria *</Label>
                          <Select value={sacSubcategory} onValueChange={setSacSubcategory}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a subcategoria" />
                            </SelectTrigger>
                            <SelectContent>
                              {sacCategory === 'complaint' && (
                                <>
                                  <SelectItem value="Produto não entregue">Produto não entregue</SelectItem>
                                  <SelectItem value="Produto divergente">Produto divergente</SelectItem>
                                  <SelectItem value="Cobrança indevida">Cobrança indevida</SelectItem>
                                  <SelectItem value="Promessa não cumprida">Promessa não cumprida</SelectItem>
                                  <SelectItem value="Mal atendimento">Mal atendimento</SelectItem>
                                </>
                              )}
                              {sacCategory === 'question' && (
                                <>
                                  <SelectItem value="Como usar o produto">Como usar o produto</SelectItem>
                                  <SelectItem value="Como rastrear">Como rastrear</SelectItem>
                                  <SelectItem value="Como pagar">Como pagar</SelectItem>
                                </>
                              )}
                              {sacCategory === 'request' && (
                                <>
                                  <SelectItem value="2ª via boleto">2ª via boleto</SelectItem>
                                  <SelectItem value="Troca">Troca</SelectItem>
                                  <SelectItem value="Reenvio">Reenvio</SelectItem>
                                  <SelectItem value="Ajuste de cadastro">Ajuste de cadastro</SelectItem>
                                </>
                              )}
                              {sacCategory === 'financial' && (
                                <>
                                  <SelectItem value="Renegociação">Renegociação</SelectItem>
                                  <SelectItem value="Cancelamento">Cancelamento</SelectItem>
                                  <SelectItem value="Estorno">Estorno</SelectItem>
                                  <SelectItem value="Chargeback">Chargeback</SelectItem>
                                </>
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Prioridade</Label>
                        <Select value={sacPriority} onValueChange={setSacPriority}>
                          <SelectTrigger className="w-48">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Baixa</SelectItem>
                            <SelectItem value="normal">Normal</SelectItem>
                            <SelectItem value="high">Alta</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="p-3 bg-purple-500/10 rounded-lg text-sm">
                        <p className="font-medium text-purple-700 dark:text-purple-400 mb-1">
                          ℹ️ Como funciona o modo SAC:
                        </p>
                        <ul className="text-xs text-muted-foreground space-y-1">
                          <li>• O webhook irá criar/encontrar o lead pelo WhatsApp ou email</li>
                          <li>• Um chamado SAC será criado na coluna "Não Tratados"</li>
                          <li>• A equipe de SAC poderá visualizar e tratar o chamado</li>
                          <li>• Ideal para: chargebacks, cancelamentos, reclamações externas</li>
                        </ul>
                      </div>
                    </div>
                  )}
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
                    <div className="flex gap-2">
                      {mappings.length > 0 && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={resetMappings}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Resetar Mapeamentos
                        </Button>
                      )}
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={autoDetectFields}
                        disabled={!lastPayload}
                      >
                        <Wand2 className="h-4 w-4 mr-1" />
                        {mappings.length > 0 ? 'Ver Dados Recebidos' : 'Detectar Campos'}
                      </Button>
                      <Button size="sm" onClick={handleAddMapping}>
                        <Plus className="h-4 w-4 mr-1" />
                        Adicionar
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {!lastPayload && (
                    <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground">
                      <p>💡 <strong>Dica:</strong> Envie um webhook de teste para que possamos detectar automaticamente os campos disponíveis.</p>
                    </div>
                  )}

                  {showPayloadViewer && detectedFields.length > 0 && (
                    <div className="border rounded-lg p-4 bg-muted/30">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium">Campos Detectados no Último Payload</h4>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => setShowPayloadViewer(false)}
                        >
                          Fechar
                        </Button>
                      </div>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {detectedFields.map((field, idx) => (
                          <div 
                            key={idx}
                            className="flex items-center gap-2 p-2 bg-background rounded border"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="font-mono text-sm truncate">{field.key}</div>
                              <div className="text-xs text-muted-foreground truncate">
                                {String(field.value).slice(0, 50)}
                              </div>
                            </div>
                            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                            <Select
                              value={field.suggested_target || ''}
                              onValueChange={(v) => applyDetectedField(field, v)}
                            >
                              <SelectTrigger className="w-40">
                                <SelectValue placeholder="Mapear para..." />
                              </SelectTrigger>
                              <SelectContent className="max-h-64">
                                <SelectItem value="__ignore__">Ignorar</SelectItem>
                                {Object.entries(groupedTargetFields).map(([group, fields]) => (
                                  <React.Fragment key={group}>
                                    {fields.length > 0 && (
                                      <>
                                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase">
                                          {group === 'lead' ? 'Lead' : group === 'address' ? 'Endereço' : group === 'custom' ? 'Personalizados' : 'Venda'}
                                        </div>
                                        {fields.map(f => {
                                          const isUsed = usedTargetFields.has(f.value);
                                          return (
                                            <SelectItem 
                                              key={f.value} 
                                              value={f.value}
                                              disabled={isUsed}
                                              className={isUsed ? 'opacity-50' : ''}
                                            >
                                              {f.label} {isUsed && '(já mapeado)'}
                                            </SelectItem>
                                          );
                                        })}
                                      </>
                                    )}
                                  </React.Fragment>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {mappings.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Nenhum mapeamento configurado</p>
                      <p className="text-sm">O sistema tentará detectar campos automaticamente</p>
                    </div>
                  ) : (
                    mappings.map((mapping) => (
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
                            <SelectContent className="max-h-64">
                              {Object.entries(groupedTargetFields).map(([group, fields]) => (
                                <React.Fragment key={group}>
                                  {fields.length > 0 && (
                                    <>
                                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase">
                                        {group === 'lead' ? 'Lead' : group === 'address' ? 'Endereço' : group === 'custom' ? 'Personalizados' : 'Venda'}
                                      </div>
                                      {fields.map(f => {
                                        const isUsedByOther = usedTargetFields.has(f.value) && mapping.target_field !== f.value;
                                        return (
                                          <SelectItem 
                                            key={f.value} 
                                            value={f.value}
                                            disabled={isUsedByOther}
                                            className={isUsedByOther ? 'opacity-50' : ''}
                                          >
                                            {f.label} {isUsedByOther && '(já mapeado)'}
                                          </SelectItem>
                                        );
                                      })}
                                    </>
                                  )}
                                </React.Fragment>
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
                  
                  {(mappings.length > 0 || hasUnsavedMappings) && (
                    <div className="flex items-center justify-between pt-4 border-t">
                      <div className="flex items-center gap-2">
                        {hasUnsavedMappings && (
                          <Badge variant="outline" className="text-orange-600 border-orange-300 bg-orange-50 dark:bg-orange-950/30">
                            Alterações não salvas
                          </Badge>
                        )}
                        {!hasUnsavedMappings && mappings.length > 0 && (
                          <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50 dark:bg-green-950/30">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Mapeamentos salvos
                          </Badge>
                        )}
                      </div>
                      <Button 
                        onClick={handleSaveMappings} 
                        disabled={saveFieldMappings.isPending || !hasUnsavedMappings}
                      >
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

            <TabsContent value="sales" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Configuração de Vendas</CardTitle>
                  <CardDescription>
                    Configure como vendas serão criadas quando o webhook enviar dados de venda
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {eventMode === 'lead' && (
                    <div className="p-4 bg-muted rounded-lg text-center">
                      <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-muted-foreground">
                        Esta integração está configurada apenas para criar leads.
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Altere o "Modo de Evento" na aba Configuração para habilitar vendas.
                      </p>
                    </div>
                  )}

                  {eventMode !== 'lead' && (
                    <>
                      <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                        <p className="text-sm">
                          <strong>📦 Vendas Online:</strong> Quando um webhook enviar dados de venda, 
                          será criada uma venda com status <Badge variant="secondary">{saleStatusOnCreate}</Badge> 
                          e tag <Badge>{saleTag}</Badge> para revisão antes de ir para expedição.
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Status Inicial da Venda</Label>
                          <Select value={saleStatusOnCreate} onValueChange={setSaleStatusOnCreate}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="rascunho">Rascunho (Aguardando Revisão)</SelectItem>
                              <SelectItem value="pendente">Pendente (Aguardando Pagamento)</SelectItem>
                              <SelectItem value="pago">Pago (Pronto para Expedição)</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            Recomendamos "Rascunho" para revisão manual
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label>Tag da Venda</Label>
                          <Input
                            value={saleTag}
                            onChange={(e) => setSaleTag(e.target.value)}
                            placeholder="Ex: VENDA ONLINE"
                          />
                          <p className="text-xs text-muted-foreground">
                            Tag para identificar vendas desta integração
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Campos de Venda no Mapeamento</Label>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="p-2 bg-muted rounded">
                            <span className="font-mono text-xs">sale_total_cents</span>
                            <span className="text-muted-foreground text-xs block">Valor em centavos</span>
                          </div>
                          <div className="p-2 bg-muted rounded">
                            <span className="font-mono text-xs">sale_external_id</span>
                            <span className="text-muted-foreground text-xs block">ID do pedido externo</span>
                          </div>
                          <div className="p-2 bg-muted rounded">
                            <span className="font-mono text-xs">sale_external_url</span>
                            <span className="text-muted-foreground text-xs block">Link para o pedido</span>
                          </div>
                          <div className="p-2 bg-muted rounded">
                            <span className="font-mono text-xs">sale_product_name</span>
                            <span className="text-muted-foreground text-xs block">Nome do produto</span>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Configure estes campos na aba "Mapeamento" para capturar dados de venda
                        </p>
                      </div>

                      <div className="flex justify-end pt-2">
                        <Button onClick={handleSaveConfig} disabled={updateIntegration.isPending}>
                          {updateIntegration.isPending ? 'Salvando...' : 'Salvar Configurações'}
                        </Button>
                      </div>
                    </>
                  )}
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