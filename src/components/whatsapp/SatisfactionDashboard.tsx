import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { 
  Star, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  MessageSquare
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { 
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger 
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

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

interface PendingReview {
  id: string;
  conversation_id: string;
  rating: number | null;
  raw_response: string | null;
  closed_at: string;
  lead_id: string | null;
  whatsapp_number: string | null;
  assigned_user_id: string | null;
  leads?: { name: string; whatsapp_number: string | null } | null;
  profiles?: { first_name: string | null; last_name: string | null } | null;
}

export function SatisfactionDashboard() {
  const { profile } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showPendingDialog, setShowPendingDialog] = useState(false);

  // Buscar métricas NPS da organização
  const { data: metrics, isLoading } = useQuery({
    queryKey: ["org-nps-metrics", profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return null;

      const { data, error } = await supabase.rpc("get_org_nps_metrics", {
        p_organization_id: profile.organization_id,
        p_days: 30
      });

      if (error) throw error;
      return data as unknown as NPSMetrics | null;
    },
    enabled: !!profile?.organization_id,
    refetchInterval: 60000, // Atualiza a cada minuto
  });

  // Buscar avaliações pendentes de revisão
  const { data: pendingReviews } = useQuery({
    queryKey: ["pending-satisfaction-reviews", profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      const { data, error } = await supabase
        .from("conversation_satisfaction_ratings")
        .select(`
          id,
          conversation_id,
          rating,
          raw_response,
          closed_at,
          lead_id,
          assigned_user_id,
          leads(name, whatsapp_number),
          profiles:assigned_user_id(first_name, last_name)
        `)
        .eq("organization_id", profile.organization_id)
        .eq("is_pending_review", true)
        .order("closed_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return (data || []) as unknown as PendingReview[];
    },
    enabled: !!profile?.organization_id,
  });

  // Se não há dados ou está carregando, mostra versão compacta
  if (isLoading || !metrics || metrics.total_responses === 0) {
    return null; // Não mostra nada se não há dados
  }

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

  const promoterPercent = metrics.total_responses > 0 
    ? (metrics.promoters / metrics.total_responses) * 100 
    : 0;
  const passivePercent = metrics.total_responses > 0 
    ? (metrics.passives / metrics.total_responses) * 100 
    : 0;
  const detractorPercent = metrics.total_responses > 0 
    ? (metrics.detractors / metrics.total_responses) * 100 
    : 0;

  return (
    <>
      <Card className="mx-4 mt-2 mb-2">
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-4">
                {/* NPS Score */}
                <div className={cn(
                  "flex items-center gap-2 px-3 py-1 rounded-full",
                  getNPSBgColor(metrics.nps_score)
                )}>
                  <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                  <span className={cn("font-bold", getNPSColor(metrics.nps_score))}>
                    NPS {metrics.nps_score}
                  </span>
                </div>

                {/* Média */}
                <div className="flex items-center gap-1.5 text-sm">
                  <span className="text-muted-foreground">Média:</span>
                  <span className="font-medium">{metrics.avg_rating}/10</span>
                </div>

                {/* Respostas */}
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>{metrics.total_responses} respostas</span>
                </div>

                {/* Pendentes de revisão */}
                {metrics.pending_reviews > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowPendingDialog(true);
                    }}
                  >
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {metrics.pending_reviews} para revisar
                  </Button>
                )}
              </div>

              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="px-3 pb-3 pt-1 border-t space-y-3">
              {/* Barra de distribuição */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                    <span>Promotores: {metrics.promoters} ({promoterPercent.toFixed(0)}%)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span>Neutros: {metrics.passives} ({passivePercent.toFixed(0)}%)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <TrendingDown className="h-3.5 w-3.5 text-red-600" />
                    <span>Detratores: {metrics.detractors} ({detractorPercent.toFixed(0)}%)</span>
                  </div>
                </div>

                <div className="h-2 rounded-full overflow-hidden flex">
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

              {/* Por vendedor */}
              {metrics.by_user && metrics.by_user.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    Por vendedor (últimos 30 dias)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {metrics.by_user.slice(0, 5).map((user) => (
                      <UserBadge 
                        key={user.user_id} 
                        userId={user.user_id}
                        total={user.total}
                        avgRating={user.avg_rating}
                        detractors={user.detractors}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Dialog de pendentes */}
      <Dialog open={showPendingDialog} onOpenChange={setShowPendingDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Avaliações para Revisar
            </DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="max-h-96">
            <div className="space-y-2">
              {pendingReviews?.map((review) => (
                <div 
                  key={review.id}
                  className="p-3 border rounded-lg space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "font-bold",
                          getRatingColor(review.rating)
                        )}
                      >
                        {review.rating !== null ? `Nota ${review.rating}` : "Sem nota"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(review.closed_at), "dd/MM HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="h-7 gap-1"
                      onClick={() => {
                        window.open(`/whatsapp?chatId=${review.conversation_id}`, '_blank');
                      }}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Ver conversa
                    </Button>
                  </div>
                  
                  {review.raw_response && (
                    <p className="text-sm bg-muted/50 p-2 rounded">
                      "{review.raw_response}"
                    </p>
                  )}
                  
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {review.leads && (
                      <span>Lead: {review.leads.name || review.leads.whatsapp_number}</span>
                    )}
                    {review.profiles && (
                      <span>• Vendedor: {review.profiles.first_name}</span>
                    )}
                  </div>
                </div>
              ))}

              {(!pendingReviews || pendingReviews.length === 0) && (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma avaliação pendente de revisão
                </p>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Componente auxiliar para badge de usuário
function UserBadge({ 
  userId, 
  total, 
  avgRating, 
  detractors 
}: { 
  userId: string;
  total: number;
  avgRating: number;
  detractors: number;
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
      "flex items-center gap-2 px-2 py-1 rounded-full text-xs",
      getRatingBg()
    )}>
      <Avatar className="h-5 w-5">
        <AvatarFallback className="text-[10px]">
          {profile?.first_name?.[0] || "?"}
        </AvatarFallback>
      </Avatar>
      <span className="font-medium">{profile?.first_name || "..."}</span>
      <span className="opacity-70">
        {avgRating.toFixed(1)} ({total})
      </span>
      {detractors > 0 && (
        <Badge variant="destructive" className="h-4 text-[10px] px-1">
          {detractors}
        </Badge>
      )}
    </div>
  );
}
