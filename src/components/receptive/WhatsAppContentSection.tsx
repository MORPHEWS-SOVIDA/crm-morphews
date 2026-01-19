import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MessageSquare, Search, Loader2, Copy, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useLeadWhatsAppSummary } from '@/hooks/useLeadWhatsAppSummary';
import { useUpdateReceptiveAttendance } from '@/hooks/useReceptiveManagement';

interface WhatsAppContentSectionProps {
  attendanceId: string;
  leadId: string | null;
  phoneSearched: string;
  existingNotes: string | null;
  conversationId?: string | null;
}

export function WhatsAppContentSection({
  attendanceId,
  leadId,
  phoneSearched,
  existingNotes,
  conversationId,
}: WhatsAppContentSectionProps) {
  const [showPasteArea, setShowPasteArea] = useState(false);
  const [pastedConversation, setPastedConversation] = useState('');
  const updateAttendance = useUpdateReceptiveAttendance();

  const { data: summary, isLoading, refetch } = useLeadWhatsAppSummary(leadId, phoneSearched);

  const handleSavePasted = async () => {
    if (!pastedConversation.trim()) return;

    // Append to notes or transcription field
    const newNotes = existingNotes
      ? `${existingNotes}\n\n--- Conversa colada ---\n${pastedConversation}`
      : `--- Conversa colada ---\n${pastedConversation}`;

    await updateAttendance.mutateAsync({ id: attendanceId, updates: { notes: newNotes } });
    setPastedConversation('');
    setShowPasteArea(false);
  };

  // Has system conversation
  if (summary?.hasConversation && summary.messages.length > 0) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-green-600" />
            Histórico WhatsApp
          </p>
          <Badge variant="outline" className="text-green-600 border-green-500/30 text-xs">
            Conversa vinculada
          </Badge>
        </div>

        <div className="p-3 bg-muted/50 rounded-lg border max-h-60 overflow-y-auto space-y-2">
          {summary.messages.map((msg, idx) => (
            <div
              key={idx}
              className={`text-xs p-2 rounded-md max-w-[85%] ${
                msg.direction === 'outbound'
                  ? 'bg-primary/10 text-primary ml-auto'
                  : 'bg-background border'
              }`}
            >
              <p className="break-words">{msg.content || '[mídia]'}</p>
              <span className="text-[10px] text-muted-foreground mt-1 block">
                {format(new Date(msg.created_at), 'dd/MM HH:mm')}
              </span>
            </div>
          ))}
        </div>

        {/* Link to full conversation */}
        {summary.conversationId && (
          <a
            href={`/whatsapp?chatId=${summary.conversationId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <ExternalLink className="w-3 h-3" />
            Ver conversa completa
          </a>
        )}
      </div>
    );
  }

  // No conversation found - show options
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-muted-foreground" />
        Conversa WhatsApp
      </p>

      <div className="text-xs text-muted-foreground p-2 bg-muted/30 rounded-md">
        Nenhuma conversa encontrada no sistema para este lead.
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
          ) : (
            <Search className="w-4 h-4 mr-1" />
          )}
          Buscar por número
        </Button>

        <Button size="sm" variant="outline" onClick={() => setShowPasteArea(!showPasteArea)}>
          <Copy className="w-4 h-4 mr-1" />
          Colar conversa
        </Button>
      </div>

      {showPasteArea && (
        <div className="space-y-2">
          <Textarea
            value={pastedConversation}
            onChange={(e) => setPastedConversation(e.target.value)}
            placeholder="Cole aqui o histórico da conversa do WhatsApp (exportado ou copiado)..."
            rows={6}
            className="text-xs"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSavePasted} disabled={updateAttendance.isPending}>
              {updateAttendance.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowPasteArea(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
