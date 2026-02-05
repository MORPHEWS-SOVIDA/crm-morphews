 import { useState } from 'react';
 import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
 import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Textarea } from '@/components/ui/textarea';
 import { Label } from '@/components/ui/label';
 import { Switch } from '@/components/ui/switch';
 import { Badge } from '@/components/ui/badge';
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
 import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
 import { 
   Plus, Save, Loader2, Webhook, Mail, MessageSquare, Tag, 
   UserCheck, ListTodo, Bell, Trash2, Settings2, Zap, Play
 } from 'lucide-react';
 import { supabase } from '@/integrations/supabase/client';
 import { useTenant } from '@/hooks/useTenant';
 import { toast } from '@/hooks/use-toast';
 import { useVoiceAIAgents } from '@/hooks/useVoiceAI';
 
 interface Automation {
   id: string;
   agent_id: string | null;
   name: string;
   description: string | null;
   trigger_event: string;
   action_type: string;
   action_config: Record<string, any>;
   conditions: Record<string, any>;
   is_active: boolean;
   executions_count: number;
   last_executed_at: string | null;
   created_at: string;
   agent?: { name: string } | null;
 }
 
 const TRIGGER_EVENTS = [
   { value: 'call_ended', label: 'Chamada Finalizada', icon: Zap },
   { value: 'appointment_booked', label: 'Reunião Agendada', icon: ListTodo },
   { value: 'transfer_requested', label: 'Transferência Solicitada', icon: UserCheck },
   { value: 'sentiment_negative', label: 'Sentimento Negativo', icon: Zap },
   { value: 'sentiment_positive', label: 'Sentimento Positivo', icon: Zap },
   { value: 'outcome_sale', label: 'Venda Realizada', icon: Zap },
   { value: 'outcome_no_answer', label: 'Não Atendeu', icon: Zap },
 ];
 
 const ACTION_TYPES = [
   { value: 'webhook', label: 'Disparar Webhook', icon: Webhook },
   { value: 'update_lead', label: 'Atualizar Lead/CRM', icon: UserCheck },
   { value: 'send_notification', label: 'Enviar Notificação', icon: Bell },
   { value: 'create_task', label: 'Criar Tarefa', icon: ListTodo },
   { value: 'send_email', label: 'Enviar E-mail', icon: Mail },
   { value: 'send_sms', label: 'Enviar SMS', icon: MessageSquare },
   { value: 'add_tag', label: 'Adicionar Tag', icon: Tag },
 ];
 
 export function AutomationsConfig() {
   const { tenantId } = useTenant();
   const queryClient = useQueryClient();
   const [isDialogOpen, setIsDialogOpen] = useState(false);
   const [editingAutomation, setEditingAutomation] = useState<Automation | null>(null);
   
   const { data: agents } = useVoiceAIAgents();
 
   const [formData, setFormData] = useState({
     agent_id: '',
     name: '',
     description: '',
     trigger_event: '',
     action_type: '',
     action_config: {} as Record<string, any>,
     is_active: true,
   });
 
   const { data: automations, isLoading } = useQuery({
     queryKey: ['voice-ai-automations', tenantId],
     queryFn: async () => {
       if (!tenantId) return [];
       const { data, error } = await supabase
         .from('voice_ai_automations')
         .select(`
           *,
           agent:voice_ai_agents!voice_ai_automations_agent_id_fkey(name)
         `)
         .eq('organization_id', tenantId)
         .order('created_at', { ascending: false });
       
       if (error) throw error;
       return data as Automation[];
     },
     enabled: !!tenantId,
   });
 
   const createAutomation = useMutation({
     mutationFn: async (data: typeof formData) => {
       const { error } = await supabase
         .from('voice_ai_automations')
         .insert({
           organization_id: tenantId,
           agent_id: data.agent_id || null,
           name: data.name,
           description: data.description || null,
           trigger_event: data.trigger_event,
           action_type: data.action_type,
           action_config: data.action_config,
           is_active: data.is_active,
         });
       
       if (error) throw error;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['voice-ai-automations'] });
       setIsDialogOpen(false);
       resetForm();
       toast({ title: 'Automação criada!', description: 'Workflow configurado com sucesso.' });
     },
     onError: (error: Error) => {
       toast({ title: 'Erro', description: error.message, variant: 'destructive' });
     },
   });
 
   const updateAutomation = useMutation({
     mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
       const { error } = await supabase
         .from('voice_ai_automations')
         .update({
           agent_id: data.agent_id || null,
           name: data.name,
           description: data.description || null,
           trigger_event: data.trigger_event,
           action_type: data.action_type,
           action_config: data.action_config,
           is_active: data.is_active,
         })
         .eq('id', id);
       
       if (error) throw error;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['voice-ai-automations'] });
       setIsDialogOpen(false);
       setEditingAutomation(null);
       resetForm();
       toast({ title: 'Automação atualizada!' });
     },
     onError: (error: Error) => {
       toast({ title: 'Erro', description: error.message, variant: 'destructive' });
     },
   });
 
   const deleteAutomation = useMutation({
     mutationFn: async (id: string) => {
       const { error } = await supabase
         .from('voice_ai_automations')
         .delete()
         .eq('id', id);
       
       if (error) throw error;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['voice-ai-automations'] });
       toast({ title: 'Automação removida!' });
     },
     onError: (error: Error) => {
       toast({ title: 'Erro', description: error.message, variant: 'destructive' });
     },
   });
 
   const resetForm = () => {
     setFormData({
       agent_id: '',
       name: '',
       description: '',
       trigger_event: '',
       action_type: '',
       action_config: {},
       is_active: true,
     });
     setEditingAutomation(null);
   };
 
   const startEditing = (automation: Automation) => {
     setEditingAutomation(automation);
     setFormData({
       agent_id: automation.agent_id || '',
       name: automation.name,
       description: automation.description || '',
       trigger_event: automation.trigger_event,
       action_type: automation.action_type,
       action_config: automation.action_config,
       is_active: automation.is_active,
     });
     setIsDialogOpen(true);
   };
 
   const handleSubmit = (e: React.FormEvent) => {
     e.preventDefault();
     if (editingAutomation) {
       updateAutomation.mutate({ id: editingAutomation.id, data: formData });
     } else {
       createAutomation.mutate(formData);
     }
   };
 
   const getTriggerLabel = (value: string) => {
     return TRIGGER_EVENTS.find(t => t.value === value)?.label || value;
   };
 
   const getActionLabel = (value: string) => {
     return ACTION_TYPES.find(a => a.value === value)?.label || value;
   };
 
   const getActionIcon = (value: string) => {
     return ACTION_TYPES.find(a => a.value === value)?.icon || Webhook;
   };
 
   const renderActionConfig = () => {
     switch (formData.action_type) {
       case 'webhook':
         return (
           <div className="space-y-3">
             <div className="space-y-2">
               <Label>URL do Webhook *</Label>
               <Input
                 value={formData.action_config.url || ''}
                 onChange={(e) => setFormData({ 
                   ...formData, 
                   action_config: { ...formData.action_config, url: e.target.value } 
                 })}
                 placeholder="https://n8n.exemplo.com/webhook/..."
                 required
               />
             </div>
             <div className="space-y-2">
               <Label>Método HTTP</Label>
               <Select
                 value={formData.action_config.method || 'POST'}
                 onValueChange={(value) => setFormData({ 
                   ...formData, 
                   action_config: { ...formData.action_config, method: value } 
                 })}
               >
                 <SelectTrigger>
                   <SelectValue />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="POST">POST</SelectItem>
                   <SelectItem value="GET">GET</SelectItem>
                   <SelectItem value="PUT">PUT</SelectItem>
                 </SelectContent>
               </Select>
             </div>
           </div>
         );
       
       case 'update_lead':
         return (
           <div className="space-y-3">
             <div className="space-y-2">
               <Label>Novo Status do Lead</Label>
               <Input
                 value={formData.action_config.new_status || ''}
                 onChange={(e) => setFormData({ 
                   ...formData, 
                   action_config: { ...formData.action_config, new_status: e.target.value } 
                 })}
                 placeholder="contacted, qualified, etc."
               />
             </div>
             <div className="space-y-2">
               <Label>Adicionar Nota</Label>
               <Textarea
                 value={formData.action_config.note_template || ''}
                 onChange={(e) => setFormData({ 
                   ...formData, 
                   action_config: { ...formData.action_config, note_template: e.target.value } 
                 })}
                 placeholder="Ligação realizada via Voice AI. Resultado: {{outcome}}"
                 rows={2}
               />
             </div>
           </div>
         );
       
       case 'send_notification':
         return (
           <div className="space-y-3">
             <div className="space-y-2">
               <Label>Título da Notificação</Label>
               <Input
                 value={formData.action_config.title || ''}
                 onChange={(e) => setFormData({ 
                   ...formData, 
                   action_config: { ...formData.action_config, title: e.target.value } 
                 })}
                 placeholder="Nova chamada finalizada"
               />
             </div>
             <div className="space-y-2">
               <Label>Mensagem</Label>
               <Textarea
                 value={formData.action_config.message || ''}
                 onChange={(e) => setFormData({ 
                   ...formData, 
                   action_config: { ...formData.action_config, message: e.target.value } 
                 })}
                 placeholder="Lead {{lead_name}} foi contatado. Duração: {{duration}}"
                 rows={2}
               />
             </div>
           </div>
         );
       
       case 'send_email':
         return (
           <div className="space-y-3">
             <div className="space-y-2">
               <Label>E-mail Destino</Label>
               <Input
                 type="email"
                 value={formData.action_config.to_email || ''}
                 onChange={(e) => setFormData({ 
                   ...formData, 
                   action_config: { ...formData.action_config, to_email: e.target.value } 
                 })}
                 placeholder="vendas@empresa.com"
               />
             </div>
             <div className="space-y-2">
               <Label>Assunto</Label>
               <Input
                 value={formData.action_config.subject || ''}
                 onChange={(e) => setFormData({ 
                   ...formData, 
                   action_config: { ...formData.action_config, subject: e.target.value } 
                 })}
                 placeholder="Nova chamada - {{lead_name}}"
               />
             </div>
           </div>
         );
       
       case 'add_tag':
         return (
           <div className="space-y-3">
             <div className="space-y-2">
               <Label>Tags para Adicionar</Label>
               <Input
                 value={formData.action_config.tags || ''}
                 onChange={(e) => setFormData({ 
                   ...formData, 
                   action_config: { ...formData.action_config, tags: e.target.value } 
                 })}
                 placeholder="voice-ai, contacted, qualified"
               />
               <p className="text-xs text-muted-foreground">Separadas por vírgula</p>
             </div>
           </div>
         );
       
       default:
         return null;
     }
   };
 
   if (isLoading) {
     return (
       <div className="flex items-center justify-center py-8">
         <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
       </div>
     );
   }
 
   return (
     <div className="space-y-4">
       <div className="flex items-center justify-between">
         <div>
           <h3 className="text-lg font-semibold">Automações Pós-Ligação</h3>
           <p className="text-sm text-muted-foreground">
             Configure workflows automáticos após eventos de chamadas
           </p>
         </div>
         <Dialog open={isDialogOpen} onOpenChange={(open) => {
           setIsDialogOpen(open);
           if (!open) resetForm();
         }}>
           <DialogTrigger asChild>
             <Button>
               <Plus className="h-4 w-4 mr-2" />
               Nova Automação
             </Button>
           </DialogTrigger>
           <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
             <DialogHeader>
               <DialogTitle>
                 {editingAutomation ? 'Editar Automação' : 'Nova Automação'}
               </DialogTitle>
             </DialogHeader>
             <form onSubmit={handleSubmit} className="space-y-4">
               <div className="space-y-2">
                 <Label>Nome *</Label>
                 <Input
                   value={formData.name}
                   onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                   placeholder="Ex: Notificar equipe após venda"
                   required
                 />
               </div>
 
               <div className="space-y-2">
                 <Label>Agente (opcional)</Label>
                 <Select
                   value={formData.agent_id}
                   onValueChange={(value) => setFormData({ ...formData, agent_id: value })}
                 >
                   <SelectTrigger>
                     <SelectValue placeholder="Todos os agentes" />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="">Todos os agentes</SelectItem>
                     {agents?.map((agent) => (
                       <SelectItem key={agent.id} value={agent.id}>
                         {agent.name}
                       </SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
               </div>
 
               <div className="space-y-2">
                 <Label>Quando *</Label>
                 <Select
                   value={formData.trigger_event}
                   onValueChange={(value) => setFormData({ ...formData, trigger_event: value })}
                   required
                 >
                   <SelectTrigger>
                     <SelectValue placeholder="Selecione o gatilho..." />
                   </SelectTrigger>
                   <SelectContent>
                     {TRIGGER_EVENTS.map((trigger) => (
                       <SelectItem key={trigger.value} value={trigger.value}>
                         <div className="flex items-center gap-2">
                           <trigger.icon className="h-4 w-4" />
                           {trigger.label}
                         </div>
                       </SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
               </div>
 
               <div className="space-y-2">
                 <Label>Então *</Label>
                 <Select
                   value={formData.action_type}
                   onValueChange={(value) => setFormData({ 
                     ...formData, 
                     action_type: value, 
                     action_config: {} 
                   })}
                   required
                 >
                   <SelectTrigger>
                     <SelectValue placeholder="Selecione a ação..." />
                   </SelectTrigger>
                   <SelectContent>
                     {ACTION_TYPES.map((action) => (
                       <SelectItem key={action.value} value={action.value}>
                         <div className="flex items-center gap-2">
                           <action.icon className="h-4 w-4" />
                           {action.label}
                         </div>
                       </SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
               </div>
 
               {formData.action_type && (
                 <div className="border-t pt-4">
                   <Label className="text-sm font-medium mb-3 block">
                     Configurações de {getActionLabel(formData.action_type)}
                   </Label>
                   {renderActionConfig()}
                 </div>
               )}
 
               <div className="space-y-2">
                 <Label>Descrição (opcional)</Label>
                 <Textarea
                   value={formData.description}
                   onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                   placeholder="Descreva o que esta automação faz..."
                   rows={2}
                 />
               </div>
 
               <div className="flex items-center gap-2">
                 <Switch
                   checked={formData.is_active}
                   onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                 />
                 <Label>Ativa</Label>
               </div>
 
               <div className="flex gap-2 pt-2">
                 <Button
                   type="button"
                   variant="outline"
                   onClick={() => {
                     setIsDialogOpen(false);
                     resetForm();
                   }}
                 >
                   Cancelar
                 </Button>
                 <Button
                   type="submit"
                   disabled={createAutomation.isPending || updateAutomation.isPending}
                 >
                   {(createAutomation.isPending || updateAutomation.isPending) && (
                     <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                   )}
                   <Save className="h-4 w-4 mr-2" />
                   {editingAutomation ? 'Salvar' : 'Criar'}
                 </Button>
               </div>
             </form>
           </DialogContent>
         </Dialog>
       </div>
 
       {automations?.length === 0 ? (
         <Card>
           <CardContent className="flex flex-col items-center justify-center py-12">
             <Zap className="h-12 w-12 text-muted-foreground mb-4" />
             <h4 className="font-medium">Nenhuma automação configurada</h4>
             <p className="text-sm text-muted-foreground mb-4 text-center">
               Crie workflows automáticos para disparar ações<br />
               após eventos de chamadas (webhooks, e-mails, etc.)
             </p>
           </CardContent>
         </Card>
       ) : (
         <div className="grid gap-4 md:grid-cols-2">
           {automations?.map((automation) => {
             const ActionIcon = getActionIcon(automation.action_type);
             return (
               <Card key={automation.id} className="relative">
                 <CardHeader className="pb-3">
                   <div className="flex items-start justify-between">
                     <div className="flex items-center gap-3">
                       <div className="p-2 rounded-lg bg-primary/10">
                         <ActionIcon className="h-5 w-5 text-primary" />
                       </div>
                       <div>
                         <CardTitle className="text-base">{automation.name}</CardTitle>
                         <CardDescription className="text-xs">
                           {automation.agent?.name || 'Todos os agentes'}
                         </CardDescription>
                       </div>
                     </div>
                     <Badge variant={automation.is_active ? 'default' : 'secondary'}>
                       {automation.is_active ? 'Ativa' : 'Inativa'}
                     </Badge>
                   </div>
                 </CardHeader>
                 <CardContent className="pt-0">
                   <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                     <Badge variant="outline" className="text-xs">
                       {getTriggerLabel(automation.trigger_event)}
                     </Badge>
                     <span>→</span>
                     <Badge variant="outline" className="text-xs">
                       {getActionLabel(automation.action_type)}
                     </Badge>
                   </div>
                   <div className="flex items-center justify-between">
                     <span className="text-xs text-muted-foreground">
                       {automation.executions_count} execuções
                     </span>
                     <div className="flex gap-1">
                       <Button
                         variant="ghost"
                         size="icon"
                         className="h-7 w-7"
                         onClick={() => startEditing(automation)}
                       >
                         <Settings2 className="h-3 w-3" />
                       </Button>
                       <Button
                         variant="ghost"
                         size="icon"
                         className="h-7 w-7 text-destructive"
                         onClick={() => deleteAutomation.mutate(automation.id)}
                       >
                         <Trash2 className="h-3 w-3" />
                       </Button>
                     </div>
                   </div>
                 </CardContent>
               </Card>
             );
           })}
         </div>
       )}
     </div>
   );
 }