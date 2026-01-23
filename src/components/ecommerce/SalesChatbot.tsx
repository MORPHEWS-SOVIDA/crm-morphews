import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Loader2, Bot, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface SalesChatbotProps {
  productId?: string;
  productName?: string;
  productPrice?: number;
  landingPageId?: string;
  storefrontId?: string;
  mode?: 'sales' | 'recommendations' | 'telesales';
  primaryColor?: string;
  welcomeMessage?: string;
  position?: 'bottom-right' | 'bottom-left';
  className?: string;
}

export function SalesChatbot({
  productId,
  productName,
  productPrice,
  landingPageId,
  storefrontId,
  mode = 'sales',
  primaryColor = '#000000',
  welcomeMessage = 'Olá! 👋 Como posso ajudar você hoje?',
  position = 'bottom-right',
  className,
}: SalesChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: welcomeMessage },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    let assistantContent = '';

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sales-chatbot`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: [...messages, { role: 'user', content: userMessage }],
            product: productId ? { id: productId, name: productName, price: productPrice } : undefined,
            landingPageId,
            storefrontId,
            mode,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao enviar mensagem');
      }

      if (!response.body) throw new Error('No response body');

      // Stream the response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // Add empty assistant message to start streaming into
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process SSE lines
        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') continue;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              setMessages(prev => {
                const updated = [...prev];
                const lastIdx = updated.length - 1;
                if (updated[lastIdx]?.role === 'assistant') {
                  updated[lastIdx] = { ...updated[lastIdx], content: assistantContent };
                }
                return updated;
              });
            }
          } catch {
            // Partial JSON, continue buffering
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'Desculpe, tive um problema. Posso ajudar de outra forma?',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Chat Widget Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'fixed z-50 p-4 rounded-full shadow-lg transition-all hover:scale-105',
          position === 'bottom-right' ? 'right-6 bottom-6' : 'left-6 bottom-6',
          className
        )}
        style={{ backgroundColor: primaryColor }}
      >
        {isOpen ? (
          <X className="h-6 w-6 text-white" />
        ) : (
          <MessageCircle className="h-6 w-6 text-white" />
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div
          className={cn(
            'fixed z-50 bg-background border rounded-xl shadow-2xl flex flex-col',
            'w-[360px] h-[500px] max-h-[80vh]',
            position === 'bottom-right' ? 'right-6 bottom-24' : 'left-6 bottom-24'
          )}
        >
          {/* Header */}
          <div
            className="p-4 rounded-t-xl flex items-center gap-3"
            style={{ backgroundColor: primaryColor }}
          >
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <Bot className="h-6 w-6 text-white" />
            </div>
            <div className="text-white">
              <h3 className="font-semibold">Assistente de Vendas</h3>
              <p className="text-xs opacity-80">Online • Responde em segundos</p>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea ref={scrollRef} className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'flex gap-2',
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  {msg.role === 'assistant' && (
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: primaryColor + '20' }}
                    >
                      <Bot className="h-4 w-4" style={{ color: primaryColor }} />
                    </div>
                  )}
                  <div
                    className={cn(
                      'rounded-xl px-4 py-2 max-w-[80%]',
                      msg.role === 'user'
                        ? 'text-white'
                        : 'bg-muted'
                    )}
                    style={msg.role === 'user' ? { backgroundColor: primaryColor } : undefined}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      <User className="h-4 w-4" />
                    </div>
                  )}
                </div>
              ))}
              {isLoading && messages[messages.length - 1]?.role === 'user' && (
                <div className="flex gap-2">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: primaryColor + '20' }}
                  >
                    <Loader2 className="h-4 w-4 animate-spin" style={{ color: primaryColor }} />
                  </div>
                  <div className="bg-muted rounded-xl px-4 py-2">
                    <p className="text-sm text-muted-foreground">Digitando...</p>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="p-4 border-t">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Digite sua mensagem..."
                disabled={isLoading}
                className="flex-1"
              />
              <Button
                size="icon"
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
                style={{ backgroundColor: primaryColor }}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Telesales Copilot variant with side panel
export function TelesalesCopilot({
  productId,
  productName,
  leadName,
  className,
}: {
  productId?: string;
  productName?: string;
  leadName?: string;
  className?: string;
}) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    let assistantContent = '';

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sales-chatbot`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: [...messages, { role: 'user', content: userMessage }],
            product: productId ? { id: productId, name: productName } : undefined,
            mode: 'telesales',
          }),
        }
      );

      if (!response.ok || !response.body) throw new Error('Request failed');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') continue;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: 'assistant', content: assistantContent };
                return updated;
              });
            }
          } catch {
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }
    } catch (error) {
      console.error('Copilot error:', error);
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Erro ao processar. Tente novamente.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn('flex flex-col h-full border rounded-lg', className)}>
      <div className="p-3 border-b bg-muted/30">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Bot className="h-4 w-4" />
          Copiloto IA
        </h3>
        {productName && (
          <p className="text-xs text-muted-foreground mt-1">Produto: {productName}</p>
        )}
      </div>

      <ScrollArea ref={scrollRef} className="flex-1 p-3">
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-8">
            <p>💡 Pergunte sobre:</p>
            <ul className="mt-2 space-y-1">
              <li>• Argumentos de venda</li>
              <li>• Objeções do cliente</li>
              <li>• Ofertas e descontos</li>
            </ul>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={cn(
                  'rounded-lg px-3 py-2 text-sm',
                  msg.role === 'user' ? 'bg-primary text-primary-foreground ml-4' : 'bg-muted mr-4'
                )}
              >
                {msg.content}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      <div className="p-3 border-t">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Pergunte ao copiloto..."
            disabled={isLoading}
            className="text-sm"
          />
          <Button size="sm" onClick={sendMessage} disabled={!input.trim() || isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
