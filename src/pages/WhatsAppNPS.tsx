import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrgAdmin } from "@/hooks/useOrgAdmin";
import { Layout } from "@/components/layout/Layout";
import { 
  Star, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  AlertTriangle,
  ExternalLink,
  MessageSquare,
  ArrowLeft,
  Filter,
  Calendar,
  CheckCircle,
  Bot,
  Hash
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { NPSReviewPanel } from "@/components/whatsapp/NPSReviewPanel";

interface NPSMetrics {
  total_responses: number;
  promoters: number;
  detractors: number;
  passives: number;
  nps_score: number;
  avg_rating: number;
  pending_reviews: number;
  by_user?: Array<{
    user_id: string;
    total: number;
    avg_rating: number;
    detractors: number;
  }>;
}

interface SatisfactionRating {
  id: string;
  conversation_id: string;
  rating: number | null;
  ai_original_rating: number | null;
  final_rating: number | null;
  raw_response: string | null;
  classification_source: string | null;
  classification_reasoning: string | null;
  closed_at: string;
  responded_at: string | null;
  lead_id: string | null;
  assigned_user_id: string | null;
  instance_id: string;
  is_pending_review: boolean | null;
  review_requested: boolean | null;
  review_request_reason: string | null;
  review_notes: string | null;
  reviewed_at: string | null;
  leads?: { name: string; whatsapp_number: string | null } | null;
  profiles?: { first_name: string | null; last_name: string | null } | null;
  whatsapp_instances?: { name: string; display_name_for_team: string | null } | null;
}

export default function WhatsAppNPS() {
  const { profile } = useAuth();
  const { data: isOrgAdmin } = useOrgAdmin();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [daysFilter, setDaysFilter] = useState("30");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [ratingFilter, setRatingFilter] = useState<string>("all");
  const [selectedReview, setSelectedReview] = useState<SatisfactionRating | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [manualRating, setManualRating] = useState<string>("");

  // Buscar métricas NPS da organização
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ["org-nps-metrics-full", profile?.organization_id, daysFilter],
    queryFn: async () => {
      if (!profile?.organization_id) return null;

      const { data, error } = await supabase.rpc("get_org_nps_metrics", {
        p_organization_id: profile.organization_id,
        p_days: parseInt(daysFilter)
      });

      if (error) throw error;
      return data as unknown as NPSMetrics | null;
    },
    enabled: !!profile?.organization_id,
  });

  // Buscar usuários da organização para filtro
  const { data: users } = useQuery({
    queryKey: ["org-users", profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];
      
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name")
        .eq("organization_id", profile.organization_id);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.organization_id,
  });

  // Buscar todas as avaliações com filtros
  const { data: ratings, isLoading: ratingsLoading } = useQuery({
    queryKey: ["satisfaction-ratings-full", profile?.organization_id, daysFilter, userFilter, ratingFilter],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - parseInt(daysFilter));

      let query = supabase
        .from("conversation_satisfaction_ratings")
        .select(`
          id,
          conversation_id,
          rating,
          ai_original_rating,
          final_rating,
          raw_response,
          classification_source,
          classification_reasoning,
          closed_at,
          responded_at,
          lead_id,
          assigned_user_id,
          instance_id,
          is_pending_review,
          review_requested,
          review_request_reason,
          review_notes,
          reviewed_at,
          leads(name, whatsapp_number),
          profiles:assigned_user_id(first_name, last_name),
          whatsapp_instances:instance_id(name, display_name_for_team)
        `)
        .eq("organization_id", profile.organization_id)
        .gte("closed_at", daysAgo.toISOString())
        .order("closed_at", { ascending: false });

      if (userFilter !== "all") {
        query = query.eq("assigned_user_id", userFilter);
      }

      if (ratingFilter === "promoters") {
        query = query.gte("rating", 9);
      } else if (ratingFilter === "passives") {
        query = query.gte("rating", 7).lt("rating", 9);
      } else if (ratingFilter === "detractors") {
        query = query.lt("rating", 7);
      } else if (ratingFilter === "pending") {
        query = query.eq("is_pending_review", true);
      }

      const { data, error } = await query.limit(200);

      if (error) throw error;
      return (data || []) as unknown as SatisfactionRating[];
    },
    enabled: !!profile?.organization_id,
  });

  // Mutation para marcar como revisado (com opção de alterar nota)
  const markAsReviewed = useMutation({
    mutationFn: async ({ ratingId, notes, newRating }: { ratingId: string; notes: string; newRating?: number }) => {
      // Se vai alterar a nota, buscar nota original primeiro
      if (newRating !== undefined) {
        const { data: current } = await supabase
          .from("conversation_satisfaction_ratings")
          .select("rating, ai_original_rating")
          .eq("id", ratingId)
          .single();
        
        const { error } = await supabase
          .from("conversation_satisfaction_ratings")
          .update({
            rating: newRating,
            final_rating: newRating,
            ai_original_rating: current?.ai_original_rating ?? current?.rating,
            is_pending_review: false,
            review_requested: false,
            reviewed_at: new Date().toISOString(),
            reviewed_by: profile?.user_id,
            review_notes: notes || null,
            classification_source: "manual",
          })
          .eq("id", ratingId);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("conversation_satisfaction_ratings")
          .update({
            is_pending_review: false,
            review_requested: false,
            reviewed_at: new Date().toISOString(),
            reviewed_by: profile?.user_id,
            review_notes: notes || null
          })
          .eq("id", ratingId);
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Avaliação revisada com sucesso");
      setSelectedReview(null);
      setReviewNotes("");
      setManualRating("");
      queryClient.invalidateQueries({ queryKey: ["satisfaction-ratings-full"] });
      queryClient.invalidateQueries({ queryKey: ["org-nps-metrics-full"] });
      queryClient.invalidateQueries({ queryKey: ["nps-review-requests"] });
    },
    onError: () => {
      toast.error("Erro ao revisar avaliação");
    }
  });

  const getNPSColor = (score: number) => {
    if (score >= 50) return "text-green-600";
    if (score >= 0) return "text-amber-600";
    return "text-red-600";
  };

  const getNPSBgColor = (score: number) => {
    if (score >= 50) return "bg-green-100 dark:bg-green-950/30";
    if (score >= 0) return "bg-amber-100 dark:bg-amber-950/30";
    return "bg-red-100 dark:bg-red-950/30";
  };

  const getRatingColor = (rating: number | null) => {
    if (rating === null) return "text-muted-foreground";
    if (rating >= 9) return "text-green-600";
    if (rating >= 7) return "text-amber-600";
    return "text-red-600";
  };

  const getRatingBadgeVariant = (rating: number | null) => {
    if (rating === null) return "secondary";
    if (rating >= 9) return "default";
    if (rating >= 7) return "secondary";
    return "destructive";
  };

  const promoterPercent = metrics && metrics.total_responses > 0 
    ? (metrics.promoters / metrics.total_responses) * 100 
    : 0;
  const passivePercent = metrics && metrics.total_responses > 0 
    ? (metrics.passives / metrics.total_responses) * 100 
    : 0;
  const detractorPercent = metrics && metrics.total_responses > 0 
    ? (metrics.detractors / metrics.total_responses) * 100 
    : 0;

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/whatsapp")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Star className="h-6 w-6 text-amber-500 fill-amber-500" />
              Resultado NPS
            </h1>
            <p className="text-muted-foreground">
              Pesquisa de Satisfação do WhatsApp
            </p>
          </div>
        </div>

        {/* Métricas principais */}
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className={cn("p-4", getNPSBgColor(metrics.nps_score))}>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">NPS Score</p>
                <p className={cn("text-4xl font-bold", getNPSColor(metrics.nps_score))}>
                  {metrics.nps_score}
                </p>
              </div>
            </Card>
            
            <Card className="p-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Média</p>
                <p className="text-4xl font-bold">{metrics.avg_rating.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">de 10</p>
              </div>
            </Card>

            <Card className="p-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Respostas</p>
                <p className="text-4xl font-bold">{metrics.total_responses}</p>
                <p className="text-xs text-muted-foreground">últimos {daysFilter} dias</p>
              </div>
            </Card>

            <Card className="p-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Pendentes</p>
                <p className={cn("text-4xl font-bold", metrics.pending_reviews > 0 && "text-red-600")}>
                  {metrics.pending_reviews}
                </p>
                <p className="text-xs text-muted-foreground">para revisar</p>
              </div>
            </Card>
          </div>
        )}

        {/* Barra de distribuição */}
        {metrics && metrics.total_responses > 0 && (
          <Card className="p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <span>Promotores (9-10): {metrics.promoters} ({promoterPercent.toFixed(0)}%)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-amber-500" />
                  <span>Neutros (7-8): {metrics.passives} ({passivePercent.toFixed(0)}%)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <TrendingDown className="h-4 w-4 text-red-600" />
                  <span>Detratores (0-6): {metrics.detractors} ({detractorPercent.toFixed(0)}%)</span>
                </div>
              </div>

              <div className="h-4 rounded-full overflow-hidden flex">
                <div 
                  className="bg-green-500 transition-all"
                  style={{ width: `${promoterPercent}%` }}
                />
                <div 
                  className="bg-amber-500 transition-all"
                  style={{ width: `${passivePercent}%` }}
                />
                <div 
                  className="bg-red-500 transition-all"
                  style={{ width: `${detractorPercent}%` }}
                />
              </div>
            </div>
          </Card>
        )}

        {/* Painel de Revisões Pendentes (apenas para admins/gerentes) */}
        {isOrgAdmin && <NPSReviewPanel className="mb-4" />}

        {/* Ranking por vendedor */}
        {metrics?.by_user && metrics.by_user.length > 0 && (
          <Card className="p-4">
            <h3 className="font-medium flex items-center gap-2 mb-3">
              <Users className="h-4 w-4" />
              Ranking por Vendedor
            </h3>
            <div className="flex flex-wrap gap-2">
              {metrics.by_user.map((user) => (
                <UserBadge 
                  key={user.user_id} 
                  userId={user.user_id}
                  total={user.total}
                  avgRating={user.avg_rating}
                  detractors={user.detractors}
                  onClickUser={() => {
                    setUserFilter(user.user_id);
                    setRatingFilter("all");
                  }}
                  onClickDetractors={() => {
                    setUserFilter(user.user_id);
                    setRatingFilter("detractors");
                  }}
                />
              ))}
            </div>
          </Card>
        )}

        {/* Filtros */}
        <Card className="p-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filtros:</span>
            </div>
            
            <Select value={daysFilter} onValueChange={setDaysFilter}>
              <SelectTrigger className="w-36">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="15">Últimos 15 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="60">Últimos 60 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
              </SelectContent>
            </Select>

            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger className="w-44">
                <Users className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Vendedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos vendedores</SelectItem>
                {users?.map(user => (
                  <SelectItem key={user.user_id} value={user.user_id}>
                    {user.first_name} {user.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={ratingFilter} onValueChange={setRatingFilter}>
              <SelectTrigger className="w-40">
                <Star className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Nota" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas notas</SelectItem>
                <SelectItem value="promoters">Promotores (9-10)</SelectItem>
                <SelectItem value="passives">Neutros (7-8)</SelectItem>
                <SelectItem value="detractors">Detratores (0-6)</SelectItem>
                <SelectItem value="pending">Pendentes revisão</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* Lista de avaliações */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Avaliações ({ratings?.length || 0})</CardTitle>
            <CardDescription>
              Clique em uma avaliação para ver detalhes e marcar como revisada
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              <div className="space-y-2">
                {ratingsLoading ? (
                  <p className="text-center text-muted-foreground py-8">Carregando...</p>
                ) : ratings && ratings.length > 0 ? (
                  ratings.map((rating) => (
                    <div 
                      key={rating.id}
                      className={cn(
                        "p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors",
                        rating.is_pending_review && "border-red-200 bg-red-50/50 dark:bg-red-950/10"
                      )}
                      onClick={() => {
                        setSelectedReview(rating);
                        setReviewNotes(rating.review_notes || "");
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge 
                            variant={getRatingBadgeVariant(rating.rating) as any}
                            className={cn("font-bold", getRatingColor(rating.rating))}
                          >
                            {rating.rating !== null ? rating.rating : "–"}
                          </Badge>
                          
                          {/* Indicador de fonte da classificação */}
                          {rating.classification_source && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                                    {rating.classification_source === "ai" ? (
                                      <Bot className="h-3 w-3" />
                                    ) : rating.classification_source === "regex" ? (
                                      <Hash className="h-3 w-3" />
                                    ) : null}
                                    <span>{rating.classification_source === "ai" ? "IA" : rating.classification_source === "regex" ? "Auto" : "Manual"}</span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-sm">
                                  <p className="font-medium">
                                    {rating.classification_source === "ai" ? "Classificado por IA" : 
                                     rating.classification_source === "regex" ? "Número detectado automaticamente" : "Classificação manual"}
                                  </p>
                                  {rating.classification_reasoning && (
                                    <p className="text-xs mt-1">{rating.classification_reasoning}</p>
                                  )}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          
                          <div>
                            <p className="font-medium">
                              {rating.leads?.name || rating.leads?.whatsapp_number || "Cliente desconhecido"}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{format(new Date(rating.closed_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                              {rating.profiles && (
                                <>
                                  <span>•</span>
                                  <span>{rating.profiles.first_name}</span>
                                </>
                              )}
                              {rating.whatsapp_instances && (
                                <>
                                  <span>•</span>
                                  <span>{rating.whatsapp_instances.display_name_for_team || rating.whatsapp_instances.name}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {rating.review_requested && (
                            <Badge variant="outline" className="text-orange-600 border-orange-300">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Revisão solicitada
                            </Badge>
                          )}
                          {rating.is_pending_review && !rating.review_requested && (
                            <Badge variant="outline" className="text-red-600 border-red-300">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Revisar
                            </Badge>
                          )}
                          {rating.reviewed_at && !rating.review_requested && (
                            <Badge variant="outline" className="text-green-600 border-green-300">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Revisado
                            </Badge>
                          )}
                          {rating.ai_original_rating !== null && rating.ai_original_rating !== rating.rating && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <span className="text-xs text-muted-foreground line-through">
                                    ({rating.ai_original_rating})
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Nota original da IA: {rating.ai_original_rating}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(`/whatsapp?chatId=${rating.conversation_id}`, '_blank');
                            }}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      
                      {rating.raw_response && (
                        <p className="text-sm text-muted-foreground mt-2 bg-muted/50 p-2 rounded">
                          "{rating.raw_response}"
                        </p>
                      )}
                      
                      {rating.classification_reasoning && rating.classification_source === "ai" && (
                        <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                          <Bot className="h-3 w-3" />
                          {rating.classification_reasoning}
                        </p>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhuma avaliação encontrada com os filtros selecionados
                  </p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Dialog de detalhes da avaliação */}
        <Dialog open={!!selectedReview} onOpenChange={(open) => !open && setSelectedReview(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Star className="h-5 w-5 text-amber-500" />
                Detalhes da Avaliação
              </DialogTitle>
            </DialogHeader>
            
            {selectedReview && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant={getRatingBadgeVariant(selectedReview.rating) as any}
                      className={cn("text-lg font-bold px-3 py-1", getRatingColor(selectedReview.rating))}
                    >
                      Nota: {selectedReview.rating !== null ? selectedReview.rating : "Sem nota"}
                    </Badge>
                    {selectedReview.classification_source && (
                      <Badge variant="outline" className="text-xs">
                        {selectedReview.classification_source === "ai" ? (
                          <><Bot className="h-3 w-3 mr-1" /> IA</>
                        ) : selectedReview.classification_source === "regex" ? (
                          <><Hash className="h-3 w-3 mr-1" /> Auto</>
                        ) : "Manual"}
                      </Badge>
                    )}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {format(new Date(selectedReview.closed_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </span>
                </div>

                {/* Justificativa da IA */}
                {selectedReview.classification_reasoning && selectedReview.classification_source === "ai" && (
                  <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg border border-blue-200 dark:border-blue-900/50">
                    <div className="flex items-center gap-2 mb-1">
                      <Bot className="h-4 w-4 text-blue-600" />
                      <p className="text-sm font-medium text-blue-700 dark:text-blue-400">
                        Justificativa da IA:
                      </p>
                    </div>
                    <p className="text-sm">{selectedReview.classification_reasoning}</p>
                  </div>
                )}

                {/* Nota original se foi alterada */}
                {selectedReview.ai_original_rating !== null && 
                 selectedReview.ai_original_rating !== selectedReview.rating && (
                  <div className="text-sm text-muted-foreground">
                    Nota original: <span className="line-through">{selectedReview.ai_original_rating}</span> → {selectedReview.rating}
                  </div>
                )}

                {selectedReview.raw_response && (
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="text-sm font-medium mb-1">Resposta do cliente:</p>
                    <p>"{selectedReview.raw_response}"</p>
                  </div>
                )}

                {/* Motivo da solicitação de revisão */}
                {selectedReview.review_requested && selectedReview.review_request_reason && (
                  <div className="bg-orange-50 dark:bg-orange-950/20 p-3 rounded-lg border border-orange-200 dark:border-orange-900/50">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="h-4 w-4 text-orange-600" />
                      <p className="text-sm font-medium text-orange-700 dark:text-orange-400">
                        Motivo da solicitação de revisão:
                      </p>
                    </div>
                    <p className="text-sm">{selectedReview.review_request_reason}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Cliente:</p>
                    <p className="font-medium">
                      {selectedReview.leads?.name || selectedReview.leads?.whatsapp_number || "–"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Vendedor:</p>
                    <p className="font-medium">
                      {selectedReview.profiles?.first_name || "–"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Instância:</p>
                    <p className="font-medium">
                      {selectedReview.whatsapp_instances?.display_name_for_team || selectedReview.whatsapp_instances?.name || "–"}
                    </p>
                  </div>
                  {selectedReview.responded_at && (
                    <div>
                      <p className="text-muted-foreground">Respondido em:</p>
                      <p className="font-medium">
                        {format(new Date(selectedReview.responded_at), "dd/MM HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  )}
                </div>

                {/* Alterar nota manualmente (apenas para admins) */}
                {isOrgAdmin && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Alterar nota manualmente:</p>
                    <Select value={manualRating} onValueChange={setManualRating}>
                      <SelectTrigger>
                        <SelectValue placeholder="Manter nota atual" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Manter nota atual</SelectItem>
                        {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0].map(n => (
                          <SelectItem key={n} value={n.toString()}>
                            {n} - {n >= 9 ? "Promotor" : n >= 7 ? "Neutro" : "Detrator"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <p className="text-sm font-medium">Notas de revisão:</p>
                  <Textarea
                    placeholder="Adicione uma nota sobre esta avaliação..."
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                  />
                </div>

                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => window.open(`/whatsapp?chatId=${selectedReview.conversation_id}`, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Ver Conversa
                  </Button>
                  <Button 
                    className="flex-1"
                    onClick={() => markAsReviewed.mutate({ 
                      ratingId: selectedReview.id, 
                      notes: reviewNotes,
                      newRating: manualRating ? parseInt(manualRating) : undefined
                    })}
                    disabled={markAsReviewed.isPending}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    {manualRating ? `Salvar (Nota: ${manualRating})` : "Marcar como Revisado"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}

// Componente auxiliar para badge de usuário
function UserBadge({ 
  userId, 
  total, 
  avgRating, 
  detractors,
  onClickUser,
  onClickDetractors,
}: { 
  userId: string;
  total: number;
  avgRating: number;
  detractors: number;
  onClickUser?: () => void;
  onClickDetractors?: () => void;
}) {
  const { data: profile } = useQuery({
    queryKey: ["profile-name", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("user_id", userId)
        .single();
      return data;
    },
  });

  const getRatingBg = () => {
    if (avgRating >= 8) return "bg-green-100 text-green-700 dark:bg-green-950/30";
    if (avgRating >= 6) return "bg-amber-100 text-amber-700 dark:bg-amber-950/30";
    return "bg-red-100 text-red-700 dark:bg-red-950/30";
  };

  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm",
      getRatingBg()
    )}>
      <Avatar className="h-6 w-6">
        <AvatarFallback className="text-xs">
          {profile?.first_name?.[0] || "?"}
        </AvatarFallback>
      </Avatar>
      <span className="font-medium">{profile?.first_name || "..."}</span>
      <span className="opacity-70">
        {avgRating.toFixed(1)} ({total})
      </span>
      {detractors > 0 && (
        <Badge variant="destructive" className="h-5 text-xs px-1.5">
          {detractors}
        </Badge>
      )}
    </div>
  );
}
