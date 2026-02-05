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
   Plus, Save, Loader2, PhoneForwarded, Calendar, Hash, 
   Globe, MessageSquare, Database, Webhook, Trash2, Settings2
 } from 'lucide-react';
 import { supabase } from '@/integrations/supabase/client';
 import { useTenant } from '@/hooks/useTenant';
 import { toast } from '@/hooks/use-toast';
 
 interface AgentTool {
   id: string;
   agent_id: string;
   tool_type: string;
   name: string;
   description: string | null;
   is_active: boolean;
   config: Record<string, any>;
   trigger_keywords: string[];
   created_at: string;
 }
 
 interface AgentToolsConfigProps {
   agentId: string;
   agentName: string;
 }
 
 const TOOL_TYPES = [
   { value: 'transfer_human', label: 'Transferir para Humano', icon: PhoneForwarded, color: 'bg-blue-500' },
   { value: 'book_appointment', label: 'Agendar Reunião', icon: Calendar, color: 'bg-green-500' },
   { value: 'dtmf', label: 'DTMF (Teclas)', icon: Hash, color: 'bg-purple-500' },
   { value: 'api_call', label: 'Chamada API', icon: Globe, color: 'bg-orange-500' },
   { value: 'send_sms', label: 'Enviar SMS', icon: MessageSquare, color: 'bg-pink-500' },
   { value: 'update_crm', label: 'Atualizar CRM', icon: Database, color: 'bg-cyan-500' },
   { value: 'webhook', label: 'Webhook', icon: Webhook, color: 'bg-yellow-500' },
 ];
 
 export function AgentToolsConfig({ agentId, agentName }: AgentToolsConfigProps) {
   const { tenantId } = useTenant();
   const queryClient = useQueryClient();
   const [isDialogOpen, setIsDialogOpen] = useState(false);
   const [editingTool, setEditingTool] = useState<AgentTool | null>(null);
   
   const [formData, setFormData] = useState({
     tool_type: '',
     name: '',
     description: '',
     is_active: true,
     config: {} as Record<string, any>,
     trigger_keywords: '',
   });
 
   const { data: tools, isLoading } = useQuery({
     queryKey: ['voice-ai-agent-tools', agentId],
     queryFn: async () => {
       const { data, error } = await supabase
         .from('voice_ai_agent_tools')
         .select('*')
         .eq('agent_id', agentId)
         .order('created_at', { ascending: false });
       
       if (error) throw error;
       return data as AgentTool[];
     },
     enabled: !!agentId,
   });
 
   const createTool = useMutation({
     mutationFn: async (data: typeof formData) => {
       const { error } = await supabase
         .from('voice_ai_agent_tools')
         .insert({
           organization_id: tenantId,
           agent_id: agentId,
           tool_type: data.tool_type,
           name: data.name,
           description: data.description || null,
           is_active: data.is_active,
           config: data.config,
           trigger_keywords: data.trigger_keywords.split(',').map(k => k.trim()).filter(Boolean),
         });
       
       if (error) throw error;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['voice-ai-agent-tools', agentId] });
       setIsDialogOpen(false);
       resetForm();
       toast({ title: 'Tool criada!', description: 'Ação configurada com sucesso.' });
     },
     onError: (error: Error) => {
       toast({ title: 'Erro', description: error.message, variant: 'destructive' });
     },
   });
 
   const updateTool = useMutation({
     mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
       const { error } = await supabase
         .from('voice_ai_agent_tools')
         .update({
           tool_type: data.tool_type,
           name: data.name,
           description: data.description || null,
           is_active: data.is_active,
           config: data.config,
           trigger_keywords: data.trigger_keywords.split(',').map(k => k.trim()).filter(Boolean),
         })
         .eq('id', id);
       
       if (error) throw error;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['voice-ai-agent-tools', agentId] });
       setIsDialogOpen(false);
       setEditingTool(null);
       resetForm();
       toast({ title: 'Tool atualizada!' });
     },
     onError: (error: Error) => {
       toast({ title: 'Erro', description: error.message, variant: 'destructive' });
     },
   });
 
   const deleteTool = useMutation({
     mutationFn: async (id: string) => {
       const { error } = await supabase
         .from('voice_ai_agent_tools')
         .delete()
         .eq('id', id);
       
       if (error) throw error;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['voice-ai-agent-tools', agentId] });
       toast({ title: 'Tool removida!' });
     },
     onError: (error: Error) => {
       toast({ title: 'Erro', description: error.message, variant: 'destructive' });
     },
   });
 
   const resetForm = () => {
     setFormData({
       tool_type: '',
       name: '',
       description: '',
       is_active: true,
       config: {},
       trigger_keywords: '',
     });
     setEditingTool(null);
   };
 
   const startEditing = (tool: AgentTool) => {
     setEditingTool(tool);
     setFormData({
       tool_type: tool.tool_type,
       name: tool.name,
       description: tool.description || '',
       is_active: tool.is_active,
       config: tool.config,
       trigger_keywords: tool.trigger_keywords.join(', '),
     });
     setIsDialogOpen(true);
   };
 
   const handleSubmit = (e: React.FormEvent) => {
     e.preventDefault();
     if (editingTool) {
       updateTool.mutate({ id: editingTool.id, data: formData });
     } else {
       createTool.mutate(formData);
     }
   };
 
   const getToolIcon = (type: string) => {
     const toolType = TOOL_TYPES.find(t => t.value === type);
     return toolType ? toolType.icon : Settings2;
   };
 
   const getToolLabel = (type: string) => {
     const toolType = TOOL_TYPES.find(t => t.value === type);
     return toolType ? toolType.label : type;
   };
 
   const renderToolConfig = () => {
     switch (formData.tool_type) {
       case 'transfer_human':
         return (
           <div className="space-y-3">
             <div className="space-y-2">
               <Label>Número para Transferência</Label>
               <Input
                 value={formData.config.transfer_number || ''}
                 onChange={(e) => setFormData({ 
                   ...formData, 
                   config: { ...formData.config, transfer_number: e.target.value } 
                 })}
                 placeholder="+5511999999999"
               />
             </div>
             <div className="space-y-2">
               <Label>Mensagem antes de transferir</Label>
               <Input
                 value={formData.config.transfer_message || ''}
                 onChange={(e) => setFormData({ 
                   ...formData, 
                   config: { ...formData.config, transfer_message: e.target.value } 
                 })}
                 placeholder="Vou transferir você para um atendente humano..."
               />
             </div>
           </div>
         );
       
       case 'book_appointment':
         return (
           <div className="space-y-3">
             <div className="space-y-2">
               <Label>Provedor de Calendário</Label>
               <Select
                 value={formData.config.calendar_provider || ''}
                 onValueChange={(value) => setFormData({ 
                   ...formData, 
                   config: { ...formData.config, calendar_provider: value } 
                 })}
               >
                 <SelectTrigger>
                   <SelectValue placeholder="Selecione..." />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="cal_com">Cal.com</SelectItem>
                   <SelectItem value="calendly">Calendly</SelectItem>
                   <SelectItem value="google_calendar">Google Calendar</SelectItem>
                 </SelectContent>
               </Select>
             </div>
             <div className="space-y-2">
               <Label>API Key / Token</Label>
               <Input
                 type="password"
                 value={formData.config.calendar_api_key || ''}
                 onChange={(e) => setFormData({ 
                   ...formData, 
                   config: { ...formData.config, calendar_api_key: e.target.value } 
                 })}
                 placeholder="Sua API key do calendário"
               />
             </div>
             <div className="space-y-2">
               <Label>ID do Evento/Link</Label>
               <Input
                 value={formData.config.event_type_id || ''}
                 onChange={(e) => setFormData({ 
                   ...formData, 
                   config: { ...formData.config, event_type_id: e.target.value } 
                 })}
                 placeholder="ID do tipo de evento ou link"
               />
             </div>
           </div>
         );
       
       case 'dtmf':
         return (
           <div className="space-y-3">
             <div className="space-y-2">
               <Label>Sequência DTMF</Label>
               <Input
                 value={formData.config.dtmf_sequence || ''}
                 onChange={(e) => setFormData({ 
                   ...formData, 
                   config: { ...formData.config, dtmf_sequence: e.target.value } 
                 })}
                 placeholder="1,2,*,#"
               />
               <p className="text-xs text-muted-foreground">
                 Teclas separadas por vírgula (0-9, *, #)
               </p>
             </div>
           </div>
         );
       
       case 'api_call':
       case 'webhook':
         return (
           <div className="space-y-3">
             <div className="space-y-2">
               <Label>URL do Endpoint</Label>
               <Input
                 value={formData.config.url || ''}
                 onChange={(e) => setFormData({ 
                   ...formData, 
                   config: { ...formData.config, url: e.target.value } 
                 })}
                 placeholder="https://api.exemplo.com/endpoint"
               />
             </div>
             <div className="space-y-2">
               <Label>Método HTTP</Label>
               <Select
                 value={formData.config.method || 'POST'}
                 onValueChange={(value) => setFormData({ 
                   ...formData, 
                   config: { ...formData.config, method: value } 
                 })}
               >
                 <SelectTrigger>
                   <SelectValue />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="GET">GET</SelectItem>
                   <SelectItem value="POST">POST</SelectItem>
                   <SelectItem value="PUT">PUT</SelectItem>
                   <SelectItem value="PATCH">PATCH</SelectItem>
                 </SelectContent>
               </Select>
             </div>
             <div className="space-y-2">
               <Label>Headers (JSON)</Label>
               <Textarea
                 value={formData.config.headers || ''}
                 onChange={(e) => setFormData({ 
                   ...formData, 
                   config: { ...formData.config, headers: e.target.value } 
                 })}
                 placeholder='{"Authorization": "Bearer token"}'
                 rows={2}
               />
             </div>
           </div>
         );
       
       case 'send_sms':
         return (
           <div className="space-y-3">
             <div className="space-y-2">
               <Label>Template da Mensagem</Label>
               <Textarea
                 value={formData.config.sms_template || ''}
                 onChange={(e) => setFormData({ 
                   ...formData, 
                   config: { ...formData.config, sms_template: e.target.value } 
                 })}
                 placeholder="Olá {{nome}}, sua reunião foi agendada para {{data}}."
                 rows={3}
               />
               <p className="text-xs text-muted-foreground">
                 Use {"{{variavel}}"} para dados dinâmicos
               </p>
             </div>
           </div>
         );
       
       case 'update_crm':
         return (
           <div className="space-y-3">
             <div className="space-y-2">
               <Label>Campos para Atualizar</Label>
               <Textarea
                 value={formData.config.crm_fields || ''}
                 onChange={(e) => setFormData({ 
                   ...formData, 
                   config: { ...formData.config, crm_fields: e.target.value } 
                 })}
                 placeholder='{"status": "contacted", "notes": "Ligação realizada"}'
                 rows={3}
               />
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
           <h4 className="font-medium">Tools do Agente: {agentName}</h4>
           <p className="text-sm text-muted-foreground">
             Configure ações que o agente pode executar durante a chamada
           </p>
         </div>
         <Dialog open={isDialogOpen} onOpenChange={(open) => {
           setIsDialogOpen(open);
           if (!open) resetForm();
         }}>
           <DialogTrigger asChild>
             <Button size="sm">
               <Plus className="h-4 w-4 mr-2" />
               Nova Tool
             </Button>
           </DialogTrigger>
           <DialogContent className="max-w-lg">
             <DialogHeader>
               <DialogTitle>
                 {editingTool ? 'Editar Tool' : 'Nova Tool'}
               </DialogTitle>
             </DialogHeader>
             <form onSubmit={handleSubmit} className="space-y-4">
               <div className="space-y-2">
                 <Label>Tipo de Ação *</Label>
                 <Select
                   value={formData.tool_type}
                   onValueChange={(value) => setFormData({ ...formData, tool_type: value, config: {} })}
                   required
                 >
                   <SelectTrigger>
                     <SelectValue placeholder="Selecione o tipo..." />
                   </SelectTrigger>
                   <SelectContent>
                     {TOOL_TYPES.map((type) => (
                       <SelectItem key={type.value} value={type.value}>
                         <div className="flex items-center gap-2">
                           <type.icon className="h-4 w-4" />
                           {type.label}
                         </div>
                       </SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
               </div>
 
               <div className="space-y-2">
                 <Label>Nome *</Label>
                 <Input
                   value={formData.name}
                   onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                   placeholder="Ex: Transferir para Suporte"
                   required
                 />
               </div>
 
               <div className="space-y-2">
                 <Label>Descrição (para a IA)</Label>
                 <Textarea
                   value={formData.description}
                   onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                   placeholder="Quando o cliente pedir para falar com um humano..."
                   rows={2}
                 />
               </div>
 
               <div className="space-y-2">
                 <Label>Palavras-chave de Gatilho</Label>
                 <Input
                   value={formData.trigger_keywords}
                   onChange={(e) => setFormData({ ...formData, trigger_keywords: e.target.value })}
                   placeholder="humano, atendente, transferir"
                 />
                 <p className="text-xs text-muted-foreground">
                   Separadas por vírgula
                 </p>
               </div>
 
               {formData.tool_type && (
                 <div className="border-t pt-4">
                   <Label className="text-sm font-medium mb-3 block">
                     Configurações de {getToolLabel(formData.tool_type)}
                   </Label>
                   {renderToolConfig()}
                 </div>
               )}
 
               <div className="flex items-center gap-2">
                 <Switch
                   checked={formData.is_active}
                   onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                 />
                 <Label>Ativo</Label>
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
                   disabled={createTool.isPending || updateTool.isPending}
                 >
                   {(createTool.isPending || updateTool.isPending) && (
                     <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                   )}
                   <Save className="h-4 w-4 mr-2" />
                   {editingTool ? 'Salvar' : 'Criar'}
                 </Button>
               </div>
             </form>
           </DialogContent>
         </Dialog>
       </div>
 
       {tools?.length === 0 ? (
         <Card>
           <CardContent className="flex flex-col items-center justify-center py-8">
             <Settings2 className="h-10 w-10 text-muted-foreground mb-3" />
             <p className="text-sm text-muted-foreground text-center">
               Nenhuma tool configurada.<br />
               Adicione ações como transferência, agendamento, etc.
             </p>
           </CardContent>
         </Card>
       ) : (
         <div className="grid gap-3 md:grid-cols-2">
           {tools?.map((tool) => {
             const Icon = getToolIcon(tool.tool_type);
             return (
               <Card key={tool.id} className="relative">
                 <CardContent className="pt-4">
                   <div className="flex items-start justify-between">
                     <div className="flex items-start gap-3">
                       <div className="p-2 rounded-lg bg-primary/10">
                         <Icon className="h-4 w-4 text-primary" />
                       </div>
                       <div>
                         <div className="font-medium text-sm">{tool.name}</div>
                         <div className="text-xs text-muted-foreground">
                           {getToolLabel(tool.tool_type)}
                         </div>
                         {tool.trigger_keywords.length > 0 && (
                           <div className="flex flex-wrap gap-1 mt-2">
                             {tool.trigger_keywords.slice(0, 3).map((kw, i) => (
                               <Badge key={i} variant="outline" className="text-xs">
                                 {kw}
                               </Badge>
                             ))}
                           </div>
                         )}
                       </div>
                     </div>
                     <div className="flex items-center gap-1">
                       <Badge variant={tool.is_active ? 'default' : 'secondary'} className="text-xs">
                         {tool.is_active ? 'Ativo' : 'Inativo'}
                       </Badge>
                       <Button
                         variant="ghost"
                         size="icon"
                         className="h-7 w-7"
                         onClick={() => startEditing(tool)}
                       >
                         <Settings2 className="h-3 w-3" />
                       </Button>
                       <Button
                         variant="ghost"
                         size="icon"
                         className="h-7 w-7 text-destructive"
                         onClick={() => deleteTool.mutate(tool.id)}
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