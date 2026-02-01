import { useState } from "react";
import { Star, Bot, Hash, AlertCircle, ThumbsDown, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface NPSRatingBadgeProps {
  rating: number | null;
  source?: "regex" | "ai" | "manual" | null;
  reasoning?: string | null;
  rawResponse?: string | null;
  ratingId?: string;
  reviewRequested?: boolean;
  finalRating?: number | null;
  showRequestReview?: boolean;
  compact?: boolean;
}

export function NPSRatingBadge({ 
  rating, 
  source, 
  reasoning,
  rawResponse,
  ratingId,
  reviewRequested,
  finalRating,
  showRequestReview = true,
  compact = false,
}: NPSRatingBadgeProps) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reviewReason, setReviewReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Use final rating if available, otherwise use original
  const displayRating = finalRating !== null && finalRating !== undefined ? finalRating : rating;
  
  if (displayRating === null && !reviewRequested) return null;
  
  const getColor = () => {
    if (displayRating === null) return "text-muted-foreground";
    if (displayRating >= 9) return "text-green-600";
    if (displayRating >= 7) return "text-amber-600";
    return "text-red-600";
  };
  
  const getBgColor = () => {
    if (displayRating === null) return "bg-muted";
    if (displayRating >= 9) return "bg-green-100 dark:bg-green-950/30";
    if (displayRating >= 7) return "bg-amber-100 dark:bg-amber-950/30";
    return "bg-red-100 dark:bg-red-950/30";
  };
  
  const getLabel = () => {
    if (displayRating === null) return "Sem nota";
    if (displayRating >= 9) return "Promotor";
    if (displayRating >= 7) return "Neutro";
    return "Detrator";
  };
  
  const getSourceIcon = () => {
    if (source === "ai") return <Bot className="h-3 w-3" />;
    if (source === "regex") return <Hash className="h-3 w-3" />;
    return null;
  };
  
  const getSourceLabel = () => {
    if (source === "ai") return "Classificado por IA";
    if (source === "regex") return "Número detectado";
    return "Manual";
  };

  const handleRequestReview = async () => {
    if (!ratingId || !profile?.user_id) return;
    
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("conversation_satisfaction_ratings")
        .update({
          review_requested: true,
          review_requested_at: new Date().toISOString(),
          review_requested_by: profile.user_id,
          review_request_reason: reviewReason || null,
        })
        .eq("id", ratingId);

      if (error) throw error;
      
      toast.success("Solicitação de revisão enviada!");
      setDialogOpen(false);
      setReviewReason("");
      queryClient.invalidateQueries({ queryKey: ["satisfaction-ratings"] });
    } catch (error: any) {
      toast.error(error.message || "Erro ao solicitar revisão");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant="secondary" 
              className={cn("gap-1", getBgColor(), getColor())}
            >
              <Star className="h-3 w-3 fill-current" />
              {displayRating ?? "–"}
              {source === "ai" && <Bot className="h-2.5 w-2.5 ml-0.5 opacity-70" />}
              {reviewRequested && <AlertCircle className="h-2.5 w-2.5 ml-0.5 text-orange-500" />}
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <div className="space-y-1">
              <p className="font-medium">NPS: {displayRating ?? "Sem nota"} ({getLabel()})</p>
              {source && <p className="text-xs text-muted-foreground">{getSourceLabel()}</p>}
              {reasoning && <p className="text-xs">{reasoning}</p>}
              {rawResponse && (
                <p className="text-xs text-muted-foreground italic">"{rawResponse.substring(0, 100)}..."</p>
              )}
              {reviewRequested && (
                <p className="text-xs text-orange-600 font-medium">⚠️ Revisão solicitada</p>
              )}
              {finalRating !== null && finalRating !== undefined && finalRating !== rating && (
                <p className="text-xs text-muted-foreground">Nota original: {rating}</p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <>
      <div className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg text-sm",
        getBgColor()
      )}>
        <div className="flex items-center gap-1.5">
          <Star className={cn("h-4 w-4 fill-current", getColor())} />
          <span className={cn("font-bold", getColor())}>
            {displayRating ?? "–"}
          </span>
          <span className="text-muted-foreground text-xs">
            ({getLabel()})
          </span>
        </div>
        
        {source && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 text-xs text-muted-foreground bg-background/50 px-1.5 py-0.5 rounded">
                  {getSourceIcon()}
                  <span>{source === "ai" ? "IA" : source === "regex" ? "Auto" : "Manual"}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-sm">
                <div className="space-y-1">
                  <p className="font-medium">{getSourceLabel()}</p>
                  {reasoning && <p className="text-xs">{reasoning}</p>}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {reviewRequested && (
          <Badge variant="outline" className="text-orange-600 border-orange-300 text-xs">
            <AlertCircle className="h-3 w-3 mr-1" />
            Revisão solicitada
          </Badge>
        )}

        {finalRating !== null && finalRating !== undefined && finalRating !== rating && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-xs text-muted-foreground line-through">
                  ({rating})
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>Nota original da IA: {rating}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {showRequestReview && ratingId && !reviewRequested && source === "ai" && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-xs text-muted-foreground hover:text-orange-600"
                  onClick={() => setDialogOpen(true)}
                >
                  <ThumbsDown className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Discordar e solicitar revisão</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              Solicitar Revisão de Nota
            </DialogTitle>
            <DialogDescription>
              Você discorda da classificação feita pela IA? Solicite uma revisão para que um gerente ou admin avalie manualmente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className={cn("p-3 rounded-lg", getBgColor())}>
              <div className="flex items-center gap-2 mb-2">
                <Star className={cn("h-4 w-4 fill-current", getColor())} />
                <span className={cn("font-bold", getColor())}>Nota atual: {displayRating}</span>
                {source === "ai" && (
                  <Badge variant="outline" className="text-xs">
                    <Bot className="h-3 w-3 mr-1" />
                    Classificado por IA
                  </Badge>
                )}
              </div>
              {reasoning && (
                <p className="text-sm text-muted-foreground">
                  <strong>Justificativa da IA:</strong> {reasoning}
                </p>
              )}
              {rawResponse && (
                <p className="text-sm text-muted-foreground mt-1 italic">
                  "{rawResponse}"
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium">Por que você discorda? (opcional)</label>
              <Textarea
                placeholder="Ex: O cliente elogiou o atendimento, mas a IA classificou como neutro..."
                value={reviewReason}
                onChange={(e) => setReviewReason(e.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleRequestReview}
              disabled={isSubmitting}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <AlertCircle className="h-4 w-4 mr-2" />
              )}
              Solicitar Revisão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
