import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Send, Loader2, Eye, Code, Smartphone, Monitor, Save, ExternalLink, Sparkles, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import { LandingImageUpload } from '@/components/ecommerce/landing/LandingImageUpload';

// URL detection regex
const URL_REGEX = /https?:\/\/[^\s]+\.(app|com|com\.br|net|org|io|dev)[^\s]*/gi;
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

const INITIAL_SYSTEM_PROMPT = `Você é um expert em criação de landing pages de alta conversão. Seu trabalho é construir landing pages incríveis para vender produtos.

REGRAS IMPORTANTES:
1. Sempre responda em português brasileiro
2. Gere HTML/CSS completo e responsivo quando pedido
3. Use Tailwind CSS inline para estilização
4. Crie designs modernos, profissionais e de alta conversão
5. Quando o usuário pedir para criar a landing page, gere o HTML completo entre as tags <landing-html> e </landing-html>
6. Para botões de compra/CTA, SEMPRE use links internos no formato "/pay/[slug]" (ex: /pay/meu-produto). NUNCA mencione ou sugira checkouts externos como Kiwify, Hotmart, Eduzz, Monetizze, PagSeguro ou qualquer outro gateway externo.
7. Pergunte sobre: produto, público-alvo, benefícios, diferenciais, garantia, urgência
8. Use técnicas de copywriting persuasivo: headlines impactantes, bullet points de benefícios, prova social, escassez

Comece perguntando sobre o produto que o usuário quer vender.`;

const CLONE_SYSTEM_PROMPT = `Você é um especialista em replicar landing pages com fidelidade EXATA.

REGRAS CRÍTICAS PARA CLONAGEM:
1. Você receberá o HTML REAL do site original capturado via scraping
2. Seu trabalho é MANTER esse HTML o mais fiel possível, apenas fazendo ajustes mínimos necessários
3. NÃO mude cores, fontes, estrutura, layout ou design - eles já estão corretos no HTML original
4. NÃO invente conteúdo novo - use EXATAMENTE o que está no HTML original
5. Apenas ajuste:
   - Links de checkout para usar "/pay/[slug]"
   - Remova scripts de terceiros problemáticos
   - Converta URLs de imagens para absolutas se necessário
6. Retorne o HTML entre <landing-html> e </landing-html>
7. Se precisar de algum ajuste, pergunte ao usuário

O HTML capturado do site original será fornecido. Preserve-o fielmente.`;

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/landing-chat-builder`;

export default function LandingChatBuilder() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const { toast } = useToast();
  const { tenantId } = useTenant();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [htmlPreview, setHtmlPreview] = useState<string>('');
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');
  const [deviceMode, setDeviceMode] = useState<'desktop' | 'mobile'>('desktop');
  const [landingPageId, setLandingPageId] = useState<string | null>(id || null);
  const [landingSlug, setLandingSlug] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isCloneMode, setIsCloneMode] = useState(false);
  const [scrapedHtml, setScrapedHtml] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Initialize with welcome message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: `Olá! 👋 Sou sua assistente de criação de landing pages.

Vou te ajudar a construir uma página de vendas incrível, passo a passo. Juntos vamos criar:
- Headlines que prendem atenção
- Benefícios irresistíveis  
- Seções de prova social
- CTAs que convertem

**Para começar, me conta: qual produto você quer vender?**

Pode me passar o nome, uma breve descrição e, se tiver, o link do checkout (ex: \`/pay/seu-produto\`).`,
          timestamp: new Date(),
        }
      ]);
    }
  }, [messages.length]);

  // Load existing landing page if editing
  useEffect(() => {
    if (id) {
      loadLandingPage(id);
    }
  }, [id]);

  const loadLandingPage = async (pageId: string) => {
    try {
      const { data, error } = await supabase
        .from('landing_pages')
        .select('*')
        .eq('id', pageId)
        .single();

      if (error) throw error;

      if (data?.full_html) {
        setHtmlPreview(data.full_html);
      }
      if (data?.slug) {
        setLandingSlug(data.slug);
      }

      // Add context message
      setMessages(prev => [
        ...prev,
        {
          id: 'loaded',
          role: 'assistant',
          content: `Carreguei a landing page "${data.name}". O que você gostaria de modificar?`,
          timestamp: new Date(),
        }
      ]);
    } catch (error) {
      console.error('Error loading landing page:', error);
    }
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Extract HTML from AI response
  const extractHtmlFromResponse = useCallback((content: string): string | null => {
    const match = content.match(/<landing-html>([\s\S]*?)<\/landing-html>/);
    if (match) {
      return match[1].trim();
    }
    return null;
  }, []);

  // Detect if message contains a URL to clone
  const detectCloneUrl = (text: string): string | null => {
    const urls = text.match(URL_REGEX);
    if (urls && urls.length > 0) {
      // Check if it's a clone request
      const cloneKeywords = ['clone', 'clon', 'recri', 'igual', 'copi', 'replica', 'mesmo', 'site'];
      const lowerText = text.toLowerCase();
      const isCloneRequest = cloneKeywords.some(kw => lowerText.includes(kw));
      if (isCloneRequest || urls[0].includes('.lovable.app') || urls[0].includes('.vercel.app')) {
        return urls[0].replace(/[.,;!?]+$/, ''); // Clean trailing punctuation
      }
    }
    return null;
  };

  // Scrape a URL to get its HTML
  const scrapeUrl = async (url: string): Promise<string | null> => {
    setIsScraping(true);
    try {
      const { data, error } = await supabase.functions.invoke('scrape-landing-page', {
        body: { url },
      });
      
      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Erro ao acessar o site');
      
      return data.full_html || null;
    } catch (error) {
      console.error('Scrape error:', error);
      toast({
        title: 'Erro ao acessar site',
        description: error instanceof Error ? error.message : 'Não foi possível capturar o HTML do site',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsScraping(false);
    }
  };

  // Stream chat with AI
  const sendMessage = async () => {
    if (!input.trim() || isLoading || isScraping) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');

    // Check if this is a clone request with a URL
    const cloneUrl = detectCloneUrl(userMessage.content);
    let capturedHtml: string | null = null;
    
    if (cloneUrl) {
      // Add status message
      const scrapingMsgId = `scraping-${Date.now()}`;
      setMessages(prev => [...prev, {
        id: scrapingMsgId,
        role: 'assistant',
        content: `🔍 Capturando o HTML do site ${cloneUrl}...\n\nIsso pode levar alguns segundos.`,
        timestamp: new Date(),
      }]);
      
      capturedHtml = await scrapeUrl(cloneUrl);
      
      if (capturedHtml) {
        setScrapedHtml(capturedHtml);
        setIsCloneMode(true);
        // Update the message
        setMessages(prev => prev.map(m => 
          m.id === scrapingMsgId 
            ? { ...m, content: `✅ HTML capturado com sucesso! (${Math.round(capturedHtml!.length / 1024)}KB)\n\nProcessando para criar sua landing page...` }
            : m
        ));
      } else {
        setMessages(prev => prev.map(m => 
          m.id === scrapingMsgId 
            ? { ...m, content: `❌ Não foi possível capturar o HTML do site. Vou tentar criar uma versão baseada no que você descreveu.` }
            : m
        ));
      }
    }

    setIsLoading(true);

    // Prepare messages for API - use different prompts for clone vs create
    const systemPrompt = capturedHtml ? CLONE_SYSTEM_PROMPT : (isCloneMode && scrapedHtml ? CLONE_SYSTEM_PROMPT : INITIAL_SYSTEM_PROMPT);
    
    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.filter(m => m.role !== 'system' && !m.id.startsWith('scraping-')).map(m => ({
        role: m.role,
        content: m.content,
      })),
      { role: 'user', content: userMessage.content },
    ];

    // If we have scraped HTML, add it as context
    const htmlContext = capturedHtml || scrapedHtml;
    if (htmlContext && (capturedHtml || isCloneMode)) {
      apiMessages.push({
        role: 'system',
        content: `HTML ORIGINAL CAPTURADO DO SITE (mantenha-o fielmente):\n\n${htmlContext.slice(0, 100000)}`,
      });
    } else if (htmlPreview) {
      // Add current HTML context if exists
      apiMessages.push({
        role: 'system',
        content: `HTML atual da landing page:\n<current-html>${htmlPreview}</current-html>\n\nQuando o usuário pedir modificações, retorne o HTML completo atualizado entre <landing-html> tags.`,
      });
    }

    let assistantContent = '';

    try {
      const response = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Muitas requisições. Aguarde um momento e tente novamente.');
        }
        if (response.status === 402) {
          throw new Error('Créditos de IA esgotados. Adicione mais créditos.');
        }
        throw new Error('Erro ao conectar com a IA');
      }

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // Create assistant message placeholder
      const assistantId = `assistant-${Date.now()}`;
      setMessages(prev => [
        ...prev,
        {
          id: assistantId,
          role: 'assistant',
          content: '',
          timestamp: new Date(),
        }
      ]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              setMessages(prev =>
                prev.map(m =>
                  m.id === assistantId
                    ? { ...m, content: assistantContent }
                    : m
                )
              );
            }
          } catch {
            // Incomplete JSON, put back and wait
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }

      // Extract and update HTML preview
      const extractedHtml = extractHtmlFromResponse(assistantContent);
      if (extractedHtml) {
        setHtmlPreview(extractedHtml);
      } else if (capturedHtml && !extractedHtml) {
        // If clone mode but AI didn't return HTML, use the captured HTML directly
        setHtmlPreview(capturedHtml);
        setMessages(prev => [...prev, {
          id: `auto-${Date.now()}`,
          role: 'assistant',
          content: '✅ Usando o HTML original capturado diretamente. Posso fazer ajustes se você precisar!',
          timestamp: new Date(),
        }]);
      }

    } catch (error) {
      console.error('Chat error:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao processar mensagem',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Save landing page
  const saveLandingPage = async () => {
    if (!htmlPreview || !tenantId) {
      toast({
        title: 'Erro',
        description: 'Gere uma landing page primeiro antes de salvar.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);

    try {
      if (landingPageId) {
        // Update existing
        const { error } = await supabase
          .from('landing_pages')
          .update({
            full_html: htmlPreview,
            import_mode: 'full_html',
            updated_at: new Date().toISOString(),
          })
          .eq('id', landingPageId);

        if (error) throw error;

        toast({
          title: 'Salvo!',
          description: 'Landing page atualizada com sucesso.',
        });
      } else {
        // Create new - prompt for name
        const name = prompt('Nome da landing page:');
        if (!name) return;

        const slug = name
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '')
          + '-' + Math.random().toString(36).substring(2, 6);

        const { data, error } = await supabase
          .from('landing_pages')
          .insert({
            organization_id: tenantId,
            name,
            slug,
            full_html: htmlPreview,
            import_mode: 'full_html',
            is_active: true,
          })
          .select('id, slug')
          .single();

        if (error) throw error;

        setLandingPageId(data.id);
        setLandingSlug(data.slug);
        
        toast({
          title: 'Criado!',
          description: 'Landing page criada com sucesso.',
        });

        // Update URL without reloading
        window.history.replaceState(null, '', `/ecommerce/landing-builder/${data.id}`);
      }
    } catch (error) {
      console.error('Save error:', error);
      toast({
        title: 'Erro ao salvar',
        description: error instanceof Error ? error.message : 'Tente novamente',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Clean content for display (remove HTML tags for markdown)
  const cleanContentForDisplay = (content: string): string => {
    // Remove the landing-html block for display purposes
    return content.replace(/<landing-html>[\s\S]*?<\/landing-html>/g, '\n\n✅ *HTML da landing page atualizado no preview* →\n\n');
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b bg-card">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/ecommerce/landings')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Landing Page Builder</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Device Toggle */}
          <Tabs value={deviceMode} onValueChange={(v) => setDeviceMode(v as 'desktop' | 'mobile')}>
            <TabsList className="h-8">
              <TabsTrigger value="desktop" className="h-7 px-2">
                <Monitor className="h-4 w-4" />
              </TabsTrigger>
              <TabsTrigger value="mobile" className="h-7 px-2">
                <Smartphone className="h-4 w-4" />
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* View Toggle */}
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'preview' | 'code')}>
            <TabsList className="h-8">
              <TabsTrigger value="preview" className="h-7 px-2">
                <Eye className="h-4 w-4 mr-1" />
                Preview
              </TabsTrigger>
              <TabsTrigger value="code" className="h-7 px-2">
                <Code className="h-4 w-4 mr-1" />
                Código
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Actions */}
          <Button
            variant="outline"
            size="sm"
            onClick={saveLandingPage}
            disabled={isSaving || !htmlPreview}
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
            Salvar
          </Button>

          {landingSlug && (
            <Button variant="outline" size="sm" asChild>
              <a href={`/lp/${landingSlug}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-1" />
                Abrir
              </a>
            </Button>
          )}
        </div>
      </header>

      {/* Main Content - Split View */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat Panel */}
        <div className="w-[420px] flex flex-col border-r bg-muted/30">
          {/* Messages */}
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    'flex',
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  <div
                    className={cn(
                      'max-w-[90%] rounded-lg px-4 py-2.5 text-sm',
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-card border'
                    )}
                  >
                    {message.role === 'assistant' ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown>
                          {cleanContentForDisplay(message.content)}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && messages[messages.length - 1]?.role === 'user' && (
                <div className="flex justify-start">
                  <div className="bg-card border rounded-lg px-4 py-2.5">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="p-4 border-t bg-card">
            <div className="flex gap-2">
              <div className="flex items-end">
                <LandingImageUpload 
                  onImageUploaded={(url) => {
                    setInput(prev => prev + (prev ? '\n' : '') + `Use esta imagem: ${url}`);
                    textareaRef.current?.focus();
                  }}
                  disabled={isLoading || isScraping}
                />
              </div>
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Descreva o que quer criar ou cole uma URL para clonar..."
                className="min-h-[80px] resize-none"
                disabled={isLoading || isScraping}
              />
              <Button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading || isScraping}
                className="self-end"
              >
                {isScraping ? (
                  <Link2 className="h-4 w-4 animate-pulse" />
                ) : isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              📷 Imagens • 🔗 Cole uma URL para clonar sites • /pay/produto para CTAs
            </p>
          </div>
        </div>

        {/* Preview Panel */}
        <div className="flex-1 bg-muted/50 flex items-center justify-center p-4 overflow-auto">
          {viewMode === 'preview' ? (
            htmlPreview ? (
              <div
                className={cn(
                  'bg-white rounded-lg shadow-lg overflow-hidden transition-all',
                  deviceMode === 'mobile' ? 'w-[390px] h-[844px]' : 'w-full h-full max-w-[1200px]'
                )}
              >
                <iframe
                  srcDoc={`
                    <!DOCTYPE html>
                    <html>
                    <head>
                      <meta charset="UTF-8">
                      <meta name="viewport" content="width=device-width, initial-scale=1.0">
                      <script src="https://cdn.tailwindcss.com"></script>
                      <style>
                        body { margin: 0; font-family: system-ui, -apple-system, sans-serif; }
                      </style>
                    </head>
                    <body>
                      ${htmlPreview}
                    </body>
                    </html>
                  `}
                  className="w-full h-full border-0"
                  title="Landing Page Preview"
                />
              </div>
            ) : (
              <div className="text-center text-muted-foreground">
                <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Sua landing page aparecerá aqui</p>
                <p className="text-sm">Converse com a IA no chat para criar sua página</p>
              </div>
            )
          ) : (
            <div className="w-full h-full">
              <Textarea
                value={htmlPreview}
                onChange={(e) => setHtmlPreview(e.target.value)}
                className="w-full h-full font-mono text-xs resize-none"
                placeholder="O código HTML da landing page aparecerá aqui..."
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
