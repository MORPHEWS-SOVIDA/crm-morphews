import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useMyWhiteLabelConfig } from '@/hooks/useWhiteAdmin';
import { useUpdateWhiteLabelConfig } from '@/hooks/useWhiteLabel';
import { Palette, Upload, Globe, Mail, Phone, FileText, Save, CheckCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export function WhiteAdminBranding() {
  const { data: wlData, refetch } = useMyWhiteLabelConfig();
  const config = wlData?.white_label_configs;
  const updateConfig = useUpdateWhiteLabelConfig();
  
  const [formData, setFormData] = useState({
    brand_name: config?.brand_name || '',
    logo_url: config?.logo_url || '',
    favicon_url: config?.favicon_url || '',
    primary_color: config?.primary_color || '#8B5CF6',
    secondary_color: config?.secondary_color || '#ffffff',
    sales_page_slug: config?.sales_page_slug || '',
    app_domain: config?.app_domain || '',
    checkout_domain: config?.checkout_domain || '',
    email_from_name: config?.email_from_name || '',
    email_logo_url: config?.email_logo_url || '',
    support_email: config?.support_email || '',
    support_whatsapp: config?.support_whatsapp || '',
    support_phone: config?.support_phone || '',
    terms_url: config?.terms_url || '',
    privacy_url: config?.privacy_url || '',
    login_background_url: config?.login_background_url || '',
    dashboard_welcome_message: config?.dashboard_welcome_message || '',
  });
  
  const [hasChanges, setHasChanges] = useState(false);
  
  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };
  
  const handleSave = async () => {
    if (!config?.id) return;
    
    try {
      await updateConfig.mutateAsync({
        configId: config.id,
        updates: formData,
      });
      setHasChanges(false);
      refetch();
    } catch (error) {
      console.error(error);
    }
  };

  const primaryColor = formData.primary_color || '#8B5CF6';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Configuração de Marca</h1>
          <p className="text-muted-foreground">Personalize a aparência da sua franquia</p>
        </div>
        
        {hasChanges && (
          <Button 
            onClick={handleSave}
            disabled={updateConfig.isPending}
            style={{ backgroundColor: primaryColor }}
          >
            <Save className="h-4 w-4 mr-2" />
            Salvar Alterações
          </Button>
        )}
      </div>
      
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Basic Branding */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Identidade Visual
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da Marca</Label>
              <Input 
                value={formData.brand_name}
                onChange={(e) => handleChange('brand_name', e.target.value)}
                placeholder="Ex: AtomicSales"
              />
            </div>
            
            <div className="space-y-2">
              <Label>URL do Logo</Label>
              <Input 
                value={formData.logo_url}
                onChange={(e) => handleChange('logo_url', e.target.value)}
                placeholder="https://..."
              />
              {formData.logo_url && (
                <div className="p-4 border rounded-lg bg-muted/50">
                  <img src={formData.logo_url} alt="Logo" className="h-12 w-auto" />
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              <Label>URL do Favicon</Label>
              <Input 
                value={formData.favicon_url}
                onChange={(e) => handleChange('favicon_url', e.target.value)}
                placeholder="https://..."
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cor Primária</Label>
                <div className="flex gap-2">
                  <input 
                    type="color"
                    value={formData.primary_color}
                    onChange={(e) => handleChange('primary_color', e.target.value)}
                    className="w-12 h-10 rounded border cursor-pointer"
                  />
                  <Input 
                    value={formData.primary_color}
                    onChange={(e) => handleChange('primary_color', e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Cor Secundária</Label>
                <div className="flex gap-2">
                  <input 
                    type="color"
                    value={formData.secondary_color}
                    onChange={(e) => handleChange('secondary_color', e.target.value)}
                    className="w-12 h-10 rounded border cursor-pointer"
                  />
                  <Input 
                    value={formData.secondary_color}
                    onChange={(e) => handleChange('secondary_color', e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Domains */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Domínios
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Slug da Página de Vendas</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">/pv2/</span>
                <Input 
                  value={formData.sales_page_slug}
                  onChange={(e) => handleChange('sales_page_slug', e.target.value)}
                  placeholder="atomicsales"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Sua página de vendas: crm.morphews.com/pv2/{formData.sales_page_slug || 'seu-slug'}
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>Domínio do App (opcional)</Label>
              <Input 
                value={formData.app_domain}
                onChange={(e) => handleChange('app_domain', e.target.value)}
                placeholder="app.seudominio.com.br"
              />
              <p className="text-xs text-muted-foreground">
                Requer configuração DNS. Entre em contato com o suporte.
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>Domínio do Checkout (opcional)</Label>
              <Input 
                value={formData.checkout_domain}
                onChange={(e) => handleChange('checkout_domain', e.target.value)}
                placeholder="pay.seudominio.com.br"
              />
            </div>
          </CardContent>
        </Card>
        
        {/* Email Config */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Configuração de E-mail
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do Remetente</Label>
              <Input 
                value={formData.email_from_name}
                onChange={(e) => handleChange('email_from_name', e.target.value)}
                placeholder="Ex: Equipe AtomicSales"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Logo para E-mails</Label>
              <Input 
                value={formData.email_logo_url}
                onChange={(e) => handleChange('email_logo_url', e.target.value)}
                placeholder="https://..."
              />
            </div>
          </CardContent>
        </Card>
        
        {/* Support */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Suporte
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>E-mail de Suporte</Label>
              <Input 
                type="email"
                value={formData.support_email}
                onChange={(e) => handleChange('support_email', e.target.value)}
                placeholder="suporte@seudominio.com.br"
              />
            </div>
            
            <div className="space-y-2">
              <Label>WhatsApp de Suporte</Label>
              <Input 
                value={formData.support_whatsapp}
                onChange={(e) => handleChange('support_whatsapp', e.target.value)}
                placeholder="5511999998888"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Telefone de Suporte</Label>
              <Input 
                value={formData.support_phone}
                onChange={(e) => handleChange('support_phone', e.target.value)}
                placeholder="(11) 99999-8888"
              />
            </div>
          </CardContent>
        </Card>
        
        {/* Legal */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Páginas Legais
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>URL dos Termos de Uso</Label>
              <Input 
                value={formData.terms_url}
                onChange={(e) => handleChange('terms_url', e.target.value)}
                placeholder="https://seusite.com/termos"
              />
            </div>
            
            <div className="space-y-2">
              <Label>URL da Política de Privacidade</Label>
              <Input 
                value={formData.privacy_url}
                onChange={(e) => handleChange('privacy_url', e.target.value)}
                placeholder="https://seusite.com/privacidade"
              />
            </div>
          </CardContent>
        </Card>
        
        {/* Custom Login */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Personalização Avançada
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Imagem de Fundo do Login</Label>
              <Input 
                value={formData.login_background_url}
                onChange={(e) => handleChange('login_background_url', e.target.value)}
                placeholder="https://..."
              />
            </div>
            
            <div className="space-y-2">
              <Label>Mensagem de Boas-Vindas no Dashboard</Label>
              <Textarea 
                value={formData.dashboard_welcome_message}
                onChange={(e) => handleChange('dashboard_welcome_message', e.target.value)}
                placeholder="Bem-vindo ao sistema! Aqui você gerencia seus leads..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Save Button */}
      {hasChanges && (
        <div className="fixed bottom-20 lg:bottom-6 right-6">
          <Button 
            onClick={handleSave}
            size="lg"
            disabled={updateConfig.isPending}
            style={{ backgroundColor: primaryColor }}
            className="shadow-lg"
          >
            {updateConfig.isPending ? (
              'Salvando...'
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Salvar Alterações
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
