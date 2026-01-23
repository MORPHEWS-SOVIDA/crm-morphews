import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Mail, Plus, Pencil, Trash2, Play, Pause, Clock, 
  MailOpen, MousePointer, AlertTriangle, CheckCircle,
  Zap, ShoppingCart, Gift, RefreshCw, UserPlus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  html_content: string;
  category: string;
  is_active: boolean;
}

interface EmailSequence {
  id: string;
  name: string;
  description: string | null;
  trigger_type: string;
  is_active: boolean;
  steps_count?: number;
  enrollments_count?: number;
}

const TRIGGER_TYPES = [
  { value: 'abandoned_cart', label: 'Carrinho Abandonado', icon: ShoppingCart, color: 'text-orange-500' },
  { value: 'post_purchase', label: 'Pós-Compra', icon: Gift, color: 'text-green-500' },
  { value: 'lead_created', label: 'Novo Lead', icon: UserPlus, color: 'text-blue-500' },
  { value: 'recompra', label: 'Recompra (30 dias)', icon: RefreshCw, color: 'text-purple-500' },
  { value: 'upsell', label: 'Upsell', icon: Zap, color: 'text-amber-500' },
];

const TEMPLATE_CATEGORIES = [
  { value: 'abandoned_cart', label: 'Carrinho Abandonado' },
  { value: 'welcome', label: 'Boas-vindas' },
  { value: 'post_purchase', label: 'Pós-Compra' },
  { value: 'recompra', label: 'Recompra' },
  { value: 'upsell', label: 'Upsell' },
  { value: 'crosssell', label: 'Cross-sell' },
  { value: 'general', label: 'Geral' },
];

const AVAILABLE_VARIABLES = [
  '{{nome}}', '{{nome_completo}}', '{{email}}', '{{produtos}}', 
  '{{valor}}', '{{link_carrinho}}', '{{link_loja}}'
];

export function EmailMarketingManager() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('sequences');

  // Templates Query
  const { data: templates, isLoading: loadingTemplates } = useQuery({
    queryKey: ['email-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as EmailTemplate[];
    },
  });

  // Sequences Query
  const { data: sequences, isLoading: loadingSequences } = useQuery({
    queryKey: ['email-sequences'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_sequences')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as EmailSequence[];
    },
  });

  // Stats Query
  const { data: stats } = useQuery({
    queryKey: ['email-stats'],
    queryFn: async () => {
      const { count: sent } = await supabase
        .from('email_sends')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'sent');
      
      const { count: opened } = await supabase
        .from('email_sends')
        .select('*', { count: 'exact', head: true })
        .not('opened_at', 'is', null);

      const { count: clicked } = await supabase
        .from('email_sends')
        .select('*', { count: 'exact', head: true })
        .not('clicked_at', 'is', null);

      const { count: active } = await supabase
        .from('email_sequence_enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      return {
        sent: sent || 0,
        opened: opened || 0,
        clicked: clicked || 0,
        activeEnrollments: active || 0,
        openRate: sent ? ((opened || 0) / sent * 100).toFixed(1) : '0',
        clickRate: opened ? ((clicked || 0) / (opened || 1) * 100).toFixed(1) : '0',
      };
    },
  });

  // Template Dialog State
  const [templateDialog, setTemplateDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState({
    name: '',
    subject: '',
    html_content: '',
    category: 'general',
  });

  // Sequence Dialog State
  const [sequenceDialog, setSequenceDialog] = useState(false);
  const [editingSequence, setEditingSequence] = useState<EmailSequence | null>(null);
  const [sequenceForm, setSequenceForm] = useState({
    name: '',
    description: '',
    trigger_type: 'abandoned_cart',
  });

  const [deleteId, setDeleteId] = useState<{ type: 'template' | 'sequence'; id: string } | null>(null);

  // Mutations
  const saveTemplate = useMutation({
    mutationFn: async (data: typeof templateForm) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.organization_id) throw new Error('Organização não encontrada');

      if (editingTemplate) {
        const { error } = await supabase
          .from('email_templates')
          .update(data)
          .eq('id', editingTemplate.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('email_templates')
          .insert({ ...data, organization_id: profile.organization_id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      setTemplateDialog(false);
      setEditingTemplate(null);
      toast.success(editingTemplate ? 'Template atualizado!' : 'Template criado!');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveSequence = useMutation({
    mutationFn: async (data: typeof sequenceForm) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.organization_id) throw new Error('Organização não encontrada');

      if (editingSequence) {
        const { error } = await supabase
          .from('email_sequences')
          .update(data)
          .eq('id', editingSequence.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('email_sequences')
          .insert({ ...data, organization_id: profile.organization_id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-sequences'] });
      setSequenceDialog(false);
      setEditingSequence(null);
      toast.success(editingSequence ? 'Sequência atualizada!' : 'Sequência criada!');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleSequence = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('email_sequences')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-sequences'] });
      toast.success('Status atualizado');
    },
  });

  const deleteItem = useMutation({
    mutationFn: async ({ type, id }: { type: 'template' | 'sequence'; id: string }) => {
      const table = type === 'template' ? 'email_templates' : 'email_sequences';
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      queryClient.invalidateQueries({ queryKey: ['email-sequences'] });
      setDeleteId(null);
      toast.success('Removido com sucesso');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleEditTemplate = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setTemplateForm({
      name: template.name,
      subject: template.subject,
      html_content: template.html_content,
      category: template.category,
    });
    setTemplateDialog(true);
  };

  const handleEditSequence = (sequence: EmailSequence) => {
    setEditingSequence(sequence);
    setSequenceForm({
      name: sequence.name,
      description: sequence.description || '',
      trigger_type: sequence.trigger_type,
    });
    setSequenceDialog(true);
  };

  const isLoading = loadingTemplates || loadingSequences;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Mail className="h-8 w-8 text-primary" />
          <div>
            <h2 className="text-2xl font-bold">Email Marketing</h2>
            <p className="text-muted-foreground">Sequências automatizadas via Resend</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Mail className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{stats?.sent || 0}</p>
                <p className="text-sm text-muted-foreground">Emails Enviados</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <MailOpen className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{stats?.openRate}%</p>
                <p className="text-sm text-muted-foreground">Taxa de Abertura</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <MousePointer className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">{stats?.clickRate}%</p>
                <p className="text-sm text-muted-foreground">Taxa de Clique</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-amber-500" />
              <div>
                <p className="text-2xl font-bold">{stats?.activeEnrollments || 0}</p>
                <p className="text-sm text-muted-foreground">Em Sequência</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="sequences">Sequências</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        {/* Sequences Tab */}
        <TabsContent value="sequences" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { setEditingSequence(null); setSequenceForm({ name: '', description: '', trigger_type: 'abandoned_cart' }); setSequenceDialog(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Sequência
            </Button>
          </div>

          {sequences?.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Zap className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhuma sequência</h3>
                <p className="text-muted-foreground mb-4">
                  Crie sequências automatizadas para recuperar carrinhos, upsell e recompra
                </p>
                <Button onClick={() => setSequenceDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Sequência
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {sequences?.map((seq) => {
                const trigger = TRIGGER_TYPES.find(t => t.value === seq.trigger_type);
                const TriggerIcon = trigger?.icon || Zap;
                
                return (
                  <Card key={seq.id}>
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg bg-muted ${trigger?.color}`}>
                          <TriggerIcon className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{seq.name}</h3>
                            {seq.is_active ? (
                              <Badge variant="default" className="bg-green-500">Ativa</Badge>
                            ) : (
                              <Badge variant="secondary">Pausada</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {trigger?.label || seq.trigger_type}
                            {seq.description && ` • ${seq.description}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleSequence.mutate({ id: seq.id, is_active: !seq.is_active })}
                        >
                          {seq.is_active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditSequence(seq)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId({ type: 'sequence', id: seq.id })}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { setEditingTemplate(null); setTemplateForm({ name: '', subject: '', html_content: '', category: 'general' }); setTemplateDialog(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Template
            </Button>
          </div>

          {templates?.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Mail className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhum template</h3>
                <p className="text-muted-foreground mb-4">
                  Crie templates de email para usar nas sequências
                </p>
                <Button onClick={() => setTemplateDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Template
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {templates?.map((template) => (
                <Card key={template.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{template.name}</CardTitle>
                      <Badge variant="outline">{template.category}</Badge>
                    </div>
                    <CardDescription className="truncate">
                      {template.subject}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => handleEditTemplate(template)}>
                      <Pencil className="h-4 w-4 mr-1" />
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteId({ type: 'template', id: template.id })}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Template Dialog */}
      <Dialog open={templateDialog} onOpenChange={setTemplateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Editar Template' : 'Novo Template'}</DialogTitle>
            <DialogDescription>Configure o template de email</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Nome do Template</Label>
                <Input
                  value={templateForm.name}
                  onChange={(e) => setTemplateForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Ex: Carrinho Abandonado - Email 1"
                />
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select
                  value={templateForm.category}
                  onValueChange={(v) => setTemplateForm(p => ({ ...p, category: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Assunto do Email</Label>
              <Input
                value={templateForm.subject}
                onChange={(e) => setTemplateForm(p => ({ ...p, subject: e.target.value }))}
                placeholder="Ex: {{nome}}, você esqueceu algo no carrinho!"
              />
            </div>

            <div className="space-y-2">
              <Label>Conteúdo HTML</Label>
              <Textarea
                value={templateForm.html_content}
                onChange={(e) => setTemplateForm(p => ({ ...p, html_content: e.target.value }))}
                placeholder="<h1>Olá {{nome}}!</h1>..."
                rows={10}
                className="font-mono text-sm"
              />
            </div>

            <div className="p-3 rounded-lg bg-muted">
              <p className="text-sm font-medium mb-2">Variáveis disponíveis:</p>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_VARIABLES.map((v) => (
                  <Badge key={v} variant="outline" className="font-mono text-xs">
                    {v}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => saveTemplate.mutate(templateForm)}
              disabled={!templateForm.name || !templateForm.subject || !templateForm.html_content || saveTemplate.isPending}
            >
              {editingTemplate ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sequence Dialog */}
      <Dialog open={sequenceDialog} onOpenChange={setSequenceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSequence ? 'Editar Sequência' : 'Nova Sequência'}</DialogTitle>
            <DialogDescription>Configure a automação de emails</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da Sequência</Label>
              <Input
                value={sequenceForm.name}
                onChange={(e) => setSequenceForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Ex: Recuperação de Carrinho"
              />
            </div>

            <div className="space-y-2">
              <Label>Gatilho</Label>
              <Select
                value={sequenceForm.trigger_type}
                onValueChange={(v) => setSequenceForm(p => ({ ...p, trigger_type: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRIGGER_TYPES.map((trigger) => (
                    <SelectItem key={trigger.value} value={trigger.value}>
                      <span className="flex items-center gap-2">
                        <trigger.icon className={`h-4 w-4 ${trigger.color}`} />
                        {trigger.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Input
                value={sequenceForm.description}
                onChange={(e) => setSequenceForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Breve descrição da sequência"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSequenceDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => saveSequence.mutate(sequenceForm)}
              disabled={!sequenceForm.name || saveSequence.isPending}
            >
              {editingSequence ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteItem.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
