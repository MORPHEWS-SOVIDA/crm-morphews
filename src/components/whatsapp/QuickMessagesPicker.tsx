import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Zap, Loader2, Mic, ImageIcon, FileText, Send } from "lucide-react";
import { useQuickMessages, QuickMessage } from "@/hooks/useQuickMessages";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface QuickMessagesPickerProps {
  onSelectText: (text: string) => void;
  onSelectMedia: (msg: QuickMessage) => void;
  disabled?: boolean;
}

export function QuickMessagesPicker({ onSelectText, onSelectMedia, disabled }: QuickMessagesPickerProps) {
  const { data: messages, isLoading } = useQuickMessages();
  const [open, setOpen] = useState(false);

  const handleSelect = (msg: QuickMessage) => {
    // If has media, send as media; if text only, insert text
    if (msg.media_type && msg.media_url) {
      onSelectMedia(msg);
    } else if (msg.message_text) {
      onSelectText(msg.message_text);
    }
    setOpen(false);
  };

  if (!messages?.length && !isLoading) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10"
          disabled={disabled}
          title="Mensagens rápidas"
        >
          <Zap className="h-5 w-5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start" side="top">
        <div className="px-3 py-2 border-b">
          <h4 className="font-medium text-sm">Mensagens Rápidas</h4>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <ScrollArea className="max-h-64">
            <div className="p-1">
              {messages?.map((msg) => (
                <button
                  key={msg.id}
                  onClick={() => handleSelect(msg)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-md hover:bg-accent transition-colors",
                    "flex items-center gap-2"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium truncate">{msg.title}</span>
                      {msg.media_type === "audio" && <Mic className="h-3 w-3 text-muted-foreground shrink-0" />}
                      {msg.media_type === "image" && <ImageIcon className="h-3 w-3 text-muted-foreground shrink-0" />}
                      {msg.media_type === "document" && <FileText className="h-3 w-3 text-muted-foreground shrink-0" />}
                    </div>
                    {msg.message_text && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{msg.message_text.substring(0, 60)}</p>
                    )}
                  </div>
                  <Send className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
