import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, X, Sparkles, Clock, Edit3, Check, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { FollowupSuggestion } from "@/hooks/useFollowupSuggestions";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface FollowupSuggestionsListProps {
  suggestions: FollowupSuggestion[];
  isLoading: boolean;
  onSend: (followupId: string, editedMessage?: string) => void;
  onReject: (followupId: string) => void;
  isSending?: boolean;
}

const triggerLabels: Record<string, string> = {
  cron_inactive: "Lead inativo",
  event_stage_change: "Mudou de etapa",
  event_cart_abandon: "Carrinho abandonado",
  event_post_sale: "Pós-venda",
  event_payment_declined: "Pagamento recusado",
  manual: "Manual",
};

export function FollowupSuggestionsList({
  suggestions,
  isLoading,
  onSend,
  onReject,
  isSending,
}: FollowupSuggestionsListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedMessages, setEditedMessages] = useState<Record<string, string>>({});

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        <Sparkles className="h-5 w-5 animate-pulse mr-2" />
        Carregando sugestões...
      </div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-muted-foreground gap-2">
        <Sparkles className="h-8 w-8 opacity-50" />
        <p className="text-sm font-medium">Nenhuma sugestão de follow-up</p>
        <p className="text-xs">O motor de IA gera sugestões automaticamente para leads inativos</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="divide-y divide-border">
        {suggestions.map((suggestion) => {
          const isEditing = editingId === suggestion.id;
          const currentMessage = editedMessages[suggestion.id] || suggestion.generated_message || "";
          const contactName = suggestion.conversation?.contact_name || suggestion.lead?.name || "Lead desconhecido";
          const phone = suggestion.conversation?.contact_phone || suggestion.lead?.whatsapp || "";

          return (
            <div
              key={suggestion.id}
              className="p-3 hover:bg-muted/30 transition-colors"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{contactName}</p>
                    <p className="text-[10px] text-muted-foreground">{phone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                    {triggerLabels[suggestion.trigger_type] || suggestion.trigger_type}
                  </Badge>
                </div>
              </div>

              {/* Message */}
              <div className="ml-10">
                {isEditing ? (
                  <Textarea
                    value={currentMessage}
                    onChange={(e) =>
                      setEditedMessages((prev) => ({
                        ...prev,
                        [suggestion.id]: e.target.value,
                      }))
                    }
                    className="text-sm min-h-[80px] mb-2"
                    autoFocus
                  />
                ) : (
                  <div className="bg-muted/50 rounded-lg p-2.5 mb-2">
                    <p className="text-sm whitespace-pre-wrap">{suggestion.generated_message}</p>
                  </div>
                )}

                {/* Timestamp */}
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-2">
                  <Clock className="h-3 w-3" />
                  <span>
                    Gerado{" "}
                    {formatDistanceToNow(new Date(suggestion.created_at), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </span>
                  {suggestion.ai_model_used && (
                    <span className="ml-1 opacity-60">• {suggestion.ai_model_used}</span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {isEditing ? (
                    <>
                      <Button
                        size="sm"
                        variant="default"
                        className="h-7 text-xs gap-1"
                        onClick={() => {
                          onSend(suggestion.id, editedMessages[suggestion.id]);
                          setEditingId(null);
                        }}
                        disabled={isSending}
                      >
                        <Send className="h-3 w-3" />
                        Enviar editado
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => setEditingId(null)}
                      >
                        Cancelar
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="default"
                        className="h-7 text-xs gap-1"
                        onClick={() => onSend(suggestion.id)}
                        disabled={isSending}
                      >
                        <Send className="h-3 w-3" />
                        Enviar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1"
                        onClick={() => {
                          setEditedMessages((prev) => ({
                            ...prev,
                            [suggestion.id]: suggestion.generated_message || "",
                          }));
                          setEditingId(suggestion.id);
                        }}
                      >
                        <Edit3 className="h-3 w-3" />
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-destructive hover:text-destructive gap-1"
                        onClick={() => onReject(suggestion.id)}
                      >
                        <X className="h-3 w-3" />
                        Descartar
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
