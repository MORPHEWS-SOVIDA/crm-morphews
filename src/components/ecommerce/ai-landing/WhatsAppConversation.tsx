import { useState, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Check, CheckCheck, Play, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WhatsAppMessage } from './types';

interface WhatsAppConversationProps {
  messages: WhatsAppMessage[];
  contactName: string;
  contactPhoto?: string;
  audioUrl?: string;
  videoUrl?: string;
  autoAnimate?: boolean;
}

export function WhatsAppConversation({
  messages,
  contactName,
  contactPhoto,
  audioUrl,
  videoUrl,
  autoAnimate = true,
}: WhatsAppConversationProps) {
  const [visibleMessages, setVisibleMessages] = useState<number>(autoAnimate ? 0 : messages.length);
  const [isTyping, setIsTyping] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!autoAnimate || visibleMessages >= messages.length) return;

    // Show typing indicator
    setIsTyping(true);
    
    const typingTimeout = setTimeout(() => {
      setIsTyping(false);
      setVisibleMessages(prev => prev + 1);
    }, 800 + Math.random() * 1200); // Random delay between 800-2000ms

    return () => clearTimeout(typingTimeout);
  }, [visibleMessages, messages.length, autoAnimate]);

  const handlePlayAudio = () => {
    if (!audioUrl) return;
    
    const audio = new Audio(audioUrl);
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play();
      setIsPlaying(true);
      audio.onended = () => setIsPlaying(false);
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto">
      {/* WhatsApp Header */}
      <div className="bg-[#075E54] text-white px-4 py-3 rounded-t-xl flex items-center gap-3">
        <Avatar className="h-10 w-10 border-2 border-white/20">
          <AvatarImage src={contactPhoto} />
          <AvatarFallback className="bg-[#128C7E] text-white text-sm">
            {contactName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">{contactName}</div>
          <div className="text-xs text-white/70">online</div>
        </div>
      </div>

      {/* Messages Container */}
      <div 
        className="bg-[#ECE5DD] bg-[url('/whatsapp-bg.png')] p-3 space-y-2 min-h-[200px] max-h-[400px] overflow-y-auto"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23c5bfb7' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      >
        {messages.slice(0, visibleMessages).map((message, index) => (
          <div
            key={message.id}
            className={cn(
              'flex',
              message.isFromClient ? 'justify-end' : 'justify-start',
              'animate-in slide-in-from-bottom-2 fade-in duration-300'
            )}
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div
              className={cn(
                'max-w-[80%] rounded-lg px-3 py-2 shadow-sm relative',
                message.isFromClient
                  ? 'bg-[#DCF8C6] rounded-tr-none'
                  : 'bg-white rounded-tl-none'
              )}
            >
              {/* Tail */}
              <div
                className={cn(
                  'absolute top-0 w-3 h-3',
                  message.isFromClient
                    ? 'right-[-6px] border-t-8 border-l-8 border-t-[#DCF8C6] border-l-transparent'
                    : 'left-[-6px] border-t-8 border-r-8 border-t-white border-r-transparent'
                )}
              />
              
              {/* Image if present */}
              {message.hasImage && message.imageUrl && (
                <img
                  src={message.imageUrl}
                  alt="Attachment"
                  className="w-full rounded-lg mb-2 max-h-48 object-cover"
                />
              )}
              
              {/* Message Text */}
              <p className="text-sm text-gray-800 leading-relaxed break-words">
                {message.text}
              </p>
              
              {/* Timestamp and Read Status */}
              <div className="flex items-center justify-end gap-1 mt-1">
                <span className="text-[10px] text-gray-500">
                  {message.timestamp}
                </span>
                {message.isFromClient && (
                  <CheckCheck className="h-3 w-3 text-[#53BDEB]" />
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Typing Indicator */}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white rounded-lg px-4 py-2 shadow-sm">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Audio Player (if audio exists) */}
      {audioUrl && (
        <div className="bg-[#F0F0F0] px-4 py-2 flex items-center gap-3 border-t">
          <button
            onClick={handlePlayAudio}
            className="w-10 h-10 rounded-full bg-[#25D366] text-white flex items-center justify-center hover:bg-[#128C7E] transition-colors"
          >
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
          </button>
          <div className="flex-1">
            <div className="h-1 bg-gray-300 rounded-full overflow-hidden">
              <div 
                className={cn(
                  "h-full bg-[#25D366] transition-all duration-300",
                  isPlaying && "animate-pulse"
                )}
                style={{ width: isPlaying ? '50%' : '0%' }}
              />
            </div>
          </div>
          <span className="text-xs text-gray-500">0:12</span>
        </div>
      )}

      {/* Video Embed (if video exists) */}
      {videoUrl && (
        <div className="bg-black rounded-b-xl overflow-hidden">
          <video
            src={videoUrl}
            controls
            className="w-full max-h-48 object-contain"
            poster={contactPhoto}
          />
        </div>
      )}

      {/* Footer */}
      <div className="bg-[#F0F0F0] px-4 py-3 rounded-b-xl flex items-center gap-2">
        <div className="flex-1 bg-white rounded-full px-4 py-2 text-sm text-gray-400">
          Mensagem
        </div>
        <div className="w-10 h-10 rounded-full bg-[#25D366] flex items-center justify-center">
          <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
        </div>
      </div>
    </div>
  );
}
