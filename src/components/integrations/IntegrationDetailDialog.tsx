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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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
  AlertCircle,
  MessageSquare,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Integration,
  IntegrationFieldMapping,
  IntegrationLog,
  TriggerRule,
  useIntegrations,
  useIntegrationFieldMappings,
  useIntegrationLogs,
  useUpdateIntegration,
  useSaveFieldMappings,
  getWebhookUrl,
  TARGET_FIELDS,
  TRANSFORM_TYPES,
} from '@/hooks/useIntegrations';
import { IntegrationTriggerRules } from './IntegrationTriggerRules';
import { useCustomFieldDefinitions } from '@/hooks/useLeadCustomFields';
import { useProducts } from '@/hooks/useProducts';
import { useUsers } from '@/hooks/useUsers';
import { useNonPurchaseReasons } from '@/hooks/useNonPurchaseReasons';
import { useFunnelStages, getStageEnumValue } from '@/hooks/useFunnelStages';
import { FUNNEL_STAGES } from '@/types/lead';
import { useWhatsAppInstances } from '@/hooks/useWhatsAppInstances';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';

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
  const { data: customFieldDefs = [] } = useCustomFieldDefinitions();
  const { data: allIntegrations } = useIntegrations();
  
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
  const [sacDefaultDescription, setSacDefaultDescription] = useState<string>(
    (integration as any).sac_default_description || ''
  );
  
  // Seller and trigger rules for sales
  const [defaultSellerId, setDefaultSellerId] = useState<string>(
    integration.default_seller_id || ''
  );
  const [triggerRules, setTriggerRules] = useState<TriggerRule[]>(
    integration.trigger_rules || []
  );
  const [triggerRulesLogic, setTriggerRulesLogic] = useState<'AND' | 'OR'>(
    integration.trigger_rules_logic || 'AND'
  );
  
  // Auto-message state
  const [autoMessageEnabled, setAutoMessageEnabled] = useState(
    (integration as any).auto_message_enabled || false
  );
  const [autoMessageText, setAutoMessageText] = useState(
    (integration as any).auto_message_text || ''
  );
  const [autoMessageInstanceIds, setAutoMessageInstanceIds] = useState<string[]>(
    (integration as any).auto_message_instance_ids || []
  );
  const [autoMessageRotationEnabled, setAutoMessageRotationEnabled] = useState(
    (integration as any).auto_message_rotation_enabled || false
  );
  
  // Deduplication settings
  const [dedupCooldownMinutes, setDedupCooldownMinutes] = useState<string>(
    (integration as any).dedup_cooldown_minutes?.toString() || ''
  );
  const [stagePriorityOverride, setStagePriorityOverride] = useState(
    (integration as any).stage_priority_override || false
  );

  // WhatsApp instances for auto-message
  const { data: whatsappInstances } = useWhatsAppInstances();

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
  // Ensures each target field is only auto-suggested ONCE (no duplicates)
  // Non-recognized fields default to "IGNORAR"
  const autoDetectFields = () => {
    if (!lastPayload) {
      toast.error('Nenhum payload recebido ainda. Envie um webhook primeiro.');
      return;
    }

    const payload = typeof lastPayload === 'object' ? lastPayload : {};
    const detected: DetectedField[] = [];
    
    // Track which target fields have already been auto-suggested to prevent duplicates
    const alreadySuggestedTargets = new Set<string>();
    
    // Known field aliases for auto-suggestion
    const fieldAliases: Record<string, string[]> = {
      name: ['name', 'nome', 'nome_completo', 'full_name', 'fullName', 'customer_name', 'customerName', 'buyer_name', 'buyerName', 'contact_name'],
      email: ['email', 'e-mail', 'mail', 'customer_email', 'customerEmail', 'buyer_email', 'buyerEmail', 'contact_email'],
      whatsapp: ['whatsapp', 'phone', 'phone_number', 'phoneNumber', 'telefone', 'celular', 'mobile', 'tel', 'fone', 'customer_phone', 'customerPhone', 'buyer_phone', 'contact_phone', 'numero_telefone', 'numero_whatsapp'],
      cpf: ['cpf', 'cnpj', 'cpf_cnpj', 'documento', 'document', 'doc', 'tax_id', 'taxId'],
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

    // Build custom field aliases from webhook_alias definitions
    const customFieldAliases: Record<string, string> = {};
    customFieldDefs.forEach(def => {
      if (def.webhook_alias) {
        customFieldAliases[def.webhook_alias.toLowerCase()] = `custom_${def.field_name}`;
      }
    });

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
          
          // First check custom field webhook_alias (exact match on full key)
          const fullKeyLower = fullKey.toLowerCase();
          if (customFieldAliases[fullKeyLower] && !alreadySuggestedTargets.has(customFieldAliases[fullKeyLower])) {
            suggested = customFieldAliases[fullKeyLower];
            alreadySuggestedTargets.add(suggested);
          }
          
          // Then check standard field aliases
          if (!suggested) {
            for (const [target, aliases] of Object.entries(fieldAliases)) {
              // Only suggest if this target hasn't been suggested yet
              if (!alreadySuggestedTargets.has(target) && aliases.some(a => a.replace(/[_\s-]/g, '') === lowerKey)) {
                suggested = target;
                alreadySuggestedTargets.add(target); // Mark as used
                break;
              }
            }
          }
          
          // If no suggestion found, default to "__ignore__" so user knows this won't be mapped
          detected.push({
            key: fullKey,
            value: value,
            suggested_target: suggested || '__ignore__',
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
    
    // AUTO-APPLY: Create mappings for ALL detected fields with suggestions (not just ignored)
    // This ensures when user clicks "Save", all auto-detected mappings are saved
    const autoMappings: FieldMappingRow[] = [];
    for (const field of detected) {
      if (field.suggested_target && field.suggested_target !== '__ignore__' && field.suggested_target !== '__none__') {
        autoMappings.push({
          id: `auto-${Date.now()}-${field.key}`,
          source_field: field.key,
          target_field: field.suggested_target,
          transform_type: field.suggested_target === 'whatsapp' ? 'phone_normalize' : 'direct',
        });
      }
    }
    
    // Merge with existing mappings (preserve user edits, add new auto-detected)
    const existingSourceFields = new Set(mappings.map(m => m.source_field));
    const newMappings = autoMappings.filter(m => !existingSourceFields.has(m.source_field));
    
    if (newMappings.length > 0) {
      setMappings(prev => [...prev, ...newMappings]);
      setHasUnsavedMappings(true);
    }
    
    if (detected.length === 0) {
      toast.info('Nenhum campo encontrado no payload. Verifique os logs.');
    } else {
      const recognized = detected.filter(d => d.suggested_target !== '__ignore__').length;
      toast.success(`${detected.length} campos detectados! ${recognized} mapeados automaticamente. Clique em "Salvar Mapeamentos" para confirmar.`);
    }
  };

  // Apply detected field as mapping (or ignore it)
  const applyDetectedField = (field: DetectedField, targetField: string) => {
    // Handle "Ignore" - remove any existing mapping for this source field
    if (targetField === '__ignore__') {
      // Remove the mapping if this source field was previously mapped
      const existingMapping = mappings.find(m => m.source_field === field.key);
      if (existingMapping) {
        setMappings(mappings.filter(m => m.source_field !== field.key));
        setHasUnsavedMappings(true);
      }
      // Clear the suggested_target in detectedFields so the dropdown shows "Ignorar"
      setDetectedFields(prev => prev.map(f => 
        f.key === field.key ? { ...f, suggested_target: '__ignore__' } : f
      ));
      toast.success(`Campo "${field.key}" será ignorado`);
      return;
    }
    
    // First, remove any existing mapping for this source field (to avoid orphans)
    const filteredMappings = mappings.filter(m => m.source_field !== field.key);
    
    const existingIndex = filteredMappings.findIndex(m => m.target_field === targetField);
    
    if (existingIndex >= 0) {
      // Update existing mapping - replace the source field
      setMappings(filteredMappings.map((m, i) => 
        i === existingIndex 
          ? { ...m, source_field: field.key }
          : m
      ));
    } else {
      // Add new mapping
      setMappings([
        ...filteredMappings,
        {
          id: `new-${Date.now()}`,
          source_field: field.key,
          target_field: targetField,
          transform_type: targetField === 'whatsapp' ? 'phone_normalize' : 'direct',
        },
      ]);
    }
    
    // Update the detected field's suggested target to reflect the selection
    setDetectedFields(prev => prev.map(f => 
      f.key === field.key ? { ...f, suggested_target: targetField } : f
    ));
    
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
      sac_default_description: sacDefaultDescription || null,
      default_seller_id: defaultSellerId || null,
      trigger_rules: triggerRules.length > 0 ? triggerRules : null,
      trigger_rules_logic: triggerRulesLogic,
      auto_message_enabled: autoMessageEnabled,
      auto_message_text: autoMessageText || null,
      auto_message_instance_ids: autoMessageInstanceIds,
      auto_message_rotation_enabled: autoMessageRotationEnabled,
      dedup_cooldown_minutes: dedupCooldownMinutes ? parseInt(dedupCooldownMinutes) : null,
      stage_priority_override: stagePriorityOverride,
    } as any);
    toast.success('Configurações salvas!');
  };

  // Other integrations for source rules (exclude current one)
  const otherIntegrations = useMemo(() => {
    return (allIntegrations || [])
      .filter(i => i.id !== integration.id)
      .map(i => ({ id: i.id, name: i.name }));
  }, [allIntegrations, integration.id]);

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
    // Filter out ignored/unselected fields and empty source fields
    const validMappings = mappings.filter(m => {
      const source = m.source_field?.trim();
      const target = m.target_field?.trim();
      return !!source && !!target && target !== '__ignore__' && target !== '__none__';
    });

    // Defensive: prevent duplicate target fields (even if UI failed to block)
    const counts = new Map<string, number>();
    for (const m of validMappings) {
      counts.set(m.target_field, (counts.get(m.target_field) || 0) + 1);
    }
    const duplicatedTargets = Array.from(counts.entries())
      .filter(([, count]) => count > 1)
      .map(([target]) => target);
    if (duplicatedTargets.length > 0) {
      toast.error('Existem campos duplicados no mapeamento', {
        description: `Esses destinos foram selecionados mais de uma vez: ${duplicatedTargets.join(', ')}`,
      });
      return;
    }

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

  // Get available stages - use UUID (s.id) as value since default_stage stores UUIDs
  const availableStages = funnelStages?.length 
    ? funnelStages.filter(s => (s as any).is_active !== false).map(s => ({ 
        value: s.id, 
        label: (s as any).display_name || (s as any).label || (s as any).name 
      }))
    : Object.entries(FUNNEL_STAGES).map(([key, val]) => ({ value: key, label: val.label }));

  // Get already mapped target fields to disable duplicates
  const usedTargetFields = useMemo(() => {
    return new Set(mappings.map(m => m.target_field));
  }, [mappings]);

  // Group target fields including custom fields
  const groupedTargetFields = useMemo(() => {
    const groups: Record<string, { value: string; label: string; group?: string }[]> = {
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
    
    // Add custom fields dynamically
    customFieldDefs.forEach(def => {
      groups.custom.push({
        value: `custom_${def.field_name}`,
        label: def.field_label,
        group: 'custom',
      });
    });
    
    return groups;
  }, [customFieldDefs]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] sm:max-h-[92vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
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

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 min-h-0 flex flex-col">
          <TabsList className="grid w-full grid-cols-7 flex-shrink-0">
            <TabsTrigger value="config" className="gap-1 text-xs">
              <Settings className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Config</span>
            </TabsTrigger>
            <TabsTrigger value="mappings" className="gap-1 text-xs">
              <MapPin className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Map</span>
            </TabsTrigger>
            <TabsTrigger value="lead" className="gap-1 text-xs">
              <Users className="h-3.5 w-3.5" />
              Lead
            </TabsTrigger>
            <TabsTrigger value="sales" className="gap-1 text-xs">
              <ShoppingCart className="h-3.5 w-3.5" />
              Vendas
            </TabsTrigger>
            <TabsTrigger value="auto_message" className="gap-1 text-xs">
              <MessageSquare className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Msg Auto</span>
              <span className="sm:hidden">Msg</span>
            </TabsTrigger>
            <TabsTrigger value="rules" className="gap-1 text-xs">
              <AlertCircle className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Regras</span>
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-1 text-xs">
              <Activity className="h-3.5 w-3.5" />
              Logs
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pr-2" style={{ WebkitOverflowScrolling: 'touch' }}>
            <TabsContent value="config" className="space-y-4 mt-4 pb-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">URLs do Webhook</CardTitle>
                  <CardDescription>
                    Cole estas URLs no sistema externo (Payt, Hotmart, etc)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* URLs in compact layout */}
                  <div className="grid gap-3">
                    {/* URL de Teste - one line */}
                    <div className="flex items-center gap-3 p-3 border-2 border-dashed border-blue-500/50 rounded-lg bg-blue-500/5">
                      <Badge variant="secondary" className="shrink-0 bg-blue-500/20 text-blue-700 dark:text-blue-400">
                        1º TESTE
                      </Badge>
                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        <code className="text-xs text-muted-foreground truncate block flex-1">
                          {webhookTestUrl.length > 60 ? webhookTestUrl.slice(0, 60) + '...' : webhookTestUrl}
                        </code>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="shrink-0 h-8"
                              onClick={() => {
                                navigator.clipboard.writeText(webhookTestUrl);
                                toast.success('URL de teste copiada!');
                              }}
                            >
                              <Copy className="h-3.5 w-3.5 mr-1" />
                              Copiar
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            <p className="text-xs">Use primeiro para testar. Registra nos logs mas <strong>não cria leads/vendas</strong>.</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>

                    {/* URL de Produção - one line */}
                    <div className="flex items-center gap-3 p-3 border rounded-lg bg-background">
                      <Badge variant="secondary" className="shrink-0 bg-green-500/20 text-green-700 dark:text-green-400">
                        2º PRODUÇÃO
                      </Badge>
                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        <code className="text-xs text-muted-foreground truncate block flex-1">
                          {webhookUrl.length > 60 ? webhookUrl.slice(0, 60) + '...' : webhookUrl}
                        </code>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="shrink-0 h-8"
                              onClick={handleCopyUrl}
                            >
                              <Copy className="h-3.5 w-3.5 mr-1" />
                              Copiar
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            <p className="text-xs">Após validar o teste, troque para esta. <strong>Cria leads/vendas de verdade</strong>.</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  </div>

                  {/* Test connection and instructions in one row */}
                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex items-center gap-2">
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
                        {isTesting ? 'Testando...' : 'Testar Conexão'}
                      </Button>
                      
                      {testResult && (
                        <div className={`flex items-center gap-1.5 text-sm ${
                          testResult.success 
                            ? 'text-green-600' 
                            : 'text-red-600'
                        }`}>
                          {testResult.success ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : (
                            <AlertCircle className="h-4 w-4" />
                          )}
                          <span className="text-xs">{testResult.message}</span>
                        </div>
                      )}
                    </div>
                    
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <AlertCircle className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-sm">
                        <p className="font-medium mb-1">Como configurar:</p>
                        <ol className="text-xs space-y-0.5 list-decimal list-inside">
                          <li>Copie a <strong>URL de Teste</strong></li>
                          <li>Cole na Payt/Hotmart e salve</li>
                          <li>Veja a aba "Logs" aqui - deve aparecer o evento</li>
                          <li>Se funcionou, troque para a <strong>URL de Produção</strong></li>
                        </ol>
                      </TooltipContent>
                    </Tooltip>
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
                      { value: 'lead', label: 'Criar/Atualizar Lead', desc: 'Apenas gerencia leads', icon: '👤' },
                      { value: 'sale', label: 'Lead + Venda Rápida', desc: 'Gera venda com produto e valor', icon: '💰' },
                      { value: 'both', label: 'Lead + Venda Completa', desc: 'Venda com endereço e parcelas', icon: '📦' },
                      { value: 'sac', label: 'Lead + Chamado SAC', desc: 'Abre ticket na fila de atendimento', icon: '🎧' },
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
                      <li>• O <strong>WhatsApp/telefone</strong> é a chave única para identificar o cliente</li>
                      <li>• Se o lead já existe: atualiza os dados cadastrais</li>
                      <li>• Se não existe: cria um novo lead automaticamente</li>
                    </ul>
                    {(eventMode === 'sale' || eventMode === 'both') && (
                      <div className="mt-2 pt-2 border-t border-blue-500/20">
                        <p className="font-medium text-blue-600 dark:text-blue-300 text-xs mb-1">Diferença entre modos de venda:</p>
                        <ul className="text-xs text-muted-foreground space-y-0.5">
                          <li><strong>💰 Venda Rápida:</strong> Cria venda com produto e valor total. Útil para hotmart, payt, etc.</li>
                          <li><strong>📦 Venda Completa:</strong> Inclui endereço de entrega, parcelas e data estimada. Para e-commerce completo.</li>
                        </ul>
                      </div>
                    )}
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
                      
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Prioridade</Label>
                          <Select value={sacPriority} onValueChange={setSacPriority}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="low">Baixa</SelectItem>
                              <SelectItem value="normal">Normal</SelectItem>
                              <SelectItem value="high">Alta</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Usuários Envolvidos (opcional)</Label>
                          <Select>
                            <SelectTrigger>
                              <SelectValue placeholder="Automático (responsável do lead)" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__auto__">Automático (responsável do lead)</SelectItem>
                              {users?.map(user => (
                                <SelectItem key={user.id} value={user.id}>
                                  {user.first_name} {user.last_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Descrição Padrão do Chamado</Label>
                        <Input
                          value={sacDefaultDescription}
                          onChange={(e) => setSacDefaultDescription(e.target.value)}
                          placeholder="Ex: Chamado aberto via webhook de chargeback"
                        />
                        <p className="text-xs text-muted-foreground">
                          Texto que será usado como descrição do chamado. Deixe vazio para usar dados do webhook.
                        </p>
                      </div>
                      
                      <div className="p-3 bg-purple-500/10 rounded-lg text-sm">
                        <p className="font-medium text-purple-700 dark:text-purple-400 mb-1">
                          ℹ️ Como funciona o modo SAC:
                        </p>
                        <ul className="text-xs text-muted-foreground space-y-1">
                          <li>• O webhook irá criar/encontrar o lead pelo WhatsApp</li>
                          <li>• Um chamado será aberto na coluna <strong>"Não Tratados"</strong></li>
                          <li>• A descrição pode vir do webhook ou do texto padrão acima</li>
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
              <Card className="flex flex-col max-h-[calc(70vh-120px)]">
                <CardHeader className="shrink-0">
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
                <CardContent className="space-y-3 flex-1 overflow-y-auto">
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
                              value={field.suggested_target || '__none__'}
                              onValueChange={(v) => {
                                if (v !== '__none__') {
                                  applyDetectedField(field, v);
                                }
                              }}
                            >
                              <SelectTrigger className="w-40">
                                <SelectValue placeholder="Mapear para...">
                                  {field.suggested_target === '__ignore__' 
                                    ? 'Ignorar' 
                                    : field.suggested_target 
                                      ? groupedTargetFields.lead.concat(groupedTargetFields.address, groupedTargetFields.sale, groupedTargetFields.custom).find(f => f.value === field.suggested_target)?.label || field.suggested_target
                                      : 'Mapear para...'
                                  }
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent className="max-h-64 z-[100] bg-popover">
                                <SelectItem value="__ignore__">Ignorar</SelectItem>
                                {Object.entries(groupedTargetFields).map(([group, fields]) => (
                                  <React.Fragment key={group}>
                                    {fields.length > 0 && (
                                      <>
                                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase">
                                          {group === 'lead' ? 'Lead' : group === 'address' ? 'Endereço' : group === 'custom' ? 'Personalizados' : 'Venda'}
                                        </div>
                                        {fields.map(f => {
                                          const isUsed = usedTargetFields.has(f.value) && field.suggested_target !== f.value;
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
                  
                </CardContent>
                
                {/* Sticky footer for Save button */}
                {(mappings.length > 0 || hasUnsavedMappings) && (
                  <div className="shrink-0 flex items-center justify-between p-4 border-t bg-card">
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
                    <Label>Followup Automático</Label>
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

                      {/* Seller selector - REQUIRED for sales */}
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          Vendedor Padrão
                          <Badge variant="destructive" className="text-xs">Obrigatório</Badge>
                        </Label>
                        <Select value={defaultSellerId || '__none__'} onValueChange={(v) => setDefaultSellerId(v === '__none__' ? '' : v)}>
                          <SelectTrigger className={!defaultSellerId ? 'border-destructive' : ''}>
                            <SelectValue placeholder="Selecione um vendedor" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Selecione um vendedor...</SelectItem>
                            {users?.map(user => (
                              <SelectItem key={user.id} value={user.id}>
                                {user.first_name} {user.last_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Todas as vendas criadas por esta integração serão atribuídas a este vendedor
                        </p>
                        {!defaultSellerId && (
                          <p className="text-xs text-destructive">
                            ⚠️ É necessário selecionar um vendedor para vendas funcionarem corretamente
                          </p>
                        )}
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
                        <Button onClick={handleSaveConfig} disabled={updateIntegration.isPending || (!defaultSellerId && (eventMode === 'sale' || eventMode === 'both'))}>
                          {updateIntegration.isPending ? 'Salvando...' : 'Salvar Configurações'}
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Auto Message Tab */}
            <TabsContent value="auto_message" className="space-y-4 mt-4 pb-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Mensagem Automática
                  </CardTitle>
                  <CardDescription>
                    Configure uma mensagem automática para enviar via WhatsApp quando um lead entrar por esta integração
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Enable toggle */}
                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div>
                      <Label className="text-base font-medium">Ativar Mensagem Automática</Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Enviar automaticamente uma mensagem quando o lead for cadastrado
                      </p>
                    </div>
                    <Switch
                      checked={autoMessageEnabled}
                      onCheckedChange={setAutoMessageEnabled}
                    />
                  </div>

                  {autoMessageEnabled && (
                    <>
                      {/* Message text */}
                      <div className="space-y-2">
                        <Label>Mensagem</Label>
                        <Textarea
                          value={autoMessageText}
                          onChange={(e) => setAutoMessageText(e.target.value)}
                          placeholder="Olá {{nome}}! Obrigado pelo seu interesse..."
                          rows={5}
                          className="min-h-[120px]"
                        />
                        <p className="text-xs text-muted-foreground">
                          Variáveis disponíveis: <code className="bg-muted px-1 rounded">{'{{nome}}'}</code>, <code className="bg-muted px-1 rounded">{'{{email}}'}</code>, <code className="bg-muted px-1 rounded">{'{{produto}}'}</code>
                        </p>
                      </div>

                      {/* Instance selection */}
                      <div className="space-y-3">
                        <Label>Instâncias de WhatsApp</Label>
                        <p className="text-sm text-muted-foreground">
                          Selecione as instâncias que serão usadas para enviar a mensagem
                        </p>
                        
                        {!whatsappInstances || whatsappInstances.length === 0 ? (
                          <div className="p-4 border rounded-lg text-center text-muted-foreground">
                            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">Nenhuma instância de WhatsApp ativa</p>
                            <p className="text-xs">Conecte uma instância em Configurações → WhatsApp</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {whatsappInstances.map((instance) => (
                              <div 
                                key={instance.id}
                                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                  autoMessageInstanceIds.includes(instance.id)
                                    ? 'border-primary bg-primary/5'
                                    : 'border-border hover:border-primary/50'
                                }`}
                                onClick={() => {
                                  setAutoMessageInstanceIds(prev =>
                                    prev.includes(instance.id)
                                      ? prev.filter(id => id !== instance.id)
                                      : [...prev, instance.id]
                                  );
                                }}
                              >
                                <Checkbox
                                  checked={autoMessageInstanceIds.includes(instance.id)}
                                  onCheckedChange={(checked) => {
                                    setAutoMessageInstanceIds(prev =>
                                      checked
                                        ? [...prev, instance.id]
                                        : prev.filter(id => id !== instance.id)
                                    );
                                  }}
                                />
                                <div className="flex-1">
                                  <p className="font-medium text-sm">{instance.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {instance.phone_number || 'Sem número'}
                                    {' • '}
                                    <span className={instance.is_connected ? 'text-green-600' : 'text-red-500'}>
                                      {instance.is_connected ? '🟢 Conectada' : '🔴 Desconectada'}
                                    </span>
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Rotation toggle */}
                      {autoMessageInstanceIds.length > 1 && (
                        <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                          <div className="flex items-center gap-3">
                            <RefreshCw className="h-5 w-5 text-primary" />
                            <div>
                              <Label className="text-base font-medium">Rotação de Instâncias</Label>
                              <p className="text-sm text-muted-foreground mt-1">
                                Alternar entre as instâncias selecionadas para distribuir o envio e reduzir a chance de queda dos chips
                              </p>
                            </div>
                          </div>
                          <Switch
                            checked={autoMessageRotationEnabled}
                            onCheckedChange={setAutoMessageRotationEnabled}
                          />
                        </div>
                      )}

                      {autoMessageInstanceIds.length === 0 && (
                        <div className="p-3 rounded-lg border border-yellow-500/50 bg-yellow-500/5 text-sm text-yellow-700 dark:text-yellow-400">
                          ⚠️ Selecione pelo menos uma instância para enviar mensagens automáticas
                        </div>
                      )}
                    </>
                  )}

                  <div className="flex justify-end pt-2">
                    <Button onClick={handleSaveConfig} disabled={updateIntegration.isPending}>
                      {updateIntegration.isPending ? 'Salvando...' : 'Salvar Configurações'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Trigger Rules Tab */}
            <TabsContent value="rules" className="space-y-4 mt-4">
              <IntegrationTriggerRules
                rules={triggerRules}
                rulesLogic={triggerRulesLogic}
                onRulesChange={setTriggerRules}
                onRulesLogicChange={setTriggerRulesLogic}
                integrations={otherIntegrations}
              />
              
              <div className="flex justify-end">
                <Button onClick={handleSaveConfig} disabled={updateIntegration.isPending}>
                  {updateIntegration.isPending ? 'Salvando...' : 'Salvar Regras'}
                </Button>
              </div>
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
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}