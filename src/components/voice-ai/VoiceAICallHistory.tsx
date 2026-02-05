import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
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
  Clock,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  Minus
} from "lucide-react";
import { useVoiceAICallLogs, VoiceAICallLog } from "@/hooks/useVoiceAI";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface VoiceAICallHistoryProps {
  direction?: 'inbound' | 'outbound';
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  initiated: { label: "Iniciada", variant: "outline" },
  ringing: { label: "Chamando", variant: "outline" },
  'in-progress': { label: "Em Andamento", variant: "default" },
  completed: { label: "Concluída", variant: "default" },
  failed: { label: "Falhou", variant: "destructive" },
  busy: { label: "Ocupado", variant: "secondary" },
  'no-answer': { label: "Sem Resposta", variant: "secondary" },
  canceled: { label: "Cancelada", variant: "secondary" },
};

const sentimentConfig: Record<string, { label: string; icon: typeof TrendingUp }> = {
  positive: { label: "Positivo", icon: TrendingUp },
  neutral: { label: "Neutro", icon: Minus },
  negative: { label: "Negativo", icon: TrendingDown },
};

const outcomeLabels: Record<string, string> = {
  appointment_booked: 'Agendamento',
  callback_requested: 'Retorno',
  sale_closed: 'Venda',
  info_provided: 'Informação',
  transferred: 'Transferida',
  voicemail: 'Recado',
  hung_up: 'Desligou',
  no_outcome: 'Sem resultado',
};

export function VoiceAICallHistory({ direction }: VoiceAICallHistoryProps) {
  const [search, setSearch] = useState("");
  const [selectedCall, setSelectedCall] = useState<VoiceAICallLog | null>(null);

  const { data: calls, isLoading } = useVoiceAICallLogs({
    direction,
    limit: 100,
  });

  const formatDuration = (seconds: number) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };
  
  // Filter by search locally
  const filteredCalls = calls?.filter(call => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      call.from_number?.toLowerCase().includes(searchLower) ||
      call.to_number?.toLowerCase().includes(searchLower) ||
      call.lead_name?.toLowerCase().includes(searchLower) ||
      call.transcription?.toLowerCase().includes(searchLower)
    );
  }) || [];

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
            placeholder="Buscar por telefone, nome ou transcrição..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Calls Table */}
      {filteredCalls.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Phone className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma chamada registrada ainda</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {!direction && <TableHead className="w-12">Tipo</TableHead>}
                  <TableHead>De / Para</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Agente</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead>Resultado</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCalls.map((call) => (
                  <TableRow key={call.id}>
                    {!direction && (
                      <TableCell>
                        {call.direction === "inbound" ? (
                          <PhoneIncoming className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <PhoneOutgoing className="h-4 w-4 text-blue-500" />
                        )}
                      </TableCell>
                    )}
                    <TableCell className="font-mono text-xs">
                      <div>{call.from_number}</div>
                      <div className="text-muted-foreground">→ {call.to_number}</div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{call.lead_name || '-'}</span>
                    </TableCell>
                    <TableCell className="text-sm">{call.agent?.name || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={statusConfig[call.status]?.variant || "secondary"}>
                        {statusConfig[call.status]?.label || call.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Clock className="h-3 w-3" />
                        {formatDuration(call.duration_seconds || 0)}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {call.outcome ? outcomeLabels[call.outcome] || call.outcome : '-'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(call.started_at), { 
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

      {/* Call Details Dialog */}
      <Dialog open={!!selectedCall} onOpenChange={() => setSelectedCall(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedCall?.direction === "inbound" ? (
                <PhoneIncoming className="h-5 w-5 text-emerald-500" />
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
                  <span className="text-muted-foreground">De:</span>
                  <p className="font-mono">{selectedCall.from_number}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Para:</span>
                  <p className="font-mono">{selectedCall.to_number}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Contato:</span>
                  <p>{selectedCall.lead_name || '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Agente:</span>
                  <p>{selectedCall.agent?.name || '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <Badge variant={statusConfig[selectedCall.status]?.variant || "secondary"}>
                    {statusConfig[selectedCall.status]?.label || selectedCall.status}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Duração:</span>
                  <p>{formatDuration(selectedCall.duration_seconds || 0)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Minutos:</span>
                  <p>{selectedCall.minutes_consumed} min</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Resultado:</span>
                  <p>{selectedCall.outcome ? outcomeLabels[selectedCall.outcome] || selectedCall.outcome : '-'}</p>
                </div>
                {selectedCall.sentiment && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Sentimento:</span>
                    <div className="flex items-center gap-2">
                      {(() => {
                        const config = sentimentConfig[selectedCall.sentiment];
                        const Icon = config?.icon || Minus;
                        return (
                          <>
                            <Icon className={`h-4 w-4 ${selectedCall.sentiment === 'positive' ? 'text-emerald-500' : selectedCall.sentiment === 'negative' ? 'text-red-500' : 'text-muted-foreground'}`} />
                            <span>{config?.label || selectedCall.sentiment}</span>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>

              {/* Transcript */}
              {selectedCall.transcription && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare className="h-4 w-4" />
                    <span className="font-medium">Transcrição</span>
                  </div>
                  <ScrollArea className="h-48 rounded border p-3 bg-muted/50">
                    <p className="text-sm whitespace-pre-wrap">
                      {selectedCall.transcription}
                    </p>
                  </ScrollArea>
                </div>
              )}
              
              {/* Summary */}
              {selectedCall.transcription_summary && (
                <div className="p-3 bg-primary/5 rounded-lg">
                  <span className="font-medium text-sm">Resumo:</span>
                  <p className="text-sm text-muted-foreground mt-1">{selectedCall.transcription_summary}</p>
                </div>
              )}

              {/* Timestamps */}
              <div className="text-xs text-muted-foreground pt-2 border-t">
                <p>
                  Iniciada: {format(new Date(selectedCall.started_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                </p>
                {selectedCall.answered_at && (
                  <p>Atendida: {format(new Date(selectedCall.answered_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}</p>
                )}
                {selectedCall.ended_at && (
                  <p>Encerrada: {format(new Date(selectedCall.ended_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
