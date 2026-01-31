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
  Call3cData,
  ValidationResult,
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
      // Read file content
      const content = await file.text();
      const calls = parseCsv3c(content);
      
      if (calls.length === 0) {
        toast.error('Nenhuma ligação encontrada no arquivo');
        setProcessing(false);
        return;
      }
      
      // Get blacklist and CNPJ numbers
      const blacklistNumbers = config?.blacklist_numbers || [];
      const cnpjNumbers = config?.cnpj_numbers || [];
      
      // Filter out blacklisted and CNPJ numbers
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
      
      // Group calls by phone and date for lookup
      const callsByPhoneDate = new Map<string, Call3cData[]>();
      for (const call of filteredCalls) {
        const parsedDate = parseDate3c(call.created_at);
        if (!parsedDate) continue;
        
        const dateKey = format(parsedDate, 'yyyy-MM-dd');
        const key = `${call.number}_${dateKey}`;
        
        if (!callsByPhoneDate.has(key)) {
          callsByPhoneDate.set(key, []);
        }
        callsByPhoneDate.get(key)!.push(call);
      }
      
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
      
      // Fetch receptive attendances for the date range
      const { data: attendances, error } = await supabase
        .from('receptive_attendances')
        .select(`
          id,
          phone_searched,
          user_id,
          sale_id,
          non_purchase_reason_id,
          created_at
        `)
        .eq('organization_id', profile.organization_id)
        .gte('created_at', format(minDate, 'yyyy-MM-dd'))
        .lte('created_at', format(new Date(maxDate.getTime() + 86400000), 'yyyy-MM-dd'));
      
      if (error) throw error;
      
      // Build map of phone+date to attendance
      const attendanceByPhoneDate = new Map<string, (typeof attendances)[0]>();
      for (const att of attendances || []) {
        const phone = att.phone_searched?.replace(/\D/g, '') || '';
        const dateKey = format(new Date(att.created_at), 'yyyy-MM-dd');
        const key = `${phone}_${dateKey}`;
        attendanceByPhoneDate.set(key, att);
      }
      
      // Get unique phone+date keys from calls
      const uniqueCallKeys = Array.from(callsByPhoneDate.keys());
      
      // Find calls without record
      const callsWithoutRecord: Call3cData[] = [];
      const callsWithRecordNoSale: Array<Call3cData & {
        receptive_id: string;
        user_name: string;
        reason_name: string;
        has_followup: boolean;
      }> = [];
      
      // Get user IDs and reason IDs for lookup
      const userIds = new Set<string>();
      const reasonIds = new Set<string>();
      
      for (const key of uniqueCallKeys) {
        const attendance = attendanceByPhoneDate.get(key);
        const calls = callsByPhoneDate.get(key)!;
        
        if (!attendance) {
          // No record for this phone+date
          callsWithoutRecord.push(...calls);
        } else if (!attendance.sale_id) {
          // Has record but no sale
          if (attendance.user_id) userIds.add(attendance.user_id);
          if (attendance.non_purchase_reason_id) reasonIds.add(attendance.non_purchase_reason_id);
          
          for (const call of calls) {
            callsWithRecordNoSale.push({
              ...call,
              receptive_id: attendance.id,
              user_name: '',
              reason_name: '',
              has_followup: false,
            });
          }
        }
      }
      
      // Fetch user names
      let userMap = new Map<string, string>();
      if (userIds.size > 0) {
        const { data: users } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name')
          .in('user_id', Array.from(userIds));
        
        userMap = new Map((users || []).map(u => [u.user_id, `${u.first_name} ${u.last_name}`]));
      }
      
      // Fetch reason names
      let reasonMap = new Map<string, string>();
      if (reasonIds.size > 0) {
        const { data: reasons } = await supabase
          .from('non_purchase_reasons')
          .select('id, name')
          .in('id', Array.from(reasonIds));
        
        reasonMap = new Map((reasons || []).map(r => [r.id, r.name]));
      }
      
      // Update with fetched data - map attendance to get user/reason
      for (const call of callsWithRecordNoSale) {
        const phone = call.number;
        const parsedDate = parseDate3c(call.created_at);
        if (parsedDate) {
          const dateKey = format(parsedDate, 'yyyy-MM-dd');
          const key = `${phone}_${dateKey}`;
          const attendance = attendanceByPhoneDate.get(key);
          if (attendance) {
            call.user_name = attendance.user_id ? userMap.get(attendance.user_id) || 'Desconhecido' : 'Desconhecido';
            call.reason_name = attendance.non_purchase_reason_id ? reasonMap.get(attendance.non_purchase_reason_id) || '' : '';
          }
        }
      }
      
      const validationResult: ValidationResult = {
        callsWithoutRecord,
        callsWithRecordNoSale,
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
              <div className="flex gap-4 mt-2">
                <Badge variant="outline" className="text-base">
                  Total: {totalCalls} ligações
                </Badge>
                <Badge variant="destructive" className="text-base">
                  <PhoneOff className="w-4 h-4 mr-1" />
                  Sem registro: {result.callsWithoutRecord.length}
                </Badge>
                <Badge variant="secondary" className="text-base">
                  <ShoppingCart className="w-4 h-4 mr-1" />
                  Sem venda: {result.callsWithRecordNoSale.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="without-record">
                <TabsList className="mb-4">
                  <TabsTrigger value="without-record" className="gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Sem Registro ({result.callsWithoutRecord.length})
                  </TabsTrigger>
                  <TabsTrigger value="no-sale" className="gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Sem Venda ({result.callsWithRecordNoSale.length})
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="without-record">
                  <div className="border rounded-lg overflow-auto max-h-[500px]">
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
                
                <TabsContent value="no-sale">
                  <div className="border rounded-lg overflow-auto max-h-[500px]">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background">
                        <TableRow>
                          <TableHead>Telefone</TableHead>
                          <TableHead>Data/Hora</TableHead>
                          <TableHead>Queue (origem)</TableHead>
                          <TableHead>Vendedor</TableHead>
                          <TableHead>Motivo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {result.callsWithRecordNoSale.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                              Todos os registros têm venda! 🎉
                            </TableCell>
                          </TableRow>
                        ) : (
                          result.callsWithRecordNoSale.map((call, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="font-mono">{call.number}</TableCell>
                              <TableCell>{call.created_at}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">
                                  {call.source_queue_name || call.queue_name || 'N/A'}
                                </Badge>
                              </TableCell>
                              <TableCell>{call.user_name}</TableCell>
                              <TableCell>
                                {call.reason_name ? (
                                  <Badge variant="secondary">{call.reason_name}</Badge>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
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
