import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Loader2,
  Eye,
  EyeOff,
  Copy,
  Check,
  QrCode,
  Plus,
  X,
  Info,
  ExternalLink,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useEfiPayConfig, useUpsertEfiPayConfig, getEfiPayWebhookUrl } from '@/hooks/useEfiPayConfig';
import { toast } from 'sonner';

export function EfiPayConfigManager() {
  const { profile } = useAuth();
  const { data: config, isLoading } = useEfiPayConfig();
  const upsertConfig = useUpsertEfiPayConfig();

  const [isActive, setIsActive] = useState(true);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [environment, setEnvironment] = useState<'sandbox' | 'production'>('production');
  const [pixKeys, setPixKeys] = useState<string[]>(['']);
  const [webhookSecret, setWebhookSecret] = useState('');
  const [copied, setCopied] = useState(false);

  // Load existing config
  useEffect(() => {
    if (config) {
      setIsActive(config.is_active);
      setClientId(config.credentials_encrypted?.client_id || '');
      setEnvironment(config.credentials_encrypted?.environment || 'production');
      setPixKeys(config.credentials_encrypted?.pix_keys?.length ? config.credentials_encrypted.pix_keys : ['']);
      setWebhookSecret(config.webhook_secret || '');
    }
  }, [config]);

  const webhookUrl = profile?.organization_id 
    ? getEfiPayWebhookUrl(profile.organization_id) 
    : '';

  const handleCopyWebhook = async () => {
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    toast.success('URL copiada!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddPixKey = () => {
    setPixKeys([...pixKeys, '']);
  };

  const handleRemovePixKey = (index: number) => {
    if (pixKeys.length > 1) {
      setPixKeys(pixKeys.filter((_, i) => i !== index));
    }
  };

  const handlePixKeyChange = (index: number, value: string) => {
    const updated = [...pixKeys];
    updated[index] = value;
    setPixKeys(updated);
  };

  const handleSave = async () => {
    const filteredPixKeys = pixKeys.filter(k => k.trim());
    
    if (!clientId.trim()) {
      toast.error('Client ID é obrigatório');
      return;
    }

    if (filteredPixKeys.length === 0) {
      toast.error('Adicione pelo menos uma chave PIX');
      return;
    }

    await upsertConfig.mutateAsync({
      client_id: clientId.trim(),
      client_secret: clientSecret.trim() || undefined,
      pix_keys: filteredPixKeys,
      environment,
      webhook_secret: webhookSecret.trim() || undefined,
      is_active: isActive,
    });

    // Clear secret after save
    setClientSecret('');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasExistingConfig = !!config;
  const hasSecret = config?.credentials_encrypted?.has_secret;
  const hasCertificate = config?.credentials_encrypted?.has_certificate;

  return (
    <div className="space-y-6">
      {/* Status Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-500/10">
            <QrCode className="h-5 w-5 text-green-500" />
          </div>
          <div>
            <h3 className="font-medium">EfiPay (Gerencianet)</h3>
            <p className="text-sm text-muted-foreground">
              Receba PIX automaticamente
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Switch
            checked={isActive}
            onCheckedChange={setIsActive}
          />
          <Badge variant={isActive ? 'default' : 'secondary'}>
            {isActive ? 'Ativo' : 'Inativo'}
          </Badge>
        </div>
      </div>

      {/* Status Badges */}
      {hasExistingConfig && (
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="gap-1">
            <CheckCircle className="h-3 w-3 text-green-500" />
            Client ID configurado
          </Badge>
          {hasSecret && (
            <Badge variant="outline" className="gap-1">
              <CheckCircle className="h-3 w-3 text-green-500" />
              Client Secret configurado
            </Badge>
          )}
          {hasCertificate && (
            <Badge variant="outline" className="gap-1">
              <CheckCircle className="h-3 w-3 text-green-500" />
              Certificado .p12 configurado
            </Badge>
          )}
        </div>
      )}

      <Separator />

      {/* Credentials */}
      <Accordion type="single" collapsible defaultValue={hasExistingConfig ? undefined : 'credentials'}>
        <AccordionItem value="credentials">
          <AccordionTrigger>
            <div className="flex items-center gap-2">
              <span>Credenciais da API</span>
              {!hasExistingConfig && (
                <Badge variant="destructive" className="text-xs">Configurar</Badge>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-sm">
                Obtenha suas credenciais no{' '}
                <a
                  href="https://app.efipay.com.br"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline inline-flex items-center gap-1"
                >
                  painel EfiPay <ExternalLink className="h-3 w-3" />
                </a>
                {' '}em API → Aplicações → Sua Aplicação → Credenciais de Produção.
              </AlertDescription>
            </Alert>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Client ID</Label>
                <Input
                  placeholder="Client_Id_xxxxx..."
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Client Secret</Label>
                <div className="relative">
                  <Input
                    type={showSecret ? 'text' : 'password'}
                    placeholder={hasSecret ? '••••••••••••••••' : 'Client_Secret_xxxxx...'}
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0"
                    onClick={() => setShowSecret(!showSecret)}
                  >
                    {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {hasSecret && (
                  <p className="text-xs text-muted-foreground">
                    Deixe em branco para manter o atual
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Ambiente</Label>
              <Select value={environment} onValueChange={(v) => setEnvironment(v as 'sandbox' | 'production')}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="production">Produção</SelectItem>
                  <SelectItem value="sandbox">Sandbox (testes)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {!hasCertificate && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Certificado .p12 não encontrado. Solicite ao administrador da plataforma
                  para configurar o certificado EfiPay.
                </AlertDescription>
              </Alert>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* PIX Keys */}
        <AccordionItem value="pix-keys">
          <AccordionTrigger>
            <div className="flex items-center gap-2">
              <span>Chaves PIX Monitoradas</span>
              <Badge variant="outline">{pixKeys.filter(k => k.trim()).length}</Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-4">
            <p className="text-sm text-muted-foreground">
              Adicione as chaves PIX que devem ser monitoradas para recebimentos automáticos.
            </p>

            <div className="space-y-3">
              {pixKeys.map((key, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    placeholder="email@exemplo.com, CPF, CNPJ ou telefone"
                    value={key}
                    onChange={(e) => handlePixKeyChange(index, e.target.value)}
                  />
                  {pixKeys.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemovePixKey(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddPixKey}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Adicionar chave
            </Button>
          </AccordionContent>
        </AccordionItem>

        {/* Webhook */}
        <AccordionItem value="webhook">
          <AccordionTrigger>URL do Webhook</AccordionTrigger>
          <AccordionContent className="space-y-4 pt-4">
            <p className="text-sm text-muted-foreground">
              Configure esta URL no painel EfiPay para receber notificações de PIX.
            </p>

            <div className="flex gap-2">
              <Input
                value={webhookUrl}
                readOnly
                className="font-mono text-xs"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopyWebhook}
              >
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Segredo do Webhook (opcional)</Label>
              <Input
                placeholder="hmac_secret_xxx..."
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Se configurado, valida a autenticidade das notificações
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={upsertConfig.isPending}
          className="gap-2"
        >
          {upsertConfig.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Salvar Configuração
        </Button>
      </div>
    </div>
  );
}
