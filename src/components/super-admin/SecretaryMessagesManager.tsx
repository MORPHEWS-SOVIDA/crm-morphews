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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { 
  MessageSquare, 
  Plus, 
  Pencil, 
  Trash2,
  Calendar,
  Clock,
  Users,
  Crown,
  Loader2,
  Send,
  Play
} from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface MessageTemplate {
  id: string;
  recipient_type: "owners" | "users";
  message_type: "scheduled" | "followup" | "birthday" | "welcome" | "reactivation";
  day_of_week: number | null;
  scheduled_time: string;
  days_without_contact: number | null;
  message_title: string;
  message_content: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const DAY_NAMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const RECIPIENT_LABELS = {
  owners: { label: "Donos & Gerentes", icon: Crown, color: "bg-amber-500" },
  users: { label: "Usuários", icon: Users, color: "bg-blue-500" },
};

const MESSAGE_TYPE_LABELS = {
  scheduled: "Agendada por Dia",
  followup: "Follow-up",
  birthday: "Aniversário",
  welcome: "Boas-vindas",
  reactivation: "Reativação",
};

const VARIABLES_HELP = [
  { var: "{{nome}}", desc: "Nome completo" },
  { var: "{{primeiro_nome}}", desc: "Primeiro nome" },
  { var: "{{empresa}}", desc: "Nome da empresa" },
  { var: "{{dia_semana}}", desc: "Dia da semana" },
];

export function SecretaryMessagesManager() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"owners" | "users">("owners");
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isRunningNow, setIsRunningNow] = useState(false);

  const [formData, setFormData] = useState({
    message_title: "",
    message_content: "",
    day_of_week: "",
    scheduled_time: "09:00",
    message_type: "scheduled" as MessageTemplate["message_type"],
    days_without_contact: "",
  });

  // Fetch templates
  const { data: templates, isLoading } = useQuery({
    queryKey: ["secretary-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("secretary_message_templates")
        .select("*")
        .order("day_of_week", { ascending: true });

      if (error) throw error;
      return data as MessageTemplate[];
    },
  });

  // Fetch sent messages stats
  const { data: sentStats } = useQuery({
    queryKey: ["secretary-sent-stats"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      const { data: todayCount } = await supabase
        .from("secretary_sent_messages")
        .select("id", { count: "exact" })
        .gte("sent_date", today);

      const { data: weekCount } = await supabase
        .from("secretary_sent_messages")
        .select("id", { count: "exact" })
        .gte("sent_date", weekAgo);

      return {
        today: todayCount?.length || 0,
        week: weekCount?.length || 0,
      };
    },
  });

  // Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("secretary_message_templates")
        .update({ is_active: isActive })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["secretary-templates"] });
      toast({ title: "Status atualizado!" });
    },
  });

  // Save template mutation
  const saveTemplateMutation = useMutation({
    mutationFn: async (data: Partial<MessageTemplate>) => {
      if (editingTemplate) {
        const { error } = await supabase
          .from("secretary_message_templates")
          .update(data)
          .eq("id", editingTemplate.id);
        if (error) throw error;
      } else {
        const insertData = {
          message_title: data.message_title!,
          message_content: data.message_content!,
          day_of_week: data.day_of_week,
          scheduled_time: data.scheduled_time,
          message_type: data.message_type,
          days_without_contact: data.days_without_contact,
          recipient_type: activeTab as "owners" | "users",
        };
        const { error } = await supabase
          .from("secretary_message_templates")
          .insert(insertData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["secretary-templates"] });
      toast({ title: editingTemplate ? "Mensagem atualizada!" : "Mensagem criada!" });
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
        .from("secretary_message_templates")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["secretary-templates"] });
      toast({ title: "Mensagem excluída!" });
    },
  });

  const resetForm = () => {
    setFormData({
      message_title: "",
      message_content: "",
      day_of_week: "",
      scheduled_time: "09:00",
      message_type: "scheduled",
      days_without_contact: "",
    });
    setEditingTemplate(null);
  };

  const openEditDialog = (template: MessageTemplate) => {
    setEditingTemplate(template);
    setFormData({
      message_title: template.message_title,
      message_content: template.message_content,
      day_of_week: template.day_of_week?.toString() || "",
      scheduled_time: template.scheduled_time?.slice(0, 5) || "09:00",
      message_type: template.message_type,
      days_without_contact: template.days_without_contact?.toString() || "",
    });
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (!formData.message_title || !formData.message_content) {
      toast({
        title: "Preencha os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    saveTemplateMutation.mutate({
      message_title: formData.message_title,
      message_content: formData.message_content,
      day_of_week: formData.day_of_week ? parseInt(formData.day_of_week) : null,
      scheduled_time: formData.scheduled_time + ":00",
      message_type: formData.message_type,
      days_without_contact: formData.days_without_contact ? parseInt(formData.days_without_contact) : null,
    });
  };

  const handleRunNow = async () => {
    setIsRunningNow(true);
    try {
      const { error } = await supabase.functions.invoke("secretary-scheduled-sender", {
        body: { force: true },
      });

      if (error) throw error;
      
      toast({ title: "Mensagens enviadas! 📤" });
      queryClient.invalidateQueries({ queryKey: ["secretary-sent-stats"] });
    } catch (error: any) {
      toast({
        title: "Erro ao enviar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsRunningNow(false);
    }
  };

  const filteredTemplates = templates?.filter((t) => t.recipient_type === activeTab) || [];

  const scheduledByDay = DAY_NAMES.map((day, index) => ({
    day,
    dayIndex: index,
    templates: filteredTemplates.filter(
      (t) => t.message_type === "scheduled" && t.day_of_week === index
    ),
  })).filter((d) => d.dayIndex >= 1 && d.dayIndex <= 5); // Apenas seg-sex

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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Send className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Enviadas Hoje</p>
                <p className="text-2xl font-bold">{sentStats?.today || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Calendar className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Esta Semana</p>
                <p className="text-2xl font-bold">{sentStats?.week || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <MessageSquare className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Templates Ativos</p>
                <p className="text-2xl font-bold">
                  {templates?.filter((t) => t.is_active).length || 0}
                </p>
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
                <MessageSquare className="h-5 w-5" />
                Mensagens Programadas
              </CardTitle>
              <CardDescription>
                Configure as mensagens automáticas que a Secretária Morphews envia
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleRunNow}
                disabled={isRunningNow}
              >
                {isRunningNow ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Enviar Agora
              </Button>
              <Dialog open={isDialogOpen} onOpenChange={(open) => {
                setIsDialogOpen(open);
                if (!open) resetForm();
              }}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Mensagem
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
                      {editingTemplate ? "Editar Mensagem" : "Nova Mensagem"}
                    </DialogTitle>
                  </DialogHeader>

                  <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Tipo de Mensagem</Label>
                        <Select
                          value={formData.message_type}
                          onValueChange={(v) => setFormData({ ...formData, message_type: v as any })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(MESSAGE_TYPE_LABELS).map(([key, label]) => (
                              <SelectItem key={key} value={key}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {formData.message_type === "scheduled" && (
                        <div className="space-y-2">
                          <Label>Dia da Semana</Label>
                          <Select
                            value={formData.day_of_week}
                            onValueChange={(v) => setFormData({ ...formData, day_of_week: v })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent>
                              {DAY_NAMES.map((day, index) => (
                                <SelectItem key={index} value={index.toString()}>
                                  {day}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {formData.message_type === "followup" && (
                        <div className="space-y-2">
                          <Label>Dias sem contato</Label>
                          <Input
                            type="number"
                            min={1}
                            value={formData.days_without_contact}
                            onChange={(e) => setFormData({ ...formData, days_without_contact: e.target.value })}
                            placeholder="Ex: 7"
                          />
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Horário de Envio</Label>
                      <Input
                        type="time"
                        value={formData.scheduled_time}
                        onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Título (interno)</Label>
                      <Input
                        value={formData.message_title}
                        onChange={(e) => setFormData({ ...formData, message_title: e.target.value })}
                        placeholder="Ex: Bom dia Segunda - Donos"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Conteúdo da Mensagem</Label>
                      <Textarea
                        value={formData.message_content}
                        onChange={(e) => setFormData({ ...formData, message_content: e.target.value })}
                        placeholder="Digite a mensagem..."
                        rows={8}
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
                                message_content: formData.message_content + v.var,
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
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="mb-4">
              <TabsTrigger value="owners" className="gap-2">
                <Crown className="h-4 w-4" />
                Donos & Gerentes
              </TabsTrigger>
              <TabsTrigger value="users" className="gap-2">
                <Users className="h-4 w-4" />
                Usuários
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab}>
              <div className="space-y-6">
                {/* Mensagens por dia da semana */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  {scheduledByDay.map(({ day, dayIndex, templates: dayTemplates }) => (
                    <div
                      key={dayIndex}
                      className="border rounded-lg p-4 bg-muted/30"
                    >
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {day}
                      </h4>

                      {dayTemplates.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic">
                          Nenhuma mensagem
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {dayTemplates.map((template) => (
                            <div
                              key={template.id}
                              className={`p-3 rounded-lg border bg-background ${
                                !template.is_active ? "opacity-50" : ""
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Clock className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground">
                                      {template.scheduled_time?.slice(0, 5)}
                                    </span>
                                  </div>
                                  <p className="text-sm font-medium truncate">
                                    {template.message_title}
                                  </p>
                                </div>
                                <Switch
                                  checked={template.is_active}
                                  onCheckedChange={(checked) =>
                                    toggleActiveMutation.mutate({
                                      id: template.id,
                                      isActive: checked,
                                    })
                                  }
                                />
                              </div>

                              <div className="flex gap-1 mt-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openEditDialog(template)}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="sm">
                                      <Trash2 className="h-3 w-3 text-destructive" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Excluir mensagem?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Esta ação não pode ser desfeita.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => deleteTemplateMutation.mutate(template.id)}
                                      >
                                        Excluir
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
