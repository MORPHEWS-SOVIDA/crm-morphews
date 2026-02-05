 import { useState } from 'react';
 import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { Badge } from '@/components/ui/badge';
 import { Progress } from '@/components/ui/progress';
 import { 
   Plus, Play, Pause, PhoneOutgoing, Users, 
   Calendar, Check, Loader2, MoreHorizontal,
   Upload
 } from 'lucide-react';
 import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuTrigger,
 } from '@/components/ui/dropdown-menu';
 import { useVoiceAICampaigns } from '@/hooks/useVoiceAI';
 
 export function VoiceAICampaignsList() {
   const { data: campaigns, isLoading } = useVoiceAICampaigns();
 
   const getStatusBadge = (status: string) => {
     switch (status) {
       case 'running':
         return <Badge className="bg-green-500 hover:bg-green-600">Em andamento</Badge>;
       case 'paused':
         return <Badge variant="secondary">Pausado</Badge>;
       case 'completed':
         return <Badge variant="outline">Concluído</Badge>;
       case 'scheduled':
         return <Badge className="bg-blue-500 hover:bg-blue-600">Agendado</Badge>;
       case 'cancelled':
         return <Badge variant="destructive">Cancelado</Badge>;
       default:
         return <Badge variant="outline">Rascunho</Badge>;
     }
   };
 
   const getProgress = (campaign: typeof campaigns extends (infer T)[] ? T : never) => {
     if (!campaign.total_contacts) return 0;
     return Math.round((campaign.calls_completed / campaign.total_contacts) * 100);
   };
 
   if (isLoading) {
     return (
       <div className="flex items-center justify-center py-12">
         <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
       </div>
     );
   }
 
   return (
     <div className="space-y-4">
       {/* Header */}
       <Card>
         <CardHeader>
           <div className="flex items-center justify-between">
             <div>
               <CardTitle>Campanhas de Ligação Ativa</CardTitle>
               <CardDescription>
                 Disparo de ligações em massa com robô de voz
               </CardDescription>
             </div>
             <Button>
               <Plus className="h-4 w-4 mr-2" />
               Nova Campanha
             </Button>
           </div>
         </CardHeader>
       </Card>
 
       {/* Campaign List */}
       {(!campaigns || campaigns.length === 0) ? (
         <Card>
           <CardContent className="flex flex-col items-center justify-center py-12">
             <PhoneOutgoing className="h-12 w-12 text-muted-foreground mb-4" />
             <h4 className="font-medium">Nenhuma campanha criada</h4>
             <p className="text-sm text-muted-foreground mb-4 text-center max-w-sm">
               Crie uma campanha para disparar ligações em massa com seu robô de voz
             </p>
             <Button>
               <Upload className="h-4 w-4 mr-2" />
               Importar Contatos (CSV)
             </Button>
           </CardContent>
         </Card>
       ) : (
         <div className="space-y-3">
           {campaigns.map((campaign) => (
             <Card key={campaign.id} className="hover:border-primary/50 transition-colors">
               <CardContent className="p-4">
                 <div className="flex items-start justify-between">
                   <div className="space-y-2 flex-1">
                     <div className="flex items-center gap-3">
                       <h4 className="font-semibold">{campaign.name}</h4>
                       {getStatusBadge(campaign.status)}
                     </div>
                     
                     {campaign.description && (
                       <p className="text-sm text-muted-foreground">{campaign.description}</p>
                     )}
 
                     {/* Stats */}
                     <div className="flex items-center gap-6 text-sm">
                       <div className="flex items-center gap-1.5">
                         <Users className="h-4 w-4 text-muted-foreground" />
                         <span>{campaign.total_contacts} contatos</span>
                       </div>
                       <div className="flex items-center gap-1.5">
                         <PhoneOutgoing className="h-4 w-4 text-muted-foreground" />
                         <span>{campaign.calls_connected} atendidas</span>
                       </div>
                       <div className="flex items-center gap-1.5">
                         <Calendar className="h-4 w-4 text-muted-foreground" />
                         <span>{campaign.appointments_booked} agendamentos</span>
                       </div>
                     </div>
 
                     {/* Progress */}
                     {campaign.status === 'running' && (
                       <div className="space-y-1">
                         <Progress value={getProgress(campaign)} className="h-2" />
                         <p className="text-xs text-muted-foreground">
                           {campaign.calls_completed} de {campaign.total_contacts} ({getProgress(campaign)}%)
                         </p>
                       </div>
                     )}
 
                     {/* Agent */}
                     <p className="text-xs text-muted-foreground">
                       Agente: {campaign.agent?.name || 'Não definido'}
                     </p>
                   </div>
 
                   <div className="flex items-center gap-2">
                     {campaign.status === 'running' ? (
                       <Button variant="outline" size="icon">
                         <Pause className="h-4 w-4" />
                       </Button>
                     ) : campaign.status === 'paused' || campaign.status === 'draft' ? (
                       <Button variant="outline" size="icon">
                         <Play className="h-4 w-4" />
                       </Button>
                     ) : null}
 
                     <DropdownMenu>
                       <DropdownMenuTrigger asChild>
                         <Button variant="ghost" size="icon">
                           <MoreHorizontal className="h-4 w-4" />
                         </Button>
                       </DropdownMenuTrigger>
                       <DropdownMenuContent align="end">
                         <DropdownMenuItem>Ver detalhes</DropdownMenuItem>
                         <DropdownMenuItem>Editar</DropdownMenuItem>
                         <DropdownMenuItem>Adicionar contatos</DropdownMenuItem>
                         <DropdownMenuItem className="text-destructive">Cancelar</DropdownMenuItem>
                       </DropdownMenuContent>
                     </DropdownMenu>
                   </div>
                 </div>
               </CardContent>
             </Card>
           ))}
         </div>
       )}
     </div>
   );
 }