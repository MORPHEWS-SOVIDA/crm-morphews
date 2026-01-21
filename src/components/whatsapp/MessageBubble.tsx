import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Bot, Check, CheckCheck, Clock, Download, ImageIcon, AlertTriangle, FileText, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface Message {
  id: string;
  content: string | null;
  direction: string;
  message_type: string;
  media_url: string | null;
  media_caption: string | null;
  created_at: string;
  is_from_bot: boolean;
  status: string | null;
  error_details?: string | null;
  sent_by_user_id?: string | null;
  sender_name?: string | null; // Nome do remetente (preenchido via join)
  transcription?: string | null; // Transcrição de áudio
  transcription_status?: string | null; // Status da transcrição
}

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isOutbound = message.direction === 'outbound';

  const getStatusIcon = () => {
    switch (message.status) {
      case 'sending':
        return <Clock className="h-3 w-3" />;
      case 'sent':
        return <Check className="h-3 w-3" />;
      case 'delivered':
        return <CheckCheck className="h-3 w-3" />;
      case 'read':
        return <CheckCheck className="h-3 w-3 text-blue-400" />;
      case 'failed':
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <AlertTriangle className="h-3 w-3 text-red-500 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="text-xs font-medium text-red-600">Falha no envio</p>
                <p className="text-xs text-muted-foreground">
                  {message.error_details || 'Erro desconhecido. Tente novamente.'}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      default:
        return null;
    }
  };

  const [imageError, setImageError] = useState(false);
  const [audioError, setAudioError] = useState(false);

  const renderContent = () => {
    switch (message.message_type) {
      case 'image':
        return (
          <div className="space-y-1">
            {message.media_url && !imageError ? (
              <img 
                src={message.media_url} 
                alt="Imagem" 
                className="rounded-lg max-w-full max-h-72 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => window.open(message.media_url!, '_blank')}
                onError={() => setImageError(true)}
              />
            ) : (
              <div 
                className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors"
                onClick={() => message.media_url && window.open(message.media_url, '_blank')}
              >
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Imagem (clique para abrir)
                </span>
              </div>
            )}
            {(message.content || message.media_caption) && (
              <p className="whitespace-pre-wrap break-words text-sm">
                {message.content || message.media_caption}
              </p>
            )}
          </div>
        );

      case 'audio':
        return (
          <div className="min-w-[200px] space-y-2">
            {message.media_url && !audioError ? (
              <audio 
                controls 
                className="w-full h-10"
                onError={(e) => {
                  console.error("Audio load error:", message.media_url);
                  setAudioError(true);
                }}
                preload="metadata"
              >
                {/* Múltiplos formatos para compatibilidade */}
                <source src={message.media_url} type="audio/ogg" />
                <source src={message.media_url} type="audio/mpeg" />
                <source src={message.media_url} type="audio/webm" />
                <source src={message.media_url} type="audio/mp4" />
                Seu navegador não suporta áudio.
              </audio>
            ) : (
              <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg text-sm text-muted-foreground">
                <span>🎤</span>
                <span>
                  {message.content?.includes("Transcrição do áudio") 
                    ? "Áudio transcrito" 
                    : "Áudio não disponível"}
                </span>
              </div>
            )}
            
            {/* Transcription display */}
            {message.transcription_status === 'processing' && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 p-2 rounded-lg">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Transcrevendo...</span>
              </div>
            )}
            
            {message.transcription && (
              <div className="bg-muted/40 p-2 rounded-lg border-l-2 border-blue-400">
                <div className="flex items-center gap-1 text-xs text-blue-500 mb-1">
                  <FileText className="h-3 w-3" />
                  <span>Transcrição</span>
                </div>
                <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                  {message.transcription}
                </p>
              </div>
            )}
            
            {message.content && message.content.includes("Transcrição do áudio") && !message.transcription && (
              <p className="whitespace-pre-wrap break-words text-sm mt-1">
                {message.content}
              </p>
            )}
          </div>
        );

      case 'video':
        return (
          <div className="space-y-1">
            {message.media_url && (
              <video 
                controls 
                className="rounded-lg max-w-full max-h-72"
              >
                <source src={message.media_url} />
              </video>
            )}
            {message.media_caption && (
              <p className="whitespace-pre-wrap break-words text-sm">
                {message.media_caption}
              </p>
            )}
          </div>
        );

      case 'document':
        return (
          <a 
            href={message.media_url || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-2 bg-background/50 rounded-lg hover:bg-background/80 transition-colors"
          >
            <Download className="h-5 w-5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {message.media_caption || 'Documento'}
              </p>
            </div>
          </a>
        );

      case 'sticker':
        return (
          <div>
            {message.media_url ? (
              <img 
                src={message.media_url} 
                alt="Sticker" 
                className="max-w-[150px] max-h-[150px]"
              />
            ) : (
              <span>🎨 Sticker</span>
            )}
          </div>
        );

      default:
        if (message.content) {
          return (
            <p className="whitespace-pre-wrap break-words text-sm">
              {message.content}
            </p>
          );
        }
        return (
          <span className="text-muted-foreground italic text-sm">
            [{message.message_type}]
          </span>
        );
    }
  };

  return (
    <div className={cn("flex", isOutbound ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-3 py-2 shadow-sm relative",
          isOutbound
            ? "bg-[#dcf8c6] dark:bg-green-900/60 text-foreground rounded-br-md"
            : "bg-card border border-border rounded-bl-md",
          message.is_from_bot && "border-l-2 border-l-blue-400",
          message.status === 'failed' && "border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/30"
        )}
      >
        {/* Sender name for multi-attendant teams */}
        {isOutbound && message.sender_name && (
          <div className="text-xs font-medium text-primary/80 mb-1">
            {message.sender_name}
          </div>
        )}

        {/* Bot indicator */}
        {message.is_from_bot && (
          <div className="flex items-center gap-1 text-xs text-blue-500 mb-1">
            <Bot className="h-3 w-3" />
            <span>Bot</span>
          </div>
        )}

        {/* Message content */}
        {renderContent()}

        {/* Time and status */}
        <div className={cn(
          "flex items-center gap-1 justify-end mt-1",
          "text-[10px]",
          isOutbound ? "text-muted-foreground" : "text-muted-foreground"
        )}>
          <span>{format(new Date(message.created_at), 'HH:mm', { locale: ptBR })}</span>
          {isOutbound && getStatusIcon()}
        </div>
      </div>
    </div>
  );
}
