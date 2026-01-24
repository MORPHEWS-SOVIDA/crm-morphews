import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Bot,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Route,
  MessageSquare,
  Clock,
  Heart,
  Users,
  Loader2,
  Crown,
  Shield,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface CrmConditions {
  has_purchase?: boolean;
  is_new_lead?: boolean;
  has_open_ticket?: boolean;
  no_purchase?: boolean;
}

export interface TimeConditions {
  outside_business_hours?: boolean;
  days_of_week?: number[];
}

export interface RouteData {
  id?: string;
  condition_type: string;
  keywords: string[] | null;
  intent_description: string | null;
  crm_conditions: CrmConditions | null;
  sentiment_conditions: string[] | null;
  time_conditions: TimeConditions | null;
  condition_label: string | null;
  priority: number;
  is_active: boolean;
}

interface BotTeamMemberRouteCardProps {
  member: {
    id: string;
    bot_id: string;
    bot?: {
      id: string;
      name: string;
      avatar_url: string | null;
      service_type: string;
    };
  };
  routes: RouteData[];
  isInitialBot: boolean;
  isFallbackBot: boolean;
  onAddRoute: (route: Omit<RouteData, "id">) => Promise<void>;
  onDeleteRoute: (routeId: string) => Promise<void>;
  onRemoveMember: () => void;
  isRemoving?: boolean;
  isAddingRoute?: boolean;
}

const CONDITION_TYPES = [
  { value: "keyword", label: "Palavras-chave", icon: MessageSquare, description: "Ativa quando detecta palavras específicas" },
  { value: "intent", label: "Intenção (IA)", icon: Route, description: "IA analisa o contexto e intenção" },
  { value: "crm_status", label: "Status no CRM", icon: Users, description: "Baseado no histórico do cliente" },
  { value: "sentiment", label: "Sentimento", icon: Heart, description: "Detecta emoção na mensagem" },
  { value: "time", label: "Horário/Turno", icon: Clock, description: "Baseado no momento do contato" },
];

const SENTIMENT_OPTIONS = [
  { value: "angry", label: "😠 Irritado/Bravo" },
  { value: "frustrated", label: "😤 Frustrado" },
  { value: "complaint", label: "😡 Reclamação" },
  { value: "urgent", label: "⚡ Urgente" },
  { value: "satisfied", label: "😊 Satisfeito" },
  { value: "confused", label: "🤔 Confuso" },
];

const CRM_OPTIONS = [
  { key: "is_new_lead", label: "Lead novo (primeiro contato)" },
  { key: "has_purchase", label: "Cliente com compra" },
  { key: "no_purchase", label: "Lead sem compra" },
  { key: "has_open_ticket", label: "Tem ticket/demanda aberta" },
];

export function BotTeamMemberRouteCard({
  member,
  routes,
  isInitialBot,
  isFallbackBot,
  onAddRoute,
  onDeleteRoute,
  onRemoveMember,
  isRemoving,
  isAddingRoute,
}: BotTeamMemberRouteCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Form state
  const [conditionType, setConditionType] = useState("keyword");
  const [keywords, setKeywords] = useState("");
  const [intentDescription, setIntentDescription] = useState("");
  const [selectedSentiments, setSelectedSentiments] = useState<string[]>([]);
  const [crmConditions, setCrmConditions] = useState<CrmConditions>({});
  const [timeOutsideHours, setTimeOutsideHours] = useState(false);
  const [conditionLabel, setConditionLabel] = useState("");

  const bot = member.bot;
  const memberRoutes = routes.filter((r) => true); // All routes for this bot come pre-filtered

  const resetForm = () => {
    setConditionType("keyword");
    setKeywords("");
    setIntentDescription("");
    setSelectedSentiments([]);
    setCrmConditions({});
    setTimeOutsideHours(false);
    setConditionLabel("");
    setShowAddForm(false);
  };

  const handleAddRoute = async () => {
    const route: Omit<RouteData, "id"> = {
      condition_type: conditionType,
      keywords: conditionType === "keyword" ? keywords.split(",").map((k) => k.trim()).filter(Boolean) : null,
      intent_description: conditionType === "intent" ? intentDescription : null,
      crm_conditions: conditionType === "crm_status" ? crmConditions : null,
      sentiment_conditions: conditionType === "sentiment" ? selectedSentiments : null,
      time_conditions: conditionType === "time" ? { outside_business_hours: timeOutsideHours } : null,
      condition_label: conditionLabel || null,
      priority: memberRoutes.length,
      is_active: true,
    };

    await onAddRoute(route);
    resetForm();
  };

  const toggleSentiment = (value: string) => {
    setSelectedSentiments((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]
    );
  };

  const toggleCrmCondition = (key: keyof CrmConditions) => {
    setCrmConditions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const canAddRoute = () => {
    switch (conditionType) {
      case "keyword":
        return keywords.trim().length > 0;
      case "intent":
        return intentDescription.trim().length > 0;
      case "crm_status":
        return Object.values(crmConditions).some(Boolean);
      case "sentiment":
        return selectedSentiments.length > 0;
      case "time":
        return timeOutsideHours;
      default:
        return false;
    }
  };

  const getRouteDescription = (route: RouteData) => {
    if (route.condition_label) return route.condition_label;
    
    switch (route.condition_type) {
      case "keyword":
        return route.keywords?.join(", ") || "Sem palavras";
      case "intent":
        return route.intent_description || "Sem descrição";
      case "crm_status":
        const crm = route.crm_conditions as CrmConditions | null;
        const crmLabels: string[] = [];
        if (crm?.is_new_lead) crmLabels.push("Lead novo");
        if (crm?.has_purchase) crmLabels.push("Com compra");
        if (crm?.no_purchase) crmLabels.push("Sem compra");
        if (crm?.has_open_ticket) crmLabels.push("Com ticket");
        return crmLabels.join(", ") || "Sem condições";
      case "sentiment":
        return route.sentiment_conditions?.map((s) => 
          SENTIMENT_OPTIONS.find((o) => o.value === s)?.label || s
        ).join(", ") || "Sem sentimentos";
      case "time":
        const time = route.time_conditions as TimeConditions | null;
        return time?.outside_business_hours ? "Fora do horário comercial" : "Horário específico";
      default:
        return "Condição desconhecida";
    }
  };

  const getConditionBadge = (type: string) => {
    const config = CONDITION_TYPES.find((c) => c.value === type);
    if (!config) return { label: type, variant: "outline" as const };
    return { label: config.label, variant: "default" as const };
  };

  return (
    <Card className={`transition-all ${isInitialBot ? "border-primary/50 bg-primary/5" : isFallbackBot ? "border-secondary/50 bg-secondary/5" : ""}`}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            {bot?.avatar_url ? (
              <img
                src={bot.avatar_url}
                alt={bot.name}
                className="h-12 w-12 rounded-full object-cover border-2 border-background"
              />
            ) : (
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="h-6 w-6 text-primary" />
              </div>
            )}
            
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">{bot?.name || "Robô"}</CardTitle>
                {isInitialBot && (
                  <Badge className="gap-1">
                    <Crown className="h-3 w-3" />
                    Secretária
                  </Badge>
                )}
                {isFallbackBot && (
                  <Badge variant="secondary" className="gap-1">
                    <Shield className="h-3 w-3" />
                    Fallback
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {bot?.service_type} • {memberRoutes.length} {memberRoutes.length === 1 ? "condição" : "condições"}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {!isInitialBot && (
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm">
                    {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    {isOpen ? "Fechar" : "Configurar"}
                  </Button>
                </CollapsibleTrigger>
              )}
              
              {!isInitialBot && !isFallbackBot && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onRemoveMember}
                  disabled={isRemoving}
                  className="text-destructive hover:text-destructive"
                >
                  {isRemoving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
          </div>
          
          {/* Quick preview of routes when collapsed */}
          {!isOpen && memberRoutes.length > 0 && !isInitialBot && (
            <div className="flex flex-wrap gap-1 mt-2">
              {memberRoutes.slice(0, 3).map((route, i) => (
                <Badge key={route.id || i} variant="outline" className="text-xs">
                  {getConditionBadge(route.condition_type).label}
                </Badge>
              ))}
              {memberRoutes.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{memberRoutes.length - 3}
                </Badge>
              )}
            </div>
          )}

          {isInitialBot && (
            <p className="text-xs text-muted-foreground mt-2 p-2 bg-primary/10 rounded">
              🎯 A Secretária recebe todos os clientes, entrevista até entender como ajudar, e então direciona para o robô especialista correto.
            </p>
          )}
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            {/* Existing routes */}
            {memberRoutes.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Condições de Ativação</Label>
                {memberRoutes.map((route, index) => (
                  <div
                    key={route.id || index}
                    className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg"
                  >
                    <Badge variant={getConditionBadge(route.condition_type).variant}>
                      {getConditionBadge(route.condition_type).label}
                    </Badge>
                    <span className="flex-1 text-sm truncate">
                      {getRouteDescription(route)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => route.id && onDeleteRoute(route.id)}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                ))
                }
              </div>
            )}

            {/* Add route form */}
            {showAddForm ? (
              <div className="space-y-4 p-4 border rounded-lg bg-background">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Nova Condição de Ativação</Label>
                  <Button variant="ghost" size="sm" onClick={() => setShowAddForm(false)}>
                    Cancelar
                  </Button>
                </div>

                {/* Condition Type */}
                <div className="space-y-2">
                  <Label>Tipo de Condição</Label>
                  <Select value={conditionType} onValueChange={setConditionType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONDITION_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          <div className="flex items-center gap-2">
                            <type.icon className="h-4 w-4" />
                            {type.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {CONDITION_TYPES.find((t) => t.value === conditionType)?.description}
                  </p>
                </div>

                {/* Condition-specific inputs */}
                {conditionType === "keyword" && (
                  <div className="space-y-2">
                    <Label>Palavras-chave (separadas por vírgula)</Label>
                    <Input
                      value={keywords}
                      onChange={(e) => setKeywords(e.target.value)}
                      placeholder="rastreio, entrega, aonde está, encomenda..."
                    />
                    <p className="text-xs text-muted-foreground">
                      Quando qualquer dessas palavras aparecer na conversa
                    </p>
                  </div>
                )}

                {conditionType === "intent" && (
                  <div className="space-y-2">
                    <Label>Descrição da Intenção</Label>
                    <Textarea
                      value={intentDescription}
                      onChange={(e) => setIntentDescription(e.target.value)}
                      placeholder="Quando o cliente quer saber sobre o status da entrega, rastreamento, ou onde está o produto..."
                      rows={3}
                    />
                    <p className="text-xs text-muted-foreground">
                      A IA vai analisar se a conversa bate com essa descrição
                    </p>
                  </div>
                )}

                {conditionType === "crm_status" && (
                  <div className="space-y-2">
                    <Label>Condições do CRM</Label>
                    <div className="grid gap-2">
                      {CRM_OPTIONS.map((option) => (
                        <div
                          key={option.key}
                          className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-muted/50"
                          onClick={() => toggleCrmCondition(option.key as keyof CrmConditions)}
                        >
                          <Checkbox
                            checked={crmConditions[option.key as keyof CrmConditions] || false}
                            onCheckedChange={() => toggleCrmCondition(option.key as keyof CrmConditions)}
                          />
                          <span className="text-sm">{option.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {conditionType === "sentiment" && (
                  <div className="space-y-2">
                    <Label>Sentimentos Detectados</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {SENTIMENT_OPTIONS.map((option) => (
                        <div
                          key={option.value}
                          className={`flex items-center gap-2 p-2 border rounded cursor-pointer transition-colors ${
                            selectedSentiments.includes(option.value)
                              ? "border-primary bg-primary/10"
                              : "hover:bg-muted/50"
                          }`}
                          onClick={() => toggleSentiment(option.value)}
                        >
                          <Checkbox
                            checked={selectedSentiments.includes(option.value)}
                            onCheckedChange={() => toggleSentiment(option.value)}
                          />
                          <span className="text-sm">{option.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {conditionType === "time" && (
                  <div className="space-y-2">
                    <div
                      className="flex items-center gap-2 p-3 border rounded cursor-pointer hover:bg-muted/50"
                      onClick={() => setTimeOutsideHours(!timeOutsideHours)}
                    >
                      <Checkbox
                        checked={timeOutsideHours}
                        onCheckedChange={(checked) => setTimeOutsideHours(!!checked)}
                      />
                      <div>
                        <span className="text-sm font-medium">Fora do horário comercial</span>
                        <p className="text-xs text-muted-foreground">
                          Ativa quando o contato ocorrer fora do horário configurado na instância
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Optional label */}
                <div className="space-y-2">
                  <Label>Descrição amigável (opcional)</Label>
                  <Input
                    value={conditionLabel}
                    onChange={(e) => setConditionLabel(e.target.value)}
                    placeholder="Ex: Clientes perguntando sobre entrega"
                  />
                </div>

                <Button
                  onClick={handleAddRoute}
                  disabled={!canAddRoute() || isAddingRoute}
                  className="w-full"
                >
                  {isAddingRoute ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Adicionar Condição
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowAddForm(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Condição de Ativação
              </Button>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
