import { useState, useRef, useCallback, useEffect, KeyboardEvent, ClipboardEvent } from 'react';
import { Bold, Italic, Strikethrough, List, Code, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatWhatsAppText } from '@/utils/whatsappFormatting';

interface WhatsAppMessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  placeholder?: string;
  isMobile?: boolean;
  textareaRef?: React.RefObject<HTMLTextAreaElement>;
}

const FORMAT_ACTIONS = [
  { icon: Bold, label: 'Negrito', prefix: '*', suffix: '*' },
  { icon: Italic, label: 'Itálico', prefix: '_', suffix: '_' },
  { icon: Strikethrough, label: 'Tachado', prefix: '~', suffix: '~' },
  { icon: Code, label: 'Código', prefix: '```', suffix: '```' },
  { icon: List, label: 'Lista', prefix: '* ', suffix: '', isLinePrefix: true },
] as const;

export function WhatsAppMessageInput({
  value,
  onChange,
  onSend,
  disabled = false,
  placeholder,
  isMobile = false,
  textareaRef: externalRef,
}: WhatsAppMessageInputProps) {
  const internalRef = useRef<HTMLTextAreaElement>(null);
  const ref = externalRef || internalRef;
  const [showPreview, setShowPreview] = useState(false);

  // Auto-resize textarea based on content
  const autoResize = useCallback(() => {
    const textarea = ref.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const minH = isMobile ? 80 : 80;
    const maxH = isMobile ? 200 : 280;
    textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, minH), maxH)}px`;
  }, [ref, isMobile]);

  useEffect(() => {
    autoResize();
  }, [value, autoResize]);

  const applyFormat = useCallback((prefix: string, suffix: string, isLinePrefix = false) => {
    const textarea = ref.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.substring(start, end);

    let newValue: string;
    let newCursorPos: number;

    if (isLinePrefix) {
      // For list items, prefix each line
      if (selected) {
        const lines = selected.split('\n');
        const formatted = lines.map(line => `${prefix}${line}`).join('\n');
        newValue = value.substring(0, start) + formatted + value.substring(end);
        newCursorPos = start + formatted.length;
      } else {
        // Insert on current line
        const lineStart = value.lastIndexOf('\n', start - 1) + 1;
        newValue = value.substring(0, lineStart) + prefix + value.substring(lineStart);
        newCursorPos = start + prefix.length;
      }
    } else if (selected) {
      // Wrap selection
      newValue = value.substring(0, start) + prefix + selected + suffix + value.substring(end);
      newCursorPos = end + prefix.length + suffix.length;
    } else {
      // Insert markers and place cursor between them
      newValue = value.substring(0, start) + prefix + suffix + value.substring(end);
      newCursorPos = start + prefix.length;
    }

    onChange(newValue);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = newCursorPos;
    });
  }, [value, onChange, ref]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    } else if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newValue = value.substring(0, start) + '\n' + value.substring(end);
      onChange(newValue);
      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 1;
      });
    }

    // Keyboard shortcuts for formatting
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
      switch (e.key) {
        case 'b':
          e.preventDefault();
          applyFormat('*', '*');
          break;
        case 'i':
          e.preventDefault();
          applyFormat('_', '_');
          break;
      }
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedText = e.clipboardData.getData('text/plain');
    if (pastedText && pastedText.includes('\n')) {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newValue = value.substring(0, start) + pastedText + value.substring(end);
      onChange(newValue);
      requestAnimationFrame(() => {
        const newPos = start + pastedText.length;
        textarea.selectionStart = textarea.selectionEnd = newPos;
      });
    }
  };

  const hasContent = value.trim().length > 0;

  return (
    <div className="flex flex-col gap-0">
      {/* Formatting Toolbar */}
      <div className={cn(
        "flex items-center gap-0.5 px-2 py-1 border-b border-border/50",
        "bg-muted/30 rounded-t-xl"
      )}>
        {FORMAT_ACTIONS.map((action) => {
          const { icon: Icon, label, prefix, suffix } = action;
          const isLine = 'isLinePrefix' in action ? action.isLinePrefix : false;
          return (
            <Button
              key={label}
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => applyFormat(prefix, suffix, isLine)}
              title={label}
              disabled={disabled}
            >
              <Icon className="h-3.5 w-3.5" />
            </Button>
          );
        })}

        <div className="flex-1" />
        
        {/* Preview toggle */}
        {hasContent && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
            onClick={() => setShowPreview(!showPreview)}
            title={showPreview ? 'Ocultar preview' : 'Ver preview'}
          >
            {showPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{showPreview ? 'Editar' : 'Preview'}</span>
          </Button>
        )}
      </div>

      {/* Preview area */}
      {showPreview && hasContent ? (
        <div
          className={cn(
            "whitespace-pre-wrap break-words text-sm px-3 py-2.5",
            "bg-background border-2 border-primary/20 rounded-b-xl",
            "overflow-y-auto cursor-pointer",
            isMobile ? "min-h-[80px] max-h-[200px]" : "min-h-[80px] max-h-[280px]"
          )}
          onClick={() => setShowPreview(false)}
          title="Clique para editar"
        >
          {formatWhatsAppText(value)}
        </div>
      ) : (
        /* Text input */
        <textarea
          ref={ref as React.RefObject<HTMLTextAreaElement>}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={placeholder || (isMobile ? 'Mensagem...' : 'Digite uma mensagem... (*negrito* _itálico_ ~tachado~)\nShift+Enter para nova linha')}
          disabled={disabled}
          className={cn(
            "w-full resize-none rounded-b-xl border-2 border-t-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            "bg-background px-3 py-2.5 text-sm leading-relaxed",
            "placeholder:text-muted-foreground",
            "disabled:cursor-not-allowed disabled:opacity-50",
            isMobile
              ? "min-h-[80px] max-h-[200px]"
              : "min-h-[80px] max-h-[280px]"
          )}
          rows={3}
        />
      )}
      
      {/* Character count hint for long messages */}
      {value.length > 500 && (
        <div className="flex justify-end px-2 py-0.5">
          <span className={cn(
            "text-[10px]",
            value.length > 4000 ? "text-destructive" : "text-muted-foreground"
          )}>
            {value.length} caracteres
          </span>
        </div>
      )}
    </div>
  );
}
