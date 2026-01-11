import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Bot, Sparkles, Loader2, RefreshCw } from "lucide-react";
import { useGenerateBotAvatar } from "@/hooks/useGenerateBotAvatar";
import { cn } from "@/lib/utils";

interface AvatarGeneratorProps {
  botId: string;
  currentAvatarUrl?: string | null;
  name: string;
  gender: 'male' | 'female' | 'neutral';
  ageRange: '18-25' | '26-35' | '36-50' | '50+';
  serviceType: string;
  brazilianState?: string;
  personalityDescription?: string;
  size?: 'sm' | 'md' | 'lg';
  onAvatarGenerated?: (url: string) => void;
}

export function AvatarGenerator({
  botId,
  currentAvatarUrl,
  name,
  gender,
  ageRange,
  serviceType,
  brazilianState,
  personalityDescription,
  size = 'md',
  onAvatarGenerated
}: AvatarGeneratorProps) {
  const generateAvatar = useGenerateBotAvatar();
  const [showHover, setShowHover] = useState(false);

  const sizeClasses = {
    sm: 'h-12 w-12',
    md: 'h-20 w-20',
    lg: 'h-32 w-32'
  };

  const iconSizes = {
    sm: 'h-6 w-6',
    md: 'h-10 w-10',
    lg: 'h-16 w-16'
  };

  const handleGenerate = async () => {
    const result = await generateAvatar.mutateAsync({
      botId,
      name,
      gender,
      ageRange,
      serviceType,
      brazilianState,
      personalityDescription
    });

    if (result.avatarUrl && onAvatarGenerated) {
      onAvatarGenerated(result.avatarUrl);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div 
        className={cn(
          "relative rounded-full overflow-hidden border-2 border-primary/20 transition-all",
          sizeClasses[size],
          !currentAvatarUrl && "bg-primary/10"
        )}
        onMouseEnter={() => setShowHover(true)}
        onMouseLeave={() => setShowHover(false)}
      >
        {currentAvatarUrl ? (
          <img 
            src={currentAvatarUrl} 
            alt={name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Bot className={cn("text-primary", iconSizes[size])} />
          </div>
        )}

        {/* Overlay on hover */}
        {(showHover || generateAvatar.isPending) && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            {generateAvatar.isPending ? (
              <Loader2 className="h-6 w-6 text-white animate-spin" />
            ) : (
              <button
                onClick={handleGenerate}
                className="text-white hover:scale-110 transition-transform"
                title={currentAvatarUrl ? "Regenerar avatar" : "Gerar avatar"}
              >
                {currentAvatarUrl ? (
                  <RefreshCw className="h-6 w-6" />
                ) : (
                  <Sparkles className="h-6 w-6" />
                )}
              </button>
            )}
          </div>
        )}
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={handleGenerate}
        disabled={generateAvatar.isPending}
        className="gap-2"
      >
        {generateAvatar.isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Gerando...
          </>
        ) : currentAvatarUrl ? (
          <>
            <RefreshCw className="h-4 w-4" />
            Regenerar Avatar
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Gerar Avatar com IA
          </>
        )}
      </Button>
    </div>
  );
}
