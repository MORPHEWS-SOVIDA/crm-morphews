import { useState, useCallback } from 'react';
import { Bold, Italic, List, ListOrdered, Heading2, Link2, Code, Eye, Code2, Undo } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}

const QUICK_TAGS = [
  { icon: Bold, tag: 'strong', label: 'Negrito' },
  { icon: Italic, tag: 'em', label: 'Itálico' },
  { icon: Heading2, tag: 'h2', label: 'Título' },
  { icon: List, tag: 'ul', label: 'Lista' },
  { icon: ListOrdered, tag: 'ol', label: 'Lista Numerada' },
  { icon: Link2, tag: 'a', label: 'Link' },
];

const HTML_SNIPPETS = [
  { 
    label: 'Destaque', 
    html: '<div class="bg-primary/10 p-4 rounded-lg border-l-4 border-primary">\n  <strong>Destaque:</strong> Seu texto aqui\n</div>' 
  },
  { 
    label: 'Lista de Benefícios', 
    html: '<ul class="space-y-2">\n  <li>✅ Benefício 1</li>\n  <li>✅ Benefício 2</li>\n  <li>✅ Benefício 3</li>\n</ul>' 
  },
  { 
    label: 'Caixa de Aviso', 
    html: '<div class="bg-amber-50 border border-amber-200 p-4 rounded-lg">\n  ⚠️ <strong>Atenção:</strong> Informação importante aqui\n</div>' 
  },
  { 
    label: 'Garantia', 
    html: '<div class="text-center p-4 bg-green-50 rounded-lg">\n  <span class="text-2xl">🛡️</span>\n  <p class="font-bold text-green-700">Garantia de 30 dias</p>\n  <p class="text-sm text-green-600">Devolução sem complicação</p>\n</div>' 
  },
  { 
    label: 'Grade 2 Colunas', 
    html: '<div class="grid grid-cols-2 gap-4">\n  <div class="p-4 bg-muted rounded-lg">\n    <strong>Coluna 1</strong>\n    <p>Conteúdo aqui</p>\n  </div>\n  <div class="p-4 bg-muted rounded-lg">\n    <strong>Coluna 2</strong>\n    <p>Conteúdo aqui</p>\n  </div>\n</div>' 
  },
];

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Digite aqui...',
  rows = 8,
  className,
}: RichTextEditorProps) {
  const [mode, setMode] = useState<'visual' | 'html'>('visual');
  const [showSnippets, setShowSnippets] = useState(false);

  const insertTag = useCallback((tag: string) => {
    const textarea = document.querySelector('[data-rich-textarea]') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    
    let newText = '';
    if (tag === 'a') {
      newText = `<a href="URL_AQUI" class="text-primary underline">${selectedText || 'Texto do link'}</a>`;
    } else if (tag === 'ul') {
      newText = `<ul class="list-disc pl-6 space-y-1">\n  <li>${selectedText || 'Item 1'}</li>\n  <li>Item 2</li>\n</ul>`;
    } else if (tag === 'ol') {
      newText = `<ol class="list-decimal pl-6 space-y-1">\n  <li>${selectedText || 'Item 1'}</li>\n  <li>Item 2</li>\n</ol>`;
    } else if (tag === 'h2') {
      newText = `<h2 class="text-xl font-bold">${selectedText || 'Título'}</h2>`;
    } else {
      newText = `<${tag}>${selectedText || 'texto'}</${tag}>`;
    }

    const before = value.substring(0, start);
    const after = value.substring(end);
    onChange(before + newText + after);
  }, [value, onChange]);

  const insertSnippet = useCallback((html: string) => {
    const textarea = document.querySelector('[data-rich-textarea]') as HTMLTextAreaElement;
    if (!textarea) {
      onChange(value + '\n\n' + html);
      return;
    }

    const start = textarea.selectionStart;
    const before = value.substring(0, start);
    const after = value.substring(start);
    onChange(before + html + '\n' + after);
    setShowSnippets(false);
  }, [value, onChange]);

  return (
    <div className={cn('border rounded-lg overflow-hidden', className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 bg-muted/50 border-b flex-wrap">
        {/* Format buttons */}
        <div className="flex items-center gap-0.5 mr-2">
          {QUICK_TAGS.map(({ icon: Icon, tag, label }) => (
            <Button
              key={tag}
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => insertTag(tag)}
              title={label}
            >
              <Icon className="h-4 w-4" />
            </Button>
          ))}
        </div>

        <div className="h-6 w-px bg-border mx-1" />

        {/* HTML Snippets */}
        <div className="relative">
          <Button
            type="button"
            variant={showSnippets ? 'secondary' : 'ghost'}
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => setShowSnippets(!showSnippets)}
          >
            <Code className="h-3.5 w-3.5" />
            Snippets
          </Button>

          {showSnippets && (
            <div className="absolute top-full left-0 mt-1 z-50 w-64 bg-popover border rounded-lg shadow-lg p-2 space-y-1">
              {HTML_SNIPPETS.map((snippet) => (
                <button
                  key={snippet.label}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors"
                  onClick={() => insertSnippet(snippet.html)}
                >
                  {snippet.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1" />

        {/* Mode toggle */}
        <Tabs value={mode} onValueChange={(v) => setMode(v as 'visual' | 'html')} className="h-8">
          <TabsList className="h-8 p-0.5">
            <TabsTrigger value="visual" className="h-7 px-2.5 text-xs gap-1.5">
              <Eye className="h-3.5 w-3.5" />
              Editor
            </TabsTrigger>
            <TabsTrigger value="html" className="h-7 px-2.5 text-xs gap-1.5">
              <Code2 className="h-3.5 w-3.5" />
              HTML
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Editor Content */}
      <div className="relative">
        {mode === 'visual' ? (
          <Textarea
            data-rich-textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={rows}
            className="border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 resize-none"
          />
        ) : (
          <Textarea
            data-rich-textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="<p>Seu HTML aqui...</p>"
            rows={rows}
            className="border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 resize-none font-mono text-sm"
          />
        )}
      </div>

      {/* Preview section */}
      {value && (
        <div className="border-t">
          <div className="px-3 py-1.5 bg-muted/30 text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Eye className="h-3 w-3" />
            Pré-visualização
          </div>
          <div 
            className="p-4 prose prose-sm max-w-none min-h-[80px] bg-white dark:bg-background"
            dangerouslySetInnerHTML={{ __html: value || '<p class="text-muted-foreground">Nenhum conteúdo ainda...</p>' }}
          />
        </div>
      )}
    </div>
  );
}
