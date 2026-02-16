import { useState, useCallback, useEffect } from 'react';
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
      
      // Get date range from calls
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
      
      // Fetch receptive attendances with enriched data
      const { data: attendances, error } = await supabase
        .from('receptive_attendances')
        .select(`
          id,
          phone_searched,
          user_id,
          sale_id,
          non_purchase_reason_id,
          created_at,
          conversation_mode,
          lead_id,
          product_id,
          completed,
          lead_existed
        `)
        .eq('organization_id', profile.organization_id)
        .gte('created_at', format(minDate, 'yyyy-MM-dd'))
        .lte('created_at', format(new Date(maxDate.getTime() + 86400000), 'yyyy-MM-dd'));
      
      if (error) throw error;
      
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
      
      // Also fetch all leads to match by phone when no attendance exists
      const { data: allLeads } = await supabase
        .from('leads')
        .select('id, name, whatsapp, stage, assigned_to')
        .eq('organization_id', profile.organization_id);
      
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
        
        const callDateKey = format(callDate, 'yyyy-MM-dd');
        
        // Find matching attendance by phone (fuzzy) and same date
        const matchedAtt = (attendances || []).find(att => {
          const attPhone = att.phone_searched?.replace(/\D/g, '') || '';
          const attDateKey = format(new Date(att.created_at), 'yyyy-MM-dd');
          return phonesMatch(call.number, attPhone) && callDateKey === attDateKey;
        });
        
        if (matchedAtt) {
          const lead = matchedAtt.lead_id ? leadMap.get(matchedAtt.lead_id) : null;
          const sale = matchedAtt.sale_id ? saleMap.get(matchedAtt.sale_id) : null;
          
          const enriched: Call3cData & MatchedAttendance = {
            ...call,
            receptive_id: matchedAtt.id,
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
  }, [file, profile, config, saveValidation]);

  const formatCurrency = (cents: number | null) => {
    if (!cents) return '-';
    return `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;
  };
  
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
              <Button
                onClick={processFile}
                disabled={!file || processing || savingValidation}
              >
                {processing ? 'Processando...' : 'Validar'}
              </Button>
            </div>
            {file && (
              <p className="text-sm text-muted-foreground">
                Arquivo selecionado: <strong>{file.name}</strong>
              </p>
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
                
                {/* COM VENDA */}
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
                          <TableHead>Valor Venda</TableHead>
                          <TableHead>Hora 3C+</TableHead>
                          <TableHead>Hora Registro</TableHead>
                          <TableHead>Completo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {result.callsWithRecordAndSale.map((call, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-mono text-sm">{call.number}</TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium text-sm">{call.lead_name}</span>
                                <span className="text-xs text-muted-foreground">{call.lead_stage}</span>
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
                              <Badge className="bg-green-600 hover:bg-green-700 text-xs">
                                {formatCurrency(call.sale_total_cents)}
                              </Badge>
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
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
                
                {/* SEM VENDA */}
                <TabsContent value="no-sale">
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
                          <TableHead>Hora 3C+</TableHead>
                          <TableHead>Hora Registro</TableHead>
                          <TableHead>Completo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {result.callsWithRecordNoSale.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                              Todos os registros têm venda! 🎉
                            </TableCell>
                          </TableRow>
                        ) : (
                          result.callsWithRecordNoSale.map((call, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="font-mono text-sm">{call.number}</TableCell>
                              <TableCell>
                                <div className="flex flex-col">
                                  <span className="font-medium text-sm">{call.lead_name}</span>
                                  <span className="text-xs text-muted-foreground">{call.lead_stage}</span>
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
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {result.callsWithLeadOnly.map((call, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-mono text-sm">{call.number}</TableCell>
                            <TableCell className="font-medium text-sm">{call.lead_name}</TableCell>
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
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
                
                {/* SEM REGISTRO */}
                <TabsContent value="without-record">
                  <div className="border rounded-lg overflow-auto max-h-[600px]">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background">
                        <TableRow>
                          <TableHead>Telefone</TableHead>
                          <TableHead>Data/Hora</TableHead>
                          <TableHead>Queue (origem)</TableHead>
                          <TableHead>Status 3C+</TableHead>
                          <TableHead>Atendente</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {result.callsWithoutRecord.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                              Todas as ligações têm registro! 🎉
                            </TableCell>
                          </TableRow>
                        ) : (
                          result.callsWithoutRecord.map((call, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="font-mono">{call.number}</TableCell>
                              <TableCell>{call.created_at}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">
                                  {call.source_queue_name || call.queue_name || 'N/A'}
                                </Badge>
                              </TableCell>
                              <TableCell>{call.readable_status_text}</TableCell>
                              <TableCell>{call.agent_name || '-'}</TableCell>
                            </TableRow>
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
