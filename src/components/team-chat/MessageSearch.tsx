import { useState } from 'react';
import { Search, X, MessageSquare, Hash, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSearchMessages } from '@/hooks/useTeamChatExtended';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface MessageSearchProps {
  conversationId?: string;
  onSelectMessage?: (messageId: string, conversationId: string) => void;
  onClose?: () => void;
}

export function MessageSearch({ conversationId, onSelectMessage, onClose }: MessageSearchProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Debounce da busca
  const handleQueryChange = (value: string) => {
    setQuery(value);
    // Simple debounce
    setTimeout(() => {
      setDebouncedQuery(value);
    }, 300);
  };

  const { data: results = [], isLoading } = useSearchMessages(debouncedQuery, conversationId);

  return (
    <div className="flex flex-col h-full">
      {/* Search Header */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Buscar mensagens..."
              className="pl-9 pr-9"
              autoFocus
            />
            {query && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => {
                  setQuery('');
                  setDebouncedQuery('');
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        {query.length > 0 && query.length < 2 && (
          <p className="text-xs text-muted-foreground mt-2">
            Digite pelo menos 2 caracteres para buscar
          </p>
        )}
      </div>

      {/* Results */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="p-3 rounded-lg bg-muted animate-pulse h-20" />
              ))}
            </div>
          ) : debouncedQuery.length < 2 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Busque por mensagens</p>
              <p className="text-xs mt-1">
                {conversationId 
                  ? 'Buscar nesta conversa'
                  : 'Buscar em todas as conversas'}
              </p>
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Nenhum resultado encontrado</p>
              <p className="text-xs mt-1">Tente termos diferentes</p>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground px-2 py-1">
                {results.length} resultado{results.length !== 1 ? 's' : ''}
              </p>
              {results.map((result: any) => (
                <SearchResultItem
                  key={result.id}
                  message={result}
                  searchQuery={debouncedQuery}
                  onClick={() => onSelectMessage?.(result.id, result.conversation_id)}
                />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

interface SearchResultItemProps {
  message: any;
  searchQuery: string;
  onClick?: () => void;
}

function SearchResultItem({ message, searchQuery, onClick }: SearchResultItemProps) {
  // Highlight matched text
  const highlightText = (text: string, query: string) => {
    if (!query) return text;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const conversationType = message.conversation?.conversation_type;
  const conversationName = message.conversation?.name || 'Conversa';

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full p-3 rounded-lg text-left",
        "hover:bg-muted/50 transition-colors",
        "border border-transparent hover:border-border"
      )}
    >
      {/* Conversation info */}
      <div className="flex items-center gap-2 mb-1">
        {conversationType === 'group' ? (
          <Hash className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <User className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <span className="text-xs text-muted-foreground font-medium">
          {conversationName}
        </span>
        <span className="text-xs text-muted-foreground/60">
          {format(new Date(message.created_at), "d 'de' MMM, HH:mm", { locale: ptBR })}
        </span>
      </div>

      {/* Message content */}
      <p className="text-sm line-clamp-2">
        {highlightText(message.content, searchQuery)}
      </p>
    </button>
  );
}
