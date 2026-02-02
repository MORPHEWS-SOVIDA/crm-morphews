import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useMyWhiteLabelConfig } from '@/hooks/useWhiteAdmin';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { 
  Mail, MessageSquare, Settings, Loader2, Save, CheckCircle, 
  AlertTriangle, ExternalLink, Key, Send, Smartphone
} from 'lucide-react';

interface WhatsAppInstance {
  id: string;
  name: string;
  phone_number: string | null;
  status: string;
  is_connected: boolean;
}

interface SettingsFormData {
  resend_api_key: string;
  welcome_whatsapp_instance_id: string | null;
  send_welcome_via_whatsapp: boolean;
  send_welcome_via_email: boolean;
}

export function WhiteAdminSettings() {
  const { user } = useAuth();
  const { data: wlData, refetch } = useMyWhiteLabelConfig();
  const config = wlData?.white_label_configs;
  const configId = config?.id;
  
  const [formData, setFormData] = useState<SettingsFormData>({
    resend_api_key: '',
    welcome_whatsapp_instance_id: null,
    send_welcome_via_whatsapp: false,
    send_welcome_via_email: true,
  });
  
  const [whatsappInstances, setWhatsappInstances] = useState<WhatsAppInstance[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingInstances, setIsLoadingInstances] = useState(false);
  const [isTestingResend, setIsTestingResend] = useState(false);
  
  const primaryColor = config?.primary_color || '#8B5CF6';

  // Load existing config
  useEffect(() => {
    async function loadConfig() {
      if (!configId) return;
      
      const { data } = await supabase
        .from('white_label_configs')
        .select('resend_api_key, welcome_whatsapp_instance_id, send_welcome_via_whatsapp, send_welcome_via_email')
        .eq('id', configId)
        .single();
      
      if (data) {
        setFormData({
          resend_api_key: data.resend_api_key || '',
          welcome_whatsapp_instance_id: data.welcome_whatsapp_instance_id,
          send_welcome_via_whatsapp: data.send_welcome_via_whatsapp || false,
          send_welcome_via_email: data.send_welcome_via_email !== false,
        });
      }
    }
    
    loadConfig();
  }, [configId]);

  // Load WhatsApp instances for current implementer's organization
  useEffect(() => {
    async function loadInstances() {
      if (!wlData?.organization_id) return;
      
      setIsLoadingInstances(true);
      
      const { data } = await supabase
        .from('whatsapp_instances')
        .select('id, name, phone_number, status, is_connected')
        .eq('organization_id', wlData.organization_id)
        .order('name');
      
      setWhatsappInstances((data as WhatsAppInstance[]) || []);
      setIsLoadingInstances(false);
    }
    
    loadInstances();
  }, [wlData?.organization_id]);

  const handleSave = async () => {
    if (!configId) return;
    
    setIsSaving(true);
    
    try {
      const { error } = await supabase
        .from('white_label_configs')
        .update({
          resend_api_key: formData.resend_api_key || null,
          welcome_whatsapp_instance_id: formData.welcome_whatsapp_instance_id || null,
          send_welcome_via_whatsapp: formData.send_welcome_via_whatsapp,
          send_welcome_via_email: formData.send_welcome_via_email,
          updated_at: new Date().toISOString(),
        })
        .eq('id', configId);
      
      if (error) throw error;
      
      toast({ title: 'Configurações salvas!' });
      refetch();
    } catch (error: any) {
      toast({ 
        title: 'Erro ao salvar', 
        description: error.message, 
        variant: 'destructive' 
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestResend = async () => {
    if (!formData.resend_api_key || !user?.email) {
      toast({ 
        title: 'Configure a API Key primeiro', 
        variant: 'destructive' 
      });
      return;
    }
    
    setIsTestingResend(true);
    
    try {
      const { error } = await supabase.functions.invoke('test-resend-api', {
        body: {
          apiKey: formData.resend_api_key,
          testEmail: user.email,
          brandName: config?.brand_name || 'Teste',
        },
      });
      
      if (error) throw error;
      
      toast({ 
        title: 'E-mail de teste enviado!', 
        description: `Verifique ${user.email}` 
      });
    } catch (error: any) {
      toast({ 
        title: 'Erro ao testar Resend', 
        description: error.message, 
        variant: 'destructive' 
      });
    } finally {
      setIsTestingResend(false);
    }
  };

  const connectedInstances = whatsappInstances.filter(i => i.is_connected === true);
  const selectedInstance = whatsappInstances.find(i => i.id === formData.welcome_whatsapp_instance_id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-muted-foreground">
          Configure integrações para envio de emails e mensagens de boas-vindas aos seus clientes
        </p>
      </div>

      {/* Email Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" style={{ color: primaryColor }} />
            Configuração de E-mail (Resend)
          </CardTitle>
          <CardDescription>
            Configure sua chave do Resend para enviar emails personalizados com sua marca
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Key className="h-4 w-4" />
            <AlertDescription>
              Crie uma conta em{' '}
              <a 
                href="https://resend.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="underline font-medium"
                style={{ color: primaryColor }}
              >
                resend.com
              </a>
              , configure seu domínio e obtenha sua API Key.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="resend_api_key">Resend API Key</Label>
            <div className="flex gap-2">
              <Input
                id="resend_api_key"
                type="password"
                value={formData.resend_api_key}
                onChange={(e) => setFormData(prev => ({ ...prev, resend_api_key: e.target.value }))}
                placeholder="re_xxxxxxxx..."
                className="font-mono"
              />
              <Button
                variant="outline"
                onClick={handleTestResend}
                disabled={!formData.resend_api_key || isTestingResend}
              >
                {isTestingResend ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Testar
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Os emails serão enviados de <strong>noreply@morphews.com</strong> mas com o nome da sua marca.
            </p>
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Enviar e-mail de boas-vindas</p>
                <p className="text-sm text-muted-foreground">
                  Envia email com credenciais quando novo cliente é criado
                </p>
              </div>
            </div>
            <Switch
              checked={formData.send_welcome_via_email}
              onCheckedChange={(v) => setFormData(prev => ({ ...prev, send_welcome_via_email: v }))}
            />
          </div>
        </CardContent>
      </Card>

      {/* WhatsApp Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-green-500" />
            Mensagens via WhatsApp
          </CardTitle>
          <CardDescription>
            Envie mensagens de boas-vindas pelo WhatsApp da sua instância conectada
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {connectedInstances.length === 0 ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Nenhuma instância de WhatsApp conectada. 
                Conecte uma instância no seu CRM para usar este recurso.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Instância para Boas-Vindas</Label>
                <Select
                  value={formData.welcome_whatsapp_instance_id || ''}
                  onValueChange={(v) => setFormData(prev => ({ 
                    ...prev, 
                    welcome_whatsapp_instance_id: v || null 
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma instância..." />
                  </SelectTrigger>
                  <SelectContent>
                    {connectedInstances.map((instance) => (
                      <SelectItem key={instance.id} value={instance.id}>
                        <div className="flex items-center gap-2">
                          <Smartphone className="h-4 w-4" />
                          {instance.name}
                          {instance.phone_number && (
                            <span className="text-muted-foreground text-xs">
                              ({instance.phone_number})
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedInstance && (
                <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm">
                    Instância selecionada: <strong>{selectedInstance.name}</strong>
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <MessageSquare className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium">Enviar mensagem de boas-vindas via WhatsApp</p>
                    <p className="text-sm text-muted-foreground">
                      Envia mensagem com credenciais pelo WhatsApp selecionado
                    </p>
                  </div>
                </div>
                <Switch
                  checked={formData.send_welcome_via_whatsapp}
                  onCheckedChange={(v) => setFormData(prev => ({ ...prev, send_welcome_via_whatsapp: v }))}
                  disabled={!formData.welcome_whatsapp_instance_id}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Cost Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Regras de Negócio
          </CardTitle>
          <CardDescription>
            Custos da plataforma aplicados aos seus planos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-4 border rounded-lg space-y-1">
              <p className="font-medium">Taxa de Setup</p>
              <p className="text-2xl font-bold" style={{ color: primaryColor }}>12%</p>
              <p className="text-xs text-muted-foreground">
                Da taxa de implementação que você cobra
              </p>
            </div>
            
            <div className="p-4 border rounded-lg space-y-1">
              <p className="font-medium">Energia Extra</p>
              <p className="text-2xl font-bold" style={{ color: primaryColor }}>R$ 7,00</p>
              <p className="text-xs text-muted-foreground">
                Por cada 1.000 unidades acima do base (1.000)
              </p>
            </div>
            
            <div className="p-4 border rounded-lg space-y-1">
              <p className="font-medium">WhatsApp Extra</p>
              <p className="text-2xl font-bold" style={{ color: primaryColor }}>R$ 50,00</p>
              <p className="text-xs text-muted-foreground">
                Por instância adicional (1 inclusa)
              </p>
            </div>
            
            <div className="p-4 border rounded-lg space-y-1">
              <p className="font-medium">Usuário Extra</p>
              <p className="text-2xl font-bold" style={{ color: primaryColor }}>R$ 2,00</p>
              <p className="text-xs text-muted-foreground">
                Por usuário adicional (3 inclusos)
              </p>
            </div>
            
            <div className="p-4 border rounded-lg space-y-1">
              <p className="font-medium">Nota Fiscal (NF-e)</p>
              <p className="text-2xl font-bold" style={{ color: primaryColor }}>R$ 150,00</p>
              <p className="text-xs text-muted-foreground">
                100 notas/mês incluídas, +R$ 0,10 por extra
              </p>
            </div>
            
            <div className="p-4 border rounded-lg space-y-1">
              <p className="font-medium">Tracking & Pixels</p>
              <p className="text-2xl font-bold" style={{ color: primaryColor }}>R$ 125,00</p>
              <p className="text-xs text-muted-foreground">
                Facebook CAPI, Google Ads, etc.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={isSaving}
          style={{ backgroundColor: primaryColor }}
          className="gap-2"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Salvar Configurações
        </Button>
      </div>
    </div>
  );
}
