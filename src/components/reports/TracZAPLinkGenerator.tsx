import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenantId } from '@/hooks/useTenant';
import { QRCodeSVG } from 'qrcode.react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Link2, 
  Plus, 
  Copy, 
  QrCode, 
  ExternalLink, 
  Trash2, 
  MousePointer,
  Users,
  ShoppingCart,
  Download,
} from 'lucide-react';
import { toast } from 'sonner';

interface TracZAPLink {
  id: string;
  name: string;
  slug: string;
  whatsapp_number: string;
  default_message: string | null;
  utm_source: string;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  is_active: boolean;
  clicks_count: number;
  leads_count: number;
  sales_count: number;
  created_at: string;
}

function useTracZAPLinks() {
  const { data: tenantId } = useCurrentTenantId();
  
  return useQuery({
    queryKey: ['traczap-links', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      if (!tenantId) return [];
      
      const { data, error } = await (supabase
        .from('traczap_links' as any)
        .select('*')
        .eq('organization_id', tenantId)
        .order('created_at', { ascending: false }) as any);
      
      if (error) throw error;
      return (data || []) as TracZAPLink[];
    },
  });
}

function useCreateTracZAPLink() {
  const queryClient = useQueryClient();
  const { data: tenantId } = useCurrentTenantId();
  
  return useMutation({
    mutationFn: async (link: Partial<TracZAPLink>) => {
      if (!tenantId) throw new Error('Tenant not found');
      
      const { data, error } = await (supabase
        .from('traczap_links' as any)
        .insert({
          organization_id: tenantId,
          name: link.name,
          slug: link.slug,
          whatsapp_number: link.whatsapp_number,
          default_message: link.default_message,
          utm_source: link.utm_source || 'whatsapp',
          utm_medium: link.utm_medium || 'link',
          utm_campaign: link.utm_campaign,
          utm_content: link.utm_content,
        })
        .select()
        .single() as any);
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['traczap-links'] });
      toast.success('Link criado com sucesso!');
    },
    onError: (error: any) => {
      if (error.message?.includes('duplicate')) {
        toast.error('Slug já existe. Escolha outro nome curto.');
      } else {
        toast.error('Erro ao criar link');
      }
    },
  });
}

function useDeleteTracZAPLink() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await (supabase
        .from('traczap_links' as any)
        .delete()
        .eq('id', linkId) as any);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['traczap-links'] });
      toast.success('Link removido');
    },
    onError: () => {
      toast.error('Erro ao remover link');
    },
  });
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 20);
}

function buildWhatsAppLink(link: TracZAPLink): string {
  const phone = link.whatsapp_number.replace(/\D/g, '');
  const params = new URLSearchParams();
  
  // Build message with UTM info embedded
  let message = link.default_message || '';
  
  // Append tracking params as a hidden reference (for attribution when lead is created)
  const trackingRef = `[ref:${link.slug}]`;
  
  if (message) {
    params.set('text', message);
  }
  
  return `https://wa.me/${phone}${params.toString() ? '?' + params.toString() : ''}`;
}

function LinkCreatorDialog({ 
  open, 
  onOpenChange 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [message, setMessage] = useState('');
  const [utmSource, setUtmSource] = useState('whatsapp');
  const [utmMedium, setUtmMedium] = useState('link');
  const [utmCampaign, setUtmCampaign] = useState('');
  const [utmContent, setUtmContent] = useState('');
  
  const createLink = useCreateTracZAPLink();
  
  const handleNameChange = (value: string) => {
    setName(value);
    if (!slug || slug === generateSlug(name)) {
      setSlug(generateSlug(value));
    }
  };
  
  const handleSubmit = () => {
    if (!name || !whatsappNumber) {
      toast.error('Preencha nome e número do WhatsApp');
      return;
    }
    
    createLink.mutate({
      name,
      slug: slug || generateSlug(name),
      whatsapp_number: whatsappNumber,
      default_message: message || null,
      utm_source: utmSource,
      utm_medium: utmMedium || null,
      utm_campaign: utmCampaign || null,
      utm_content: utmContent || null,
    }, {
      onSuccess: () => {
        onOpenChange(false);
        // Reset form
        setName('');
        setSlug('');
        setWhatsappNumber('');
        setMessage('');
        setUtmCampaign('');
        setUtmContent('');
      },
    });
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Novo Link Rastreável
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome do Link *</Label>
              <Input 
                placeholder="Ex: Instagram Bio"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Slug (URL curta)</Label>
              <Input 
                placeholder="instagram-bio"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>Número WhatsApp *</Label>
            <Input 
              placeholder="5551999999999"
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value.replace(/\D/g, ''))}
            />
            <p className="text-xs text-muted-foreground">
              Formato: código do país + DDD + número (ex: 5551999999999)
            </p>
          </div>
          
          <div className="space-y-2">
            <Label>Mensagem Padrão</Label>
            <Textarea 
              placeholder="Olá! Vi seu link e gostaria de saber mais..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
            />
          </div>
          
          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <p className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-3">
              Parâmetros UTM (Rastreamento)
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">utm_source</Label>
                <Input 
                  placeholder="whatsapp"
                  value={utmSource}
                  onChange={(e) => setUtmSource(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">utm_medium</Label>
                <Input 
                  placeholder="link"
                  value={utmMedium}
                  onChange={(e) => setUtmMedium(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">utm_campaign</Label>
                <Input 
                  placeholder="black-friday"
                  value={utmCampaign}
                  onChange={(e) => setUtmCampaign(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">utm_content</Label>
                <Input 
                  placeholder="bio-link"
                  value={utmContent}
                  onChange={(e) => setUtmContent(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={createLink.isPending}>
            {createLink.isPending ? 'Criando...' : 'Criar Link'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QRCodeDialog({ 
  link, 
  open, 
  onOpenChange 
}: { 
  link: TracZAPLink | null;
  open: boolean; 
  onOpenChange: (open: boolean) => void;
}) {
  if (!link) return null;
  
  const waLink = buildWhatsAppLink(link);
  
  const downloadQR = () => {
    const canvas = document.getElementById('traczap-qr-canvas') as HTMLCanvasElement;
    if (canvas) {
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `qr-${link.slug}.png`;
      a.click();
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            QR Code - {link.name}
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="p-4 bg-white rounded-lg">
            <QRCodeSVG 
              id="traczap-qr-canvas"
              value={waLink}
              size={200}
              level="H"
              includeMargin
            />
          </div>
          
          <p className="text-sm text-muted-foreground text-center">
            Escaneie o QR Code para abrir o WhatsApp com a mensagem pré-definida
          </p>
          
          <div className="flex gap-2 w-full">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => {
                navigator.clipboard.writeText(waLink);
                toast.success('Link copiado!');
              }}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copiar Link
            </Button>
            <Button onClick={downloadQR}>
              <Download className="h-4 w-4 mr-2" />
              Baixar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function TracZAPLinkGenerator() {
  const [showCreator, setShowCreator] = useState(false);
  const [qrLink, setQrLink] = useState<TracZAPLink | null>(null);
  
  const { data: links, isLoading } = useTracZAPLinks();
  const deleteLink = useDeleteTracZAPLink();
  
  const copyLink = (link: TracZAPLink) => {
    const waLink = buildWhatsAppLink(link);
    navigator.clipboard.writeText(waLink);
    toast.success('Link copiado!');
  };
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Links Rastreáveis
          </h3>
          <p className="text-sm text-muted-foreground">
            Crie links de WhatsApp com UTMs para rastrear origens de leads
          </p>
        </div>
        <Button onClick={() => setShowCreator(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Link
        </Button>
      </div>
      
      {/* Links List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : links && links.length > 0 ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>UTMs</TableHead>
                <TableHead className="text-center">Cliques</TableHead>
                <TableHead className="text-center">Leads</TableHead>
                <TableHead className="text-center">Vendas</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {links.map((link) => (
                <TableRow key={link.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{link.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        /{link.slug}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline" className="text-xs">
                        {link.utm_source}
                      </Badge>
                      {link.utm_campaign && (
                        <Badge variant="secondary" className="text-xs">
                          {link.utm_campaign}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <MousePointer className="h-3 w-3 text-muted-foreground" />
                      <span>{link.clicks_count}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Users className="h-3 w-3 text-muted-foreground" />
                      <span>{link.leads_count}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <ShoppingCart className="h-3 w-3 text-muted-foreground" />
                      <span>{link.sales_count}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => copyLink(link)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => setQrLink(link)}
                      >
                        <QrCode className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => window.open(buildWhatsAppLink(link), '_blank')}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => deleteLink.mutate(link.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Link2 className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Nenhum link criado</h3>
            <p className="text-muted-foreground text-center max-w-md mb-4">
              Crie links de WhatsApp rastreáveis para saber exatamente de onde 
              vêm seus leads - Instagram, Facebook, cartões de visita, etc.
            </p>
            <Button onClick={() => setShowCreator(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Primeiro Link
            </Button>
          </CardContent>
        </Card>
      )}
      
      {/* Dialogs */}
      <LinkCreatorDialog open={showCreator} onOpenChange={setShowCreator} />
      <QRCodeDialog link={qrLink} open={!!qrLink} onOpenChange={() => setQrLink(null)} />
    </div>
  );
}
