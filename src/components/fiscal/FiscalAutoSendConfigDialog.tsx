import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Mail, MessageSquare, Info, ExternalLink, Eye, EyeOff, CheckCircle } from 'lucide-react';
import {
  useFiscalAutoSendConfig,
  useUpsertFiscalAutoSendConfig,
  useSaveResendApiKey,
} from '@/hooks/useFiscalAutoSendConfig';
import { useEvolutionInstances } from '@/hooks/useEvolutionInstances';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function FiscalAutoSendConfigDialog({ open, onClose }: Props) {
  const { data: config, isLoading } = useFiscalAutoSendConfig();
  const { instances = [] } = useEvolutionInstances();
  const upsertConfig = useUpsertFiscalAutoSendConfig();
  const saveApiKey = useSaveResendApiKey();

  // Email form state
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [resendApiKey, setResendApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [emailFromName, setEmailFromName] = useState('Sua Empresa');
  const [emailFromAddress, setEmailFromAddress] = useState('');
  const [emailSubject, setEmailSubject] = useState('Nota Fiscal #{invoice_number} - {company_name}');
  const [emailBody, setEmailBody] = useState(`Prezado(a) {recipient_name},

Segue anexa a Nota Fiscal Eletrônica referente à sua compra.

Número da Nota: {invoice_number}
Valor Total: {total_value}
Data de Emissão: {emission_date}

Atenciosamente,
{company_name}`);
  const [emailSendDanfe, setEmailSendDanfe] = useState(true);
  const [emailSendXml, setEmailSendXml] = useState(true);

  // WhatsApp form state
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [whatsappInstanceId, setWhatsappInstanceId] = useState('');
  const [whatsappMessage, setWhatsappMessage] = useState(`🧾 Nota Fiscal #{invoice_number}

Olá {recipient_name}! Sua nota fiscal foi emitida com sucesso.

Valor: {total_value}
Data: {emission_date}

Acesse o PDF da DANFE:
{danfe_url}`);
  const [whatsappSendDanfe, setWhatsappSendDanfe] = useState(true);
  const [whatsappSendXml, setWhatsappSendXml] = useState(false);

  // Load existing config
  useEffect(() => {
    if (config) {
      setEmailEnabled(config.email_enabled);
      setEmailFromName(config.email_from_name || 'Sua Empresa');
      setEmailFromAddress(config.email_from_address || '');
      setEmailSubject(config.email_subject_template || emailSubject);
      setEmailBody(config.email_body_template || emailBody);
      setEmailSendDanfe(config.email_send_danfe);
      setEmailSendXml(config.email_send_xml);
      setWhatsappEnabled(config.whatsapp_enabled);
      setWhatsappInstanceId(config.whatsapp_instance_id || '');
      setWhatsappMessage(config.whatsapp_message_template || whatsappMessage);
      setWhatsappSendDanfe(config.whatsapp_send_danfe);
      setWhatsappSendXml(config.whatsapp_send_xml);
    }
  }, [config]);

  const handleSaveEmail = async () => {
    // Save API key if provided
    if (resendApiKey.trim()) {
      await saveApiKey.mutateAsync(resendApiKey.trim());
      setResendApiKey('');
    }

    // Save config
    await upsertConfig.mutateAsync({
      email_enabled: emailEnabled,
      email_from_name: emailFromName,
      email_from_address: emailFromAddress,
      email_subject_template: emailSubject,
      email_body_template: emailBody,
      email_send_danfe: emailSendDanfe,
      email_send_xml: emailSendXml,
    });
  };

  const handleSaveWhatsapp = async () => {
    await upsertConfig.mutateAsync({
      whatsapp_enabled: whatsappEnabled,
      whatsapp_instance_id: whatsappInstanceId || null,
      whatsapp_message_template: whatsappMessage,
      whatsapp_send_danfe: whatsappSendDanfe,
      whatsapp_send_xml: whatsappSendXml,
    });
  };

  const connectedInstances = instances.filter(
    (i) => i.is_connected
  );

  const variablesHelp = [
    { var: '{invoice_number}', desc: 'Número da nota' },
    { var: '{company_name}', desc: 'Nome da empresa emitente' },
    { var: '{recipient_name}', desc: 'Nome do destinatário' },
    { var: '{total_value}', desc: 'Valor total formatado' },
    { var: '{emission_date}', desc: 'Data de emissão' },
    { var: '{danfe_url}', desc: 'Link do PDF DANFE' },
    { var: '{xml_url}', desc: 'Link do XML' },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Envio Automático de Notas Fiscais</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="email" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="email" className="gap-2">
                <Mail className="h-4 w-4" />
                Email
              </TabsTrigger>
              <TabsTrigger value="whatsapp" className="gap-2">
                <MessageSquare className="h-4 w-4" />
                WhatsApp
              </TabsTrigger>
            </TabsList>

            {/* Email Tab */}
            <TabsContent value="email" className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Envio por Email</CardTitle>
                    <Switch
                      checked={emailEnabled}
                      onCheckedChange={setEmailEnabled}
                    />
                  </div>
                  <CardDescription>
                    Envie automaticamente DANFE e XML por email quando a nota for autorizada
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      Você precisa de uma conta no{' '}
                      <a
                        href="https://resend.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline inline-flex items-center gap-1"
                      >
                        Resend.com <ExternalLink className="h-3 w-3" />
                      </a>
                      {' '}e configurar um domínio verificado para enviar emails.
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-2">
                    <Label>API Key do Resend</Label>
                    <div className="relative">
                      <Input
                        type={showApiKey ? 'text' : 'password'}
                        placeholder={config?.resend_api_key_encrypted ? '••••••••••••••••' : 'Cole sua API Key aqui'}
                        value={resendApiKey}
                        onChange={(e) => setResendApiKey(e.target.value)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0"
                        onClick={() => setShowApiKey(!showApiKey)}
                      >
                        {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    {config?.resend_api_key_encrypted && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        API Key configurada. Deixe em branco para manter a atual.
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nome do Remetente</Label>
                      <Input
                        placeholder="Sua Empresa"
                        value={emailFromName}
                        onChange={(e) => setEmailFromName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Email do Remetente</Label>
                      <Input
                        type="email"
                        placeholder="nfe@seudominio.com.br"
                        value={emailFromAddress}
                        onChange={(e) => setEmailFromAddress(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Deve ser um domínio verificado no Resend
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Assunto do Email</Label>
                    <Input
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Corpo do Email</Label>
                    <Textarea
                      rows={8}
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                    />
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <Switch
                        id="email-danfe"
                        checked={emailSendDanfe}
                        onCheckedChange={setEmailSendDanfe}
                      />
                      <Label htmlFor="email-danfe">Anexar DANFE (PDF)</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        id="email-xml"
                        checked={emailSendXml}
                        onCheckedChange={setEmailSendXml}
                      />
                      <Label htmlFor="email-xml">Anexar XML</Label>
                    </div>
                  </div>

                  <Button
                    onClick={handleSaveEmail}
                    disabled={upsertConfig.isPending || saveApiKey.isPending}
                    className="w-full"
                  >
                    {(upsertConfig.isPending || saveApiKey.isPending) && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    Salvar Configuração de Email
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* WhatsApp Tab */}
            <TabsContent value="whatsapp" className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Envio por WhatsApp</CardTitle>
                    <Switch
                      checked={whatsappEnabled}
                      onCheckedChange={setWhatsappEnabled}
                    />
                  </div>
                  <CardDescription>
                    Envie automaticamente uma mensagem com link da DANFE quando a nota for autorizada
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {connectedInstances.length === 0 ? (
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription>
                        Nenhuma instância WhatsApp conectada. Configure uma instância primeiro.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <div className="space-y-2">
                      <Label>Instância de Envio</Label>
                      <Select value={whatsappInstanceId} onValueChange={setWhatsappInstanceId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma instância" />
                        </SelectTrigger>
                        <SelectContent>
                          {connectedInstances.map((inst) => (
                            <SelectItem key={inst.id} value={inst.id}>
                              {inst.name} ({inst.phone_number || 'Sem número'})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Mensagem</Label>
                    <Textarea
                      rows={8}
                      value={whatsappMessage}
                      onChange={(e) => setWhatsappMessage(e.target.value)}
                    />
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <Switch
                        id="wa-danfe"
                        checked={whatsappSendDanfe}
                        onCheckedChange={setWhatsappSendDanfe}
                      />
                      <Label htmlFor="wa-danfe">Enviar link DANFE</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        id="wa-xml"
                        checked={whatsappSendXml}
                        onCheckedChange={setWhatsappSendXml}
                      />
                      <Label htmlFor="wa-xml">Enviar link XML</Label>
                    </div>
                  </div>

                  <Button
                    onClick={handleSaveWhatsapp}
                    disabled={upsertConfig.isPending}
                    className="w-full"
                  >
                    {upsertConfig.isPending && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    Salvar Configuração de WhatsApp
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Variables Help */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Variáveis disponíveis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {variablesHelp.map((v) => (
                    <code
                      key={v.var}
                      className="px-2 py-1 bg-muted rounded text-xs"
                      title={v.desc}
                    >
                      {v.var}
                    </code>
                  ))}
                </div>
              </CardContent>
            </Card>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
