import { useState } from 'react';
import { 
  Drawer, 
  DrawerContent, 
  DrawerHeader, 
  DrawerTitle, 
  DrawerDescription, 
  DrawerFooter, 
  DrawerClose 
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { 
  User, 
  Star, 
  ExternalLink, 
  Link, 
  Phone, 
  Mail, 
  Instagram, 
  MessageSquare,
  Calendar,
  Tag,
  UserCheck,
  Clock,
  Zap,
  Bot,
  XCircle,
  Copy,
  Check
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Lead {
  id: string;
  name: string;
  instagram: string;
  whatsapp: string;
  email: string | null;
  stage: string;
  stars: number;
}

interface Conversation {
  id: string;
  phone_number: string;
  contact_name: string | null;
  contact_profile_pic: string | null;
  last_message_at: string | null;
  unread_count: number;
  lead_id: string | null;
  instance_id: string | null;
  status?: string;
  assigned_user_id?: string | null;
  designated_user_id?: string | null;
  is_group?: boolean;
  display_name?: string;
  group_subject?: string;
}

interface MobileLeadDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: Conversation | null;
  lead: Lead | null;
  assignedUserName?: string | null;
  instanceLabel?: string | null;
  isUpdatingStars?: boolean;
  onUpdateStars?: (stars: number) => void;
  onNavigateToLead?: () => void;
  onLinkLead?: () => void;
  getStageDisplayName?: (stage: string) => string;
}

export function MobileLeadDrawer({
  open,
  onOpenChange,
  conversation,
  lead,
  assignedUserName,
  instanceLabel,
  isUpdatingStars = false,
  onUpdateStars,
  onNavigateToLead,
  onLinkLead,
  getStageDisplayName,
}: MobileLeadDrawerProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!conversation) return null;

  const displayName = conversation.display_name || conversation.contact_name || 
    (conversation.is_group ? (conversation.group_subject || 'Grupo') : conversation.phone_number);
  
  const status = conversation.status || 'pending';

  const getStatusInfo = () => {
    switch (status) {
      case 'with_bot':
        return { icon: Bot, label: 'Com Robô', color: 'bg-purple-100 text-purple-700 border-purple-200' };
      case 'pending':
        return { icon: Clock, label: 'Pendente', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' };
      case 'autodistributed':
        return { icon: Zap, label: 'Auto-distribuído', color: 'bg-blue-100 text-blue-700 border-blue-200' };
      case 'assigned':
        return { icon: UserCheck, label: 'Atribuído', color: 'bg-green-100 text-green-700 border-green-200' };
      case 'closed':
        return { icon: XCircle, label: 'Encerrado', color: 'bg-gray-100 text-gray-700 border-gray-200' };
      default:
        return { icon: MessageSquare, label: 'Conversa', color: 'bg-gray-100 text-gray-700 border-gray-200' };
    }
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="pb-2">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border-2 border-border">
              <AvatarImage src={conversation.contact_profile_pic || undefined} />
              <AvatarFallback className={cn(
                "text-xl font-semibold text-white",
                conversation.is_group ? "bg-blue-500" : "bg-gradient-to-br from-green-400 to-green-600"
              )}>
                {conversation.is_group ? '👥' : displayName?.[0]?.toUpperCase() || '?'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <DrawerTitle className="text-left truncate">{displayName}</DrawerTitle>
              <DrawerDescription className="text-left">
                {conversation.is_group ? 'Grupo' : conversation.phone_number}
              </DrawerDescription>
              <div className="flex items-center gap-2 mt-1.5">
                <Badge variant="outline" className={cn("text-xs", statusInfo.color)}>
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {statusInfo.label}
                </Badge>
                {assignedUserName && status === 'assigned' && (
                  <Badge variant="secondary" className="text-xs">
                    {assignedUserName}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </DrawerHeader>

        <Separator />

        <div className="p-4 space-y-4 overflow-y-auto">
          {/* Quick Info Cards */}
          <div className="grid grid-cols-2 gap-3">
            {/* Phone */}
            <button 
              onClick={() => copyToClipboard(conversation.phone_number, 'phone')}
              className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-left"
            >
              <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                <Phone className="h-4 w-4 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Telefone</p>
                <p className="text-xs font-medium truncate">{conversation.phone_number}</p>
              </div>
              {copiedField === 'phone' ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </button>

            {/* Instance */}
            {instanceLabel && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                  <MessageSquare className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Instância</p>
                  <p className="text-xs font-medium truncate">{instanceLabel}</p>
                </div>
              </div>
            )}

            {/* Last Message */}
            {conversation.last_message_at && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center">
                  <Calendar className="h-4 w-4 text-orange-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Última msg</p>
                  <p className="text-xs font-medium">
                    {format(new Date(conversation.last_message_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>
            )}

            {/* Unread */}
            {conversation.unread_count > 0 && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10">
                <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <MessageSquare className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Não lidas</p>
                  <p className="text-sm font-bold text-primary">{conversation.unread_count}</p>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Lead Section */}
          {lead ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Tag className="h-4 w-4 text-primary" />
                  Lead Vinculado
                </h3>
                <Badge variant="outline" className="text-xs">
                  {getStageDisplayName?.(lead.stage) || lead.stage}
                </Badge>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/20 text-primary font-semibold">
                      {lead.name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{lead.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{lead.whatsapp}</p>
                  </div>
                </div>

                {/* Lead Details */}
                <div className="space-y-2">
                  {lead.email && (
                    <button 
                      onClick={() => copyToClipboard(lead.email!, 'email')}
                      className="flex items-center gap-2 w-full p-2 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm flex-1 text-left truncate">{lead.email}</span>
                      {copiedField === 'email' ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </button>
                  )}
                  
                  {lead.instagram && (
                    <a 
                      href={`https://instagram.com/${lead.instagram.replace('@', '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 w-full p-2 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <Instagram className="h-4 w-4 text-pink-500" />
                      <span className="text-sm flex-1 text-left text-pink-600">{lead.instagram}</span>
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                    </a>
                  )}
                </div>

                {/* Stars */}
                <div className="flex items-center justify-between p-2">
                  <span className="text-sm text-muted-foreground">Avaliação:</span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => onUpdateStars?.(star)}
                        disabled={isUpdatingStars}
                        className="p-0.5 touch-manipulation"
                      >
                        <Star className={cn(
                          "h-6 w-6 transition-colors",
                          star <= (lead.stars || 0) 
                            ? "fill-yellow-400 text-yellow-400" 
                            : "text-gray-300 hover:text-yellow-300"
                        )} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <Button 
                className="w-full" 
                onClick={() => {
                  onOpenChange(false);
                  onNavigateToLead?.();
                }}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Ver Lead Completo
              </Button>
            </div>
          ) : (
            <div className="text-center py-6">
              <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
                <User className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Nenhum lead vinculado</p>
              <p className="text-xs text-muted-foreground/70 mb-4">
                Vincule este contato a um lead para acompanhar o histórico
              </p>
              <Button 
                onClick={() => {
                  onOpenChange(false);
                  onLinkLead?.();
                }}
                className="gap-2"
              >
                <Link className="h-4 w-4" />
                Vincular Lead
              </Button>
            </div>
          )}
        </div>

        <DrawerFooter className="pt-2">
          <DrawerClose asChild>
            <Button variant="outline" className="w-full">Fechar</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
