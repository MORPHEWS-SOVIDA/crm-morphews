import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Loader2, 
  Phone, 
  PhoneIncoming, 
  PhoneOutgoing,
  Search,
  Eye,
  Zap,
  Clock,
  MessageSquare
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface VoiceAICall {
  id: string;
  call_type: "inbound" | "outbound";
  status: string;
  phone_number: string | null;
  contact_name: string | null;
  agent_name: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  transcript: string | null;
  sentiment: string | null;
  outcome: string | null;
  energy_consumed: number;
  cost_credits: number;
  created_at: string;
  lead_id: string | null;
  contact_id: string | null;
  leads?: {
    name: string;
  } | null;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendente", variant: "secondary" },
  ringing: { label: "Chamando", variant: "outline" },
  in_progress: { label: "Em Andamento", variant: "default" },
  completed: { label: "Concluída", variant: "default" },
  failed: { label: "Falhou", variant: "destructive" },
  missed: { label: "Perdida", variant: "secondary" },
  no_answer: { label: "Sem Resposta", variant: "secondary" },
};

const sentimentConfig: Record<string, { label: string; color: string }> = {
  positive: { label: "Positivo", color: "text-green-600" },
  neutral: { label: "Neutro", color: "text-muted-foreground" },
  negative: { label: "Negativo", color: "text-red-600" },
};

export function VoiceAICallHistory() {
  const { tenantId } = useTenant();
  const [search, setSearch] = useState("");
  const [selectedCall, setSelectedCall] = useState<VoiceAICall | null>(null);

  const { data: calls, isLoading } = useQuery({
    queryKey: ["voice-ai-calls", tenantId, search],
    queryFn: async () => {
      if (!tenantId) return [];
      
      let query = supabase
        .from("voice_ai_calls")
        .select(`
          id,
          call_type,
          status,
          phone_number,
          contact_name,
          agent_name,
          started_at,
          ended_at,
          duration_seconds,
          transcript,
          sentiment,
          outcome,
          energy_consumed,
          cost_credits,
          created_at,
          lead_id,
          contact_id,
          leads(name)
        `)
        .eq("organization_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(100);
      
      if (search) {
        query = query.or(`phone_number.ilike.%${search}%,transcript.ilike.%${search}%`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as VoiceAICall[];
    },
    enabled: !!tenantId,
  });

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "-";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
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
      {/* Search */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por telefone ou transcrição..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total de Chamadas</span>
            </div>
            <p className="text-2xl font-bold mt-1">{calls?.length || 0}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <PhoneOutgoing className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">Outbound</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {calls?.filter(c => c.call_type === "outbound").length || 0}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <PhoneIncoming className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Inbound</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {calls?.filter(c => c.call_type === "inbound").length || 0}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-500" />
              <span className="text-sm text-muted-foreground">Energia Usada</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {calls?.reduce((acc, c) => acc + (c.energy_consumed || 0), 0) || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Calls Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico de Chamadas</CardTitle>
        </CardHeader>
        <CardContent>
          {!calls || calls.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Phone className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma chamada registrada ainda</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Direção</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Agente</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead>Energia</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {calls.map((call) => (
                  <TableRow key={call.id}>
                    <TableCell>
                      {call.call_type === "inbound" ? (
                        <PhoneIncoming className="h-4 w-4 text-green-500" />
                      ) : (
                        <PhoneOutgoing className="h-4 w-4 text-blue-500" />
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {call.phone_number || "-"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {call.agent_name || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusConfig[call.status]?.variant || "secondary"}>
                        {statusConfig[call.status]?.label || call.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Clock className="h-3 w-3" />
                        {formatDuration(call.duration_seconds)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Zap className="h-3 w-3 text-yellow-500" />
                        {call.energy_consumed}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(call.created_at), { 
                        addSuffix: true, 
                        locale: ptBR 
                      })}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedCall(call)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Call Details Dialog */}
      <Dialog open={!!selectedCall} onOpenChange={() => setSelectedCall(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedCall?.call_type === "inbound" ? (
                <PhoneIncoming className="h-5 w-5 text-green-500" />
              ) : (
                <PhoneOutgoing className="h-5 w-5 text-blue-500" />
              )}
              Detalhes da Chamada
            </DialogTitle>
          </DialogHeader>
          
          {selectedCall && (
            <div className="space-y-4">
              {/* Meta Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Telefone:</span>
                  <p className="font-mono">{selectedCall.phone_number || "-"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Agente:</span>
                  <p>{selectedCall.agent_name || "-"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Lead:</span>
                  <p>{selectedCall.leads?.name || "-"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <Badge variant={statusConfig[selectedCall.status]?.variant || "secondary"}>
                    {statusConfig[selectedCall.status]?.label || selectedCall.status}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Duração:</span>
                  <p>{formatDuration(selectedCall.duration_seconds)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Energia:</span>
                  <p className="flex items-center gap-1">
                    <Zap className="h-4 w-4 text-yellow-500" />
                    {selectedCall.energy_consumed}
                  </p>
                </div>
                {selectedCall.sentiment && (
                  <div>
                    <span className="text-muted-foreground">Sentimento:</span>
                    <p className={sentimentConfig[selectedCall.sentiment]?.color}>
                      {sentimentConfig[selectedCall.sentiment]?.label || selectedCall.sentiment}
                    </p>
                  </div>
                )}
                {selectedCall.outcome && (
                  <div>
                    <span className="text-muted-foreground">Resultado:</span>
                    <p>{selectedCall.outcome}</p>
                  </div>
                )}
              </div>

              {/* Transcript */}
              {selectedCall.transcript && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare className="h-4 w-4" />
                    <span className="font-medium">Transcrição</span>
                  </div>
                  <ScrollArea className="h-48 rounded border p-3 bg-muted/50">
                    <p className="text-sm whitespace-pre-wrap">
                      {selectedCall.transcript}
                    </p>
                  </ScrollArea>
                </div>
              )}

              {/* Timestamps */}
              <div className="text-xs text-muted-foreground pt-2 border-t">
                <p>
                  Criada em: {format(new Date(selectedCall.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </p>
                {selectedCall.started_at && (
                  <p>
                    Iniciada em: {format(new Date(selectedCall.started_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </p>
                )}
                {selectedCall.ended_at && (
                  <p>
                    Encerrada em: {format(new Date(selectedCall.ended_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
