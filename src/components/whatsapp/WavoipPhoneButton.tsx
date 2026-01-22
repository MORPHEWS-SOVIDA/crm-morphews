import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Delete,
  Loader2,
  Phone,
  PhoneCall,
  Power,
  PowerOff,
  Users,
  Video,
  X,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCallQueue, useUserCallAvailability, useWavoip } from '@/hooks/useWavoip';
import { useOrgHasFeature } from '@/hooks/usePlanFeatures';
import { cn } from '@/lib/utils';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface WavoipPhoneButtonProps {
  /**
   * Instância preferida (ex.: quando o usuário está filtrando por uma instância no chat).
   * Se estiver em "all" ou null, o componente escolhe automaticamente a primeira instância permitida.
   */
  instanceId?: string | null;
  className?: string;
}

type PhoneInstanceOption = {
  id: string;
  label: string;
  evolutionInstanceName: string;
};

type ProfileSummary = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
};

const DIALPAD_KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['*', '0', '#'],
];

export function WavoipPhoneButton({ instanceId, className }: WavoipPhoneButtonProps) {
  const { user, profile } = useAuth();
  const { data: hasWavoipFeature = false, isLoading: loadingFeature } = useOrgHasFeature("wavoip_calls");

  const [open, setOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [activeTab, setActiveTab] = useState<'dial' | 'queue'>('dial');
  const [activeInstanceId, setActiveInstanceId] = useState<string | null>(instanceId ?? null);

  // Don't render if Wavoip feature is not enabled for the organization
  if (!loadingFeature && !hasWavoipFeature) {
    return null;
  }

  // Instâncias onde o usuário tem permissão de "Telefone" + chamadas habilitadas
  const { data: phoneInstances = [], isLoading: loadingInstances } = useQuery({
    queryKey: ['wavoip-phone-instances', user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<PhoneInstanceOption[]> => {
      if (!user?.id) return [];

      const { data: perms, error: permsError } = await supabase
        .from('whatsapp_instance_users')
        .select('instance_id')
        .eq('user_id', user.id)
        .eq('can_use_phone', true)
        .eq('can_view', true);

      if (permsError) return [];

      const instanceIds = (perms || []).map((p: any) => p.instance_id).filter(Boolean) as string[];
      if (instanceIds.length === 0) return [];

      const { data: instances, error: instancesError } = await supabase
        .from('whatsapp_instances')
        .select('id, name, display_name_for_team, manual_instance_number, wavoip_enabled, evolution_instance_id')
        .in('id', instanceIds)
        .eq('wavoip_enabled', true)
        .order('name');

      if (instancesError) return [];

      return (instances || []).map((i: any) => {
        const display = i.display_name_for_team || i.name;
        const suffix = i.manual_instance_number ? ` · ${i.manual_instance_number}` : '';
        return {
          id: i.id,
          label: `${display}${suffix}`,
          evolutionInstanceName: i.evolution_instance_id || i.name,
        };
      });
    },
  });

  // Se o chat passar uma instância específica, prioriza ela
  useEffect(() => {
    if (instanceId && instanceId !== 'all') {
      setActiveInstanceId(instanceId);
    }
  }, [instanceId]);

  // Se não tiver instância ativa, escolhe a primeira permitida
  useEffect(() => {
    if (activeInstanceId) return;
    if (phoneInstances.length > 0) setActiveInstanceId(phoneInstances[0].id);
  }, [activeInstanceId, phoneInstances]);

  // Se a instância ativa não estiver mais permitida, cai para a primeira
  useEffect(() => {
    if (!activeInstanceId) return;
    if (phoneInstances.length === 0) return;
    const ok = phoneInstances.some((i) => i.id === activeInstanceId);
    if (!ok) setActiveInstanceId(phoneInstances[0].id);
  }, [activeInstanceId, phoneInstances]);

  const activeInstance = useMemo(
    () => phoneInstances.find((i) => i.id === activeInstanceId) || null,
    [phoneInstances, activeInstanceId]
  );

  const { wavoipStatus, wavoipError, isLoadingCall, makeCall } = useWavoip(activeInstanceId);
  const { callQueue, isLoading: loadingQueue } = useCallQueue(activeInstanceId);
  const { isAvailable, setAvailable, isInQueue, queuePosition } = useUserCallAvailability(activeInstanceId);

  const canDialNow = wavoipStatus === 'available';

  // Usuários com permissão "Telefone" na instância ativa (somente para visualização)
  const { data: phoneUsers = [], isLoading: loadingPhoneUsers } = useQuery({
    queryKey: ['wavoip-phone-users', activeInstanceId],
    enabled: !!activeInstanceId && open,
    queryFn: async () => {
      if (!activeInstanceId) return [];

      const { data: rows, error } = await supabase
        .from('whatsapp_instance_users')
        .select('id, user_id')
        .eq('instance_id', activeInstanceId)
        .eq('can_use_phone', true);

      if (error) return [];

      const userIds = (rows || []).map((r: any) => r.user_id);
      if (userIds.length === 0) return [];

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, avatar_url')
        .in('user_id', userIds);

      if (profilesError) return [];

      const byUserId = new Map((profiles || []).map((p: any) => [p.user_id, p as ProfileSummary]));
      return (rows || []).map((r: any) => ({ ...r, profiles: byUserId.get(r.user_id) || null }));
    },
  });

  // Se ainda estiver carregando instâncias, não renderiza nada para não "pular" layout
  if (loadingInstances) return null;

  // Se o usuário não tem acesso ao telefone em nenhuma instância, esconde o botão
  if (!activeInstanceId || phoneInstances.length === 0) return null;

  const handleKeyPress = (key: string) => setPhoneNumber((prev) => prev + key);
  const handleDelete = () => setPhoneNumber((prev) => prev.slice(0, -1));
  const handleClear = () => setPhoneNumber('');

  const handleCall = async (isVideo: boolean) => {
    if (!phoneNumber || phoneNumber.length < 10) return;
    if (!activeInstance) return;

    const success = await makeCall({
      instanceName: activeInstance.evolutionInstanceName,
      contactPhone: phoneNumber,
      isVideo,
    });

    if (success) {
      setOpen(false);
      setPhoneNumber('');
    }
  };

  const formatPhoneDisplay = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  };

  const statusDotClass = isAvailable ? 'bg-primary' : 'bg-muted-foreground/40';

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className={cn(
            'relative h-8 w-8 rounded-full',
            isAvailable ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border bg-background',
            className
          )}
          title="Telefone (receptivo)"
        >
          <Phone className="h-4 w-4" />
          <span
            className={cn(
              'absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background',
              statusDotClass
            )}
          />
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="w-[340px] sm:w-[380px] p-0 flex flex-col">
        <SheetHeader className="p-4 pb-0">
          <SheetTitle className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <PhoneCall className="h-5 w-5 text-primary" />
              <span className="truncate">Telefone</span>
            </div>

            <div
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border',
                isAvailable ? 'bg-primary/10 text-primary border-primary/20' : 'bg-muted text-muted-foreground border-border'
              )}
            >
              {isAvailable ? <Power className="h-3.5 w-3.5" /> : <PowerOff className="h-3.5 w-3.5" />}
              <span>{isAvailable ? 'Online' : 'Offline'}</span>
              <Switch checked={isAvailable} onCheckedChange={setAvailable} className="scale-75" />
            </div>
          </SheetTitle>

          {/* Se houver mais de uma instância liberada, permite alternar aqui (sem mexer no filtro do chat) */}
          {phoneInstances.length > 1 && (
            <div className="mt-3">
              <Select value={activeInstanceId || undefined} onValueChange={setActiveInstanceId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecione a instância" />
                </SelectTrigger>
                <SelectContent>
                  {phoneInstances.map((inst) => (
                    <SelectItem key={inst.id} value={inst.id}>
                      {inst.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Aviso quando o diagnóstico não estiver OK — mas o usuário ainda pode ficar Online/Offline */}
          {wavoipStatus !== 'available' && (
            <div className="mt-3 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium text-foreground">Chamadas indisponíveis no momento</p>
                  <p>
                    {wavoipError || 'O sistema não conseguiu validar o Wavoip agora. Você ainda pode ficar Online/Offline.'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-2 mx-4 mt-4" style={{ width: 'calc(100% - 32px)' }}>
            <TabsTrigger value="dial" className="gap-1">
              <Phone className="h-4 w-4" />
              Discar
            </TabsTrigger>
            <TabsTrigger value="queue" className="gap-1">
              <Users className="h-4 w-4" />
              Fila
              {phoneUsers.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {phoneUsers.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dial" className="flex-1 p-4 space-y-4 mt-0">
            <div className="relative">
              <Input
                value={formatPhoneDisplay(phoneNumber)}
                onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                placeholder="Digite o número"
                className="text-center text-2xl font-mono h-14 pr-12"
              />
              {phoneNumber && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10"
                  onClick={handleClear}
                >
                  <X className="h-5 w-5" />
                </Button>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              {DIALPAD_KEYS.flat().map((key) => (
                <Button
                  key={key}
                  variant="outline"
                  size="lg"
                  className="h-16 text-2xl font-semibold hover:bg-muted active:bg-muted/80 transition-all"
                  onClick={() => handleKeyPress(key)}
                >
                  {key}
                </Button>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2">
              <Button
                variant="outline"
                size="lg"
                className="h-16 flex-col gap-1"
                disabled={!canDialNow || isLoadingCall || phoneNumber.length < 10}
                onClick={() => handleCall(true)}
              >
                {isLoadingCall ? <Loader2 className="h-6 w-6 animate-spin" /> : <Video className="h-6 w-6" />}
                <span className="text-[10px]">Vídeo</span>
              </Button>

              <Button
                size="lg"
                className="h-16 flex-col gap-1"
                disabled={!canDialNow || isLoadingCall || phoneNumber.length < 10}
                onClick={() => handleCall(false)}
              >
                {isLoadingCall ? <Loader2 className="h-6 w-6 animate-spin" /> : <Phone className="h-6 w-6" />}
                <span className="text-[10px]">Ligar</span>
              </Button>

              <Button
                variant="outline"
                size="lg"
                className="h-16 flex-col gap-1"
                onClick={handleDelete}
                disabled={!phoneNumber}
              >
                <Delete className="h-6 w-6" />
                <span className="text-[10px]">Apagar</span>
              </Button>
            </div>

            <p className="text-[11px] text-muted-foreground">
              Receptivo: deixe seu status <span className="font-medium text-foreground">Online</span> para entrar na fila.
            </p>
          </TabsContent>

          <TabsContent value="queue" className="flex-1 p-4 mt-0 flex flex-col">
            <div
              className={cn(
                'p-4 rounded-lg border mb-4',
                isAvailable ? 'border-primary/20 bg-primary/10' : 'border-border bg-muted/30'
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12 border-2 border-background">
                    <AvatarImage src={profile?.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {profile?.first_name?.[0] || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold">
                      {profile?.first_name} {profile?.last_name}
                    </p>
                    <div className="flex items-center gap-2">
                      <Badge variant={isAvailable ? 'default' : 'secondary'} className="text-xs">
                        {isAvailable ? 'Disponível' : 'Indisponível'}
                      </Badge>
                      {queuePosition !== undefined && isInQueue && (
                        <span className="text-xs text-muted-foreground">#{queuePosition + 1} na fila</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                {isAvailable ? 'Você receberá chamadas quando for sua vez na fila' : 'Ative para começar a receber chamadas'}
              </p>
            </div>

            <div className="flex-1 flex flex-col min-h-0">
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Usuários com acesso ao telefone
              </h4>

              <ScrollArea className="flex-1 -mx-4 px-4">
                {loadingPhoneUsers ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : phoneUsers.length > 0 ? (
                  <div className="space-y-2">
                    {phoneUsers.map((entry: any, index: number) => {
                      const isCurrentUser = entry.user_id === user?.id;
                      const queueEntry = (callQueue || []).find((q: any) => q.user_id === entry.user_id);
                      const userIsAvailable = queueEntry?.is_available ?? false;
                      const p = entry.profiles as ProfileSummary | null;

                      return (
                        <div
                          key={entry.id}
                          className={cn(
                            'flex items-center justify-between p-3 rounded-lg border',
                            userIsAvailable ? 'bg-primary/10 border-primary/20' : 'bg-muted/40 border-border',
                            isCurrentUser && 'ring-2 ring-primary/20'
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold',
                                userIsAvailable ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                              )}
                            >
                              {index + 1}
                            </div>
                            <Avatar className="h-9 w-9">
                              <AvatarImage src={p?.avatar_url || undefined} />
                              <AvatarFallback className="text-xs">{p?.first_name?.[0] || 'U'}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium">
                                {[p?.first_name, p?.last_name].filter(Boolean).join(' ') || 'Usuário'}
                                {isCurrentUser && (
                                  <span className="text-xs text-muted-foreground ml-1">(você)</span>
                                )}
                              </p>
                              <p className="text-xs text-muted-foreground">{userIsAvailable ? 'Online' : 'Offline'}</p>
                            </div>
                          </div>
                          <div
                            className={cn(
                              'w-3 h-3 rounded-full',
                              userIsAvailable ? 'bg-primary' : 'bg-muted-foreground/30'
                            )}
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium">Nenhum usuário com permissão</p>
                    <p className="text-xs mt-1">Ative a coluna “Telefone” nas permissões da instância</p>
                  </div>
                )}
              </ScrollArea>
            </div>

            <div className="text-xs text-muted-foreground bg-muted p-3 rounded-lg mt-4">
              <p className="flex items-start gap-2">
                <span className="text-base leading-none">ℹ️</span>
                <span>
                  A fila é <span className="font-medium text-foreground">round-robin</span>. Quando alguém recebe uma chamada,
                  vai para o final.
                </span>
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}