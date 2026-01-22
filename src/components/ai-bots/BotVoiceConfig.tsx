import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Volume2, Play, Loader2, Mic, Zap, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { useOrgHasFeature } from "@/hooks/usePlanFeatures";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

// Curated voices for Brazilian Portuguese - expanded selection
export const CURATED_VOICES = [
  // Vozes masculinas
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George", gender: "male", description: "Profissional e amigável", icon: "👨‍💼" },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel", gender: "male", description: "Madura e confiante", icon: "👨‍🔬" },
  { id: "CwhRBWXzGAHq8TQ4Fs17", name: "Roger", gender: "male", description: "Voz grave e autoritária", icon: "🎙️" },
  { id: "IKne3meq5aSn9XLyUdCD", name: "Charlie", gender: "male", description: "Jovem e dinâmico", icon: "🧑" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam", gender: "male", description: "Casual e descontraído", icon: "😎" },
  { id: "nPczCjzI2devNBz1zQrb", name: "Brian", gender: "male", description: "Narrador profissional", icon: "📢" },
  { id: "cjVigY5qzO86Huf0OWal", name: "Eric", gender: "male", description: "Tom comercial/vendas", icon: "💼" },
  { id: "iP95p4xoKVk53GoZ742B", name: "Chris", gender: "male", description: "Amigável e acessível", icon: "🤝" },
  // Vozes femininas
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", gender: "female", description: "Jovem e acolhedora", icon: "👩" },
  { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily", gender: "female", description: "Suave e tranquila", icon: "🧘‍♀️" },
  { id: "cgSgspJ2msm6clMCkdW9", name: "Jessica", gender: "female", description: "Expressiva e energética", icon: "💃" },
  { id: "FGY2WhTYpPnrIDTdsKH5", name: "Laura", gender: "female", description: "Profissional e clara", icon: "👩‍💼" },
  { id: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice", gender: "female", description: "Elegante e sofisticada", icon: "✨" },
  { id: "XrExE9yKIg1WjnnlVkGX", name: "Matilda", gender: "female", description: "Calorosa e maternal", icon: "💝" },
  { id: "SAz9YHcvj6GT2YYXdXww", name: "River", gender: "female", description: "Neutra e versátil", icon: "🌊" },
  { id: "bIHbv24MWmeRgasZH58o", name: "Will", gender: "male", description: "Inspirador e motivador", icon: "⭐" },
];

const VOICE_STYLES = [
  { value: "natural", label: "Natural", description: "Equilibrado e profissional" },
  { value: "expressive", label: "Expressivo", description: "Mais emoção e variação" },
  { value: "calm", label: "Calmo", description: "Sereno e tranquilo" },
];

interface BotVoiceConfigProps {
  voiceEnabled: boolean;
  voiceId: string;
  voiceName: string;
  audioResponseProbability: number;
  voiceStyle: string;
  onVoiceEnabledChange: (enabled: boolean) => void;
  onVoiceIdChange: (id: string, name: string) => void;
  onAudioResponseProbabilityChange: (probability: number) => void;
  onVoiceStyleChange: (style: string) => void;
  organizationId?: string;
}

export function BotVoiceConfig({
  voiceEnabled,
  voiceId,
  voiceName,
  audioResponseProbability,
  voiceStyle,
  onVoiceEnabledChange,
  onVoiceIdChange,
  onAudioResponseProbabilityChange,
  onVoiceStyleChange,
  organizationId,
}: BotVoiceConfigProps) {
  const { data: hasVoiceFeature, isLoading: featureLoading } = useOrgHasFeature("bot_voice_responses");
  const [isTestingVoice, setIsTestingVoice] = useState(false);
  const [testAudio, setTestAudio] = useState<HTMLAudioElement | null>(null);

  const handleVoiceSelect = (id: string) => {
    const voice = CURATED_VOICES.find(v => v.id === id);
    if (voice) {
      onVoiceIdChange(id, voice.name);
    }
  };

  const handleTestVoice = async () => {
    if (!organizationId || !voiceId) return;

    setIsTestingVoice(true);
    try {
      const testText = "Olá! Eu sou o assistente virtual e estou aqui para te ajudar. Como posso te atender hoje?";
      
      const { data, error } = await supabase.functions.invoke("elevenlabs-tts", {
        body: {
          text: testText,
          voiceId,
          organizationId,
          voiceStyle,
        },
      });

      if (error) throw error;

      if (data?.audioUrl) {
        // Stop any existing audio
        if (testAudio) {
          testAudio.pause();
          testAudio.src = "";
        }

        const audio = new Audio(data.audioUrl);
        setTestAudio(audio);
        await audio.play();
        
        toast({
          title: "🎤 Teste de voz",
          description: `Consumo: ${data.energyConsumed} ⚡ energia`,
        });
      }
    } catch (error) {
      console.error("Error testing voice:", error);
      toast({
        variant: "destructive",
        title: "Erro ao testar voz",
        description: "Não foi possível gerar o áudio de teste",
      });
    } finally {
      setIsTestingVoice(false);
    }
  };

  // Feature not available
  if (!featureLoading && !hasVoiceFeature) {
    return (
      <Card className="border-dashed border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Volume2 className="h-5 w-5 text-amber-600" />
            Voz IA (ElevenLabs)
            <Badge variant="outline" className="ml-2 text-amber-600 border-amber-600">Premium</Badge>
          </CardTitle>
          <CardDescription className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Recurso não disponível no seu plano atual
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Faça upgrade do seu plano para permitir que seus robôs respondam com áudio humanizado via ElevenLabs.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Volume2 className="h-5 w-5 text-primary" />
          Voz IA (ElevenLabs)
          {voiceEnabled && (
            <Badge variant="secondary" className="ml-2">
              <Mic className="h-3 w-3 mr-1" />
              Ativo
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Permita que o robô responda com áudio para uma experiência mais humanizada
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <Label>Habilitar Respostas em Áudio</Label>
            <p className="text-sm text-muted-foreground">
              O robô poderá enviar mensagens de voz além de texto
            </p>
          </div>
          <Switch
            checked={voiceEnabled}
            onCheckedChange={onVoiceEnabledChange}
          />
        </div>

        {voiceEnabled && (
          <>
            {/* Voice Selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Voz do Robô</Label>
                <a 
                  href="https://elevenlabs.io/voice-library" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline"
                >
                  🎤 Explorar mais vozes
                </a>
              </div>
              
              {/* Gender filter tabs */}
              <div className="flex gap-2 mb-2">
                <Badge variant="outline" className="cursor-default">
                  8 Masculinas • 8 Femininas
                </Badge>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-[300px] overflow-y-auto pr-1">
                {CURATED_VOICES.map((voice) => (
                  <button
                    key={voice.id}
                    type="button"
                    onClick={() => handleVoiceSelect(voice.id)}
                    className={`p-2 rounded-lg border text-left transition-all ${
                      voiceId === voice.id
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="flex flex-col items-center gap-1 text-center">
                      <span className="text-xl">{voice.icon}</span>
                      <p className="font-medium text-xs">{voice.name}</p>
                      <p className="text-[10px] text-muted-foreground line-clamp-2">{voice.description}</p>
                      {voiceId === voice.id && (
                        <Badge variant="default" className="text-[10px] px-1">✓</Badge>
                      )}
                    </div>
                  </button>
                ))}
              </div>
              
              {/* Note about custom voices */}
              <p className="text-xs text-muted-foreground mt-2">
                💡 Para usar vozes clonadas, acesse a <a href="https://elevenlabs.io/voice-library" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">biblioteca ElevenLabs</a> e copie o ID da voz.
              </p>
            </div>

            {/* Voice Style */}
            <div className="space-y-2">
              <Label>Estilo da Voz</Label>
              <Select value={voiceStyle} onValueChange={onVoiceStyleChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VOICE_STYLES.map((style) => (
                    <SelectItem key={style.value} value={style.value}>
                      <div>
                        <span className="font-medium">{style.label}</span>
                        <span className="text-muted-foreground ml-2">- {style.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Audio Response Probability */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Probabilidade de Resposta em Áudio</Label>
                <Badge variant="outline">{audioResponseProbability}%</Badge>
              </div>
              <Slider
                value={[audioResponseProbability]}
                onValueChange={([value]) => onAudioResponseProbabilityChange(value)}
                min={0}
                max={100}
                step={5}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                {audioResponseProbability === 0 && "Nunca responde em áudio"}
                {audioResponseProbability > 0 && audioResponseProbability <= 25 && "Raramente responde em áudio"}
                {audioResponseProbability > 25 && audioResponseProbability <= 50 && "Às vezes responde em áudio"}
                {audioResponseProbability > 50 && audioResponseProbability <= 75 && "Frequentemente responde em áudio"}
                {audioResponseProbability > 75 && audioResponseProbability < 100 && "Quase sempre responde em áudio"}
                {audioResponseProbability === 100 && "Sempre responde em áudio"}
              </p>
            </div>

            {/* Energy Cost Warning */}
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <div className="flex items-start gap-2">
                <Zap className="h-4 w-4 text-amber-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-amber-800 dark:text-amber-200">Consumo de Energia</p>
                  <p className="text-amber-700 dark:text-amber-300 text-xs mt-1">
                    Áudios consomem mais energia: 15-100⚡ por mensagem de voz, dependendo do tamanho.
                  </p>
                </div>
              </div>
            </div>

            {/* Test Voice Button */}
            <Button
              variant="outline"
              onClick={handleTestVoice}
              disabled={isTestingVoice || !organizationId}
              className="w-full"
            >
              {isTestingVoice ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Gerando áudio...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Testar Voz
                </>
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
