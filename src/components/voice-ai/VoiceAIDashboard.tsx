 import { useState } from 'react';
 import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
 import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
 import { Badge } from '@/components/ui/badge';
 import { Button } from '@/components/ui/button';
 import { 
   Phone, PhoneIncoming, PhoneOutgoing, Clock, 
   TrendingUp, Calendar, Users, Zap, Loader2,
   Play, Pause, RefreshCw
 } from 'lucide-react';
 import { useVoiceMinutesBalance, useVoiceAICallStats, useVoiceAICallLogs } from '@/hooks/useVoiceAI';
 import { VoiceAICallHistory } from './VoiceAICallHistory';
 import { VoiceAICampaignsList } from './VoiceAICampaignsList';
 
 export function VoiceAIDashboard() {
   const [statsPeriod, setStatsPeriod] = useState<'today' | 'week' | 'month'>('today');
   
   const { data: balance, isLoading: balanceLoading } = useVoiceMinutesBalance();
   const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useVoiceAICallStats(statsPeriod);
 
   const formatMinutes = (minutes: number) => {
     const hours = Math.floor(minutes / 60);
     const mins = minutes % 60;
     if (hours === 0) return `${mins}min`;
     return `${hours}h ${mins}min`;
   };
 
   const formatDuration = (seconds: number) => {
     const mins = Math.floor(seconds / 60);
     const secs = seconds % 60;
     return `${mins}:${secs.toString().padStart(2, '0')}`;
   };
 
   return (
     <div className="space-y-6">
       {/* Balance Card */}
       <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
         <CardContent className="p-6">
           <div className="flex items-center justify-between">
             <div className="space-y-1">
               <p className="text-sm text-muted-foreground">Saldo de Minutos</p>
               <div className="flex items-baseline gap-2">
                 {balanceLoading ? (
                   <Loader2 className="h-6 w-6 animate-spin" />
                 ) : (
                   <>
                     <span className="text-4xl font-bold text-primary">
                       {balance?.minutes_remaining || 0}
                     </span>
                     <span className="text-lg text-muted-foreground">minutos</span>
                   </>
                 )}
               </div>
               {balance && (
                 <p className="text-xs text-muted-foreground">
                   {balance.minutes_used} usados de {balance.minutes_purchased} comprados
                 </p>
               )}
             </div>
             <div className="flex items-center gap-3">
               <Badge variant="outline" className="flex items-center gap-1 px-3 py-1.5">
                 <Zap className="h-3 w-3" />
                 R$ 2,00/min
               </Badge>
               <Button variant="default" size="sm">
                 Comprar Minutos
               </Button>
             </div>
           </div>
         </CardContent>
       </Card>
 
       {/* Stats Cards */}
       <div className="flex items-center justify-between">
         <div className="flex items-center gap-2">
           <Button 
             variant={statsPeriod === 'today' ? 'default' : 'outline'} 
             size="sm"
             onClick={() => setStatsPeriod('today')}
           >
             Hoje
           </Button>
           <Button 
             variant={statsPeriod === 'week' ? 'default' : 'outline'} 
             size="sm"
             onClick={() => setStatsPeriod('week')}
           >
             7 dias
           </Button>
           <Button 
             variant={statsPeriod === 'month' ? 'default' : 'outline'} 
             size="sm"
             onClick={() => setStatsPeriod('month')}
           >
             30 dias
           </Button>
         </div>
         <Button variant="ghost" size="icon" onClick={() => refetchStats()}>
           <RefreshCw className="h-4 w-4" />
         </Button>
       </div>
 
       <div className="grid gap-4 md:grid-cols-4">
         <Card>
           <CardHeader className="pb-2">
             <CardTitle className="text-sm font-medium flex items-center gap-2">
               <Phone className="h-4 w-4 text-primary" />
               Total de Ligações
             </CardTitle>
           </CardHeader>
           <CardContent>
             {statsLoading ? (
               <Loader2 className="h-6 w-6 animate-spin" />
             ) : (
               <>
                 <p className="text-3xl font-bold">{stats?.totalCalls || 0}</p>
                 <p className="text-xs text-muted-foreground mt-1">
                   {stats?.completedCalls || 0} atendidas
                 </p>
               </>
             )}
           </CardContent>
         </Card>
 
         <Card>
           <CardHeader className="pb-2">
             <CardTitle className="text-sm font-medium flex items-center gap-2">
               <PhoneIncoming className="h-4 w-4 text-green-500" />
               Receptivas
             </CardTitle>
           </CardHeader>
           <CardContent>
             {statsLoading ? (
               <Loader2 className="h-6 w-6 animate-spin" />
             ) : (
               <>
                 <p className="text-3xl font-bold text-green-600">{stats?.inboundCalls || 0}</p>
                 <p className="text-xs text-muted-foreground mt-1">
                   Chamadas recebidas
                 </p>
               </>
             )}
           </CardContent>
         </Card>
 
         <Card>
           <CardHeader className="pb-2">
             <CardTitle className="text-sm font-medium flex items-center gap-2">
               <PhoneOutgoing className="h-4 w-4 text-blue-500" />
               Ativas
             </CardTitle>
           </CardHeader>
           <CardContent>
             {statsLoading ? (
               <Loader2 className="h-6 w-6 animate-spin" />
             ) : (
               <>
                 <p className="text-3xl font-bold text-blue-600">{stats?.outboundCalls || 0}</p>
                 <p className="text-xs text-muted-foreground mt-1">
                   Chamadas realizadas
                 </p>
               </>
             )}
           </CardContent>
         </Card>
 
         <Card>
           <CardHeader className="pb-2">
             <CardTitle className="text-sm font-medium flex items-center gap-2">
               <Clock className="h-4 w-4 text-amber-500" />
               Tempo Médio
             </CardTitle>
           </CardHeader>
           <CardContent>
             {statsLoading ? (
               <Loader2 className="h-6 w-6 animate-spin" />
             ) : (
               <>
                 <p className="text-3xl font-bold">{formatDuration(stats?.averageDuration || 0)}</p>
                 <p className="text-xs text-muted-foreground mt-1">
                   {formatMinutes(stats?.totalMinutes || 0)} total
                 </p>
               </>
             )}
           </CardContent>
         </Card>
       </div>
 
       {/* Performance Row */}
       <div className="grid gap-4 md:grid-cols-2">
         <Card>
           <CardHeader className="pb-2">
             <CardTitle className="text-sm font-medium flex items-center gap-2">
               <TrendingUp className="h-4 w-4 text-emerald-500" />
               Taxa de Atendimento
             </CardTitle>
           </CardHeader>
           <CardContent>
             <div className="flex items-end gap-3">
               <p className="text-4xl font-bold text-emerald-600">{stats?.answerRate || 0}%</p>
               <p className="text-sm text-muted-foreground pb-1">
                 das chamadas atendidas
               </p>
             </div>
           </CardContent>
         </Card>
 
         <Card>
           <CardHeader className="pb-2">
             <CardTitle className="text-sm font-medium flex items-center gap-2">
               <Calendar className="h-4 w-4 text-purple-500" />
               Agendamentos
             </CardTitle>
           </CardHeader>
           <CardContent>
             <div className="flex items-end gap-3">
               <p className="text-4xl font-bold text-purple-600">{stats?.appointmentsBooked || 0}</p>
               <p className="text-sm text-muted-foreground pb-1">
                 compromissos marcados
               </p>
             </div>
           </CardContent>
         </Card>
       </div>
 
       {/* Tabs for Inbound/Outbound */}
       <Tabs defaultValue="inbound" className="space-y-4">
         <TabsList className="grid w-full grid-cols-3">
           <TabsTrigger value="inbound" className="flex items-center gap-2">
             <PhoneIncoming className="h-4 w-4" />
             Receptivas
           </TabsTrigger>
           <TabsTrigger value="outbound" className="flex items-center gap-2">
             <PhoneOutgoing className="h-4 w-4" />
             Ativas (Campanhas)
           </TabsTrigger>
           <TabsTrigger value="all" className="flex items-center gap-2">
             <Phone className="h-4 w-4" />
             Histórico Completo
           </TabsTrigger>
         </TabsList>
 
         <TabsContent value="inbound">
           <Card>
             <CardHeader>
               <CardTitle>Ligações Receptivas</CardTitle>
               <CardDescription>
                 Chamadas recebidas e atendidas pelo robô de voz
               </CardDescription>
             </CardHeader>
             <CardContent>
               <VoiceAICallHistory direction="inbound" />
             </CardContent>
           </Card>
         </TabsContent>
 
         <TabsContent value="outbound">
           <VoiceAICampaignsList />
         </TabsContent>
 
         <TabsContent value="all">
           <Card>
             <CardHeader>
               <CardTitle>Histórico Completo</CardTitle>
               <CardDescription>
                 Todas as chamadas receptivas e ativas
               </CardDescription>
             </CardHeader>
             <CardContent>
               <VoiceAICallHistory />
             </CardContent>
           </Card>
         </TabsContent>
       </Tabs>
     </div>
   );
 }