import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, MessageSquare, TrendingUp, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface QualityQuestion {
  pergunta: string;
  nota: number;
  resposta: string;
}

interface CallQualityScore {
  cordialidade?: QualityQuestion;
  rapport?: QualityQuestion;
  script?: QualityQuestion;
  oferta_kit_caro?: QualityQuestion;
  insistencia_fechamento?: QualityQuestion;
  overall_score: number;
  observacoes_gerais?: string;
  sugestao_followup?: string | null;
  // Legacy fields
  proper_greeting_score?: number;
  asked_needs_score?: number;
  followed_script_score?: number;
  offered_kits_score?: number;
  handled_objections_score?: number;
  clear_next_steps_score?: number;
  summary?: string;
  improvements?: string[];
}

interface CallQualityAnalysisProps {
  score: CallQualityScore;
  hasSale: boolean;
}

function getScoreColor(score: number): string {
  if (score >= 8) return "text-green-600";
  if (score >= 6) return "text-yellow-600";
  if (score >= 4) return "text-orange-600";
  return "text-red-600";
}

function getScoreBgColor(score: number): string {
  if (score >= 8) return "bg-green-500/10 border-green-500/20";
  if (score >= 6) return "bg-yellow-500/10 border-yellow-500/20";
  if (score >= 4) return "bg-orange-500/10 border-orange-500/20";
  return "bg-red-500/10 border-red-500/20";
}

function QuestionCard({ question, index }: { question: QualityQuestion; index: number }) {
  return (
    <div className={`p-3 rounded-lg border ${getScoreBgColor(question.nota)} space-y-2`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium flex-1">
          {index}. {question.pergunta}
        </p>
        <Badge variant="outline" className={`${getScoreColor(question.nota)} border-current shrink-0`}>
          {question.nota}/10
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        {question.resposta}
      </p>
      <Progress value={question.nota * 10} className="h-1.5" />
    </div>
  );
}

export function CallQualityAnalysis({ score, hasSale }: CallQualityAnalysisProps) {
  const isNewFormat = !!score.cordialidade;

  const handleCopyFollowup = () => {
    if (score.sugestao_followup) {
      navigator.clipboard.writeText(score.sugestao_followup);
      toast.success("Sugestão copiada!");
    }
  };

  // New format with detailed questions
  if (isNewFormat) {
    const questions = [
      score.cordialidade,
      score.rapport,
      score.script,
      score.oferta_kit_caro,
      score.insistencia_fechamento,
    ].filter((q): q is QualityQuestion => !!q);

    return (
      <div className="space-y-4">
        {/* Overall Score Header */}
        <div className={`p-4 rounded-lg border ${getScoreBgColor(score.overall_score)}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Nota Geral da Ligação
            </span>
            <span className={`text-2xl font-bold ${getScoreColor(score.overall_score)}`}>
              {score.overall_score}/10
            </span>
          </div>
          <Progress value={score.overall_score * 10} className="h-2" />
        </div>

        {/* Individual Questions */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Avaliação Detalhada
          </h4>
          {questions.map((q, idx) => (
            <QuestionCard key={idx} question={q} index={idx + 1} />
          ))}
        </div>

        {/* General Observations */}
        {score.observacoes_gerais && (
          <Card className="p-4 bg-muted/30">
            <div className="flex items-start gap-2">
              <MessageSquare className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
              <div>
                <h4 className="text-sm font-semibold mb-1">Observações Gerais</h4>
                <p className="text-sm text-muted-foreground">{score.observacoes_gerais}</p>
              </div>
            </div>
          </Card>
        )}

        {/* Follow-up Suggestion (only for non-sales) */}
        {!hasSale && score.sugestao_followup && (
          <Card className="p-4 bg-amber-500/10 border-amber-500/30">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 text-amber-600 shrink-0" />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-sm font-semibold text-amber-700">
                    Sugestão de Follow-up para o Vendedor
                  </h4>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={handleCopyFollowup}
                    className="h-7 text-amber-700 hover:text-amber-800"
                  >
                    <Copy className="w-3 h-3 mr-1" />
                    Copiar
                  </Button>
                </div>
                <p className="text-sm text-amber-800">{score.sugestao_followup}</p>
              </div>
            </div>
          </Card>
        )}

        {/* Sale indicator */}
        {hasSale && (
          <div className="flex items-center gap-2 text-green-600 text-sm">
            <CheckCircle2 className="w-4 h-4" />
            <span>Venda realizada nesta ligação</span>
          </div>
        )}
      </div>
    );
  }

  // Legacy format fallback
  return (
    <div className="p-3 bg-muted/30 rounded-lg space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Análise de Qualidade</span>
        <span className={`text-lg font-bold ${getScoreColor(score.overall_score)}`}>
          {score.overall_score}/10
        </span>
      </div>
      <Progress value={score.overall_score * 10} className="h-2" />
      {score.summary && (
        <p className="text-xs text-muted-foreground italic">
          "{score.summary}"
        </p>
      )}
      {score.improvements && score.improvements.length > 0 && (
        <div className="mt-2">
          <p className="text-xs font-medium mb-1">Pontos de melhoria:</p>
          <ul className="text-xs text-muted-foreground list-disc list-inside">
            {score.improvements.map((imp, idx) => (
              <li key={idx}>{imp}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
