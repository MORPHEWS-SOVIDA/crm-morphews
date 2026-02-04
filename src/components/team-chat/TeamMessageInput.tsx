import { useState, useRef, KeyboardEvent } from 'react';
import { Send, Paperclip, Smile, AtSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useSendTeamMessage, TeamMentionData } from '@/hooks/useTeamChat';
import { MentionPopover } from './MentionPopover';
import { cn } from '@/lib/utils';

interface TeamMessageInputProps {
  conversationId: string;
}

export function TeamMessageInput({ conversationId }: TeamMessageInputProps) {
  const [content, setContent] = useState('');
  const [mentions, setMentions] = useState<TeamMentionData[]>([]);
  const [showMentionPopover, setShowMentionPopover] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionType, setMentionType] = useState<TeamMentionData['type'] | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const sendMessage = useSendTeamMessage();

  const handleSend = () => {
    if (!content.trim()) return;

    sendMessage.mutate({
      conversationId,
      content: content.trim(),
      mentions,
    });

    setContent('');
    setMentions([]);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Send on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
      return;
    }

    // Detect @ mentions
    if (e.key === '@') {
      setShowMentionPopover(true);
      setMentionQuery('');
      setMentionType(null);
    }
  };

  const handleChange = (value: string) => {
    setContent(value);

    // Detectar prefixos de menção
    const cursorPos = textareaRef.current?.selectionStart || value.length;
    const textBeforeCursor = value.substring(0, cursorPos);
    
    // Procurar por padrões de menção
    const mentionPatterns = [
      { pattern: /@pessoa:(\w*)$/, type: 'user' as const },
      { pattern: /@lead:(\w*)$/, type: 'lead' as const },
      { pattern: /@demanda:(\w*)$/, type: 'demand' as const },
      { pattern: /@produto:(\w*)$/, type: 'product' as const },
      { pattern: /@sac:(\w*)$/, type: 'sac' as const },
      { pattern: /@(\w*)$/, type: null }, // Generic @ mention
    ];

    for (const { pattern, type } of mentionPatterns) {
      const match = textBeforeCursor.match(pattern);
      if (match) {
        setShowMentionPopover(true);
        setMentionQuery(match[1] || '');
        setMentionType(type);
        return;
      }
    }

    setShowMentionPopover(false);
  };

  const handleSelectMention = (mention: TeamMentionData) => {
    // Substituir o texto da menção pelo ID
    const cursorPos = textareaRef.current?.selectionStart || content.length;
    const textBeforeCursor = content.substring(0, cursorPos);
    
    // Encontrar onde a menção começa
    const atIndex = textBeforeCursor.lastIndexOf('@');
    if (atIndex === -1) return;

    const beforeMention = content.substring(0, atIndex);
    const afterMention = content.substring(cursorPos);
    
    // Inserir menção formatada
    const mentionText = `@${mention.type}:${mention.id} `;
    const newContent = beforeMention + mentionText + afterMention;
    
    setContent(newContent);
    setMentions([...mentions, mention]);
    setShowMentionPopover(false);
    
    // Focar no textarea
    textareaRef.current?.focus();
  };

  return (
    <div className="p-3 border-t bg-background">
      {/* Mention Popover */}
      <MentionPopover
        open={showMentionPopover}
        query={mentionQuery}
        type={mentionType}
        onSelect={handleSelectMention}
        onClose={() => setShowMentionPopover(false)}
      />

      <div className="flex items-end gap-2">
        {/* Input area */}
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite sua mensagem... (@pessoa: @lead: @demanda:)"
            className={cn(
              "min-h-[40px] max-h-[120px] resize-none pr-10",
              "text-sm"
            )}
            rows={1}
          />

          {/* Mention trigger button */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => {
              setShowMentionPopover(true);
              setMentionType(null);
              setMentionQuery('');
            }}
            className="absolute right-1 bottom-1 h-7 w-7"
          >
            <AtSign className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>

        {/* Send button */}
        <Button
          onClick={handleSend}
          disabled={!content.trim() || sendMessage.isPending}
          size="icon"
          className="h-10 w-10 shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>

      {/* Active mentions preview */}
      {mentions.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {mentions.map((mention, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full"
            >
              @{mention.display_name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
