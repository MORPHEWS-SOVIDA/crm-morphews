 import { useState, useRef } from 'react';
 import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
 import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Textarea } from '@/components/ui/textarea';
 import { Label } from '@/components/ui/label';
 import { Switch } from '@/components/ui/switch';
 import { Badge } from '@/components/ui/badge';
 import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
 import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
 import { 
   Plus, Save, Loader2, FileText, Link, MessageSquare, 
   Trash2, Upload, CheckCircle, XCircle, Clock, BookOpen
 } from 'lucide-react';
 import { supabase } from '@/integrations/supabase/client';
 import { useTenant } from '@/hooks/useTenant';
 import { toast } from '@/hooks/use-toast';
 
 interface KnowledgeItem {
   id: string;
   agent_id: string;
   title: string;
   content_type: 'text' | 'pdf' | 'url' | 'qa_pair';
   content: string | null;
   file_url: string | null;
   file_name: string | null;
   file_size_bytes: number | null;
   qa_question: string | null;
   qa_answer: string | null;
   is_active: boolean;
   processing_status: 'pending' | 'processing' | 'completed' | 'failed';
   created_at: string;
 }
 
 interface KnowledgeBaseConfigProps {
   agentId: string;
   agentName: string;
 }
 
 export function KnowledgeBaseConfig({ agentId, agentName }: KnowledgeBaseConfigProps) {
   const { tenantId } = useTenant();
   const queryClient = useQueryClient();
   const fileInputRef = useRef<HTMLInputElement>(null);
   const [isDialogOpen, setIsDialogOpen] = useState(false);
   const [activeTab, setActiveTab] = useState<'text' | 'qa_pair' | 'url'>('text');
   const [isUploading, setIsUploading] = useState(false);
   
   const [formData, setFormData] = useState({
     title: '',
     content: '',
     qa_question: '',
     qa_answer: '',
     url: '',
     is_active: true,
   });
 
   const { data: knowledgeItems, isLoading } = useQuery({
     queryKey: ['voice-ai-knowledge-base', agentId],
     queryFn: async () => {
       const { data, error } = await supabase
         .from('voice_ai_knowledge_base')
         .select('*')
         .eq('agent_id', agentId)
         .order('created_at', { ascending: false });
       
       if (error) throw error;
       return data as KnowledgeItem[];
     },
     enabled: !!agentId,
   });
 
   const createKnowledge = useMutation({
     mutationFn: async (data: { 
       content_type: string; 
       title: string; 
       content?: string; 
       qa_question?: string; 
       qa_answer?: string;
       file_url?: string;
       file_name?: string;
       file_size_bytes?: number;
     }) => {
       const { error } = await supabase
         .from('voice_ai_knowledge_base')
         .insert({
           organization_id: tenantId,
           agent_id: agentId,
           ...data,
           processing_status: 'completed',
         });
       
       if (error) throw error;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['voice-ai-knowledge-base', agentId] });
       setIsDialogOpen(false);
       resetForm();
       toast({ title: 'Conhecimento adicionado!', description: 'O agente foi treinado com sucesso.' });
     },
     onError: (error: Error) => {
       toast({ title: 'Erro', description: error.message, variant: 'destructive' });
     },
   });
 
   const deleteKnowledge = useMutation({
     mutationFn: async (id: string) => {
       const { error } = await supabase
         .from('voice_ai_knowledge_base')
         .delete()
         .eq('id', id);
       
       if (error) throw error;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['voice-ai-knowledge-base', agentId] });
       toast({ title: 'Conhecimento removido!' });
     },
     onError: (error: Error) => {
       toast({ title: 'Erro', description: error.message, variant: 'destructive' });
     },
   });
 
   const toggleActive = useMutation({
     mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
       const { error } = await supabase
         .from('voice_ai_knowledge_base')
         .update({ is_active })
         .eq('id', id);
       
       if (error) throw error;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['voice-ai-knowledge-base', agentId] });
     },
   });
 
   const resetForm = () => {
     setFormData({
       title: '',
       content: '',
       qa_question: '',
       qa_answer: '',
       url: '',
       is_active: true,
     });
     setActiveTab('text');
   };
 
   const handleSubmit = (e: React.FormEvent) => {
     e.preventDefault();
     
     if (activeTab === 'text') {
       createKnowledge.mutate({
         content_type: 'text',
         title: formData.title,
         content: formData.content,
       });
     } else if (activeTab === 'qa_pair') {
       createKnowledge.mutate({
         content_type: 'qa_pair',
         title: formData.qa_question.substring(0, 50),
         qa_question: formData.qa_question,
         qa_answer: formData.qa_answer,
       });
     } else if (activeTab === 'url') {
       createKnowledge.mutate({
         content_type: 'url',
         title: formData.title || formData.url,
         content: formData.url,
       });
     }
   };
 
   const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
     const file = e.target.files?.[0];
     if (!file) return;
 
     if (!file.type.includes('pdf')) {
       toast({ title: 'Erro', description: 'Apenas arquivos PDF são suportados.', variant: 'destructive' });
       return;
     }
 
     if (file.size > 10 * 1024 * 1024) {
       toast({ title: 'Erro', description: 'Arquivo muito grande (máx. 10MB).', variant: 'destructive' });
       return;
     }
 
     setIsUploading(true);
     try {
       const fileName = `${Date.now()}_${file.name}`;
       const filePath = `${tenantId}/knowledge/${agentId}/${fileName}`;
 
       const { error: uploadError } = await supabase.storage
         .from('voice-ai-knowledge')
         .upload(filePath, file);
 
       if (uploadError) throw uploadError;
 
       const { data: urlData } = supabase.storage
         .from('voice-ai-knowledge')
         .getPublicUrl(filePath);
 
       await createKnowledge.mutateAsync({
         content_type: 'pdf',
         title: file.name,
         file_url: urlData.publicUrl,
         file_name: file.name,
         file_size_bytes: file.size,
       });
     } catch (error: any) {
       toast({ title: 'Erro no upload', description: error.message, variant: 'destructive' });
     } finally {
       setIsUploading(false);
       if (fileInputRef.current) fileInputRef.current.value = '';
     }
   };
 
   const getStatusIcon = (status: string) => {
     switch (status) {
       case 'completed':
        return <CheckCircle className="h-4 w-4 text-primary" />;
       case 'failed':
         return <XCircle className="h-4 w-4 text-destructive" />;
       case 'processing':
        return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
       default:
         return <Clock className="h-4 w-4 text-muted-foreground" />;
     }
   };
 
   const getContentIcon = (type: string) => {
     switch (type) {
       case 'pdf':
         return <FileText className="h-4 w-4" />;
       case 'url':
         return <Link className="h-4 w-4" />;
       case 'qa_pair':
         return <MessageSquare className="h-4 w-4" />;
       default:
         return <FileText className="h-4 w-4" />;
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
           <h4 className="font-medium">Base de Conhecimento: {agentName}</h4>
           <p className="text-sm text-muted-foreground">
             Treine o agente com informações da sua empresa
           </p>
         </div>
         <div className="flex gap-2">
           <input
             ref={fileInputRef}
             type="file"
             accept=".pdf"
             onChange={handleFileUpload}
             className="hidden"
           />
           <Button
             variant="outline"
             size="sm"
             onClick={() => fileInputRef.current?.click()}
             disabled={isUploading}
           >
             {isUploading ? (
               <Loader2 className="h-4 w-4 mr-2 animate-spin" />
             ) : (
               <Upload className="h-4 w-4 mr-2" />
             )}
             Upload PDF
           </Button>
           <Dialog open={isDialogOpen} onOpenChange={(open) => {
             setIsDialogOpen(open);
             if (!open) resetForm();
           }}>
             <DialogTrigger asChild>
               <Button size="sm">
                 <Plus className="h-4 w-4 mr-2" />
                 Adicionar
               </Button>
             </DialogTrigger>
             <DialogContent className="max-w-lg">
               <DialogHeader>
                 <DialogTitle>Adicionar Conhecimento</DialogTitle>
               </DialogHeader>
               <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                 <TabsList className="grid w-full grid-cols-3">
                   <TabsTrigger value="text">Texto</TabsTrigger>
                   <TabsTrigger value="qa_pair">Pergunta/Resposta</TabsTrigger>
                   <TabsTrigger value="url">URL</TabsTrigger>
                 </TabsList>
                 
                 <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                   <TabsContent value="text" className="mt-0 space-y-4">
                     <div className="space-y-2">
                       <Label>Título *</Label>
                       <Input
                         value={formData.title}
                         onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                         placeholder="Ex: Política de Devolução"
                         required={activeTab === 'text'}
                       />
                     </div>
                     <div className="space-y-2">
                       <Label>Conteúdo *</Label>
                       <Textarea
                         value={formData.content}
                         onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                         placeholder="Cole aqui o texto que o agente deve conhecer..."
                         rows={6}
                         required={activeTab === 'text'}
                       />
                     </div>
                   </TabsContent>
                   
                   <TabsContent value="qa_pair" className="mt-0 space-y-4">
                     <div className="space-y-2">
                       <Label>Pergunta *</Label>
                       <Input
                         value={formData.qa_question}
                         onChange={(e) => setFormData({ ...formData, qa_question: e.target.value })}
                         placeholder="Qual é o horário de funcionamento?"
                         required={activeTab === 'qa_pair'}
                       />
                     </div>
                     <div className="space-y-2">
                       <Label>Resposta *</Label>
                       <Textarea
                         value={formData.qa_answer}
                         onChange={(e) => setFormData({ ...formData, qa_answer: e.target.value })}
                         placeholder="Nosso horário de funcionamento é de segunda a sexta, das 9h às 18h."
                         rows={4}
                         required={activeTab === 'qa_pair'}
                       />
                     </div>
                   </TabsContent>
                   
                   <TabsContent value="url" className="mt-0 space-y-4">
                     <div className="space-y-2">
                       <Label>URL *</Label>
                       <Input
                         type="url"
                         value={formData.url}
                         onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                         placeholder="https://sua-empresa.com/faq"
                         required={activeTab === 'url'}
                       />
                     </div>
                     <div className="space-y-2">
                       <Label>Título (opcional)</Label>
                       <Input
                         value={formData.title}
                         onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                         placeholder="Ex: FAQ do Site"
                       />
                     </div>
                   </TabsContent>
 
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
                       disabled={createKnowledge.isPending}
                     >
                       {createKnowledge.isPending && (
                         <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                       )}
                       <Save className="h-4 w-4 mr-2" />
                       Salvar
                     </Button>
                   </div>
                 </form>
               </Tabs>
             </DialogContent>
           </Dialog>
         </div>
       </div>
 
       {knowledgeItems?.length === 0 ? (
         <Card>
           <CardContent className="flex flex-col items-center justify-center py-8">
             <BookOpen className="h-10 w-10 text-muted-foreground mb-3" />
             <p className="text-sm text-muted-foreground text-center">
               Nenhum conhecimento adicionado.<br />
               Treine o agente com textos, PDFs ou perguntas frequentes.
             </p>
           </CardContent>
         </Card>
       ) : (
         <div className="space-y-2">
           {knowledgeItems?.map((item) => (
             <Card key={item.id}>
               <CardContent className="py-3">
                 <div className="flex items-center justify-between">
                   <div className="flex items-center gap-3">
                     <div className="p-2 rounded-lg bg-primary/10">
                       {getContentIcon(item.content_type)}
                     </div>
                     <div>
                       <div className="font-medium text-sm">{item.title}</div>
                       <div className="flex items-center gap-2 text-xs text-muted-foreground">
                         <Badge variant="outline" className="text-xs capitalize">
                           {item.content_type === 'qa_pair' ? 'Q&A' : item.content_type}
                         </Badge>
                         {item.file_size_bytes && (
                           <span>{(item.file_size_bytes / 1024).toFixed(0)} KB</span>
                         )}
                         {getStatusIcon(item.processing_status)}
                       </div>
                     </div>
                   </div>
                   <div className="flex items-center gap-2">
                     <Switch
                       checked={item.is_active}
                       onCheckedChange={(checked) => toggleActive.mutate({ id: item.id, is_active: checked })}
                     />
                     <Button
                       variant="ghost"
                       size="icon"
                       className="h-7 w-7 text-destructive"
                       onClick={() => deleteKnowledge.mutate(item.id)}
                     >
                       <Trash2 className="h-3 w-3" />
                     </Button>
                   </div>
                 </div>
                 {item.content_type === 'qa_pair' && item.qa_question && (
                   <div className="mt-2 pt-2 border-t text-sm">
                     <p className="font-medium text-muted-foreground">P: {item.qa_question}</p>
                     <p className="text-muted-foreground">R: {item.qa_answer?.substring(0, 100)}...</p>
                   </div>
                 )}
               </CardContent>
             </Card>
           ))}
         </div>
       )}
     </div>
   );
 }