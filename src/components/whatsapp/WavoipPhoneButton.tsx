import { useState } from 'react';
import { Phone, Video, Delete, X, Loader2, PhoneCall, Users, Power, PowerOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useWavoip, useCallQueue, useUserCallAvailability } from '@/hooks/useWavoip';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

interface WavoipPhoneButtonProps {
  instanceId: string;
  instanceName?: string;
  className?: string;
}

const DIALPAD_KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['*', '0', '#'],
];

export function WavoipPhoneButton({ instanceId, instanceName, className }: WavoipPhoneButtonProps) {
  const [open, setOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [activeTab, setActiveTab] = useState<'dial' | 'queue'>('dial');
  const { wavoipStatus, isLoadingCall, makeCall, instanceConfig } = useWavoip(instanceId);
  const { callQueue, isLoading: loadingQueue } = useCallQueue(instanceId);
  const { isInQueue, isAvailable, setAvailable, queuePosition } = useUserCallAvailability(instanceId);
  const { profile, user } = useAuth();

  // Check if current user has phone permission for this instance
  const { data: hasPhonePermission, isLoading: checkingPermission } = useQuery({
    queryKey: ['user-phone-permission', instanceId, user?.id],
    queryFn: async () => {
      if (!user?.id || !instanceId) return false;
      
      const { data, error } = await supabase
        .from('whatsapp_instance_users')
        .select('can_use_phone')
        .eq('instance_id', instanceId)
        .eq('user_id', user.id)
        .single();

      if (error) return false;
      return data?.can_use_phone ?? false;
    },
    enabled: !!instanceId && !!user?.id,
  });

  // Fetch users with phone permission (for queue display)
  const { data: phoneUsers, isLoading: loadingPhoneUsers } = useQuery({
    queryKey: ['phone-users', instanceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_instance_users')
        .select(`
          id,
          user_id,
          can_use_phone,
          profiles:user_id (id, first_name, last_name, avatar_url)
        `)
        .eq('instance_id', instanceId)
        .eq('can_use_phone', true);

      if (error) return [];
      return data || [];
    },
    enabled: !!instanceId && open,
  });

  // Only show if wavoip is available and user has permission
  if (wavoipStatus !== 'available' || checkingPermission || !hasPhonePermission) {
    return null;
  }

  const handleKeyPress = (key: string) => {
    setPhoneNumber(prev => prev + key);
  };

  const handleDelete = () => {
    setPhoneNumber(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPhoneNumber('');
  };

  const handleCall = async (isVideo: boolean = false) => {
    if (!phoneNumber || phoneNumber.length < 10) return;

    const targetInstanceName = instanceName || instanceConfig?.instanceName;
    if (!targetInstanceName) return;

    const success = await makeCall({
      instanceName: targetInstanceName,
      contactPhone: phoneNumber,
      isVideo,
    });

    if (success) {
      setOpen(false);
      setPhoneNumber('');
    }
  };

  // Format phone number for display
  const formatPhoneDisplay = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className={cn(
            "relative h-9 w-9 rounded-full border-2",
            isAvailable 
              ? "border-green-500 bg-green-50 hover:bg-green-100 text-green-700" 
              : "border-muted hover:bg-muted",
            className
          )}
          title="Telefone WhatsApp"
        >
          <Phone className="h-4 w-4" />
          {/* Status indicator */}
          <span className={cn(
            "absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background",
            isAvailable ? "bg-green-500" : "bg-muted-foreground"
          )} />
        </Button>
      </SheetTrigger>
      
      <SheetContent side="right" className="w-[340px] sm:w-[380px] p-0 flex flex-col">
        <SheetHeader className="p-4 pb-0">
          <SheetTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PhoneCall className="h-5 w-5 text-green-600" />
              Telefone WhatsApp
            </div>
            {/* Availability Toggle */}
            <div className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium",
              isAvailable 
                ? "bg-green-100 text-green-700" 
                : "bg-muted text-muted-foreground"
            )}>
              {isAvailable ? (
                <Power className="h-3.5 w-3.5" />
              ) : (
                <PowerOff className="h-3.5 w-3.5" />
              )}
              <span>{isAvailable ? 'Online' : 'Offline'}</span>
              <Switch
                checked={isAvailable}
                onCheckedChange={setAvailable}
                className="scale-75"
              />
            </div>
          </SheetTitle>
        </SheetHeader>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-2 mx-4 mt-4" style={{ width: 'calc(100% - 32px)' }}>
            <TabsTrigger value="dial" className="gap-1">
              <Phone className="h-4 w-4" />
              Discar
            </TabsTrigger>
            <TabsTrigger value="queue" className="gap-1">
              <Users className="h-4 w-4" />
              Fila
              {phoneUsers && phoneUsers.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {phoneUsers.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Dialpad Tab */}
          <TabsContent value="dial" className="flex-1 p-4 space-y-4 mt-0">
            {/* Phone number display */}
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

            {/* Dialpad */}
            <div className="grid grid-cols-3 gap-2">
              {DIALPAD_KEYS.map((row, rowIdx) => (
                row.map((key) => (
                  <Button
                    key={`${rowIdx}-${key}`}
                    variant="outline"
                    size="lg"
                    className="h-16 text-2xl font-semibold hover:bg-muted active:bg-muted/80 transition-all"
                    onClick={() => handleKeyPress(key)}
                  >
                    {key}
                  </Button>
                ))
              ))}
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-3 gap-3 pt-2">
              {/* Video call */}
              <Button
                variant="outline"
                size="lg"
                className="h-16 flex-col gap-1"
                disabled={isLoadingCall || phoneNumber.length < 10}
                onClick={() => handleCall(true)}
              >
                {isLoadingCall ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <>
                    <Video className="h-6 w-6" />
                    <span className="text-[10px]">Vídeo</span>
                  </>
                )}
              </Button>

              {/* Voice call */}
              <Button
                size="lg"
                className="h-16 flex-col gap-1 bg-green-600 hover:bg-green-700 text-white"
                disabled={isLoadingCall || phoneNumber.length < 10}
                onClick={() => handleCall(false)}
              >
                {isLoadingCall ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <>
                    <Phone className="h-6 w-6" />
                    <span className="text-[10px]">Ligar</span>
                  </>
                )}
              </Button>

              {/* Delete */}
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
          </TabsContent>

          {/* Queue Tab */}
          <TabsContent value="queue" className="flex-1 p-4 mt-0 flex flex-col">
            {/* Current user status */}
            <div className={cn(
              "p-4 rounded-lg border-2 mb-4",
              isAvailable ? "border-green-300 bg-green-50" : "border-muted bg-muted/30"
            )}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12 border-2 border-background">
                    <AvatarImage src={profile?.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {profile?.first_name?.[0] || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold">{profile?.first_name} {profile?.last_name}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant={isAvailable ? "default" : "secondary"} className="text-xs">
                        {isAvailable ? '🟢 Disponível' : '⚫ Indisponível'}
                      </Badge>
                      {queuePosition !== undefined && isInQueue && (
                        <span className="text-xs text-muted-foreground">
                          #{queuePosition + 1} na fila
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                {isAvailable 
                  ? 'Você receberá chamadas quando for sua vez na fila'
                  : 'Ative para começar a receber chamadas'
                }
              </p>
            </div>

            {/* Users with phone permission */}
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
                ) : phoneUsers && phoneUsers.length > 0 ? (
                  <div className="space-y-2">
                    {phoneUsers.map((entry, index) => {
                      const isCurrentUser = entry.user_id === user?.id;
                      const queueEntry = callQueue?.find(q => q.user_id === entry.user_id);
                      const userIsAvailable = queueEntry?.is_available ?? false;

                      return (
                        <div
                          key={entry.id}
                          className={cn(
                            "flex items-center justify-between p-3 rounded-lg border transition-colors",
                            userIsAvailable 
                              ? "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800" 
                              : "bg-muted/50 border-muted",
                            isCurrentUser && "ring-2 ring-primary/30"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold",
                              userIsAvailable 
                                ? "bg-green-600 text-white" 
                                : "bg-muted-foreground/20 text-muted-foreground"
                            )}>
                              {index + 1}
                            </div>
                            <Avatar className="h-9 w-9">
                              <AvatarImage src={(entry.profiles as any)?.avatar_url} />
                              <AvatarFallback className="text-xs">
                                {(entry.profiles as any)?.first_name?.[0] || 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium">
                                {(entry.profiles as any)?.first_name} {(entry.profiles as any)?.last_name}
                                {isCurrentUser && <span className="text-xs text-muted-foreground ml-1">(você)</span>}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {userIsAvailable ? 'Online' : 'Offline'}
                              </p>
                            </div>
                          </div>
                          <div className={cn(
                            "w-3 h-3 rounded-full",
                            userIsAvailable ? "bg-green-500" : "bg-muted-foreground/30"
                          )} />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium">Nenhum usuário com permissão</p>
                    <p className="text-xs mt-1">Configure permissões nas configurações da instância</p>
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Info */}
            <div className="text-xs text-muted-foreground bg-muted p-3 rounded-lg mt-4">
              <p className="flex items-start gap-2">
                <span className="text-base leading-none">💡</span>
                <span>
                  As chamadas são distribuídas em ordem (round-robin). 
                  Após receber uma chamada, você vai para o final da fila.
                </span>
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}