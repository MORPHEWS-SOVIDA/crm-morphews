import { Button } from '@/components/ui/button';
import { Search, Menu, ArrowLeft, Info, Phone as PhoneIcon } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface MobileHeaderProps {
  // Lista de conversas (sem conversa selecionada)
  showSearch?: boolean;
  onSearchClick?: () => void;
  onMenuClick?: () => void;
  title?: string;
  
  // Chat (com conversa selecionada)
  conversation?: {
    contact_name: string | null;
    contact_profile_pic: string | null;
    phone_number: string;
    is_group?: boolean;
    display_name?: string;
    group_subject?: string;
  } | null;
  onBack?: () => void;
  onInfoClick?: () => void;
  onCallClick?: () => void;
  instanceLabel?: string | null;
  isConnected?: boolean;
}

export function MobileHeader({
  showSearch,
  onSearchClick,
  onMenuClick,
  title,
  conversation,
  onBack,
  onInfoClick,
  onCallClick,
  instanceLabel,
  isConnected = true,
}: MobileHeaderProps) {
  // Header para lista de conversas
  if (!conversation) {
    return (
      <div className="flex items-center justify-between px-4 py-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <h1 className="text-lg font-semibold">{title || 'WhatsApp'}</h1>
        <div className="flex items-center gap-1">
          {showSearch && (
            <Button variant="ghost" size="icon" onClick={onSearchClick} className="h-9 w-9">
              <Search className="h-5 w-5" />
            </Button>
          )}
          {onMenuClick && (
            <Button variant="ghost" size="icon" onClick={onMenuClick} className="h-9 w-9">
              <Menu className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Header para chat
  const displayName = conversation.display_name || conversation.contact_name || 
    (conversation.is_group ? (conversation.group_subject || 'Grupo') : conversation.phone_number);

  return (
    <div className="flex items-center gap-2 px-2 py-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={onBack}
        className="h-9 w-9 flex-shrink-0"
      >
        <ArrowLeft className="h-5 w-5" />
      </Button>
      
      <div 
        className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
        onClick={onInfoClick}
      >
        <Avatar className="h-9 w-9">
          <AvatarImage src={conversation.contact_profile_pic || undefined} />
          <AvatarFallback className={cn(
            "text-sm text-white",
            conversation.is_group ? "bg-blue-500" : "bg-green-500"
          )}>
            {conversation.is_group ? '👥' : displayName?.[0]?.toUpperCase() || '?'}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">
            {conversation.is_group && <span className="text-blue-500 mr-1">👥</span>}
            {displayName}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {instanceLabel || conversation.phone_number}
            {!isConnected && (
              <span className="text-amber-600 ml-1">• Desconectado</span>
            )}
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-1 flex-shrink-0">
        {onCallClick && (
          <Button variant="ghost" size="icon" onClick={onCallClick} className="h-9 w-9">
            <PhoneIcon className="h-4 w-4" />
          </Button>
        )}
        <Button variant="ghost" size="icon" onClick={onInfoClick} className="h-9 w-9">
          <Info className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
