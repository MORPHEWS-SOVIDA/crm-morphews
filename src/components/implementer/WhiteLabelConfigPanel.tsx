import { useState, useEffect } from 'react';
import { Palette, Globe, Mail, Image, Sparkles, Lock, ExternalLink, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  useWhiteLabelConfig,
  useCreateWhiteLabelConfig,
  useUpdateWhiteLabelConfig,
  useCheckSlugAvailability,
  useHasWhiteLabelPlan,
} from '@/hooks/useWhiteLabel';
import type { Implementer } from '@/hooks/useImplementer';

interface WhiteLabelConfigPanelProps {
  implementer: Implementer;
}

export function WhiteLabelConfigPanel({ implementer }: WhiteLabelConfigPanelProps) {
  const { data: config, isLoading } = useWhiteLabelConfig(implementer.id);
  const { data: hasWhiteLabelPlan } = useHasWhiteLabelPlan(implementer.organization_id);
  const createConfig = useCreateWhiteLabelConfig();
  const updateConfig = useUpdateWhiteLabelConfig();
  const checkSlug = useCheckSlugAvailability();
  
  const [formData, setFormData] = useState({
    brand_name: '',
    logo_url: '',
    favicon_url: '',
    primary_color: '#8B5CF6',
    secondary_color: '#ffffff',
    sales_page_slug: '',
    email_from_name: '',
    email_logo_url: '',
    support_email: '',
    support_whatsapp: '',
  });
  
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');

  useEffect(() => {
    if (config) {
      setFormData({
        brand_name: config.brand_name || '',
        logo_url: config.logo_url || '',
        favicon_url: config.favicon_url || '',
        primary_color: config.primary_color || '#8B5CF6',
        secondary_color: config.secondary_color || '#ffffff',
        sales_page_slug: config.sales_page_slug || '',
        email_from_name: config.email_from_name || '',
        email_logo_url: config.email_logo_url || '',
        support_email: config.support_email || '',
        support_whatsapp: config.support_whatsapp || '',
      });
    }
  }, [config]);

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const handleBrandNameChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      brand_name: value,
      sales_page_slug: prev.sales_page_slug || generateSlug(value),
    }));
  };

  const handleSlugChange = async (slug: string) => {
    const normalized = generateSlug(slug);
    setFormData(prev => ({ ...prev, sales_page_slug: normalized }));
    
    if (normalized && normalized !== config?.sales_page_slug) {
      setSlugStatus('checking');
      try {
        const available = await checkSlug.mutateAsync(normalized);
        setSlugStatus(available ? 'available' : 'taken');
      } catch {
        setSlugStatus('idle');
      }
    } else {
      setSlugStatus('idle');
    }
  };

  const handleSubmit = async () => {
    if (!formData.brand_name || !formData.sales_page_slug) {
      toast.error('Preencha o nome da marca e o slug');
      return;
    }

    if (slugStatus === 'taken') {
      toast.error('Este slug já está em uso');
      return;
    }

    if (config) {
      await updateConfig.mutateAsync({
        configId: config.id,
        updates: formData,
      });
    } else {
      await createConfig.mutateAsync({
        implementer_id: implementer.id,
        ...formData,
      });
    }
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/${formData.sales_page_slug}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copiado!');
  };

  // Show upgrade card if no white label plan
  if (!hasWhiteLabelPlan && !isLoading) {
    return (
      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Sparkles className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-xl font-bold mb-2">White Label</h3>
            <p className="text-muted-foreground mb-4 max-w-md mx-auto">
              Tenha sua própria marca! Site de vendas, checkout e e-mails personalizados 
              com seu logo e cores.
            </p>
            <div className="bg-muted/50 rounded-lg p-4 mb-6 max-w-sm mx-auto">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm">Plano atual:</span>
                <Badge variant="secondary">Implementador</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Para desbloquear:</span>
                <Badge className="bg-gradient-to-r from-purple-500 to-pink-500">
                  Implementador White Label
                </Badge>
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-4">
              <Lock className="h-4 w-4" />
              <span>R$ 497/mês + comissões</span>
            </div>
            <Button disabled>
              <Sparkles className="h-4 w-4 mr-2" />
              Em breve: Fazer Upgrade
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Active Config Banner */}
      {config && config.is_active && (
        <Card className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-purple-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {config.logo_url ? (
                  <img src={config.logo_url} alt={config.brand_name} className="h-10 w-10 rounded-lg object-contain" />
                ) : (
                  <div 
                    className="h-10 w-10 rounded-lg flex items-center justify-center text-white font-bold"
                    style={{ backgroundColor: config.primary_color }}
                  >
                    {config.brand_name.charAt(0)}
                  </div>
                )}
                <div>
                  <h3 className="font-semibold">{config.brand_name}</h3>
                  <p className="text-sm text-muted-foreground">White Label ativo</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleCopyLink}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar Link
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => window.open(`/${config.sales_page_slug}`, '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Ver Página
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Branding Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Identidade Visual
          </CardTitle>
          <CardDescription>
            Configure o nome, logo e cores da sua marca
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="brand_name">Nome da Marca *</Label>
              <Input
                id="brand_name"
                value={formData.brand_name}
                onChange={(e) => handleBrandNameChange(e.target.value)}
                placeholder="ATOMICsales"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sales_page_slug">Slug da Página *</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground whitespace-nowrap">/pv2/</span>
                <Input
                  id="sales_page_slug"
                  value={formData.sales_page_slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  placeholder="atomicsales"
                  className={
                    slugStatus === 'available' ? 'border-green-500' :
                    slugStatus === 'taken' ? 'border-destructive' : ''
                  }
                />
              </div>
              {slugStatus === 'checking' && (
                <p className="text-xs text-muted-foreground">Verificando...</p>
              )}
              {slugStatus === 'available' && (
                <p className="text-xs text-green-600">✓ Disponível</p>
              )}
              {slugStatus === 'taken' && (
                <p className="text-xs text-destructive">✗ Já em uso</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="logo_url">URL do Logo</Label>
              <Input
                id="logo_url"
                value={formData.logo_url}
                onChange={(e) => setFormData(prev => ({ ...prev, logo_url: e.target.value }))}
                placeholder="https://..."
              />
              {formData.logo_url && (
                <img src={formData.logo_url} alt="Logo preview" className="h-10 object-contain" />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="favicon_url">URL do Favicon</Label>
              <Input
                id="favicon_url"
                value={formData.favicon_url}
                onChange={(e) => setFormData(prev => ({ ...prev, favicon_url: e.target.value }))}
                placeholder="https://..."
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="primary_color">Cor Primária</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={formData.primary_color}
                  onChange={(e) => setFormData(prev => ({ ...prev, primary_color: e.target.value }))}
                  className="h-10 w-20 rounded border cursor-pointer"
                />
                <Input
                  value={formData.primary_color}
                  onChange={(e) => setFormData(prev => ({ ...prev, primary_color: e.target.value }))}
                  className="flex-1"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="secondary_color">Cor Secundária</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={formData.secondary_color}
                  onChange={(e) => setFormData(prev => ({ ...prev, secondary_color: e.target.value }))}
                  className="h-10 w-20 rounded border cursor-pointer"
                />
                <Input
                  value={formData.secondary_color}
                  onChange={(e) => setFormData(prev => ({ ...prev, secondary_color: e.target.value }))}
                  className="flex-1"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact & Support */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Contato & Suporte
          </CardTitle>
          <CardDescription>
            Configure os dados de contato que aparecerão para seus clientes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email_from_name">Nome nos E-mails</Label>
              <Input
                id="email_from_name"
                value={formData.email_from_name}
                onChange={(e) => setFormData(prev => ({ ...prev, email_from_name: e.target.value }))}
                placeholder="ATOMICsales"
              />
              <p className="text-xs text-muted-foreground">
                Aparece como remetente: "{formData.email_from_name || 'Sua Marca'}"
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email_logo_url">Logo nos E-mails</Label>
              <Input
                id="email_logo_url"
                value={formData.email_logo_url}
                onChange={(e) => setFormData(prev => ({ ...prev, email_logo_url: e.target.value }))}
                placeholder="https://..."
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="support_email">E-mail de Suporte</Label>
              <Input
                id="support_email"
                type="email"
                value={formData.support_email}
                onChange={(e) => setFormData(prev => ({ ...prev, support_email: e.target.value }))}
                placeholder="suporte@suamarca.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="support_whatsapp">WhatsApp de Suporte</Label>
              <Input
                id="support_whatsapp"
                value={formData.support_whatsapp}
                onChange={(e) => setFormData(prev => ({ ...prev, support_whatsapp: e.target.value }))}
                placeholder="5511999999999"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button 
          onClick={handleSubmit}
          disabled={createConfig.isPending || updateConfig.isPending}
        >
          {(createConfig.isPending || updateConfig.isPending) ? (
            'Salvando...'
          ) : config ? (
            'Salvar Alterações'
          ) : (
            'Ativar White Label'
          )}
        </Button>
      </div>
    </div>
  );
}
