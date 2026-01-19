import { useState } from 'react';
import { Phone, Loader2, AlertTriangle, PhoneOff, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useWavoip, type WavoipStatus } from '@/hooks/useWavoip';
import { cn } from '@/lib/utils';

interface WavoipCallButtonProps {
  instanceId: string | null;
  instanceName?: string;
  contactPhone: string;
  contactName?: string;
  leadId?: string;
  conversationId?: string;
  className?: string;
  size?: 'default' | 'sm' | 'lg' | 'icon';
  variant?: 'default' | 'outline' | 'ghost';
}

export function WavoipCallButton({
  instanceId,
  instanceName,
  contactPhone,
  contactName,
  leadId,
  conversationId,
  className,
  size = 'sm',
  variant = 'default',
}: WavoipCallButtonProps) {
  const { 
    wavoipStatus, 
    wavoipError, 
    isLoadingCall, 
    makeCall,
    instanceConfig,
  } = useWavoip(instanceId);

  const handleCall = async (isVideo: boolean = false) => {
    const targetInstanceName = instanceName || instanceConfig?.instanceName;
    
    if (!targetInstanceName) {
      console.error('No instance name available');
      return;
    }

    const confirmed = window.confirm(
      `Deseja ${isVideo ? 'fazer uma videochamada' : 'ligar'} para ${contactName || contactPhone} via WhatsApp?`
    );
    
    if (!confirmed) return;

    await makeCall({
      instanceName: targetInstanceName,
      contactPhone,
      contactName,
      leadId,
      conversationId,
      isVideo,
    });
  };

  // Don't render anything if Wavoip is disabled or checking
  if (wavoipStatus === 'disabled' || wavoipStatus === 'checking') {
    if (wavoipStatus === 'checking') {
      return (
        <Button
          size={size}
          variant="ghost"
          disabled
          className={cn("text-muted-foreground", className)}
        >
          <Loader2 className="h-4 w-4 animate-spin mr-1" />
          <span className="hidden sm:inline">Verificando...</span>
        </Button>
      );
    }
    return null;
  }

  // Show error state
  if (wavoipStatus === 'unavailable' || wavoipStatus === 'error') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size={size}
              variant="ghost"
              disabled
              className={cn("text-muted-foreground opacity-50", className)}
            >
              <PhoneOff className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Chamadas</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm">Chamadas indisponíveis</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {wavoipError || 'Wavoip não configurado'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Abra o console (F12) para detalhes.
                </p>
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Wavoip available - show call button with dropdown for video option
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size={size}
          variant={variant}
          disabled={isLoadingCall || !contactPhone}
          className={cn(
            "bg-green-600 hover:bg-green-700 text-white",
            isLoadingCall && "opacity-70",
            className
          )}
        >
          {isLoadingCall ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
              <span className="hidden sm:inline">Ligando...</span>
            </>
          ) : (
            <>
              <Phone className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Ligar</span>
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleCall(false)}>
          <Phone className="h-4 w-4 mr-2" />
          Chamada de voz
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleCall(true)}>
          <Video className="h-4 w-4 mr-2" />
          Videochamada
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Compact version for mobile or tight spaces
 */
export function WavoipCallButtonCompact({
  instanceId,
  instanceName,
  contactPhone,
  contactName,
  leadId,
  conversationId,
  className,
}: Omit<WavoipCallButtonProps, 'size' | 'variant'>) {
  const { 
    wavoipStatus, 
    isLoadingCall, 
    makeCall,
    instanceConfig,
  } = useWavoip(instanceId);

  const handleCall = async () => {
    const targetInstanceName = instanceName || instanceConfig?.instanceName;
    
    if (!targetInstanceName) return;

    const confirmed = window.confirm(
      `Ligar para ${contactName || contactPhone}?`
    );
    
    if (!confirmed) return;

    await makeCall({
      instanceName: targetInstanceName,
      contactPhone,
      contactName,
      leadId,
      conversationId,
      isVideo: false,
    });
  };

  if (wavoipStatus !== 'available') {
    return null;
  }

  return (
    <Button
      size="icon"
      variant="ghost"
      disabled={isLoadingCall || !contactPhone}
      onClick={handleCall}
      className={cn(
        "h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50",
        className
      )}
    >
      {isLoadingCall ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Phone className="h-4 w-4" />
      )}
    </Button>
  );
}
