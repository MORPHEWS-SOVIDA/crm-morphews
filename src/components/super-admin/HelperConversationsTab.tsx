import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  MessageCircle, User, Bot, Send, RefreshCw, 
  Clock, AlertCircle, CheckCircle, Building2
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Conversation {
  id: string;
  organization_id: string | null;
  user_id: string | null;
  status: string;
  human_requested_at: string | null;
  human_notified_at: string | null;
  created_at: string;
  updated_at: string;
}

interface Message {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  created_at: string;
}

export function HelperConversationsTab() {
  const queryClient = useQueryClient();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  // Buscar conversas
  const { data: conversations, isLoading: loadingConversations, refetch } = useQuery({
    queryKey: ["helper-conversations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("helper_conversations")
        .select(`
          *,
          profiles:user_id (first_name, last_name),
          organizations:organization_id (name)
        `)
        .order("updated_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
  });

  // Buscar mensagens da conversa selecionada
  const { data: messages, isLoading: loadingMessages } = useQuery({
    queryKey: ["helper-messages", selectedConversation],
    queryFn: async () => {
      if (!selectedConversation) return [];
      
      const { data, error } = await supabase
        .from("helper_messages")
        .select("*")
        .eq("conversation_id", selectedConversation)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as Message[];
    },
    enabled: !!selectedConversation,
  });

  // Realtime para novas mensagens
  useEffect(() => {
    const channel = supabase
      .channel("helper-messages-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "helper_messages",
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ["helper-messages", selectedConversation] });
          queryClient.invalidateQueries({ queryKey: ["helper-conversations"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConversation, queryClient]);

  // Mutation para enviar resposta humana
  const sendReplyMutation = useMutation({
    mutationFn: async ({ conversationId, content }: { conversationId: string; content: string }) => {
      // Buscar organization_id da conversa
      const conv = conversations?.find(c => c.id === conversationId);
      
      const { error } = await supabase
        .from("helper_messages")
        .insert({
          conversation_id: conversationId,
          organization_id: conv?.organization_id,
          role: "human",
          content,
        });

      if (error) throw error;

      // Atualizar status da conversa
      await supabase
        .from("helper_conversations")
        .update({ status: "active" })
        .eq("id", conversationId);
    },
    onSuccess: () => {
      toast.success("Resposta enviada!");
      setReplyText("");
      queryClient.invalidateQueries({ queryKey: ["helper-messages", selectedConversation] });
      queryClient.invalidateQueries({ queryKey: ["helper-conversations"] });
    },
    onError: () => {
      toast.error("Erro ao enviar resposta");
    },
  });

  const getStatusBadge = (status: string, humanRequestedAt: string | null) => {
    if (status === "human_requested") {
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertCircle className="w-3 h-3" />
          Aguardando Humano
        </Badge>
      );
    }
    if (status === "closed") {
      return (
        <Badge variant="secondary" className="gap-1">
          <CheckCircle className="w-3 h-3" />
          Fechada
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="gap-1">
        <MessageCircle className="w-3 h-3" />
        Ativa
        </Badge>
    );
  };

  const selectedConv = conversations?.find(c => c.id === selectedConversation);

  return (
    <div className="flex gap-4 h-[600px]">
      {/* Lista de Conversas */}
      <Card className="w-1/3">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Conversas do Helper</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[520px]">
            {loadingConversations ? (
              <div className="p-4 text-center text-muted-foreground">Carregando...</div>
            ) : conversations?.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">Nenhuma conversa ainda</div>
            ) : (
              <div className="divide-y">
                {conversations?.map((conv: any) => (
                  <button
                    key={conv.id}
                    onClick={() => setSelectedConversation(conv.id)}
                    className={cn(
                      "w-full p-3 text-left hover:bg-muted/50 transition-colors",
                      selectedConversation === conv.id && "bg-muted"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {conv.profiles?.first_name || "Usuário"} {conv.profiles?.last_name || ""}
                        </p>
                        <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          {conv.organizations?.name || "Sem organização"}
                        </p>
                      </div>
                      {getStatusBadge(conv.status, conv.human_requested_at)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {format(new Date(conv.updated_at), "dd/MM HH:mm", { locale: ptBR })}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Área de Mensagens */}
      <Card className="flex-1 flex flex-col">
        <CardHeader className="pb-3 border-b">
          <CardTitle className="text-base">
            {selectedConv ? (
              <span className="flex items-center gap-2">
                <User className="w-4 h-4" />
                {(selectedConv as any).profiles?.first_name || "Conversa"} - 
                {(selectedConv as any).organizations?.name || ""}
              </span>
            ) : (
              "Selecione uma conversa"
            )}
          </CardTitle>
        </CardHeader>
        
        <CardContent className="flex-1 p-0 flex flex-col">
          {!selectedConversation ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <MessageCircle className="w-8 h-8 mr-2 opacity-50" />
              Selecione uma conversa para ver as mensagens
            </div>
          ) : loadingMessages ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              Carregando mensagens...
            </div>
          ) : (
            <>
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {messages?.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn(
                        "flex gap-2",
                        msg.role === "user" ? "justify-end" : "justify-start"
                      )}
                    >
                      {msg.role !== "user" && (
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                          msg.role === "human" ? "bg-blue-100" : "bg-emerald-100"
                        )}>
                          {msg.role === "human" ? (
                            <User className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Bot className="w-4 h-4 text-emerald-600" />
                          )}
                        </div>
                      )}
                      <div
                        className={cn(
                          "rounded-lg px-3 py-2 max-w-[80%] text-sm",
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : msg.role === "human"
                            ? "bg-blue-100 text-blue-900"
                            : "bg-muted"
                        )}
                      >
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                        <p className="text-[10px] opacity-60 mt-1">
                          {format(new Date(msg.created_at), "HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {/* Input de resposta humana */}
              <div className="p-4 border-t">
                <div className="flex gap-2">
                  <Input
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Responder como humano..."
                    onKeyPress={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        if (replyText.trim()) {
                          sendReplyMutation.mutate({
                            conversationId: selectedConversation,
                            content: replyText,
                          });
                        }
                      }
                    }}
                  />
                  <Button
                    onClick={() => {
                      if (replyText.trim()) {
                        sendReplyMutation.mutate({
                          conversationId: selectedConversation,
                          content: replyText,
                        });
                      }
                    }}
                    disabled={!replyText.trim() || sendReplyMutation.isPending}
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Suas respostas aparecerão em azul para o usuário
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
