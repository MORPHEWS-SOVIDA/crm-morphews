import { useState, useCallback, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Upload,
  Phone,
  AlertCircle,
  CheckCircle2,
  Settings,
  FileText,
  ChevronDown,
  ChevronUp,
  Ban,
  Building2,
  History,
  PhoneOff,
  ShoppingCart,
  DollarSign,
  User,
  MessageSquare,
  Package,
  Calendar,
  Filter,
  Layers,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import {
  useVoip3cConfig,
  useSaveVoip3cConfig,
  useVoip3cValidations,
  useSaveVoip3cValidation,
  parseCsv3c,
  parseDate3c,
  phonesMatch,
  formatSpeakingTime,
  Call3cData,
  ValidationResult,
  MatchedAttendance,
  LeadOnlyMatch,
  CONVERSATION_MODE_LABELS,
} from '@/hooks/useVoip3cValidation';

export default function Voip3cValidation() {
  const { profile } = useAuth();
  const { data: config } = useVoip3cConfig();
  const { mutate: saveConfig, isPending: savingConfig } = useSaveVoip3cConfig();
  const { data: validations } = useVoip3cValidations();
  const { mutate: saveValidation, isPending: savingValidation } = useSaveVoip3cValidation();
  
  const [configOpen, setConfigOpen] = useState(false);
  const [blacklistText, setBlacklistText] = useState('');
  const [cnpjText, setCnpjText] = useState('');
  
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [totalCalls, setTotalCalls] = useState(0);
  
  // New filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [onlyReceptive, setOnlyReceptive] = useState(false);
  const [motivoFilter, setMotivoFilter] = useState('all');
  
  // Sem Registro filters
  const [srQueueFilter, setSrQueueFilter] = useState('all');
  const [srStatusFilter, setSrStatusFilter] = useState('all');
  const [srAgentFilter, setSrAgentFilter] = useState('all');
  const [srMinTime, setSrMinTime] = useState('all');
  
  // Sem Venda extra filters
  const [svQueueFilter, setSvQueueFilter] = useState('all');
  const [svStatusFilter, setSvStatusFilter] = useState('all');
  const [svAgentFilter, setSvAgentFilter] = useState('all');
  const [svMinTime, setSvMinTime] = useState('all');
  
  // Initialize config text when data loads
  useEffect(() => {
    if (config) {
      setBlacklistText(config.blacklist_numbers.join('\n'));
      setCnpjText(config.cnpj_numbers.join('\n'));
    }
  }, [config]);
  
  const handleSaveConfig = () => {
    const blacklist = blacklistText
      .split('\n')
      .map(n => n.replace(/\D/g, ''))
      .filter(n => n.length >= 8);
    const cnpj = cnpjText
      .split('\n')
      .map(n => n.replace(/\D/g, ''))
      .filter(n => n.length >= 11);
    
    saveConfig({ blacklist_numbers: blacklist, cnpj_numbers: cnpj });
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);
    }
  };
  
  const processFile = useCallback(async () => {
    if (!file || !profile?.organization_id) return;
    
    setProcessing(true);
    setResult(null);
    
    try {
      const content = await file.text();
      const calls = parseCsv3c(content);
      
      if (calls.length === 0) {
        toast.error('Nenhuma ligação encontrada no arquivo');
        setProcessing(false);
        return;
      }
      
      // Filter out blacklisted and CNPJ numbers
      const blacklistNumbers = config?.blacklist_numbers || [];
      const cnpjNumbers = config?.cnpj_numbers || [];
      
      const filteredCalls = calls.filter(call => {
        const normalizedNumber = call.number;
        if (blacklistNumbers.some(b => normalizedNumber.includes(b) || b.includes(normalizedNumber))) {
          return false;
        }
        if (cnpjNumbers.some(c => normalizedNumber.includes(c) || c.includes(normalizedNumber))) {
          return false;
        }
        return true;
      });
      
      setTotalCalls(filteredCalls.length);
      
      // Use user-specified date range for attendance query
      let queryMinDate: string;
      let queryMaxDate: string;
      
      if (dateFrom && dateTo) {
        queryMinDate = dateFrom;
        queryMaxDate = format(new Date(new Date(dateTo).getTime() + 86400000), 'yyyy-MM-dd');
      } else {
        // Fallback to call dates
        const dates = filteredCalls
          .map(c => parseDate3c(c.created_at))
          .filter((d): d is Date => d !== null);
        
        if (dates.length === 0) {
          toast.error('Não foi possível extrair datas das ligações');
          setProcessing(false);
          return;
        }
        
        const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
        const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
        queryMinDate = format(minDate, 'yyyy-MM-dd');
        queryMaxDate = format(new Date(maxDate.getTime() + 86400000), 'yyyy-MM-dd');
      }
      
      // Paginated fetch to overcome Supabase 1000-row default limit
      const PAGE_SIZE = 1000;
      
      // Fetch ALL receptive attendances (paginated)
      const attendances: any[] = [];
      let attOffset = 0;
      while (true) {
        let q = supabase
          .from('receptive_attendances')
          .select('id, phone_searched, user_id, sale_id, non_purchase_reason_id, created_at, conversation_mode, lead_id, product_id, completed, lead_existed')
          .eq('organization_id', profile.organization_id)
          .gte('created_at', queryMinDate)
          .lte('created_at', queryMaxDate);
        if (onlyReceptive) {
          q = q.in('conversation_mode', ['receptive_call', 'receptive_whatsapp', 'receptive_instagram']);
        }
        q = q.range(attOffset, attOffset + PAGE_SIZE - 1);
        const { data, error } = await q;
        if (error) throw error;
        if (!data || data.length === 0) break;
        attendances.push(...data);
        if (data.length < PAGE_SIZE) break;
        attOffset += PAGE_SIZE;
      }
      
      // Collect IDs for batch lookups
      const userIds = new Set<string>();
      const leadIds = new Set<string>();
      const productIds = new Set<string>();
      const saleIds = new Set<string>();
      const reasonIds = new Set<string>();
      
      for (const att of attendances || []) {
        if (att.user_id) userIds.add(att.user_id);
        if (att.lead_id) leadIds.add(att.lead_id);
        if (att.product_id) productIds.add(att.product_id);
        if (att.sale_id) saleIds.add(att.sale_id);
        if (att.non_purchase_reason_id) reasonIds.add(att.non_purchase_reason_id);
      }
      
      // Batch fetch all related data in parallel
      const [usersRes, leadsRes, productsRes, salesRes, reasonsRes] = await Promise.all([
        userIds.size > 0
          ? supabase.from('profiles').select('user_id, first_name, last_name').in('user_id', Array.from(userIds))
          : { data: [] },
        leadIds.size > 0
          ? supabase.from('leads').select('id, name, stage').in('id', Array.from(leadIds))
          : { data: [] },
        productIds.size > 0
          ? supabase.from('lead_products').select('id, name').in('id', Array.from(productIds))
          : { data: [] },
        saleIds.size > 0
          ? supabase.from('sales').select('id, total_cents, status').in('id', Array.from(saleIds))
          : { data: [] },
        reasonIds.size > 0
          ? supabase.from('non_purchase_reasons').select('id, name').in('id', Array.from(reasonIds))
          : { data: [] },
      ]);
      
      const userMap = new Map((usersRes.data || []).map(u => [u.user_id, `${u.first_name || ''} ${u.last_name || ''}`.trim()]));
      const leadMap = new Map((leadsRes.data || []).map(l => [l.id, l]));
      const productMap = new Map((productsRes.data || []).map(p => [p.id, p.name]));
      const saleMap = new Map((salesRes.data || []).map(s => [s.id, s]));
      const reasonMap = new Map((reasonsRes.data || []).map(r => [r.id, r.name]));
      
      // Also fetch ALL leads to match by phone (paginated to overcome 1000-row limit)
      const allLeads: any[] = [];
      let leadOffset = 0;
      while (true) {
        const { data, error: leadErr } = await supabase
          .from('leads')
          .select('id, name, whatsapp, stage, assigned_to')
          .eq('organization_id', profile.organization_id)
          .range(leadOffset, leadOffset + PAGE_SIZE - 1);
        if (leadErr) throw leadErr;
        if (!data || data.length === 0) break;
        allLeads.push(...data);
        if (data.length < PAGE_SIZE) break;
        leadOffset += PAGE_SIZE;
      }
      
      // Fetch followups for leads
      const allLeadIds = (allLeads || []).map(l => l.id);
      const { data: followups } = allLeadIds.length > 0
        ? await supabase
            .from('lead_followups')
            .select('lead_id, reason, scheduled_at')
            .in('lead_id', allLeadIds)
            .order('scheduled_at', { ascending: false })
        : { data: [] };
      
      const followupMap = new Map<string, { reason: string; scheduled_at: string }>();
      for (const f of followups || []) {
        if (!followupMap.has(f.lead_id)) {
          followupMap.set(f.lead_id, { reason: f.reason, scheduled_at: f.scheduled_at });
        }
      }
      
      // Fetch responsible names for leads
      const responsibleIds = new Set<string>();
      for (const l of allLeads || []) {
        if (l.assigned_to) responsibleIds.add(l.assigned_to);
      }
      const { data: responsibles } = responsibleIds.size > 0
        ? await supabase.from('profiles').select('user_id, first_name, last_name').in('user_id', Array.from(responsibleIds))
        : { data: [] };
      const responsibleMap = new Map((responsibles || []).map(u => [u.user_id, `${u.first_name || ''} ${u.last_name || ''}`.trim()]));
      
      // Match calls to attendances using fuzzy phone matching
      const callsWithoutRecord: Call3cData[] = [];
      const callsWithRecordNoSale: Array<Call3cData & MatchedAttendance> = [];
      const callsWithRecordAndSale: Array<Call3cData & MatchedAttendance> = [];
      const callsWithLeadOnly: Array<Call3cData & LeadOnlyMatch> = [];
      
      for (const call of filteredCalls) {
        const callDate = parseDate3c(call.created_at);
        if (!callDate) {
          callsWithoutRecord.push(call);
          continue;
        }
        
        // Find ALL matching attendances by phone (fuzzy) within the date range
        // No longer require same-date — the user-specified date range handles that
        const matchingAtts = (attendances || []).filter(att => {
          const attPhone = att.phone_searched?.replace(/\D/g, '') || '';
          return phonesMatch(call.number, attPhone);
        });
        
        const matchedAtt = matchingAtts.length > 0 ? matchingAtts[0] : null;
        
        if (matchedAtt) {
          const lead = matchedAtt.lead_id ? leadMap.get(matchedAtt.lead_id) : null;
          const sale = matchedAtt.sale_id ? saleMap.get(matchedAtt.sale_id) : null;
          
          const enriched: Call3cData & MatchedAttendance = {
            ...call,
            receptive_id: matchedAtt.id,
            lead_id: matchedAtt.lead_id || null,
            user_name: matchedAtt.user_id ? userMap.get(matchedAtt.user_id) || 'Desconhecido' : '-',
            conversation_mode: matchedAtt.conversation_mode || '',
            lead_name: lead?.name || '-',
            lead_stage: lead?.stage || '-',
            product_name: matchedAtt.product_id ? productMap.get(matchedAtt.product_id) || '-' : '-',
            sale_id: matchedAtt.sale_id,
            sale_total_cents: sale?.total_cents || null,
            sale_status: sale?.status || null,
            reason_name: matchedAtt.non_purchase_reason_id ? reasonMap.get(matchedAtt.non_purchase_reason_id) || '' : '',
            completed: matchedAtt.completed || false,
            attendance_created_at: matchedAtt.created_at,
          };
          
          if (matchedAtt.sale_id) {
            callsWithRecordAndSale.push(enriched);
          } else {
            callsWithRecordNoSale.push(enriched);
          }
          continue;
        }
        
        // No attendance found - check if lead exists by phone
        const matchedLead = (allLeads || []).find(l => {
          const leadPhone = l.whatsapp?.replace(/\D/g, '') || '';
          return phonesMatch(call.number, leadPhone);
        });
        
        if (matchedLead) {
          const fu = followupMap.get(matchedLead.id);
          callsWithLeadOnly.push({
            ...call,
            lead_id: matchedLead.id,
            lead_name: matchedLead.name || '-',
            lead_stage: matchedLead.stage || '-',
            lead_whatsapp: matchedLead.whatsapp || '',
            followup_reason: fu?.reason || null,
            followup_scheduled_at: fu?.scheduled_at || null,
            responsible_name: matchedLead.assigned_to ? responsibleMap.get(matchedLead.assigned_to) || null : null,
          });
          continue;
        }
        
        callsWithoutRecord.push(call);
      }
      
      const validationResult: ValidationResult = {
        callsWithoutRecord,
        callsWithRecordNoSale,
        callsWithRecordAndSale,
        callsWithLeadOnly,
      };
      
      setResult(validationResult);
      
      // Save validation
      saveValidation({
        file_name: file.name,
        total_calls: filteredCalls.length,
        calls_without_record: callsWithoutRecord.length,
        calls_with_record_no_sale: callsWithRecordNoSale.length,
        validation_data: validationResult,
      });
      
    } catch (error) {
      console.error('Error processing file:', error);
      toast.error('Erro ao processar arquivo');
    } finally {
      setProcessing(false);
    }
  }, [file, profile, config, saveValidation, dateFrom, dateTo, onlyReceptive]);

  const formatCurrency = (cents: number | null) => {
    if (!cents) return '-';
    return `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;
  };

  // Get unique motivos for filter dropdown
  const uniqueMotivos = useMemo(() => {
    if (!result) return [];
    const reasons = new Set<string>();
    result.callsWithRecordNoSale.forEach(c => {
      if (c.reason_name) reasons.add(c.reason_name);
    });
    return Array.from(reasons).sort();
  }, [result]);

  // Apply all Sem Venda filters
  const filteredNoSale = useMemo(() => {
    if (!result) return [];
    let data = result.callsWithRecordNoSale;
    if (motivoFilter !== 'all') {
      data = motivoFilter === 'sem_motivo' ? data.filter(c => !c.reason_name) : data.filter(c => c.reason_name === motivoFilter);
    }
    if (svQueueFilter !== 'all') data = data.filter(c => (c.source_queue_name || c.queue_name || '') === svQueueFilter);
    if (svStatusFilter !== 'all') data = data.filter(c => c.readable_status_text === svStatusFilter);
    if (svAgentFilter !== 'all') data = data.filter(c => c.agent_name === svAgentFilter);
    if (svMinTime !== 'all') data = data.filter(c => c.speaking_time_seconds >= parseInt(svMinTime));
    return data;
  }, [result, motivoFilter, svQueueFilter, svStatusFilter, svAgentFilter, svMinTime]);

  // Unique values for Sem Registro filters
  const srFilterOptions = useMemo(() => {
    if (!result) return { queues: [], statuses: [], agents: [] };
    const queues = new Set<string>();
    const statuses = new Set<string>();
    const agents = new Set<string>();
    result.callsWithoutRecord.forEach(c => {
      const q = c.source_queue_name || c.queue_name;
      if (q) queues.add(q);
      if (c.readable_status_text) statuses.add(c.readable_status_text);
      if (c.agent_name) agents.add(c.agent_name);
    });
    return { queues: Array.from(queues).sort(), statuses: Array.from(statuses).sort(), agents: Array.from(agents).sort() };
  }, [result]);

  // Unique values for Sem Venda filters
  const svFilterOptions = useMemo(() => {
    if (!result) return { queues: [], statuses: [], agents: [] };
    const queues = new Set<string>();
    const statuses = new Set<string>();
    const agents = new Set<string>();
    result.callsWithRecordNoSale.forEach(c => {
      const q = c.source_queue_name || c.queue_name;
      if (q) queues.add(q);
      if (c.readable_status_text) statuses.add(c.readable_status_text);
      if (c.agent_name) agents.add(c.agent_name);
    });
    return { queues: Array.from(queues).sort(), statuses: Array.from(statuses).sort(), agents: Array.from(agents).sort() };
  }, [result]);

  // Filtered Sem Registro
  const filteredWithoutRecord = useMemo(() => {
    if (!result) return [];
    let data = result.callsWithoutRecord;
    if (srQueueFilter !== 'all') data = data.filter(c => (c.source_queue_name || c.queue_name || '') === srQueueFilter);
    if (srStatusFilter !== 'all') data = data.filter(c => c.readable_status_text === srStatusFilter);
    if (srAgentFilter !== 'all') data = data.filter(c => c.agent_name === srAgentFilter);
    if (srMinTime !== 'all') data = data.filter(c => c.speaking_time_seconds >= parseInt(srMinTime));
    return data;
  }, [result, srQueueFilter, srStatusFilter, srAgentFilter, srMinTime]);

  // Helper: group records by phone number for consolidated view
  type GroupedCall<T> = { phone: string; records: T[] };
  
  function groupByPhone<T extends { number: string }>(calls: T[]): GroupedCall<T>[] {
    const map = new Map<string, T[]>();
    for (const call of calls) {
      const key = call.number.slice(-10);
      const existing = map.get(key);
      if (existing) {
        existing.push(call);
      } else {
        map.set(key, [call]);
      }
    }
    return Array.from(map.entries()).map(([phone, records]) => ({ phone, records }));
  }

  const TIME_FILTER_OPTIONS = [
    { value: 'all', label: 'Qualquer duração' },
    { value: '60', label: '≥ 1 minuto' },
    { value: '120', label: '≥ 2 minutos' },
    { value: '300', label: '≥ 5 minutos' },
    { value: '600', label: '≥ 10 minutos' },
  ];

  // Grouped results for all tabs
  const groupedWithSale = useMemo(() => result ? groupByPhone(result.callsWithRecordAndSale) : [], [result]);
  const groupedNoSale = useMemo(() => groupByPhone(filteredNoSale), [filteredNoSale]);
  const groupedWithoutRecord = useMemo(() => groupByPhone(filteredWithoutRecord), [filteredWithoutRecord]);
  
  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Validação 3C+</h1>
          <p className="text-muted-foreground">
            Cruze ligações do VoIP com registros de atendimento receptivo
          </p>
        </div>
        
        {/* Configuration Section */}
        <Collapsible open={configOpen} onOpenChange={setConfigOpen}>
          <Card>
            <CardHeader className="pb-3">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
                  <div className="flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    <CardTitle className="text-lg">Configurações</CardTitle>
                  </div>
                  {configOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>
              </CollapsibleTrigger>
              <CardDescription>Números para ignorar nos relatórios</CardDescription>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Ban className="w-4 h-4 text-destructive" />
                      Números Blacklist (1 por linha)
                    </Label>
                    <Textarea
                      placeholder="Ex: 11999999999&#10;11888888888"
                      value={blacklistText}
                      onChange={(e) => setBlacklistText(e.target.value)}
                      rows={5}
                    />
                    <p className="text-xs text-muted-foreground">
                      Números que não devem aparecer nos relatórios (ex: concorrentes)
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-blue-500" />
                      Números CNPJ (1 por linha)
                    </Label>
                    <Textarea
                      placeholder="Ex: 11333333333&#10;11444444444"
                      value={cnpjText}
                      onChange={(e) => setCnpjText(e.target.value)}
                      rows={5}
                    />
                    <p className="text-xs text-muted-foreground">
                      Números de empresas/CNPJ que não precisam de follow-up
                    </p>
                  </div>
                </div>
                <Button onClick={handleSaveConfig} disabled={savingConfig}>
                  {savingConfig ? 'Salvando...' : 'Salvar Configurações'}
                </Button>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
        
        {/* Upload Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Upload do Relatório
            </CardTitle>
            <CardDescription>
              Faça upload do CSV exportado do 3C+ para validar
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="max-w-md"
              />
            </div>
            {file && (
              <>
                <p className="text-sm text-muted-foreground">
                  Arquivo selecionado: <strong>{file.name}</strong>
                </p>
                
                {/* Date range + filters */}
                <div className="border rounded-lg p-4 bg-muted/30 space-y-4">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Filter className="w-4 h-4" />
                    Filtros de Validação
                  </p>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-1.5">
                      <Label className="flex items-center gap-1 text-xs">
                        <Calendar className="w-3 h-3" /> De
                      </Label>
                      <Input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="flex items-center gap-1 text-xs">
                        <Calendar className="w-3 h-3" /> Até
                      </Label>
                      <Input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5 flex flex-col justify-end">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={onlyReceptive}
                          onCheckedChange={setOnlyReceptive}
                          id="only-receptive"
                        />
                        <Label htmlFor="only-receptive" className="text-xs cursor-pointer">
                          Somente ligações receptivas
                        </Label>
                      </div>
                    </div>
                  </div>
                  {(!dateFrom || !dateTo) && (
                    <p className="text-xs text-yellow-600 dark:text-yellow-400">
                      ⚠ Sem período definido, serão usadas as datas das próprias ligações do CSV
                    </p>
                  )}
                </div>
                
                <Button
                  onClick={processFile}
                  disabled={processing || savingValidation}
                  className="w-full sm:w-auto"
                >
                  {processing ? 'Processando...' : 'Validar'}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
        
        {/* Results Section */}
        {result && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Resultado da Validação
              </CardTitle>
              <div className="flex flex-wrap gap-3 mt-2">
                <Badge variant="outline" className="text-base">
                  Total: {totalCalls} ligações
                </Badge>
                {result.callsWithRecordAndSale.length > 0 && (
                  <Badge className="text-base bg-green-600 hover:bg-green-700">
                    <DollarSign className="w-4 h-4 mr-1" />
                    Com venda: {result.callsWithRecordAndSale.length}
                  </Badge>
                )}
                <Badge variant="secondary" className="text-base">
                  <ShoppingCart className="w-4 h-4 mr-1" />
                  Sem venda: {result.callsWithRecordNoSale.length}
                </Badge>
                {result.callsWithLeadOnly.length > 0 && (
                  <Badge className="text-base bg-yellow-600 hover:bg-yellow-700">
                    <User className="w-4 h-4 mr-1" />
                    Lead sem Receptivo: {result.callsWithLeadOnly.length}
                  </Badge>
                )}
                <Badge variant="destructive" className="text-base">
                  <PhoneOff className="w-4 h-4 mr-1" />
                  Sem registro: {result.callsWithoutRecord.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue={
                result.callsWithRecordAndSale.length > 0 ? 'with-sale' :
                result.callsWithRecordNoSale.length > 0 ? 'no-sale' : 'without-record'
              }>
                <TabsList className="mb-4">
                  {result.callsWithRecordAndSale.length > 0 && (
                    <TabsTrigger value="with-sale" className="gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      Com Venda ({result.callsWithRecordAndSale.length})
                    </TabsTrigger>
                  )}
                  <TabsTrigger value="no-sale" className="gap-2">
                    <ShoppingCart className="w-4 h-4" />
                    Sem Venda ({result.callsWithRecordNoSale.length})
                  </TabsTrigger>
                  {result.callsWithLeadOnly.length > 0 && (
                    <TabsTrigger value="lead-only" className="gap-2">
                      <User className="w-4 h-4" />
                      Lead sem Receptivo ({result.callsWithLeadOnly.length})
                    </TabsTrigger>
                  )}
                  <TabsTrigger value="without-record" className="gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Sem Registro ({result.callsWithoutRecord.length})
                  </TabsTrigger>
                </TabsList>
                
                {/* COM VENDA - Grouped by phone */}
                <TabsContent value="with-sale">
                  <div className="border rounded-lg overflow-auto max-h-[600px]">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background">
                        <TableRow>
                          <TableHead>Telefone</TableHead>
                          <TableHead>Lead</TableHead>
                          <TableHead>Vendedor</TableHead>
                          <TableHead>Modo</TableHead>
                          <TableHead>Produto</TableHead>
                          <TableHead>Interesse 3C+</TableHead>
                          <TableHead>Valor Venda</TableHead>
                          <TableHead>Queue</TableHead>
                          <TableHead>Atendente 3C+</TableHead>
                          <TableHead><div className="flex items-center gap-1"><Clock className="w-3 h-3" /> Tempo</div></TableHead>
                          <TableHead>Hora 3C+</TableHead>
                          <TableHead>Hora Registro</TableHead>
                          <TableHead>Completo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {groupedWithSale.map((group) => (
                          group.records.map((call, idx) => (
                            <TableRow key={`ws-${group.phone}-${idx}`} className={group.records.length > 1 && idx > 0 ? 'border-t-0 bg-muted/20' : group.records.length > 1 ? 'border-l-4 border-l-primary' : ''}>
                              <TableCell className="font-mono text-sm">
                                {idx === 0 ? (
                                  <div className="flex items-center gap-1">
                                    {call.number}
                                    {group.records.length > 1 && (
                                      <Badge variant="outline" className="text-[10px] ml-1">
                                        <Layers className="w-3 h-3 mr-0.5" />{group.records.length}
                                      </Badge>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground text-xs">↳ {call.number}</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <div className="flex flex-col">
                                    <span className="font-medium text-sm">{call.lead_name}</span>
                                    <span className="text-xs text-muted-foreground">{call.lead_stage}</span>
                                  </div>
                                  {call.lead_id && (
                                    <a href={`/leads/${call.lead_id}`} target="_blank" rel="noopener noreferrer" title="Abrir lead em nova aba">
                                      <ExternalLink className="w-3.5 h-3.5 text-primary hover:text-primary/80 shrink-0" />
                                    </a>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <User className="w-3 h-3 text-muted-foreground" />
                                  <span className="text-sm">{call.user_name}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">
                                  {CONVERSATION_MODE_LABELS[call.conversation_mode] || call.conversation_mode || '-'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm">{call.product_name}</TableCell>
                              <TableCell className="text-xs">{call.product_interest || '-'}</TableCell>
                              <TableCell>
                                <Badge className="bg-green-600 hover:bg-green-700 text-xs">
                                  {formatCurrency(call.sale_total_cents)}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">
                                  {call.source_queue_name || call.queue_name || '-'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm">{call.agent_name || '-'}</TableCell>
                              <TableCell>
                                <span className={`text-xs font-mono ${call.speaking_time_seconds >= 120 ? 'text-destructive font-bold' : 'text-muted-foreground'}`}>
                                  {formatSpeakingTime(call.speaking_time_seconds)}
                                </span>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">{call.created_at}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {format(new Date(call.attendance_created_at), "dd/MM HH:mm", { locale: ptBR })}
                              </TableCell>
                              <TableCell>
                                {call.completed ? (
                                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                                ) : (
                                  <AlertCircle className="w-4 h-4 text-yellow-500" />
                                )}
                              </TableCell>
                            </TableRow>
                          ))
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
                
                {/* SEM VENDA - with all filters + grouped */}
                <TabsContent value="no-sale">
                  {/* Filters */}
                  <div className="flex flex-wrap items-center gap-3 mb-3 p-3 border rounded-lg bg-muted/30">
                    <Label className="text-sm whitespace-nowrap font-medium flex items-center gap-1"><Filter className="w-3 h-3" /> Filtros:</Label>
                    <Select value={motivoFilter} onValueChange={setMotivoFilter}>
                      <SelectTrigger className="w-[200px] h-8 text-xs">
                        <SelectValue placeholder="Motivo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos motivos</SelectItem>
                        <SelectItem value="sem_motivo">Sem motivo</SelectItem>
                        {uniqueMotivos.map(m => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={svQueueFilter} onValueChange={setSvQueueFilter}>
                      <SelectTrigger className="w-[180px] h-8 text-xs">
                        <SelectValue placeholder="Queue" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas queues</SelectItem>
                        {svFilterOptions.queues.map(q => (
                          <SelectItem key={q} value={q}>{q}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={svStatusFilter} onValueChange={setSvStatusFilter}>
                      <SelectTrigger className="w-[160px] h-8 text-xs">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos status</SelectItem>
                        {svFilterOptions.statuses.map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={svAgentFilter} onValueChange={setSvAgentFilter}>
                      <SelectTrigger className="w-[160px] h-8 text-xs">
                        <SelectValue placeholder="Atendente" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos atendentes</SelectItem>
                        {svFilterOptions.agents.map(a => (
                          <SelectItem key={a} value={a}>{a}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={svMinTime} onValueChange={setSvMinTime}>
                      <SelectTrigger className="w-[150px] h-8 text-xs">
                        <SelectValue placeholder="Duração" />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_FILTER_OPTIONS.map(o => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Badge variant="secondary" className="text-xs">{filteredNoSale.length} registros</Badge>
                  </div>

                  <div className="border rounded-lg overflow-auto max-h-[600px]">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background">
                        <TableRow>
                          <TableHead>Telefone</TableHead>
                          <TableHead>Lead</TableHead>
                          <TableHead>Vendedor</TableHead>
                          <TableHead>Modo</TableHead>
                          <TableHead>Produto</TableHead>
                          <TableHead>Motivo</TableHead>
                          <TableHead>Queue</TableHead>
                          <TableHead>Atendente 3C+</TableHead>
                          <TableHead className="flex items-center gap-1"><Clock className="w-3 h-3" /> Tempo</TableHead>
                          <TableHead>Hora 3C+</TableHead>
                          <TableHead>Hora Registro</TableHead>
                          <TableHead>Completo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredNoSale.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={12} className="text-center text-muted-foreground py-8">
                              {motivoFilter !== 'all' || svQueueFilter !== 'all' || svAgentFilter !== 'all' || svMinTime !== 'all'
                                ? 'Nenhum registro com estes filtros'
                                : 'Todos os registros têm venda! 🎉'}
                            </TableCell>
                          </TableRow>
                        ) : (
                          groupedNoSale.map((group) => (
                            group.records.map((call, idx) => (
                              <TableRow key={`ns-${group.phone}-${idx}`} className={group.records.length > 1 && idx > 0 ? 'border-t-0 bg-muted/20' : group.records.length > 1 ? 'border-l-4 border-l-primary' : ''}>
                                <TableCell className="font-mono text-sm">
                                  {idx === 0 ? (
                                    <div className="flex items-center gap-1">
                                      {call.number}
                                      {group.records.length > 1 && (
                                        <Badge variant="outline" className="text-[10px] ml-1">
                                          <Layers className="w-3 h-3 mr-0.5" />{group.records.length}
                                        </Badge>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground text-xs">↳ {call.number}</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    <div className="flex flex-col">
                                      <span className="font-medium text-sm">{call.lead_name}</span>
                                      <span className="text-xs text-muted-foreground">{call.lead_stage}</span>
                                    </div>
                                    {call.lead_id && (
                                      <a href={`/leads/${call.lead_id}`} target="_blank" rel="noopener noreferrer" title="Abrir lead em nova aba">
                                        <ExternalLink className="w-3.5 h-3.5 text-primary hover:text-primary/80 shrink-0" />
                                      </a>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    <User className="w-3 h-3 text-muted-foreground" />
                                    <span className="text-sm">{call.user_name}</span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-xs">
                                    {CONVERSATION_MODE_LABELS[call.conversation_mode] || call.conversation_mode || '-'}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-sm">{call.product_name}</TableCell>
                                <TableCell>
                                  {call.reason_name ? (
                                    <Badge variant="secondary" className="text-xs">{call.reason_name}</Badge>
                                  ) : (
                                    <span className="text-muted-foreground text-xs">-</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-xs">
                                    {call.source_queue_name || call.queue_name || '-'}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-sm">{call.agent_name || '-'}</TableCell>
                                <TableCell>
                                  <span className={`text-xs font-mono ${call.speaking_time_seconds >= 120 ? 'text-destructive font-bold' : 'text-muted-foreground'}`}>
                                    {formatSpeakingTime(call.speaking_time_seconds)}
                                  </span>
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">{call.created_at}</TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  {format(new Date(call.attendance_created_at), "dd/MM HH:mm", { locale: ptBR })}
                                </TableCell>
                                <TableCell>
                                  {call.completed ? (
                                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                                  ) : (
                                    <AlertCircle className="w-4 h-4 text-yellow-500" />
                                  )}
                                </TableCell>
                              </TableRow>
                            ))
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
                
                {/* LEAD SEM RECEPTIVO */}
                <TabsContent value="lead-only">
                  <div className="border rounded-lg overflow-auto max-h-[600px]">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background">
                        <TableRow>
                          <TableHead>Telefone</TableHead>
                          <TableHead>Lead</TableHead>
                          <TableHead>Etapa Funil</TableHead>
                          <TableHead>Responsável</TableHead>
                          <TableHead>Follow-up</TableHead>
                          <TableHead>Hora 3C+</TableHead>
                          <TableHead>Atendente 3C+</TableHead>
                          <TableHead><div className="flex items-center gap-1"><Clock className="w-3 h-3" /> Tempo</div></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {result.callsWithLeadOnly.map((call, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-mono text-sm">{call.number}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <span className="font-medium text-sm">{call.lead_name}</span>
                                <a href={`/leads/${call.lead_id}`} target="_blank" rel="noopener noreferrer" title="Abrir lead em nova aba">
                                  <ExternalLink className="w-3.5 h-3.5 text-primary hover:text-primary/80 shrink-0" />
                                </a>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">{call.lead_stage}</Badge>
                            </TableCell>
                            <TableCell className="text-sm">{call.responsible_name || '-'}</TableCell>
                            <TableCell>
                              {call.followup_reason ? (
                                <div className="flex flex-col">
                                  <span className="text-xs font-medium">{call.followup_reason}</span>
                                  {call.followup_scheduled_at && (
                                    <span className="text-xs text-muted-foreground">
                                      {format(new Date(call.followup_scheduled_at), "dd/MM HH:mm", { locale: ptBR })}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">Sem follow-up</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{call.created_at}</TableCell>
                            <TableCell className="text-sm">{call.agent_name || '-'}</TableCell>
                            <TableCell>
                              <span className={`text-xs font-mono ${call.speaking_time_seconds >= 120 ? 'text-destructive font-bold' : 'text-muted-foreground'}`}>
                                {formatSpeakingTime(call.speaking_time_seconds)}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
                
                {/* SEM REGISTRO - with filters + speaking time */}
                <TabsContent value="without-record">
                  {/* Filters */}
                  <div className="flex flex-wrap items-center gap-3 mb-3 p-3 border rounded-lg bg-muted/30">
                    <Label className="text-sm whitespace-nowrap font-medium flex items-center gap-1"><Filter className="w-3 h-3" /> Filtros:</Label>
                    <Select value={srQueueFilter} onValueChange={setSrQueueFilter}>
                      <SelectTrigger className="w-[180px] h-8 text-xs">
                        <SelectValue placeholder="Queue" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas queues</SelectItem>
                        {srFilterOptions.queues.map(q => (
                          <SelectItem key={q} value={q}>{q}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={srStatusFilter} onValueChange={setSrStatusFilter}>
                      <SelectTrigger className="w-[160px] h-8 text-xs">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos status</SelectItem>
                        {srFilterOptions.statuses.map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={srAgentFilter} onValueChange={setSrAgentFilter}>
                      <SelectTrigger className="w-[160px] h-8 text-xs">
                        <SelectValue placeholder="Atendente" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos atendentes</SelectItem>
                        {srFilterOptions.agents.map(a => (
                          <SelectItem key={a} value={a}>{a}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={srMinTime} onValueChange={setSrMinTime}>
                      <SelectTrigger className="w-[150px] h-8 text-xs">
                        <SelectValue placeholder="Duração" />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_FILTER_OPTIONS.map(o => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Badge variant="secondary" className="text-xs">{filteredWithoutRecord.length} registros</Badge>
                  </div>

                  <div className="border rounded-lg overflow-auto max-h-[600px]">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background">
                        <TableRow>
                          <TableHead>Telefone</TableHead>
                          <TableHead>Data/Hora</TableHead>
                          <TableHead>Queue (origem)</TableHead>
                          <TableHead>Status 3C+</TableHead>
                          <TableHead>Atendente</TableHead>
                          <TableHead><div className="flex items-center gap-1"><Clock className="w-3 h-3" /> Tempo</div></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredWithoutRecord.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                              {srQueueFilter !== 'all' || srStatusFilter !== 'all' || srAgentFilter !== 'all' || srMinTime !== 'all'
                                ? 'Nenhum registro com estes filtros'
                                : 'Todas as ligações têm registro! 🎉'}
                            </TableCell>
                          </TableRow>
                        ) : (
                          groupedWithoutRecord.map((group) => (
                            group.records.map((call, idx) => (
                              <TableRow key={`wr-${group.phone}-${idx}`} className={group.records.length > 1 && idx > 0 ? 'border-t-0 bg-muted/20' : group.records.length > 1 ? 'border-l-4 border-l-primary' : ''}>
                                <TableCell className="font-mono text-sm">
                                  {idx === 0 ? (
                                    <div className="flex items-center gap-1">
                                      {call.number}
                                      {group.records.length > 1 && (
                                        <Badge variant="outline" className="text-[10px] ml-1">
                                          <Layers className="w-3 h-3 mr-0.5" />{group.records.length}
                                        </Badge>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground text-xs">↳ {call.number}</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">{call.created_at}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-xs">
                                    {call.source_queue_name || call.queue_name || 'N/A'}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-sm">{call.readable_status_text}</TableCell>
                                <TableCell className="text-sm">{call.agent_name || '-'}</TableCell>
                                <TableCell>
                                  <span className={`text-xs font-mono ${call.speaking_time_seconds >= 120 ? 'text-destructive font-bold' : 'text-muted-foreground'}`}>
                                    {formatSpeakingTime(call.speaking_time_seconds)}
                                  </span>
                                </TableCell>
                              </TableRow>
                            ))
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}
        
        {/* History Section */}
        {validations && validations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5" />
                Histórico de Validações
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Arquivo</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Sem Registro</TableHead>
                      <TableHead>Sem Venda</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {validations.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell>
                          {format(new Date(v.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">{v.file_name}</TableCell>
                        <TableCell>{v.total_calls}</TableCell>
                        <TableCell>
                          <Badge variant="destructive">{v.calls_without_record}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{v.calls_with_record_no_sale}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
