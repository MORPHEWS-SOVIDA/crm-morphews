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
  Star,
  Upload,
  MapPin,
  ClipboardList
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useLeadReceptiveHistory } from '@/hooks/useLeadReceptiveHistory';
import { useTranscribeCall } from '@/hooks/useReceptiveTranscription';
import { CONVERSATION_MODES } from '@/hooks/useReceptiveModule';
import { extractReceptiveRecordingStoragePath } from '@/lib/receptive-recordings';
import { AudioPlayer } from '@/components/receptive/AudioPlayer';
import { CallQualityAnalysis } from '@/components/receptive/CallQualityAnalysis';

interface LeadReceptiveHistorySectionProps {
  leadId: string;
}

// Modos que suportam upload de gravação de áudio
const CALL_MODES = ['receptive_call', 'active_call'];

export function LeadReceptiveHistorySection({ leadId }: LeadReceptiveHistorySectionProps) {
  const { data: history = [], isLoading } = useLeadReceptiveHistory(leadId);
  const transcribeCall = useTranscribeCall();
  
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

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

  const handleTranscribe = async (attendanceId: string, storagePath: string | null, fallbackUrl: string | null) => {
    if (!storagePath && !fallbackUrl) {
      return;
    }

    await transcribeCall.mutateAsync({ 
      attendanceId, 
      audioUrl: fallbackUrl || undefined, 
      storagePath: storagePath || undefined 
    });
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600 border-green-500/30';
    if (score >= 5) return 'text-yellow-600 border-yellow-500/30';
    return 'text-red-600 border-red-500/30';
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="w-5 h-5" />
            Histórico de Ligações e Atendimentos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Carregando...
          </div>
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
          Histórico de Ligações e Atendimentos
          <Badge variant="secondary">{history.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {history.map((item) => {
          const ModeIcon = getModeIcon(item.conversation_mode);
          const isExpanded = expandedItems.has(item.id);
          const hasTranscription = !!item.transcription;
          const isCallMode = CALL_MODES.includes(item.conversation_mode);
          
          // Get storage path - prefer recording_storage_path, fallback to extracting from URL
          const storagePath = (item as any).recording_storage_path || 
            extractReceptiveRecordingStoragePath(item.call_recording_url);
          const hasRecording = !!storagePath || !!item.call_recording_url;
          
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
                          className={getScoreColor(item.call_quality_score.overall_score)}
                        >
                          <Star className="w-3 h-3 mr-1" />
                          Nota: {item.call_quality_score.overall_score}/10
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <User className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{item.user_name}</span>
                      {item.source_name && (
                        <>
                          <span className="text-muted-foreground">•</span>
                          <MapPin className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{item.source_name}</span>
                        </>
                      )}
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

                <CollapsibleContent className="mt-3 pt-3 border-t border-border/50 space-y-4">
                  {/* Recording Section - Only for Call modes */}
                  {isCallMode && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <Mic className="w-4 h-4" />
                        Gravação da Ligação
                      </p>
                      
                      {hasRecording && storagePath ? (
                        <AudioPlayer 
                          storagePath={storagePath} 
                          fallbackUrl={item.call_recording_url}
                        />
                      ) : hasRecording ? (
                        <audio 
                          controls 
                          src={item.call_recording_url!} 
                          className="w-full h-10"
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground italic">
                          Nenhuma gravação disponível
                        </p>
                      )}
                    </div>
                  )}

                  {/* Transcription Section - Only for Call modes with recording */}
                  {isCallMode && hasRecording && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          Transcrição
                        </p>
                        
                        {!hasTranscription && !isTranscribing && (
                          <Button
                            size="sm"
                            onClick={() => handleTranscribe(item.id, storagePath, item.call_recording_url)}
                            disabled={transcribeCall.isPending || !storagePath}
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

                  {/* Quality Score Analysis */}
                  {isCallMode && item.call_quality_score && (
                    <CallQualityAnalysis 
                      score={item.call_quality_score as any} 
                      hasSale={!!item.sale_id} 
                    />
                  )}

                  {/* Product Answers */}
                  {item.product_answers && Object.keys(item.product_answers).length > 0 && (
                    <div className="space-y-1">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <ClipboardList className="w-4 h-4" />
                        Respostas do Produto
                      </p>
                      <div className="grid grid-cols-1 gap-1 bg-background p-2 rounded border">
                        {Object.entries(item.product_answers).map(([key, value]) => (
                          value && (
                            <div key={key} className="text-sm">
                              <span className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}: </span>
                              <span className="text-foreground">{String(value)}</span>
                            </div>
                          )
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {item.notes && (
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Observações</p>
                      <p className="text-sm text-muted-foreground bg-background p-2 rounded border">
                        {item.notes}
                      </p>
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
