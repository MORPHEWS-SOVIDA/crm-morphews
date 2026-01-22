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

// Curated voices for Brazilian Portuguese
export const CURATED_VOICES = [
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George", gender: "male", description: "Voz masculina profissional e amigável", icon: "👨‍💼" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", gender: "female", description: "Voz feminina jovem e acolhedora", icon: "👩" },
  { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily", gender: "female", description: "Voz feminina suave e tranquila", icon: "🧘‍♀️" },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel", gender: "male", description: "Voz masculina madura e confiante", icon: "👨‍🔬" },
  { id: "cgSgspJ2msm6clMCkdW9", name: "Jessica", gender: "female", description: "Voz feminina expressiva e energética", icon: "💃" },
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
              <Label>Voz do Robô</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {CURATED_VOICES.map((voice) => (
                  <button
                    key={voice.id}
                    type="button"
                    onClick={() => handleVoiceSelect(voice.id)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      voiceId === voice.id
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{voice.icon}</span>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{voice.name}</p>
                        <p className="text-xs text-muted-foreground">{voice.description}</p>
                      </div>
                      {voiceId === voice.id && (
                        <Badge variant="default" className="text-xs">Selecionado</Badge>
                      )}
                    </div>
                  </button>
                ))}
              </div>
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
