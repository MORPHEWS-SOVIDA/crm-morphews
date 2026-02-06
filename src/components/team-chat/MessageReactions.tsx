import { useState } from 'react';
import { Smile, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { ReactionSummary, useToggleReaction } from '@/hooks/useTeamChatExtended';

// Emojis mais comuns para reações rápidas
const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🎉', '🔥', '👏'];

// Categorias de emojis
const EMOJI_CATEGORIES = {
  'Frequentes': ['👍', '❤️', '😂', '😮', '😢', '😡', '🎉', '🔥', '👏', '💯', '🙌', '✅'],
  'Rostos': ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😊', '😇', '🙂', '😉', '😌', '😍', '🥰', '😘'],
  'Gestos': ['👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👋', '🙏', '💪', '🎯'],
  'Objetos': ['💡', '⭐', '🌟', '✨', '💥', '🔥', '❄️', '🌈', '☀️', '🌙', '⚡', '💎'],
};

interface MessageReactionsProps {
  messageId: string;
  reactions: ReactionSummary[];
  compact?: boolean;
}

export function MessageReactions({ messageId, reactions, compact = false }: MessageReactionsProps) {
  const [showPicker, setShowPicker] = useState(false);
  const toggleReaction = useToggleReaction();

  const handleReaction = (emoji: string) => {
    toggleReaction.mutate({ messageId, emoji });
    setShowPicker(false);
  };

  if (compact && reactions.length === 0) return null;

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {/* Reações existentes */}
      {reactions.map((reaction) => (
        <button
          key={reaction.emoji}
          onClick={() => handleReaction(reaction.emoji)}
          className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs",
            "border transition-colors",
            reaction.reacted_by_me
              ? "bg-primary/10 border-primary/30 text-primary"
              : "bg-muted border-transparent hover:border-border"
          )}
        >
          <span>{reaction.emoji}</span>
          <span className="font-medium">{reaction.count}</span>
        </button>
      ))}

      {/* Botão para adicionar reação */}
      <Popover open={showPicker} onOpenChange={setShowPicker}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-6 w-6 rounded-full",
              reactions.length === 0 && "opacity-0 group-hover:opacity-100"
            )}
          >
            {reactions.length > 0 ? (
              <Plus className="h-3 w-3" />
            ) : (
              <Smile className="h-3.5 w-3.5" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-2" align="start">
          <EmojiPicker onSelect={handleReaction} />
        </PopoverContent>
      </Popover>
    </div>
  );
}

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
}

function EmojiPicker({ onSelect }: EmojiPickerProps) {
  const [activeCategory, setActiveCategory] = useState<string>('Frequentes');

  return (
    <div className="space-y-2">
      {/* Quick reactions */}
      <div className="flex gap-1 justify-center pb-2 border-b">
        {QUICK_REACTIONS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => onSelect(emoji)}
            className="text-xl p-1.5 hover:bg-muted rounded transition-colors"
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {Object.keys(EMOJI_CATEGORIES).map((category) => (
          <button
            key={category}
            onClick={() => setActiveCategory(category)}
            className={cn(
              "px-2 py-1 text-xs rounded whitespace-nowrap transition-colors",
              activeCategory === category
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted"
            )}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Emoji grid */}
      <div className="grid grid-cols-8 gap-1 max-h-[150px] overflow-y-auto">
        {EMOJI_CATEGORIES[activeCategory as keyof typeof EMOJI_CATEGORIES].map((emoji) => (
          <button
            key={emoji}
            onClick={() => onSelect(emoji)}
            className="text-lg p-1 hover:bg-muted rounded transition-colors"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

// Componente de reação rápida para hover
interface QuickReactionBarProps {
  messageId: string;
  onReply?: () => void;
  onThread?: () => void;
  onPin?: () => void;
  onMore?: () => void;
}

export function QuickReactionBar({ messageId, onReply, onThread, onPin, onMore }: QuickReactionBarProps) {
  const toggleReaction = useToggleReaction();

  return (
    <div className="absolute -top-3 right-2 flex items-center gap-0.5 bg-background border rounded-lg shadow-sm px-1 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
      {QUICK_REACTIONS.slice(0, 4).map((emoji) => (
        <button
          key={emoji}
          onClick={() => toggleReaction.mutate({ messageId, emoji })}
          className="text-sm p-1 hover:bg-muted rounded transition-colors"
        >
          {emoji}
        </button>
      ))}
      
      <div className="w-px h-4 bg-border mx-0.5" />
      
      {onThread && (
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onThread} title="Responder em thread">
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </Button>
      )}
      
      {onPin && (
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onPin} title="Fixar mensagem">
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 17v5M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
          </svg>
        </Button>
      )}
    </div>
  );
}
