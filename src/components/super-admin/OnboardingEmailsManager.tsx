import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { 
  Mail, 
  Plus, 
  Pencil, 
  Trash2,
  Clock,
  Calendar,
  Loader2,
  Play,
  Eye,
  Send
} from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface EmailTemplate {
  id: string;
  day_offset: number;
  hours_offset: number;
  subject: string;
  body_html: string;
  body_text: string | null;
  is_active: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

interface QueueStats {
  pending: number;
  sent: number;
  failed: number;
}

const VARIABLES_HELP = [
  { var: "{{nome}}", desc: "Nome completo" },
  { var: "{{primeiro_nome}}", desc: "Primeiro nome" },
  { var: "{{empresa}}", desc: "Nome da empresa" },
];

export function OnboardingEmailsManager() {
  const queryClient = useQueryClient();
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const [formData, setFormData] = useState({
    day_offset: 0,
    hours_offset: 0,
    subject: "",
    body_html: "",
  });

  // Fetch templates
  const { data: templates, isLoading } = useQuery({
    queryKey: ["onboarding-email-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("onboarding_email_templates")
        .select("*")
        .order("day_offset", { ascending: true })
        .order("hours_offset", { ascending: true });

      if (error) throw error;
      return data as EmailTemplate[];
    },
  });

  // Fetch queue stats
  const { data: queueStats } = useQuery({
    queryKey: ["onboarding-queue-stats"],
    queryFn: async () => {
      const [pending, sent, failed] = await Promise.all([
        supabase.from("onboarding_email_queue").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("onboarding_email_queue").select("id", { count: "exact", head: true }).eq("status", "sent"),
        supabase.from("onboarding_email_queue").select("id", { count: "exact", head: true }).eq("status", "failed"),
      ]);

      return {
        pending: pending.count || 0,
        sent: sent.count || 0,
        failed: failed.count || 0,
      } as QueueStats;
    },
  });

  // Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("onboarding_email_templates")
        .update({ is_active: isActive })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-email-templates"] });
      toast({ title: "Status atualizado!" });
    },
  });

  // Save template mutation
  const saveTemplateMutation = useMutation({
    mutationFn: async (data: Partial<EmailTemplate>) => {
      if (editingTemplate) {
        const { error } = await supabase
          .from("onboarding_email_templates")
          .update(data)
          .eq("id", editingTemplate.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("onboarding_email_templates")
          .insert({
            day_offset: data.day_offset,
            hours_offset: data.hours_offset,
            subject: data.subject,
            body_html: data.body_html,
            position: (templates?.length || 0) + 1,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-email-templates"] });
      toast({ title: editingTemplate ? "Email atualizado!" : "Email criado!" });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("onboarding_email_templates")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-email-templates"] });
      toast({ title: "Email excluído!" });
    },
  });

  const resetForm = () => {
    setFormData({
      day_offset: 0,
      hours_offset: 0,
      subject: "",
      body_html: "",
    });
    setEditingTemplate(null);
  };

  const openEditDialog = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setFormData({
      day_offset: template.day_offset,
      hours_offset: template.hours_offset,
      subject: template.subject,
      body_html: template.body_html,
    });
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (!formData.subject || !formData.body_html) {
      toast({
        title: "Preencha os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    saveTemplateMutation.mutate({
      day_offset: formData.day_offset,
      hours_offset: formData.hours_offset,
      subject: formData.subject,
      body_html: formData.body_html,
    });
  };

  const handleProcessNow = async () => {
    setIsProcessing(true);
    try {
      const { error } = await supabase.functions.invoke("process-onboarding-emails");

      if (error) throw error;
      
      toast({ title: "Emails processados! 📧" });
      queryClient.invalidateQueries({ queryKey: ["onboarding-queue-stats"] });
    } catch (error: any) {
      toast({
        title: "Erro ao processar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const formatTiming = (dayOffset: number, hoursOffset: number): string => {
    if (dayOffset === 0 && hoursOffset === 0) return "Imediato";
    
    let parts: string[] = [];
    if (dayOffset > 0) {
      parts.push(`Dia ${dayOffset}`);
    } else {
      parts.push("Dia 0");
    }
    if (hoursOffset > 0) {
      parts.push(`+${hoursOffset}h`);
    }
    return parts.join(" ");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Templates</p>
                <p className="text-2xl font-bold">{templates?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Clock className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Na Fila</p>
                <p className="text-2xl font-bold">{queueStats?.pending || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Send className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Enviados</p>
                <p className="text-2xl font-bold">{queueStats?.sent || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <Mail className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Falhas</p>
                <p className="text-2xl font-bold">{queueStats?.failed || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Cadência de Emails de Onboarding
              </CardTitle>
              <CardDescription>
                Configure emails automáticos enviados após o cadastro de novos usuários
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleProcessNow}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Processar Agora
              </Button>
              <Dialog open={isDialogOpen} onOpenChange={(open) => {
                setIsDialogOpen(open);
                if (!open) resetForm();
              }}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Email
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
                      {editingTemplate ? "Editar Email" : "Novo Email de Onboarding"}
                    </DialogTitle>
                  </DialogHeader>

                  <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Dias após cadastro</Label>
                        <Input
                          type="number"
                          min={0}
                          value={formData.day_offset}
                          onChange={(e) => setFormData({ ...formData, day_offset: parseInt(e.target.value) || 0 })}
                        />
                        <p className="text-xs text-muted-foreground">0 = mesmo dia do cadastro</p>
                      </div>

                      <div className="space-y-2">
                        <Label>Horas extras</Label>
                        <Input
                          type="number"
                          min={0}
                          max={23}
                          value={formData.hours_offset}
                          onChange={(e) => setFormData({ ...formData, hours_offset: parseInt(e.target.value) || 0 })}
                        />
                        <p className="text-xs text-muted-foreground">Horas adicionais após o dia</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Assunto do Email</Label>
                      <Input
                        value={formData.subject}
                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                        placeholder="Ex: 🎉 Bem-vindo ao Morphews CRM!"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Conteúdo HTML</Label>
                      <Textarea
                        value={formData.body_html}
                        onChange={(e) => setFormData({ ...formData, body_html: e.target.value })}
                        placeholder="Conteúdo do email em HTML..."
                        rows={12}
                        className="font-mono text-sm"
                      />
                      <div className="flex flex-wrap gap-2 mt-2">
                        {VARIABLES_HELP.map((v) => (
                          <Badge
                            key={v.var}
                            variant="outline"
                            className="cursor-pointer hover:bg-muted"
                            onClick={() =>
                              setFormData({
                                ...formData,
                                body_html: formData.body_html + v.var,
                              })
                            }
                          >
                            {v.var} - {v.desc}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                      <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button onClick={handleSave} disabled={saveTemplateMutation.isPending}>
                        {saveTemplateMutation.isPending && (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        )}
                        Salvar
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Timeline of emails */}
          <div className="space-y-3">
            {templates?.map((template, index) => (
              <div
                key={template.id}
                className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
              >
                {/* Timeline indicator */}
                <div className="flex flex-col items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                    template.is_active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}>
                    {template.day_offset === 0 ? (
                      template.hours_offset === 0 ? "⚡" : `${template.hours_offset}h`
                    ) : (
                      `D${template.day_offset}`
                    )}
                  </div>
                  {index < (templates?.length || 0) - 1 && (
                    <div className="w-0.5 h-8 bg-border mt-2" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={template.is_active ? "default" : "secondary"}>
                          {formatTiming(template.day_offset, template.hours_offset)}
                        </Badge>
                        {!template.is_active && (
                          <Badge variant="outline" className="text-muted-foreground">
                            Inativo
                          </Badge>
                        )}
                      </div>
                      <h4 className="font-medium truncate">{template.subject}</h4>
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {template.body_html.replace(/<[^>]*>/g, "").substring(0, 150)}...
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={template.is_active}
                        onCheckedChange={(checked) => 
                          toggleActiveMutation.mutate({ id: template.id, isActive: checked })
                        }
                      />
                      
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setPreviewTemplate(template);
                          setIsPreviewOpen(true);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(template)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir email?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação não pode ser desfeita. O template será removido permanentemente.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteTemplateMutation.mutate(template.id)}
                              className="bg-destructive text-destructive-foreground"
                            >
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {(!templates || templates.length === 0) && (
              <div className="text-center py-12 text-muted-foreground">
                <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum template de email configurado</p>
                <p className="text-sm">Clique em "Novo Email" para começar</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Preview do Email</DialogTitle>
          </DialogHeader>
          {previewTemplate && (
            <ScrollArea className="h-[60vh]">
              <div className="p-4 bg-muted rounded-lg">
                <div className="mb-4 pb-4 border-b">
                  <p className="text-sm text-muted-foreground">Assunto:</p>
                  <p className="font-medium">{previewTemplate.subject}</p>
                </div>
                <div 
                  className="prose prose-sm max-w-none bg-white p-6 rounded-lg"
                  dangerouslySetInnerHTML={{ __html: previewTemplate.body_html }}
                />
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
