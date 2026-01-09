import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, UserPlus, Check } from "lucide-react";
import { useConversationDistribution } from "@/hooks/useConversationDistribution";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface ConversationTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  instanceId: string;
  currentUserId?: string | null;
  contactName?: string;
}

interface EligibleUser {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
}

export function ConversationTransferDialog({
  open,
  onOpenChange,
  conversationId,
  instanceId,
  currentUserId,
  contactName
}: ConversationTransferDialogProps) {
  const { profile } = useAuth();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const { transferConversation } = useConversationDistribution();

  // Buscar usuários elegíveis (que têm acesso à instância)
  const { data: eligibleUsers, isLoading } = useQuery({
    queryKey: ["transfer-eligible-users", instanceId],
    queryFn: async () => {
      // Buscar usuários com acesso à instância
      const { data: instanceUsers, error: instanceError } = await supabase
        .from("whatsapp_instance_users")
        .select("user_id, can_view, can_send")
        .eq("instance_id", instanceId)
        .eq("can_view", true);

      if (instanceError) throw instanceError;

      if (!instanceUsers?.length) return [];

      // Buscar perfis dos usuários
      const userIds = instanceUsers.map(u => u.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, email")
        .in("user_id", userIds);

      if (profilesError) throw profilesError;

      // Filtrar o usuário atual
      return (profiles || []).filter(p => p.user_id !== currentUserId) as EligibleUser[];
    },
    enabled: open,
  });

  const handleTransfer = async () => {
    if (!selectedUserId) return;

    await transferConversation.mutateAsync({
      conversationId,
      toUserId: selectedUserId,
      notes: notes.trim() || undefined
    });

    setSelectedUserId(null);
    setNotes("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Transferir Conversa
          </DialogTitle>
          <DialogDescription>
            {contactName ? (
              <>Transferir atendimento de <strong>{contactName}</strong> para outro usuário</>
            ) : (
              "Selecione o usuário para assumir este atendimento"
            )}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : eligibleUsers?.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Nenhum outro usuário disponível para transferência</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label className="mb-2 block">Selecione o usuário</Label>
              <ScrollArea className="h-[200px] border rounded-lg">
                <div className="p-2 space-y-1">
                  {eligibleUsers?.map((user) => (
                    <button
                      key={user.user_id}
                      onClick={() => setSelectedUserId(user.user_id)}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left",
                        selectedUserId === user.user_id
                          ? "bg-primary/10 border border-primary"
                          : "hover:bg-muted border border-transparent"
                      )}
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary/20 text-primary">
                          {user.first_name?.[0]?.toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {user.first_name} {user.last_name}
                        </p>
                        {user.email && (
                          <p className="text-xs text-muted-foreground truncate">
                            {user.email}
                          </p>
                        )}
                      </div>
                      {selectedUserId === user.user_id && (
                        <Check className="h-5 w-5 text-primary flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>

            <div>
              <Label htmlFor="notes" className="mb-2 block">
                Observações (opcional)
              </Label>
              <Textarea
                id="notes"
                placeholder="Ex: Cliente solicitou falar com suporte técnico..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1"
                onClick={handleTransfer}
                disabled={!selectedUserId || transferConversation.isPending}
              >
                {transferConversation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Transferir
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
