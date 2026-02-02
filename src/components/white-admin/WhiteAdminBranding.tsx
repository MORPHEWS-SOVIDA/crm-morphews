import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useMyWhiteLabelConfig } from '@/hooks/useWhiteAdmin';
import { useUpdateWhiteLabelConfig } from '@/hooks/useWhiteLabel';
import { supabase } from '@/integrations/supabase/client';
import { Palette, Upload, Globe, Mail, Phone, FileText, Save, ImageIcon, AlertCircle, Loader2, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface FileUploadFieldProps {
  label: string;
  value: string;
  onChange: (url: string) => void;
  configId: string;
  fieldName: string;
  accept?: string;
  helpText?: string;
}

function FileUploadField({ label, value, onChange, configId, fieldName, accept = "image/*", helpText }: FileUploadFieldProps) {
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "O tamanho máximo permitido é 5MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${configId}/${fieldName}_${Date.now()}.${fileExt}`;

      const { error: uploadError, data } = await supabase.storage
        .from('white-label-assets')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('white-label-assets')
        .getPublicUrl(fileName);

      onChange(publicUrl);
      toast({
        title: "Upload concluído",
        description: "Imagem enviada com sucesso",
      });
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "Erro no upload",
        description: error.message || "Falha ao enviar arquivo",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleRemove = () => {
    onChange('');
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
        id={`upload-${fieldName}`}
      />
      
      {value ? (
        <div className="relative group">
          <div className="p-4 border rounded-lg bg-muted/50 flex items-center gap-4">
            <img 
              src={value} 
              alt={label} 
              className="h-16 w-auto max-w-[200px] object-contain rounded"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground truncate">{value}</p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => inputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRemove}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="w-full h-24 border-dashed flex flex-col gap-2"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-sm">Enviando...</span>
            </>
          ) : (
            <>
              <ImageIcon className="h-6 w-6 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Clique para fazer upload</span>
            </>
          )}
        </Button>
      )}
      {helpText && <p className="text-xs text-muted-foreground">{helpText}</p>}
    </div>
  );
}

export function WhiteAdminBranding() {
  const { data: wlData, refetch } = useMyWhiteLabelConfig();
  const config = wlData?.white_label_configs;
  const updateConfig = useUpdateWhiteLabelConfig();
  
  const [formData, setFormData] = useState({
    brand_name: '',
    logo_url: '',
    logo_dark_url: '',
    favicon_url: '',
    primary_color: '#8B5CF6',
    secondary_color: '#ffffff',
    primary_color_dark: '#A78BFA',
    secondary_color_dark: '#1f1f1f',
    sales_page_slug: '',
    app_domain: '',
    checkout_domain: '',
    email_from_name: '',
    email_logo_url: '',
    support_email: '',
    support_whatsapp: '',
    support_phone: '',
    terms_url: '',
    privacy_url: '',
    login_background_url: '',
    dashboard_welcome_message: '',
  });
  
  const [hasChanges, setHasChanges] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Sync form data when config loads
  useEffect(() => {
    if (config && !isInitialized) {
      setFormData({
        brand_name: config.brand_name || '',
        logo_url: config.logo_url || '',
        logo_dark_url: (config as any).logo_dark_url || '',
        favicon_url: config.favicon_url || '',
        primary_color: config.primary_color || '#8B5CF6',
        secondary_color: config.secondary_color || '#ffffff',
        primary_color_dark: (config as any).primary_color_dark || '#A78BFA',
        secondary_color_dark: (config as any).secondary_color_dark || '#1f1f1f',
        sales_page_slug: config.sales_page_slug || '',
        app_domain: config.app_domain || '',
        checkout_domain: config.checkout_domain || '',
        email_from_name: config.email_from_name || '',
        email_logo_url: config.email_logo_url || '',
        support_email: config.support_email || '',
        support_whatsapp: config.support_whatsapp || '',
        support_phone: config.support_phone || '',
        terms_url: config.terms_url || '',
        privacy_url: config.privacy_url || '',
        login_background_url: config.login_background_url || '',
        dashboard_welcome_message: config.dashboard_welcome_message || '',
      });
      setIsInitialized(true);
    }
  }, [config, isInitialized]);
  
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

  if (!config?.id) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Carregando configurações...</p>
      </div>
    );
  }

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
            
            <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
              <div className="flex items-center gap-2 text-sm font-medium">
                <ImageIcon className="h-4 w-4" />
                Logos da Marca
              </div>
              <p className="text-xs text-muted-foreground">
                Recomendamos ter duas versões do logo para melhor visibilidade em diferentes temas.
                <br />
                <strong>Tamanho ideal:</strong> 400×100px ou proporção similar (horizontal).
                Use PNG ou SVG com fundo transparente.
              </p>
              
              <FileUploadField
                label="Logo (para fundo claro)"
                value={formData.logo_url}
                onChange={(url) => handleChange('logo_url', url)}
                configId={config.id}
                fieldName="logo"
                helpText="Versão escura do logo para exibir em fundos brancos/claros. Tamanho: 400×100px"
              />
              
              <FileUploadField
                label="Logo (para fundo escuro)"
                value={formData.logo_dark_url || ''}
                onChange={(url) => handleChange('logo_dark_url', url)}
                configId={config.id}
                fieldName="logo_dark"
                helpText="Versão clara do logo para exibir em fundos escuros. Tamanho: 400×100px"
              />
            </div>
            
            <FileUploadField
              label="Favicon"
              value={formData.favicon_url}
              onChange={(url) => handleChange('favicon_url', url)}
              configId={config.id}
              fieldName="favicon"
              helpText="Ícone do navegador. Recomendado: 32x32px ou 64x64px"
            />
            
            {/* Light Theme Colors */}
            <div className="space-y-4 p-4 border rounded-lg bg-white dark:bg-zinc-900">
              <div className="flex items-center gap-2 text-sm font-medium">
                <div className="w-4 h-4 rounded-full bg-gradient-to-r from-amber-200 to-yellow-400" />
                Cores do Tema Claro
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Cor Primária</Label>
                  <div className="flex gap-2">
                    <input 
                      type="color"
                      value={formData.primary_color}
                      onChange={(e) => handleChange('primary_color', e.target.value)}
                      className="w-10 h-9 rounded border cursor-pointer"
                    />
                    <Input 
                      value={formData.primary_color}
                      onChange={(e) => handleChange('primary_color', e.target.value)}
                      className="flex-1 text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Cor Secundária</Label>
                  <div className="flex gap-2">
                    <input 
                      type="color"
                      value={formData.secondary_color}
                      onChange={(e) => handleChange('secondary_color', e.target.value)}
                      className="w-10 h-9 rounded border cursor-pointer"
                    />
                    <Input 
                      value={formData.secondary_color}
                      onChange={(e) => handleChange('secondary_color', e.target.value)}
                      className="flex-1 text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            {/* Dark Theme Colors */}
            <div className="space-y-4 p-4 border rounded-lg bg-zinc-900 dark:bg-zinc-950">
              <div className="flex items-center gap-2 text-sm font-medium text-white">
                <div className="w-4 h-4 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600" />
                Cores do Tema Escuro
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-zinc-300">Cor Primária</Label>
                  <div className="flex gap-2">
                    <input 
                      type="color"
                      value={formData.primary_color_dark}
                      onChange={(e) => handleChange('primary_color_dark', e.target.value)}
                      className="w-10 h-9 rounded border border-zinc-700 cursor-pointer"
                    />
                    <Input 
                      value={formData.primary_color_dark}
                      onChange={(e) => handleChange('primary_color_dark', e.target.value)}
                      className="flex-1 text-sm bg-zinc-800 border-zinc-700 text-white"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-zinc-300">Cor Secundária</Label>
                  <div className="flex gap-2">
                    <input 
                      type="color"
                      value={formData.secondary_color_dark}
                      onChange={(e) => handleChange('secondary_color_dark', e.target.value)}
                      className="w-10 h-9 rounded border border-zinc-700 cursor-pointer"
                    />
                    <Input 
                      value={formData.secondary_color_dark}
                      onChange={(e) => handleChange('secondary_color_dark', e.target.value)}
                      className="flex-1 text-sm bg-zinc-800 border-zinc-700 text-white"
                    />
                  </div>
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
                <span className="text-sm text-muted-foreground">morphews.com/</span>
                <Input 
                  value={formData.sales_page_slug}
                  onChange={(e) => handleChange('sales_page_slug', e.target.value)}
                  placeholder="atomicsales"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Página de vendas: morphews.com/{formData.sales_page_slug || 'seu-slug'} • Login: morphews.com/{formData.sales_page_slug || 'seu-slug'}/login
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>Domínio do App (opcional)</Label>
              <Input 
                value={formData.app_domain}
                onChange={(e) => handleChange('app_domain', e.target.value)}
                placeholder="app.seudominio.com.br"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Domínio do Checkout (opcional)</Label>
              <Input 
                value={formData.checkout_domain}
                onChange={(e) => handleChange('checkout_domain', e.target.value)}
                placeholder="pay.seudominio.com.br"
              />
            </div>
            
            <Alert className="bg-amber-500/10 border-amber-500/20">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-700">
                Após configurar os domínios, salve as alterações e entre em contato com o suporte para ativação.
              </AlertDescription>
            </Alert>
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
            
            <FileUploadField
              label="Logo para E-mails"
              value={formData.email_logo_url}
              onChange={(url) => handleChange('email_logo_url', url)}
              configId={config.id}
              fieldName="email_logo"
              helpText="Aparece no cabeçalho dos e-mails enviados"
            />
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
            <FileUploadField
              label="Imagem de Fundo do Login"
              value={formData.login_background_url}
              onChange={(url) => handleChange('login_background_url', url)}
              configId={config.id}
              fieldName="login_background"
              helpText="Imagem exibida na tela de login. Recomendado: 1920x1080px"
            />
            
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
