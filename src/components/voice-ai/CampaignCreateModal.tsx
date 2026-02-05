 import { useState } from 'react';
 import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Textarea } from '@/components/ui/textarea';
 import { Label } from '@/components/ui/label';
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
 import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
 import { Card, CardContent } from '@/components/ui/card';
 import { Badge } from '@/components/ui/badge';
 import { Loader2, Upload, FileSpreadsheet, Users, Phone, AlertCircle, CheckCircle2 } from 'lucide-react';
 import { useVoiceAIAgents } from '@/hooks/useVoiceAI';
 import { useTenant } from '@/hooks/useTenant';
 import { supabase } from '@/integrations/supabase/client';
 import { toast } from '@/hooks/use-toast';
 import { useMutation, useQueryClient } from '@tanstack/react-query';
 
 interface CampaignCreateModalProps {
   open: boolean;
   onOpenChange: (open: boolean) => void;
 }
 
 interface ParsedContact {
   phone: string;
   name?: string;
   metadata?: Record<string, string>;
   valid: boolean;
   error?: string;
 }
 
 export function CampaignCreateModal({ open, onOpenChange }: CampaignCreateModalProps) {
   const { tenantId } = useTenant();
   const queryClient = useQueryClient();
   const { data: agents } = useVoiceAIAgents();
 
   const [step, setStep] = useState<'info' | 'contacts' | 'review'>('info');
   const [formData, setFormData] = useState({
     name: '',
     description: '',
     agent_id: '',
     calls_per_minute: 5,
     max_retries: 2,
     working_hours_start: '09:00',
     working_hours_end: '18:00',
   });
 
   const [csvFile, setCsvFile] = useState<File | null>(null);
   const [parsedContacts, setParsedContacts] = useState<ParsedContact[]>([]);
   const [isParsing, setIsParsing] = useState(false);
 
   const normalizePhone = (phone: string): string => {
     // Remove tudo que não é número
     let cleaned = phone.replace(/\D/g, '');
     
     // Se começar com 55, mantém
     if (cleaned.startsWith('55') && cleaned.length >= 12) {
       return cleaned;
     }
     
     // Adiciona 55 se não tiver
     if (cleaned.length === 10 || cleaned.length === 11) {
       return '55' + cleaned;
     }
     
     return cleaned;
   };
 
   const validatePhone = (phone: string): boolean => {
     const normalized = normalizePhone(phone);
     // Telefone brasileiro: 55 + DDD (2) + número (8-9)
     return normalized.length >= 12 && normalized.length <= 13;
   };
 
   const parseCSV = async (file: File) => {
     setIsParsing(true);
     
     try {
       const text = await file.text();
       const lines = text.split('\n').filter(line => line.trim());
       
       if (lines.length < 2) {
         toast({ title: 'Arquivo vazio', description: 'O CSV deve ter pelo menos um contato', variant: 'destructive' });
         setIsParsing(false);
         return;
       }
 
       // Parse header
       const header = lines[0].split(/[,;]/).map(h => h.trim().toLowerCase());
       const phoneIndex = header.findIndex(h => ['phone', 'telefone', 'celular', 'whatsapp', 'numero'].includes(h));
       const nameIndex = header.findIndex(h => ['name', 'nome', 'cliente'].includes(h));
 
       if (phoneIndex === -1) {
         toast({ 
           title: 'Coluna de telefone não encontrada', 
           description: 'O CSV deve ter uma coluna chamada "phone", "telefone" ou "celular"', 
           variant: 'destructive' 
         });
         setIsParsing(false);
         return;
       }
 
       // Parse contacts
       const contacts: ParsedContact[] = [];
       for (let i = 1; i < lines.length; i++) {
         const values = lines[i].split(/[,;]/).map(v => v.trim().replace(/^["']|["']$/g, ''));
         const phone = values[phoneIndex] || '';
         const name = nameIndex !== -1 ? values[nameIndex] : undefined;
 
         // Build metadata from other columns
         const metadata: Record<string, string> = {};
         header.forEach((h, idx) => {
           if (idx !== phoneIndex && idx !== nameIndex && values[idx]) {
             metadata[h] = values[idx];
           }
         });
 
         if (!phone) continue;
 
         const normalizedPhone = normalizePhone(phone);
         const isValid = validatePhone(phone);
 
         contacts.push({
           phone: normalizedPhone,
           name,
           metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
           valid: isValid,
           error: isValid ? undefined : 'Número inválido'
         });
       }
 
       setParsedContacts(contacts);
       setStep('review');
     } catch (error) {
       toast({ title: 'Erro ao ler CSV', description: 'Verifique o formato do arquivo', variant: 'destructive' });
     }
     
     setIsParsing(false);
   };
 
   const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
     const file = e.target.files?.[0];
     if (file) {
       setCsvFile(file);
       parseCSV(file);
     }
   };
 
   const createCampaign = useMutation({
     mutationFn: async () => {
       const validContacts = parsedContacts.filter(c => c.valid);
       
       if (validContacts.length === 0) {
         throw new Error('Nenhum contato válido para criar campanha');
       }
 
       // Create campaign
       const { data: campaign, error: campaignError } = await supabase
         .from('voice_ai_outbound_campaigns')
         .insert({
           organization_id: tenantId,
           agent_id: formData.agent_id,
           name: formData.name,
           description: formData.description || null,
           status: 'draft',
           total_contacts: validContacts.length,
           calls_per_minute: formData.calls_per_minute,
           max_retries: formData.max_retries,
           working_hours_start: formData.working_hours_start,
           working_hours_end: formData.working_hours_end,
         })
         .select()
         .single();
 
       if (campaignError) throw campaignError;
 
       // Insert contacts
       const contactsToInsert = validContacts.map(c => ({
         organization_id: tenantId,
         campaign_id: campaign.id,
         phone: c.phone,
         name: c.name || null,
         metadata: c.metadata || null,
         status: 'pending',
         attempts: 0,
       }));
 
       const { error: contactsError } = await supabase
         .from('voice_ai_campaign_contacts')
         .insert(contactsToInsert);
 
       if (contactsError) throw contactsError;
 
       return campaign;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['voice-ai-campaigns'] });
       toast({ title: 'Campanha criada!', description: 'Contatos importados com sucesso' });
       onOpenChange(false);
       resetForm();
     },
     onError: (error: Error) => {
       toast({ title: 'Erro', description: error.message, variant: 'destructive' });
     }
   });
 
   const resetForm = () => {
     setStep('info');
     setFormData({
       name: '',
       description: '',
       agent_id: '',
       calls_per_minute: 5,
       max_retries: 2,
       working_hours_start: '09:00',
       working_hours_end: '18:00',
     });
     setCsvFile(null);
     setParsedContacts([]);
   };
 
   const validCount = parsedContacts.filter(c => c.valid).length;
   const invalidCount = parsedContacts.filter(c => !c.valid).length;
 
   return (
     <Dialog open={open} onOpenChange={onOpenChange}>
       <DialogContent className="max-w-2xl">
         <DialogHeader>
           <DialogTitle>Nova Campanha de Ligações</DialogTitle>
           <DialogDescription>
             Configure a campanha e importe os contatos via CSV
           </DialogDescription>
         </DialogHeader>
 
         <Tabs value={step} className="mt-4">
           <TabsList className="grid w-full grid-cols-3">
             <TabsTrigger value="info" disabled={step !== 'info'}>
               1. Informações
             </TabsTrigger>
             <TabsTrigger value="contacts" disabled={step === 'info'}>
               2. Contatos
             </TabsTrigger>
             <TabsTrigger value="review" disabled={step !== 'review'}>
               3. Revisão
             </TabsTrigger>
           </TabsList>
 
           {/* Step 1: Campaign Info */}
           <TabsContent value="info" className="space-y-4 mt-4">
             <div className="grid gap-4 md:grid-cols-2">
               <div className="space-y-2">
                 <Label>Nome da Campanha *</Label>
                 <Input
                   value={formData.name}
                   onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                   placeholder="Ex: Recuperação Janeiro"
                 />
               </div>
               <div className="space-y-2">
                 <Label>Agente de Voz *</Label>
                 <Select
                   value={formData.agent_id}
                   onValueChange={(value) => setFormData({ ...formData, agent_id: value })}
                 >
                   <SelectTrigger>
                     <SelectValue placeholder="Selecione um agente" />
                   </SelectTrigger>
                   <SelectContent>
                     {agents?.map((agent) => (
                       <SelectItem key={agent.id} value={agent.id}>
                         {agent.name}
                       </SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
               </div>
             </div>
 
             <div className="space-y-2">
               <Label>Descrição</Label>
               <Textarea
                 value={formData.description}
                 onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                 placeholder="Objetivo da campanha..."
                 rows={2}
               />
             </div>
 
             <div className="grid gap-4 md:grid-cols-3">
               <div className="space-y-2">
                 <Label>Ligações por minuto</Label>
                 <Input
                   type="number"
                   min={1}
                   max={60}
                   value={formData.calls_per_minute}
                   onChange={(e) => setFormData({ ...formData, calls_per_minute: parseInt(e.target.value) || 5 })}
                 />
               </div>
               <div className="space-y-2">
                 <Label>Horário início</Label>
                 <Input
                   type="time"
                   value={formData.working_hours_start}
                   onChange={(e) => setFormData({ ...formData, working_hours_start: e.target.value })}
                 />
               </div>
               <div className="space-y-2">
                 <Label>Horário fim</Label>
                 <Input
                   type="time"
                   value={formData.working_hours_end}
                   onChange={(e) => setFormData({ ...formData, working_hours_end: e.target.value })}
                 />
               </div>
             </div>
 
             <DialogFooter>
               <Button variant="outline" onClick={() => onOpenChange(false)}>
                 Cancelar
               </Button>
               <Button
                 onClick={() => setStep('contacts')}
                 disabled={!formData.name || !formData.agent_id}
               >
                 Próximo
               </Button>
             </DialogFooter>
           </TabsContent>
 
           {/* Step 2: Import Contacts */}
           <TabsContent value="contacts" className="space-y-4 mt-4">
             <Card>
               <CardContent className="pt-6">
                 <div className="flex flex-col items-center justify-center py-8 border-2 border-dashed rounded-lg">
                   {isParsing ? (
                     <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
                   ) : csvFile ? (
                     <>
                       <FileSpreadsheet className="h-10 w-10 text-primary mb-2" />
                       <p className="font-medium">{csvFile.name}</p>
                       <p className="text-sm text-muted-foreground">
                         Processando...
                       </p>
                     </>
                   ) : (
                     <>
                       <Upload className="h-10 w-10 text-muted-foreground mb-4" />
                       <p className="font-medium mb-1">Arraste um arquivo CSV ou clique para selecionar</p>
                       <p className="text-sm text-muted-foreground mb-4">
                         O arquivo deve ter uma coluna "telefone" ou "phone"
                       </p>
                       <Input
                         type="file"
                         accept=".csv"
                         onChange={handleFileChange}
                         className="max-w-xs"
                       />
                     </>
                   )}
                 </div>
 
                 <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                   <p className="text-sm font-medium mb-2">Formato esperado:</p>
                   <code className="text-xs text-muted-foreground">
                     telefone,nome,email<br/>
                     5511999998888,João Silva,joao@email.com
                   </code>
                 </div>
               </CardContent>
             </Card>
 
             <DialogFooter>
               <Button variant="outline" onClick={() => setStep('info')}>
                 Voltar
               </Button>
             </DialogFooter>
           </TabsContent>
 
           {/* Step 3: Review */}
           <TabsContent value="review" className="space-y-4 mt-4">
             <div className="grid gap-4 md:grid-cols-3">
               <Card>
                 <CardContent className="pt-4">
                   <div className="flex items-center gap-3">
                     <div className="p-2 rounded-lg bg-emerald-500/10">
                       <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                     </div>
                     <div>
                       <p className="text-2xl font-bold">{validCount}</p>
                       <p className="text-xs text-muted-foreground">Contatos válidos</p>
                     </div>
                   </div>
                 </CardContent>
               </Card>
 
               <Card>
                 <CardContent className="pt-4">
                   <div className="flex items-center gap-3">
                     <div className="p-2 rounded-lg bg-destructive/10">
                       <AlertCircle className="h-5 w-5 text-destructive" />
                     </div>
                     <div>
                       <p className="text-2xl font-bold">{invalidCount}</p>
                       <p className="text-xs text-muted-foreground">Inválidos</p>
                     </div>
                   </div>
                 </CardContent>
               </Card>
 
               <Card>
                 <CardContent className="pt-4">
                   <div className="flex items-center gap-3">
                     <div className="p-2 rounded-lg bg-primary/10">
                       <Phone className="h-5 w-5 text-primary" />
                     </div>
                     <div>
                       <p className="text-2xl font-bold">{formData.calls_per_minute}/min</p>
                       <p className="text-xs text-muted-foreground">Velocidade</p>
                     </div>
                   </div>
                 </CardContent>
               </Card>
             </div>
 
             {/* Preview contacts */}
             <Card>
               <CardContent className="pt-4">
                 <p className="text-sm font-medium mb-3">Prévia dos contatos:</p>
                 <div className="space-y-2 max-h-[200px] overflow-y-auto">
                   {parsedContacts.slice(0, 10).map((contact, idx) => (
                     <div 
                       key={idx}
                       className="flex items-center justify-between p-2 rounded bg-muted/50"
                     >
                       <div className="flex items-center gap-2">
                         <Users className="h-4 w-4 text-muted-foreground" />
                         <span className="text-sm">{contact.name || 'Sem nome'}</span>
                         <span className="text-xs text-muted-foreground">{contact.phone}</span>
                       </div>
                       <Badge variant={contact.valid ? 'default' : 'destructive'}>
                         {contact.valid ? 'OK' : contact.error}
                       </Badge>
                     </div>
                   ))}
                   {parsedContacts.length > 10 && (
                     <p className="text-xs text-muted-foreground text-center py-2">
                       + {parsedContacts.length - 10} contatos...
                     </p>
                   )}
                 </div>
               </CardContent>
             </Card>
 
             <DialogFooter>
               <Button variant="outline" onClick={() => setStep('contacts')}>
                 Voltar
               </Button>
               <Button
                 onClick={() => createCampaign.mutate()}
                 disabled={validCount === 0 || createCampaign.isPending}
               >
                 {createCampaign.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                 Criar Campanha ({validCount} contatos)
               </Button>
             </DialogFooter>
           </TabsContent>
         </Tabs>
       </DialogContent>
     </Dialog>
   );
 }