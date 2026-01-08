import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { NewConversationDialog } from '@/components/whatsapp/NewConversationDialog';

interface WhatsAppButtonProps {
  phone: string;
  message?: string;
  className?: string;
  variant?: 'default' | 'icon' | 'external'; // 'external' abre wa.me
}

export function WhatsAppButton({ phone, message = '', className, variant = 'default' }: WhatsAppButtonProps) {
  const [showDialog, setShowDialog] = useState(false);
  const cleanPhone = phone.replace(/\D/g, '');
  
  // Variante 'external' mantém o comportamento antigo (abre wa.me)
  if (variant === 'external') {
    const whatsappUrl = `https://wa.me/${cleanPhone}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
    return (
      <Button
        asChild
        className={cn('bg-green-500 hover:bg-green-600 text-white', className)}
      >
        <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
          <MessageCircle className="w-4 h-4 mr-2" />
          WhatsApp
        </a>
      </Button>
    );
  }

  // Variante 'icon' - abre dialog de seleção de instância
  if (variant === 'icon') {
    return (
      <>
        <button
          onClick={() => setShowDialog(true)}
          className={cn(
            'inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-500 hover:bg-green-600 text-white transition-all duration-200 hover:scale-110',
            className
          )}
        >
          <MessageCircle className="w-4 h-4" />
        </button>
        <NewConversationDialog
          open={showDialog}
          onOpenChange={setShowDialog}
          phoneNumber={cleanPhone}
          message={message}
        />
      </>
    );
  }

  // Variante 'default' - abre dialog de seleção de instância
  return (
    <>
      <Button
        onClick={() => setShowDialog(true)}
        className={cn('bg-green-500 hover:bg-green-600 text-white', className)}
      >
        <MessageCircle className="w-4 h-4 mr-2" />
        WhatsApp
      </Button>
      <NewConversationDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        phoneNumber={cleanPhone}
        message={message}
      />
    </>
  );
}
