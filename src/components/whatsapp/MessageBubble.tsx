import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Bot, Check, CheckCheck, Clock, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

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
      default:
        return message.status === 'failed' ? (
          <span className="text-red-400 text-xs">!</span>
        ) : null;
    }
  };

  const renderContent = () => {
    switch (message.message_type) {
      case 'image':
        return (
          <div className="space-y-1">
            {message.media_url && (
              <img 
                src={message.media_url} 
                alt="Imagem" 
                className="rounded-lg max-w-full max-h-72 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => window.open(message.media_url!, '_blank')}
              />
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
          <div className="min-w-[200px]">
            {message.media_url ? (
              <audio controls className="w-full h-10">
                <source src={message.media_url} />
                Seu navegador não suporta áudio.
              </audio>
            ) : (
              <span className="text-muted-foreground text-sm">🎵 Áudio</span>
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
          message.is_from_bot && "border-l-2 border-l-blue-400"
        )}
      >
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
