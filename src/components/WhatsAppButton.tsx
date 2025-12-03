import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface WhatsAppButtonProps {
  phone: string;
  message?: string;
  className?: string;
  variant?: 'default' | 'icon';
}

export function WhatsAppButton({ phone, message = '', className, variant = 'default' }: WhatsAppButtonProps) {
  const cleanPhone = phone.replace(/\D/g, '');
  const whatsappUrl = `https://wa.me/${cleanPhone}${message ? `?text=${encodeURIComponent(message)}` : ''}`;

  if (variant === 'icon') {
    return (
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-500 hover:bg-green-600 text-white transition-all duration-200 hover:scale-110',
          className
        )}
      >
        <MessageCircle className="w-4 h-4" />
      </a>
    );
  }

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
