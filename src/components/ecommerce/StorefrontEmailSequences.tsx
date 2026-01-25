import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Mail, Sparkles, Play, Pause, Pencil, Trash2, 
  Clock, ShoppingCart, Gift, RefreshCw, UserPlus,
  ChevronDown, ChevronRight, Loader2, CheckCircle, Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
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

interface EmailSequenceStep {
  id: string;
  step_order: number;
  delay_minutes: number;
  subject_override: string | null;
  is_active: boolean;
  template_id: string | null;
  template?: {
    id: string;
    name: string;
    subject: string;
    html_content: string;
  };
}

interface EmailSequence {
  id: string;
  name: string;
  description: string | null;
  trigger_type: string;
  is_active: boolean;
  ai_generated: boolean;
  steps?: EmailSequenceStep[];
}

interface PresetStep {
  id: string;
  preset_type: string;
  step_number: number;
  delay_minutes: number;
  default_subject: string;
  default_html_template: string;
  variables: string[];
}

const SEQUENCE_TYPES = [
  { 
    type: 'abandoned_cart', 
    label: 'Carrinho Abandonado', 
    icon: ShoppingCart, 
    color: 'text-orange-500 bg-orange-50',
    description: '4 e-mails: Na hora, 1h, 3h e 24h depois'
  },
  { 
    type: 'post_purchase', 
    label: 'Pós-Compra', 
    icon: Gift, 
    color: 'text-green-500 bg-green-50',
    description: '3 e-mails: Confirmação, Upsell (5min), Rastreio (24h)'
  },
  { 
    type: 'recompra', 
    label: 'Recompra', 
    icon: RefreshCw, 
    color: 'text-purple-500 bg-purple-50',
    description: '2 e-mails: 30 e 90 dias após última compra'
  },
  { 
    type: 'welcome_lead', 
    label: 'Boas-vindas Lead', 
    icon: UserPlus, 
    color: 'text-blue-500 bg-blue-50',
    description: '2 e-mails: Imediato e 24h depois'
  },
];

interface StorefrontEmailSequencesProps {
  storefrontId?: string;
  landingPageId?: string;
  storefrontName?: string;
  landingPageName?: string;
  productName?: string;
  niche?: string;
}

export function StorefrontEmailSequences({ 
  storefrontId, 
  landingPageId,
  storefrontName,
  landingPageName,
  productName,
  niche 
}: StorefrontEmailSequencesProps) {
  const queryClient = useQueryClient();
  const [expandedSequence, setExpandedSequence] = useState<string | null>(null);
  const [generatingType, setGeneratingType] = useState<string | null>(null);
  const [editingStep, setEditingStep] = useState<EmailSequenceStep | null>(null);
  const [editForm, setEditForm] = useState({ subject: '', html_content: '' });
  const [deleteSequenceId, setDeleteSequenceId] = useState<string | null>(null);

  const entityId = storefrontId || landingPageId;
  const entityType = storefrontId ? 'storefront' : 'landing_page';
  const entityName = storefrontName || landingPageName || 'Loja';

  // Query existing sequences for this storefront/landing
  const { data: sequences, isLoading } = useQuery({
    queryKey: ['email-sequences', entityType, entityId],
    queryFn: async () => {
      if (!entityId) return [];
      
      const query = supabase
        .from('email_sequences')
        .select(`
          id,
          name,
          description,
          trigger_type,
          is_active,
          ai_generated,
          email_sequence_steps (
            id,
            step_order,
            delay_minutes,
            subject_override,
            is_active,
            template_id,
            template:email_templates (
              id,
              name,
              subject,
              html_content
            )
          )
        `)
        .order('created_at', { ascending: true });

      if (storefrontId) {
        query.eq('storefront_id', storefrontId);
      } else if (landingPageId) {
        query.eq('landing_page_id', landingPageId);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      return (data || []).map(seq => ({
        ...seq,
        steps: (seq.email_sequence_steps || [])
          .sort((a: EmailSequenceStep, b: EmailSequenceStep) => a.step_order - b.step_order)
      })) as EmailSequence[];
    },
    enabled: !!entityId,
  });

  // Query presets
  const { data: presets } = useQuery({
    queryKey: ['email-presets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_sequence_presets')
        .select('*')
        .eq('is_active', true)
        .order('step_number');
      if (error) throw error;
      return data as PresetStep[];
    },
  });

  // Generate sequence with AI
  const generateSequence = useMutation({
    mutationFn: async (sequenceType: string) => {
      setGeneratingType(sequenceType);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.organization_id) throw new Error('Organização não encontrada');

      // Get presets for this type
      const typePresets = presets?.filter(p => p.preset_type === sequenceType) || [];
      if (typePresets.length === 0) throw new Error('Presets não encontrados');

      // Call AI to personalize (if product/niche provided)
      let personalizedSteps = typePresets;
      
      if (productName || niche) {
        try {
          const { data: aiData, error: aiError } = await supabase.functions.invoke('generate-email-sequence', {
            body: {
              sequenceType,
              productName: productName || entityName,
              niche: niche || 'e-commerce',
              storeName: entityName,
              presets: typePresets,
            }
          });
          
          if (!aiError && aiData?.steps) {
            personalizedSteps = aiData.steps;
          }
        } catch (e) {
          console.warn('AI generation failed, using default presets', e);
        }
      }

      // Get sequence type config
      const typeConfig = SEQUENCE_TYPES.find(t => t.type === sequenceType);

      // Create sequence
      const { data: sequence, error: seqError } = await supabase
        .from('email_sequences')
        .insert({
          organization_id: profile.organization_id,
          name: `${typeConfig?.label || sequenceType} - ${entityName}`,
          description: typeConfig?.description || null,
          trigger_type: sequenceType,
          is_active: true,
          ai_generated: !!(productName || niche),
          storefront_id: storefrontId || null,
          landing_page_id: landingPageId || null,
        })
        .select('id')
        .single();

      if (seqError) throw seqError;

      // Create templates and steps
      for (const preset of personalizedSteps) {
        // Create template
        const { data: template, error: tplError } = await supabase
          .from('email_templates')
          .insert({
            organization_id: profile.organization_id,
            name: `${typeConfig?.label} - Passo ${preset.step_number}`,
            subject: preset.default_subject,
            html_content: preset.default_html_template,
            category: sequenceType,
            variables: preset.variables,
          })
          .select('id')
          .single();

        if (tplError) throw tplError;

        // Create step
        const { error: stepError } = await supabase
          .from('email_sequence_steps')
          .insert({
            sequence_id: sequence.id,
            organization_id: profile.organization_id,
            template_id: template.id,
            step_order: preset.step_number,
            delay_minutes: preset.delay_minutes,
            is_active: true,
          });

        if (stepError) throw stepError;
      }

      return sequence;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-sequences', entityType, entityId] });
      toast.success('Sequência de e-mails criada e ativada!');
      setGeneratingType(null);
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setGeneratingType(null);
    },
  });

  // Toggle sequence active state
  const toggleSequence = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('email_sequences')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-sequences', entityType, entityId] });
      toast.success('Status atualizado');
    },
  });

  // Save step edit
  const saveStep = useMutation({
    mutationFn: async () => {
      if (!editingStep?.template_id) throw new Error('Template não encontrado');
      
      const { error } = await supabase
        .from('email_templates')
        .update({
          subject: editForm.subject,
          html_content: editForm.html_content,
        })
        .eq('id', editingStep.template_id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-sequences', entityType, entityId] });
      setEditingStep(null);
      toast.success('E-mail atualizado!');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Delete sequence
  const deleteSequence = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('email_sequences')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-sequences', entityType, entityId] });
      setDeleteSequenceId(null);
      toast.success('Sequência removida');
    },
  });

  const formatDelay = (minutes: number): string => {
    if (minutes === 0) return 'Imediato';
    if (minutes < 60) return `${minutes} min`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
    return `${Math.floor(minutes / 1440)} dias`;
  };

  const handleEditStep = (step: EmailSequenceStep) => {
    setEditingStep(step);
    setEditForm({
      subject: step.subject_override || step.template?.subject || '',
      html_content: step.template?.html_content || '',
    });
  };

  // Check which sequences already exist
  const existingTypes = new Set(sequences?.map(s => s.trigger_type) || []);

  if (!entityId) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <Mail className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Salve primeiro para configurar e-mails</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return <Skeleton className="h-48 w-full" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Sequências de E-mail</h3>
        </div>
        <Badge variant="outline" className="gap-1">
          <Zap className="h-3 w-3" />
          10 energia/envio
        </Badge>
      </div>

      {/* Available sequence types to create */}
      <div className="grid gap-3 sm:grid-cols-2">
        {SEQUENCE_TYPES.map((type) => {
          const exists = existingTypes.has(type.type);
          const Icon = type.icon;
          const isGenerating = generatingType === type.type;
          
          return (
            <Card 
              key={type.type}
              className={exists ? 'opacity-60' : 'hover:shadow-md transition-shadow cursor-pointer'}
            >
              <CardContent className="flex items-center gap-3 p-4">
                <div className={`p-2 rounded-lg ${type.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{type.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{type.description}</p>
                </div>
                {exists ? (
                  <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isGenerating}
                    onClick={() => generateSequence.mutate(type.type)}
                    className="shrink-0"
                  >
                    {isGenerating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-1" />
                        Criar
                      </>
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Existing sequences */}
      {sequences && sequences.length > 0 && (
        <>
          <Separator className="my-4" />
          <h4 className="font-medium text-sm text-muted-foreground mb-2">Sequências Ativas</h4>
          
          <div className="space-y-3">
            {sequences.map((seq) => {
              const typeConfig = SEQUENCE_TYPES.find(t => t.type === seq.trigger_type);
              const Icon = typeConfig?.icon || Mail;
              const isExpanded = expandedSequence === seq.id;
              
              return (
                <Collapsible 
                  key={seq.id}
                  open={isExpanded}
                  onOpenChange={() => setExpandedSequence(isExpanded ? null : seq.id)}
                >
                  <Card>
                    <CardContent className="p-0">
                      <CollapsibleTrigger className="w-full">
                        <div className="flex items-center gap-3 p-4">
                          <div className={`p-2 rounded-lg ${typeConfig?.color || 'bg-muted'}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 text-left">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{typeConfig?.label}</span>
                              {seq.ai_generated && (
                                <Badge variant="secondary" className="text-xs">
                                  <Sparkles className="h-3 w-3 mr-1" />
                                  IA
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {seq.steps?.length || 0} e-mails configurados
                            </p>
                          </div>
                          <Switch
                            checked={seq.is_active}
                            onCheckedChange={(checked) => {
                              toggleSequence.mutate({ id: seq.id, is_active: checked });
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </CollapsibleTrigger>
                      
                      <CollapsibleContent>
                        <div className="border-t px-4 pb-4 pt-2 space-y-2">
                          {seq.steps?.map((step, idx) => (
                            <div 
                              key={step.id}
                              className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                            >
                              <Badge variant="outline" className="shrink-0">
                                {idx + 1}
                              </Badge>
                              <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className="text-xs text-muted-foreground shrink-0">
                                {formatDelay(step.delay_minutes)}
                              </span>
                              <span className="text-sm truncate flex-1">
                                {step.subject_override || step.template?.subject || 'Sem assunto'}
                              </span>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 shrink-0"
                                onClick={() => handleEditStep(step)}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                          
                          <div className="flex justify-end pt-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setDeleteSequenceId(seq.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Remover Sequência
                            </Button>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </CardContent>
                  </Card>
                </Collapsible>
              );
            })}
          </div>
        </>
      )}

      {/* Edit Step Dialog */}
      <Dialog open={!!editingStep} onOpenChange={() => setEditingStep(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar E-mail</DialogTitle>
            <DialogDescription>
              Personalize o assunto e conteúdo deste e-mail
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Assunto</Label>
              <Input
                value={editForm.subject}
                onChange={(e) => setEditForm(f => ({ ...f, subject: e.target.value }))}
                placeholder="Assunto do e-mail"
              />
            </div>
            
            <div>
              <Label>Conteúdo HTML</Label>
              <Textarea
                value={editForm.html_content}
                onChange={(e) => setEditForm(f => ({ ...f, html_content: e.target.value }))}
                placeholder="<div>...</div>"
                className="font-mono text-xs min-h-[200px]"
              />
            </div>

            <div className="text-xs text-muted-foreground">
              <p className="font-medium mb-1">Variáveis disponíveis:</p>
              <div className="flex flex-wrap gap-1">
                {['{{nome}}', '{{produtos}}', '{{valor}}', '{{link_carrinho}}', '{{link_loja}}', '{{loja_nome}}', '{{pedido_id}}'].map(v => (
                  <Badge key={v} variant="outline" className="text-xs">{v}</Badge>
                ))}
              </div>
            </div>

            {/* Preview */}
            <div>
              <Label>Preview</Label>
              <div 
                className="border rounded-lg p-4 bg-white max-h-[300px] overflow-auto"
                dangerouslySetInnerHTML={{ __html: editForm.html_content }}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingStep(null)}>
              Cancelar
            </Button>
            <Button onClick={() => saveStep.mutate()} disabled={saveStep.isPending}>
              {saveStep.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteSequenceId} onOpenChange={() => setDeleteSequenceId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover sequência?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todos os e-mails e configurações serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteSequenceId && deleteSequence.mutate(deleteSequenceId)}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
