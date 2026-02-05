import { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Send, 
  Users, 
  MessageSquare, 
  Clock, 
  AlertCircle,
  Loader2,
  Phone,
  Smartphone,
  CreditCard
} from 'lucide-react';
import { useSmsBalance, useSendSms, useSmsProviderConfig } from '@/hooks/useSmsCredits';
import { useTenant } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const MAX_SMS_CHARS = 160;

export default function SmsCenter() {
  const [activeTab, setActiveTab] = useState('individual');

  return (
    <Layout>
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <MessageSquare className="h-7 w-7 text-primary" />
              Central de SMS
            </h1>
            <p className="text-muted-foreground">
              Envie mensagens SMS individuais ou em massa
            </p>
          </div>
          <SmsBalanceCard />
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full max-w-md">
            <TabsTrigger value="individual" className="flex-1 gap-2">
              <Send className="h-4 w-4" />
              Envio Único
            </TabsTrigger>
            <TabsTrigger value="massa" className="flex-1 gap-2">
              <Users className="h-4 w-4" />
              Envio em Massa
            </TabsTrigger>
          </TabsList>

          <TabsContent value="individual" className="mt-6">
            <EnvioIndividual />
          </TabsContent>

          <TabsContent value="massa" className="mt-6">
            <EnvioEmMassa />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}

function SmsBalanceCard() {
  const navigate = useNavigate();
  const { data: balance, isLoading } = useSmsBalance();
  const { data: config } = useSmsProviderConfig();

  if (isLoading) {
    return (
      <Card className="w-fit">
        <CardContent className="py-3 px-4 flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Carregando...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-fit">
      <CardContent className="py-3 px-4 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-primary" />
          <div>
            <p className="text-sm text-muted-foreground">Saldo disponível</p>
            <p className="text-xl font-bold">{balance?.current_credits || 0} SMS</p>
          </div>
        </div>
        {config?.is_active ? (
          <Badge variant="default">Ativo</Badge>
        ) : (
          <Badge variant="destructive">Inativo</Badge>
        )}
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => navigate('/settings', { state: { tab: 'sms' } })}
          className="ml-2"
        >
          <CreditCard className="h-4 w-4 mr-1" />
          Recarregar
        </Button>
      </CardContent>
    </Card>
  );
}

function EnvioIndividual() {
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  
  const { tenantId } = useTenant();
  const sendSms = useSendSms();
  const { data: config } = useSmsProviderConfig();
  const { data: balance } = useSmsBalance();

  const charCount = message.length;
  const smsCount = Math.ceil(charCount / MAX_SMS_CHARS) || 1;
  const isOverLimit = charCount > MAX_SMS_CHARS;

  const handleSend = async () => {
    if (!phone.trim()) {
      toast.error('Informe o número do destinatário');
      return;
    }
    if (!message.trim()) {
      toast.error('Digite a mensagem');
      return;
    }
    if (!config?.is_active) {
      toast.error('Configure o provedor de SMS nas Configurações');
      return;
    }
    if (!balance || balance.current_credits < 1) {
      toast.error('Saldo de SMS insuficiente');
      return;
    }

    try {
      await sendSms.mutateAsync({ phone, message });
      setPhone('');
      setMessage('');
    } catch {
      // Error is handled in the hook
    }
  };

  return (
    <div className="grid lg:grid-cols-5 gap-6">
      {/* Form */}
      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Envio Único
          </CardTitle>
          <CardDescription>
            Envie SMS para um número específico
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Destinatário */}
          <div className="space-y-2">
            <Label htmlFor="phone">Destinatário</Label>
            <Input
              id="phone"
              placeholder="DDD + Número (ex: 51999887766)"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
              maxLength={11}
            />
            <p className="text-xs text-muted-foreground">
              Especifique <strong>sempre</strong> o DDD. Ex: 5199120716
            </p>
          </div>

          {/* Mensagem */}
          <div className="space-y-2">
            <Label htmlFor="message">Mensagem</Label>
            <Textarea
              id="message"
              placeholder="Digite sua mensagem aqui..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              className="resize-none"
            />
            <div className="flex items-center justify-between text-xs">
              <span className={isOverLimit ? 'text-destructive font-medium' : 'text-muted-foreground'}>
                Você digitou <strong>{charCount}</strong> de {MAX_SMS_CHARS} caracteres
                {smsCount > 1 && ` (${smsCount} SMS)`}
              </span>
              {isOverLimit && (
                <Badge variant="outline" className="text-amber-600 border-amber-600">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Mensagem longa
                </Badge>
              )}
            </div>
          </div>

          {/* Agendamento */}
          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center justify-between">
              <div>
                <Label>Agendar envio</Label>
                <p className="text-xs text-muted-foreground">
                  Programe o envio para uma data/hora específica
                </p>
              </div>
              <Switch
                checked={scheduleEnabled}
                onCheckedChange={setScheduleEnabled}
              />
            </div>
            
            {scheduleEnabled && (
              <div className="flex gap-3">
                <div className="flex-1">
                  <Label htmlFor="scheduleDate" className="text-xs">Data</Label>
                  <Input
                    id="scheduleDate"
                    type="date"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                  />
                </div>
                <div className="w-32">
                  <Label htmlFor="scheduleTime" className="text-xs">Hora</Label>
                  <Input
                    id="scheduleTime"
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Botão Enviar */}
          <Button 
            onClick={handleSend} 
            className="w-full gap-2"
            disabled={sendSms.isPending || !phone || !message}
            size="lg"
          >
            {sendSms.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : scheduleEnabled ? (
              <>
                <Clock className="h-4 w-4" />
                Agendar Envio
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Enviar Agora
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Phone Preview */}
      <div className="lg:col-span-2 flex justify-center">
        <PhonePreview message={message} />
      </div>
    </div>
  );
}

function EnvioEmMassa() {
  const [campaignName, setCampaignName] = useState('');
  const [numbers, setNumbers] = useState('');
  const [message, setMessage] = useState('');
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [isSending, setIsSending] = useState(false);

  const { tenantId } = useTenant();
  const { data: config } = useSmsProviderConfig();
  const { data: balance } = useSmsBalance();

  const charCount = message.length;
  const smsCount = Math.ceil(charCount / MAX_SMS_CHARS) || 1;
  const isOverLimit = charCount > MAX_SMS_CHARS;

  // Parse numbers from textarea
  const phoneList = numbers
    .split('\n')
    .map(n => n.trim().replace(/\D/g, ''))
    .filter(n => n.length >= 10 && n.length <= 11);
  
  const totalSms = phoneList.length * smsCount;

  const handleSendMassa = async () => {
    if (phoneList.length === 0) {
      toast.error('Adicione pelo menos um número válido');
      return;
    }
    if (!message.trim()) {
      toast.error('Digite a mensagem');
      return;
    }
    if (!config?.is_active) {
      toast.error('Configure o provedor de SMS nas Configurações');
      return;
    }
    if (!balance || balance.current_credits < totalSms) {
      toast.error(`Saldo insuficiente. Necessário: ${totalSms} SMS`);
      return;
    }

    setIsSending(true);
    let successCount = 0;
    let errorCount = 0;

    for (const phone of phoneList) {
      try {
        const { error } = await supabase.functions.invoke('facilita-send-sms', {
          body: {
            organizationId: tenantId,
            phone,
            message,
            externalKey: `massa-${campaignName || 'envio'}-${Date.now()}-${phone}`,
          },
        });
        
        if (error) {
          errorCount++;
        } else {
          successCount++;
        }
      } catch {
        errorCount++;
      }
    }

    setIsSending(false);
    
    if (successCount > 0) {
      toast.success(`${successCount} SMS enviados com sucesso!`);
    }
    if (errorCount > 0) {
      toast.error(`${errorCount} SMS falharam`);
    }

    if (successCount === phoneList.length) {
      setCampaignName('');
      setNumbers('');
      setMessage('');
    }
  };

  return (
    <div className="grid lg:grid-cols-5 gap-6">
      {/* Form */}
      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Envio em Massa
          </CardTitle>
          <CardDescription>
            Envie a mesma mensagem para vários números
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Nome da Campanha */}
          <div className="space-y-2">
            <Label htmlFor="campaignName">Nome do Envio (opcional)</Label>
            <Input
              id="campaignName"
              placeholder="Ex: Campanha de Páscoa, Natal, etc."
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
            />
          </div>

          {/* Destinatários */}
          <div className="space-y-2">
            <Label htmlFor="numbers">
              Destinatários 
              {phoneList.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {phoneList.length} números válidos
                </Badge>
              )}
            </Label>
            <Textarea
              id="numbers"
              placeholder={`Insira um número por linha:\n51999887766\n51988776655\n...`}
              value={numbers}
              onChange={(e) => setNumbers(e.target.value)}
              rows={5}
              className="resize-none font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Formato: DDD + Número (um por linha). Ex: 51999887766
            </p>
          </div>

          {/* Mensagem */}
          <div className="space-y-2">
            <Label htmlFor="messageMassa">Mensagem</Label>
            <Textarea
              id="messageMassa"
              placeholder="Digite sua mensagem aqui..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              className="resize-none"
            />
            <div className="flex items-center justify-between text-xs">
              <span className={isOverLimit ? 'text-destructive font-medium' : 'text-muted-foreground'}>
                Você digitou <strong>{charCount}</strong> de {MAX_SMS_CHARS} caracteres
                {smsCount > 1 && ` (${smsCount} SMS por destinatário)`}
              </span>
              {isOverLimit && (
                <Badge variant="outline" className="text-amber-600 border-amber-600">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Mensagem longa
                </Badge>
              )}
            </div>
          </div>

          {/* Resumo */}
          {phoneList.length > 0 && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h4 className="font-medium">Resumo do Envio</h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Destinatários</p>
                  <p className="font-medium text-lg">{phoneList.length}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">SMS por contato</p>
                  <p className="font-medium text-lg">{smsCount}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total de SMS</p>
                  <p className="font-medium text-lg text-primary">{totalSms}</p>
                </div>
              </div>
            </div>
          )}

          {/* Agendamento */}
          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center justify-between">
              <div>
                <Label>Agendar envio</Label>
                <p className="text-xs text-muted-foreground">
                  Programe o envio para uma data/hora específica
                </p>
              </div>
              <Switch
                checked={scheduleEnabled}
                onCheckedChange={setScheduleEnabled}
              />
            </div>
            
            {scheduleEnabled && (
              <div className="flex gap-3">
                <div className="flex-1">
                  <Label htmlFor="scheduleDateMassa" className="text-xs">Data</Label>
                  <Input
                    id="scheduleDateMassa"
                    type="date"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                  />
                </div>
                <div className="w-32">
                  <Label htmlFor="scheduleTimeMassa" className="text-xs">Hora</Label>
                  <Input
                    id="scheduleTimeMassa"
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Botão Enviar */}
          <Button 
            onClick={handleSendMassa} 
            className="w-full gap-2"
            disabled={isSending || phoneList.length === 0 || !message}
            size="lg"
          >
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Enviando... ({phoneList.length} SMS)
              </>
            ) : scheduleEnabled ? (
              <>
                <Clock className="h-4 w-4" />
                Agendar Envio em Massa
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Enviar para {phoneList.length} Números
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Phone Preview */}
      <div className="lg:col-span-2 flex justify-center">
        <PhonePreview message={message} />
      </div>
    </div>
  );
}

function PhonePreview({ message }: { message: string }) {
  return (
    <div className="relative w-64">
      {/* Phone Frame */}
      <div className="bg-gradient-to-b from-zinc-800 to-zinc-900 rounded-[2.5rem] p-3 shadow-xl">
        {/* Screen */}
        <div className="bg-background rounded-[2rem] overflow-hidden">
          {/* Status Bar */}
          <div className="bg-primary/10 px-4 py-2 flex items-center justify-between text-xs">
            <span className="font-medium">SMS</span>
            <div className="flex items-center gap-1">
              <div className="w-4 h-2 bg-foreground/20 rounded-sm">
                <div className="w-3 h-full bg-foreground/60 rounded-sm" />
              </div>
            </div>
          </div>
          
          {/* Header */}
          <div className="bg-muted/50 px-4 py-3 border-b flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Phone className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">Sua Empresa</p>
              <p className="text-xs text-muted-foreground">Mensagem SMS</p>
            </div>
          </div>
          
          {/* Message Area */}
          <ScrollArea className="h-72 p-4">
            {message ? (
              <div className="bg-muted rounded-xl rounded-tl-none p-3 max-w-[90%]">
                <p className="text-sm whitespace-pre-wrap break-words">{message}</p>
                <p className="text-[10px] text-muted-foreground text-right mt-1">
                  Agora
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-muted-foreground">
                  Sua mensagem aparecerá aqui
                </p>
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
      
      {/* Notch */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 w-20 h-5 bg-zinc-800 rounded-b-xl" />
    </div>
  );
}