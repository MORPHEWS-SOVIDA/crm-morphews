import { useState } from "react";
import { 
  AlertCircle, 
  Star, 
  Bot, 
  Check, 
  X, 
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Loader2,
  MessageSquare,
  User
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { 
  useNPSReviewRequests, 
  useApproveNPSReview, 
  useDismissNPSReview,
  NPSReviewRequest 
} from "@/hooks/useNPSReviewRequests";

interface NPSReviewPanelProps {
  className?: string;
}

export function NPSReviewPanel({ className }: NPSReviewPanelProps) {
  const { data: reviews, isLoading } = useNPSReviewRequests();
  const approveReview = useApproveNPSReview();
  const dismissReview = useDismissNPSReview();
  
  const [selectedReview, setSelectedReview] = useState<NPSReviewRequest | null>(null);
  const [newRating, setNewRating] = useState<string>("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [expanded, setExpanded] = useState(true);

  const pendingCount = reviews?.length || 0;

  if (pendingCount === 0 && !isLoading) {
    return null; // Não mostrar painel se não há revisões pendentes
  }

  const handleApprove = () => {
    if (!selectedReview) return;
    
    const ratingValue = newRating ? parseInt(newRating) : selectedReview.rating;
    approveReview.mutate({
      ratingId: selectedReview.id,
      newRating: ratingValue,
      notes: reviewNotes,
    }, {
      onSuccess: () => {
        setSelectedReview(null);
        setNewRating("");
        setReviewNotes("");
      }
    });
  };

  const handleDismiss = () => {
    if (!selectedReview) return;
    
    dismissReview.mutate({
      ratingId: selectedReview.id,
      notes: reviewNotes || "Solicitação rejeitada - nota original mantida",
    }, {
      onSuccess: () => {
        setSelectedReview(null);
        setNewRating("");
        setReviewNotes("");
      }
    });
  };

  const getRatingColor = (rating: number | null) => {
    if (rating === null) return "text-muted-foreground";
    if (rating >= 9) return "text-green-600";
    if (rating >= 7) return "text-amber-600";
    return "text-red-600";
  };

  const getRatingBg = (rating: number | null) => {
    if (rating === null) return "bg-muted";
    if (rating >= 9) return "bg-green-100 dark:bg-green-950/30";
    if (rating >= 7) return "bg-amber-100 dark:bg-amber-950/30";
    return "bg-red-100 dark:bg-red-950/30";
  };

  return (
    <>
      <Card className={cn("border-orange-200 dark:border-orange-900/50", className)}>
        <CardHeader 
          className="cursor-pointer pb-3"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              <CardTitle className="text-base">Revisões de NPS Pendentes</CardTitle>
              <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                {pendingCount}
              </Badge>
            </div>
            {expanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <CardDescription>
            Solicitações de revisão de notas classificadas pela IA
          </CardDescription>
        </CardHeader>
        
        {expanded && (
          <CardContent className="pt-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ScrollArea className="max-h-[300px]">
                <div className="space-y-2">
                  {reviews?.map((review) => (
                    <div 
                      key={review.id}
                      className="p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => {
                        setSelectedReview(review);
                        setNewRating("");
                        setReviewNotes("");
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Badge 
                            className={cn("font-bold shrink-0", getRatingBg(review.rating), getRatingColor(review.rating))}
                          >
                            <Star className="h-3 w-3 mr-1 fill-current" />
                            {review.rating ?? "–"}
                          </Badge>
                          {review.classification_source === "ai" && (
                            <Badge variant="outline" className="shrink-0 text-xs">
                              <Bot className="h-3 w-3 mr-1" />
                              IA
                            </Badge>
                          )}
                          <span className="text-sm font-medium truncate">
                            {review.leads?.name || review.leads?.whatsapp_number || "Cliente"}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {review.review_requested_at && format(new Date(review.review_requested_at), "dd/MM HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                      
                      {review.raw_response && (
                        <p className="text-xs text-muted-foreground mt-2 truncate italic">
                          "{review.raw_response}"
                        </p>
                      )}
                      
                      {review.review_request_reason && (
                        <div className="flex items-start gap-1.5 mt-2 text-xs text-orange-600">
                          <MessageSquare className="h-3 w-3 mt-0.5 shrink-0" />
                          <span className="line-clamp-2">{review.review_request_reason}</span>
                        </div>
                      )}
                      
                      {review.requester_profile && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                          <User className="h-3 w-3" />
                          Solicitado por {review.requester_profile.first_name}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        )}
      </Card>

      {/* Dialog de revisão */}
      <Dialog open={!!selectedReview} onOpenChange={(open) => !open && setSelectedReview(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              Revisar Classificação NPS
            </DialogTitle>
            <DialogDescription>
              Avalie a solicitação e defina a nota final se necessário
            </DialogDescription>
          </DialogHeader>

          {selectedReview && (
            <div className="space-y-4">
              {/* Nota atual */}
              <div className={cn("p-3 rounded-lg", getRatingBg(selectedReview.rating))}>
                <div className="flex items-center gap-2 mb-2">
                  <Star className={cn("h-4 w-4 fill-current", getRatingColor(selectedReview.rating))} />
                  <span className={cn("font-bold", getRatingColor(selectedReview.rating))}>
                    Nota classificada: {selectedReview.rating ?? "Sem nota"}
                  </span>
                  {selectedReview.classification_source === "ai" && (
                    <Badge variant="outline" className="text-xs">
                      <Bot className="h-3 w-3 mr-1" />
                      Classificado por IA
                    </Badge>
                  )}
                </div>
                {selectedReview.classification_reasoning && (
                  <p className="text-sm text-muted-foreground">
                    <strong>Justificativa da IA:</strong> {selectedReview.classification_reasoning}
                  </p>
                )}
              </div>

              {/* Resposta do cliente */}
              {selectedReview.raw_response && (
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-sm font-medium mb-1">Resposta do cliente:</p>
                  <p className="italic">"{selectedReview.raw_response}"</p>
                </div>
              )}

              {/* Motivo da solicitação */}
              {selectedReview.review_request_reason && (
                <div className="bg-orange-50 dark:bg-orange-950/20 p-3 rounded-lg border border-orange-200 dark:border-orange-900/50">
                  <div className="flex items-center gap-2 mb-1">
                    <MessageSquare className="h-4 w-4 text-orange-600" />
                    <p className="text-sm font-medium text-orange-700 dark:text-orange-400">
                      Motivo da solicitação:
                    </p>
                  </div>
                  <p className="text-sm">{selectedReview.review_request_reason}</p>
                  {selectedReview.requester_profile && (
                    <p className="text-xs text-muted-foreground mt-1">
                      — {selectedReview.requester_profile.first_name}
                    </p>
                  )}
                </div>
              )}

              {/* Informações */}
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
              </div>

              {/* Nova nota */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Nova nota (opcional):</label>
                <Select value={newRating} onValueChange={setNewRating}>
                  <SelectTrigger>
                    <SelectValue placeholder="Manter nota atual" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="keep">Manter nota atual ({selectedReview.rating ?? "–"})</SelectItem>
                    {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0].map(n => (
                      <SelectItem key={n} value={n.toString()}>
                        {n} - {n >= 9 ? "Promotor" : n >= 7 ? "Neutro" : "Detrator"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Notas de revisão */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Notas de revisão (opcional):</label>
                <Textarea
                  placeholder="Adicione uma observação sobre a decisão..."
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                />
              </div>

              {/* Botões */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => window.open(`/whatsapp?chatId=${selectedReview.conversation_id}`, '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Ver Conversa
                </Button>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button 
              variant="outline" 
              onClick={handleDismiss}
              disabled={dismissReview.isPending}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              {dismissReview.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <X className="h-4 w-4 mr-2" />
              )}
              Rejeitar
            </Button>
            <Button 
              onClick={handleApprove}
              disabled={approveReview.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {approveReview.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Aprovar {newRating && newRating !== "keep" && `(Nota: ${newRating})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
