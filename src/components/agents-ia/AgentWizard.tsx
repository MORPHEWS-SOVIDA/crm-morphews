import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ShoppingCart, HeadphonesIcon, PhoneCall, UserCheck, CalendarCheck,
  ArrowLeft, ArrowRight, Sparkles, Loader2, Check, Mic, Image, FileText
} from "lucide-react";
import { useCreateAgent } from "@/hooks/useAgentsIA";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AgentWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
}

const MISSIONS = [
  { key: "sales", label: "Vendas", desc: "Converte leads em clientes", icon: ShoppingCart },
  { key: "support", label: "Suporte Pós-Venda", desc: "Resolve dúvidas e problemas", icon: HeadphonesIcon },
  { key: "sac", label: "SAC", desc: "Atendimento ao cliente geral", icon: PhoneCall },
  { key: "qualification", label: "Qualificação de Leads", desc: "Filtra e qualifica prospects", icon: UserCheck },
  { key: "scheduling", label: "Agendamento", desc: "Agenda reuniões e consultas", icon: CalendarCheck },
];

const TONES = ["Formal", "Casual", "Direto", "Empático"];
const GENDERS = ["Feminino", "Masculino", "Neutro"];

const TRANSFER_OPTIONS = [
  "Cliente pediu explicitamente",
  "Reclamação grave",
  "Após 2 tentativas sem resolver",
  "Pedido de reembolso",
  "Nunca transferir",
];

interface WizardData {
  // Step 1
  mission: string;
  // Step 2
  name: string;
  gender: string;
  tone: string;
  useEmojis: boolean;
  presentName: boolean;
  // Step 3
  companyName: string;
  segment: string;
  products: string;
  targetAudience: string;
  mainObjection: string;
  // Step 4
  qualificationStrategy: string;
  neverDo: string;
  transferReasons: string[];
  // Step 5
  generatedPrompt: string;
  maxMessages: number;
  audioEnabled: boolean;
  imageEnabled: boolean;
  fileEnabled: boolean;
}

const initialData: WizardData = {
  mission: "",
  name: "",
  gender: "Neutro",
  tone: "Formal",
  useEmojis: true,
  presentName: true,
  companyName: "",
  segment: "",
  products: "",
  targetAudience: "",
  mainObjection: "",
  qualificationStrategy: "",
  neverDo: "",
  transferReasons: [],
  generatedPrompt: "",
  maxMessages: 10,
  audioEnabled: true,
  imageEnabled: false,
  fileEnabled: false,
};

export function AgentWizard({ open, onOpenChange, organizationId }: AgentWizardProps) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>({ ...initialData });
  const [generating, setGenerating] = useState(false);
  const createAgent = useCreateAgent();

  const STEPS = ["Missão", "Identidade", "Contexto", "Estratégia", "Gerar & Salvar"];

  const canAdvance = (): boolean => {
    switch (step) {
      case 0: return !!data.mission;
      case 1: return !!data.name.trim();
      case 2: return !!data.companyName.trim();
      case 3: return true;
      case 4: return !!data.generatedPrompt.trim();
      default: return false;
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("generate-bot-prompt", {
        body: {
          name: data.name,
          serviceType: data.mission,
          companyName: data.companyName,
          segment: data.segment,
          products: data.products,
          targetAudience: data.targetAudience,
          mainObjection: data.mainObjection,
          tone: data.tone.toLowerCase(),
          gender: data.gender.toLowerCase(),
          presentName: data.presentName,
          qualificationStrategy: data.qualificationStrategy,
          neverDo: data.neverDo,
          transferReasons: data.transferReasons,
          useEmojis: data.useEmojis,
          responseLength: data.tone === "Direto" ? "short" : "medium",
          interpretAudio: data.audioEnabled,
          interpretImages: data.imageEnabled,
          interpretDocuments: data.fileEnabled,
          maxMessages: data.maxMessages,
        },
      });

      if (error) throw error;
      if (result?.prompt) {
        setData(prev => ({ ...prev, generatedPrompt: result.prompt }));
        toast.success("Prompt gerado com sucesso!");
      } else {
        throw new Error("Resposta vazia da IA");
      }
    } catch (err: any) {
      toast.error("Erro ao gerar prompt: " + (err.message || "Tente novamente"));
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = () => {
    if (!data.generatedPrompt.trim()) return;
    createAgent.mutate(
      {
        organization_id: organizationId,
        name: data.name,
        personality: data.tone,
        system_prompt: data.generatedPrompt,
        max_messages: data.maxMessages,
        audio_enabled: data.audioEnabled,
        image_enabled: data.imageEnabled,
        file_enabled: data.fileEnabled,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          setStep(0);
          setData({ ...initialData });
        },
      }
    );
  };

  const toggleTransfer = (reason: string) => {
    setData(prev => ({
      ...prev,
      transferReasons: prev.transferReasons.includes(reason)
        ? prev.transferReasons.filter(r => r !== reason)
        : [...prev.transferReasons, reason],
    }));
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">Qual é o objetivo deste agente?</h2>
              <p className="text-muted-foreground">Escolha a missão principal</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {MISSIONS.map(m => (
                <button
                  key={m.key}
                  onClick={() => setData(prev => ({ ...prev, mission: m.key }))}
                  className={cn(
                    "flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all text-center",
                    data.mission === m.key
                      ? "border-primary bg-primary/5 shadow-md"
                      : "border-border hover:border-primary/50 hover:bg-muted/50"
                  )}
                >
                  <m.icon className={cn("h-10 w-10", data.mission === m.key ? "text-primary" : "text-muted-foreground")} />
                  <span className="font-semibold text-lg">{m.label}</span>
                  <span className="text-sm text-muted-foreground">{m.desc}</span>
                </button>
              ))}
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-6 max-w-lg mx-auto">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">Identidade do Agente</h2>
              <p className="text-muted-foreground">Defina a personalidade</p>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome do Agente *</Label>
                <Input placeholder="Ex: Sofia, Carlos, Assistente" value={data.name} onChange={e => setData(prev => ({ ...prev, name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Gênero</Label>
                <div className="flex gap-2">
                  {GENDERS.map(g => (
                    <Button key={g} variant={data.gender === g ? "default" : "outline"} size="sm" onClick={() => setData(prev => ({ ...prev, gender: g }))}>{g}</Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Tom de Voz</Label>
                <div className="flex flex-wrap gap-2">
                  {TONES.map(t => (
                    <Button key={t} variant={data.tone === t ? "default" : "outline"} size="sm" onClick={() => setData(prev => ({ ...prev, tone: t }))}>{t}</Button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label>Usa emojis nas respostas?</Label>
                <Switch checked={data.useEmojis} onCheckedChange={v => setData(prev => ({ ...prev, useEmojis: v }))} />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label>Apresenta-se com nome?</Label>
                <Switch checked={data.presentName} onCheckedChange={v => setData(prev => ({ ...prev, presentName: v }))} />
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6 max-w-lg mx-auto">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">Contexto do Negócio</h2>
              <p className="text-muted-foreground">Quanto mais detalhes, melhor o agente</p>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome da Empresa *</Label>
                <Input placeholder="Ex: MorpheusHub" value={data.companyName} onChange={e => setData(prev => ({ ...prev, companyName: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Segmento / Nicho</Label>
                <Input placeholder="Ex: Clínica estética, Loja de suplementos" value={data.segment} onChange={e => setData(prev => ({ ...prev, segment: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Principais Produtos ou Serviços</Label>
                <Textarea placeholder="Ex: LIFE, Chega de Cigarro, CellulitFree" value={data.products} onChange={e => setData(prev => ({ ...prev, products: e.target.value }))} rows={3} />
              </div>
              <div className="space-y-2">
                <Label>Público-alvo</Label>
                <Input placeholder="Ex: Mulheres 30-50 anos interessadas em saúde" value={data.targetAudience} onChange={e => setData(prev => ({ ...prev, targetAudience: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Maior objeção dos clientes</Label>
                <Input placeholder="Ex: Preço alto, não confia em compras online" value={data.mainObjection} onChange={e => setData(prev => ({ ...prev, mainObjection: e.target.value }))} />
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6 max-w-lg mx-auto">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">Estratégia</h2>
              <p className="text-muted-foreground">Defina regras de comportamento</p>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Como qualificar o lead?</Label>
                <Textarea placeholder="Ex: Perguntar se já usa suplementos e qual problema quer resolver" value={data.qualificationStrategy} onChange={e => setData(prev => ({ ...prev, qualificationStrategy: e.target.value }))} rows={3} />
              </div>
              <div className="space-y-2">
                <Label>O que este agente NUNCA deve fazer?</Label>
                <Textarea placeholder="Ex: Nunca inventar preços, nunca prometer entrega em prazo específico" value={data.neverDo} onChange={e => setData(prev => ({ ...prev, neverDo: e.target.value }))} rows={3} />
              </div>
              <div className="space-y-2">
                <Label>Máximo de mensagens antes de transferir</Label>
                <Input type="number" min={1} max={100} value={data.maxMessages} onChange={e => setData(prev => ({ ...prev, maxMessages: Number(e.target.value) }))} />
                <p className="text-xs text-muted-foreground">Após esse limite, o agente transfere para atendente humano.</p>
              </div>
              <div className="space-y-2">
                <Label>Quando transferir para humano?</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {TRANSFER_OPTIONS.map(opt => (
                    <Badge
                      key={opt}
                      variant={data.transferReasons.includes(opt) ? "default" : "outline"}
                      className="cursor-pointer text-sm py-1.5 px-3"
                      onClick={() => toggleTransfer(opt)}
                    >
                      {data.transferReasons.includes(opt) && <Check className="h-3 w-3 mr-1" />}
                      {opt}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6 max-w-2xl mx-auto">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">Gerar & Salvar</h2>
              <p className="text-muted-foreground">O Claude vai criar o prompt ideal com base nas suas respostas</p>
            </div>

            {!data.generatedPrompt ? (
              <div className="flex flex-col items-center gap-4 py-8">
                <Button size="lg" className="gap-2 text-lg px-8 py-6" onClick={handleGenerate} disabled={generating}>
                  {generating ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Criando seu agente especialista...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-5 w-5" />
                      Gerar Agente com IA
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-base font-semibold">Prompt Gerado (Modo Avançado)</Label>
                  <Textarea
                    value={data.generatedPrompt}
                    onChange={e => setData(prev => ({ ...prev, generatedPrompt: e.target.value }))}
                    rows={12}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">Você pode editar livremente antes de salvar.</p>
                </div>

                <Separator />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-2"><Mic className="h-4 w-4 text-primary" /><Label className="text-sm">Áudio</Label></div>
                    <Switch checked={data.audioEnabled} onCheckedChange={v => setData(prev => ({ ...prev, audioEnabled: v }))} />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-2"><Image className="h-4 w-4 text-primary" /><Label className="text-sm">Imagem</Label></div>
                    <Switch checked={data.imageEnabled} onCheckedChange={v => setData(prev => ({ ...prev, imageEnabled: v }))} />
                  </div>
                </div>

                <Button size="lg" className="w-full gap-2" onClick={handleSave} disabled={createAgent.isPending}>
                  {createAgent.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
                  {createAgent.isPending ? "Salvando..." : "Salvar Agente"}
                </Button>
              </div>
            )}
          </div>
        );
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setStep(0);
    setData({ ...initialData });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[95vh] overflow-y-auto p-0">
        {/* Progress header */}
        <div className="sticky top-0 z-10 bg-background border-b px-6 pt-6 pb-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {STEPS.map((s, i) => (
                <Badge key={s} variant={i === step ? "default" : i < step ? "secondary" : "outline"} className="text-xs">
                  {i < step ? <Check className="h-3 w-3 mr-1" /> : null}
                  {i + 1}. {s}
                </Badge>
              ))}
            </div>
            <span className="text-sm text-muted-foreground font-medium">{step + 1}/5</span>
          </div>
          <Progress value={((step + 1) / 5) * 100} className="h-2" />
        </div>

        {/* Content */}
        <div className="px-6 py-8">
          {renderStep()}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-background border-t px-6 py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => step > 0 ? setStep(step - 1) : handleClose()} className="gap-1">
            <ArrowLeft className="h-4 w-4" />
            {step > 0 ? "Anterior" : "Cancelar"}
          </Button>
          {step < 4 && (
            <Button onClick={() => setStep(step + 1)} disabled={!canAdvance()} className="gap-1">
              Próximo
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
