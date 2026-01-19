import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Phone, 
  MessageSquare, 
  ShoppingCart, 
  XCircle,
  User,
  Package,
  DollarSign,
  Mic,
  FileText,
  Loader2,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle as XCircleIcon,
  Star,
  AlertTriangle,
  ExternalLink
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useLeadReceptiveHistory, CallQualityScore } from '@/hooks/useLeadReceptiveHistory';
import { useTranscribeCall, useUpdateAttendanceRecording } from '@/hooks/useReceptiveTranscription';
import { CONVERSATION_MODES } from '@/hooks/useReceptiveModule';
import { extractReceptiveRecordingStoragePath } from '@/lib/receptive-recordings';
import { toast } from 'sonner';

interface LeadReceptiveHistorySectionProps {
  leadId: string;
}

function QualityScoreDisplay({ score }: { score: CallQualityScore }) {
  // Helper to get numeric score (supports both new numeric and legacy boolean format)
  const getScore = (numericKey: keyof CallQualityScore, legacyKey?: keyof CallQualityScore): number => {
    const numericValue = score[numericKey];
    if (typeof numericValue === 'number') return numericValue;
    // Fallback for legacy boolean format
    if (legacyKey) {
      const legacyValue = score[legacyKey];
      if (typeof legacyValue === 'boolean') return legacyValue ? 8 : 3;
    }
    return 5;
  };

  const criteria = [
    { key: 'proper_greeting_score' as const, legacyKey: 'proper_greeting' as const, label: 'Saudação adequada' },
    { key: 'asked_needs_score' as const, legacyKey: 'asked_needs' as const, label: 'Perguntou necessidades' },
    { key: 'followed_script_score' as const, legacyKey: 'followed_script' as const, label: 'Seguiu script' },
    { key: 'offered_kits_score' as const, legacyKey: 'offered_kits' as const, label: 'Ofereceu kits' },
    { key: 'handled_objections_score' as const, legacyKey: 'handled_objections' as const, label: 'Contornou objeções' },
    { key: 'clear_next_steps_score' as const, legacyKey: 'clear_next_steps' as const, label: 'Próximos passos claros' },
  ];

  const getScoreColor = (value: number) => {
    if (value >= 8) return 'text-green-600';
    if (value >= 5) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBg = (value: number) => {
    if (value >= 8) return 'bg-green-100 text-green-700';
    if (value >= 5) return 'bg-yellow-100 text-yellow-700';
    return 'bg-red-100 text-red-700';
  };

  const overallScoreColor = getScoreColor(score.overall_score);

  return (
    <div className="mt-3 p-3 bg-muted/30 rounded-lg space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Nota Geral da Ligação</span>
        <div className="flex items-center gap-1">
          <Star className={`w-5 h-5 ${overallScoreColor} fill-current`} />
          <span className={`text-xl font-bold ${overallScoreColor}`}>{score.overall_score}/10</span>
        </div>
      </div>
      
      <Progress value={score.overall_score * 10} className="h-2" />
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
        {criteria.map(({ key, legacyKey, label }) => {
          const value = getScore(key, legacyKey);
          return (
            <div key={key} className="flex items-center justify-between gap-2 p-2 rounded-md bg-background border">
              <span className="text-xs text-muted-foreground">{label}</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${getScoreBg(value)}`}>
                {value}/10
              </span>
            </div>
          );
        })}
      </div>

      {score.summary && (
        <p className="text-xs text-muted-foreground italic mt-2">"{score.summary}"</p>
      )}

      {score.improvements && score.improvements.length > 0 && (
        <div className="space-y-1 mt-2">
          <p className="text-xs font-medium flex items-center gap-1 text-amber-600">
            <AlertTriangle className="w-3 h-3" />
            Sugestões de melhoria:
          </p>
          <ul className="text-xs text-muted-foreground list-disc list-inside">
            {score.improvements.map((imp, i) => (
              <li key={i}>{imp}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function LeadReceptiveHistorySection({ leadId }: LeadReceptiveHistorySectionProps) {
  const { data: history = [], isLoading } = useLeadReceptiveHistory(leadId);
  const transcribeCall = useTranscribeCall();
  const updateRecording = useUpdateAttendanceRecording();
  
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [recordingUrls, setRecordingUrls] = useState<Record<string, string>>({});
  const [editingRecording, setEditingRecording] = useState<string | null>(null);

  const getModeLabel = (mode: string) => {
    const found = CONVERSATION_MODES.find(m => m.value === mode);
    return found?.label || mode;
  };

  const getModeIcon = (mode: string) => {
    if (mode.includes('call') || mode.includes('ligacao')) return Phone;
    if (mode.includes('whatsapp')) return MessageSquare;
    return MessageSquare;
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100);
  };

  const toggleExpanded = (id: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleSaveRecordingUrl = async (attendanceId: string) => {
    const url = recordingUrls[attendanceId];
    if (!url) {
      toast.error('Digite a URL da gravação');
      return;
    }
    
    await updateRecording.mutateAsync({ attendanceId, recordingUrl: url });
    setEditingRecording(null);
    setRecordingUrls(prev => ({ ...prev, [attendanceId]: '' }));
  };

  const handleTranscribe = async (attendanceId: string, audioUrl: string) => {
    if (!audioUrl) {
      toast.error('Nenhuma gravação disponível para transcrever');
      return;
    }

    const storagePath = extractReceptiveRecordingStoragePath(audioUrl) || undefined;
    await transcribeCall.mutateAsync({ attendanceId, audioUrl, storagePath });
  };


  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="w-5 h-5" />
            Histórico Receptivo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Carregando...</p>
        </CardContent>
      </Card>
    );
  }

  if (history.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="w-5 h-5" />
          Histórico Receptivo
          <Badge variant="secondary">{history.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {history.map((item) => {
          const ModeIcon = getModeIcon(item.conversation_mode);
          const isExpanded = expandedItems.has(item.id);
          const hasTranscription = !!item.transcription;
          const hasRecording = !!item.call_recording_url;
          const isTranscribing = item.transcription_status === 'processing' || 
                                 (transcribeCall.isPending && transcribeCall.variables?.attendanceId === item.id);
          
          return (
            <Collapsible key={item.id} open={isExpanded} onOpenChange={() => toggleExpanded(item.id)}>
              <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <ModeIcon className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {getModeLabel(item.conversation_mode)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(item.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      {item.sale_id && (
                        <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                          <ShoppingCart className="w-3 h-3 mr-1" />
                          Venda realizada
                        </Badge>
                      )}
                      
                      {item.reason_name && (
                        <Badge variant="outline" className="text-amber-600 border-amber-500/30">
                          <XCircle className="w-3 h-3 mr-1" />
                          {item.reason_name}
                        </Badge>
                      )}
                      
                      {item.product_name && (
                        <Badge variant="secondary">
                          <Package className="w-3 h-3 mr-1" />
                          {item.product_name}
                        </Badge>
                      )}
                      
                      {item.purchase_potential_cents && item.purchase_potential_cents > 0 && (
                        <Badge variant="outline" className="text-primary">
                          <DollarSign className="w-3 h-3 mr-1" />
                          Potencial: {formatCurrency(item.purchase_potential_cents)}
                        </Badge>
                      )}

                      {hasRecording && (
                        <Badge variant="outline" className="text-blue-600 border-blue-500/30">
                          <Mic className="w-3 h-3 mr-1" />
                          Gravação
                        </Badge>
                      )}

                      {hasTranscription && (
                        <Badge variant="outline" className="text-purple-600 border-purple-500/30">
                          <FileText className="w-3 h-3 mr-1" />
                          Transcrito
                        </Badge>
                      )}

                      {item.call_quality_score && (
                        <Badge 
                          variant="outline" 
                          className={
                            item.call_quality_score.overall_score >= 8 ? 'text-green-600 border-green-500/30' :
                            item.call_quality_score.overall_score >= 5 ? 'text-yellow-600 border-yellow-500/30' :
                            'text-red-600 border-red-500/30'
                          }
                        >
                          <Star className="w-3 h-3 mr-1" />
                          Nota: {item.call_quality_score.overall_score}/10
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-2">
                      <User className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{item.user_name}</span>
                    </div>
                  </div>

                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                </div>

                <CollapsibleContent className="mt-3 pt-3 border-t border-border/50 space-y-3">
                  {/* Recording Section */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <Mic className="w-4 h-4" />
                      Gravação da Ligação
                    </p>
                    
                    {hasRecording ? (
                      <div className="flex items-center gap-2">
                        <audio 
                          controls 
                          src={item.call_recording_url!} 
                          className="flex-1 h-8"
                        />
                        <a 
                          href={item.call_recording_url!} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    ) : editingRecording === item.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="Cole a URL da gravação aqui..."
                          value={recordingUrls[item.id] || ''}
                          onChange={(e) => setRecordingUrls(prev => ({ ...prev, [item.id]: e.target.value }))}
                          className="flex-1 text-sm"
                        />
                        <Button 
                          size="sm" 
                          onClick={() => handleSaveRecordingUrl(item.id)}
                          disabled={updateRecording.isPending}
                        >
                          {updateRecording.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => setEditingRecording(null)}
                        >
                          Cancelar
                        </Button>
                      </div>
                    ) : (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => setEditingRecording(item.id)}
                      >
                        <Mic className="w-4 h-4 mr-2" />
                        Adicionar gravação
                      </Button>
                    )}
                  </div>

                  {/* Transcription Section */}
                  {hasRecording && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          Transcrição
                        </p>
                        
                        {!hasTranscription && !isTranscribing && (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleTranscribe(item.id, item.call_recording_url!)}
                            disabled={transcribeCall.isPending}
                          >
                            <FileText className="w-4 h-4 mr-2" />
                            Transcrever com IA
                          </Button>
                        )}
                      </div>
                      
                      {isTranscribing && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Transcrevendo e analisando...
                        </div>
                      )}

                      {hasTranscription && (
                        <div className="p-3 bg-background rounded-lg border text-sm whitespace-pre-wrap max-h-60 overflow-y-auto">
                          {item.transcription}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Quality Score */}
                  {item.call_quality_score && (
                    <QualityScoreDisplay score={item.call_quality_score} />
                  )}

                  {/* Notes */}
                  {item.notes && (
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Observações</p>
                      <p className="text-sm text-muted-foreground">{item.notes}</p>
                    </div>
                  )}
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
      </CardContent>
    </Card>
  );
}
