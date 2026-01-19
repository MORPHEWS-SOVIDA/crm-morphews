import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Phone,
  User,
  Calendar,
  Filter,
  FileAudio,
  FileText,
  ShoppingCart,
  XCircle,
  Star,
  Mic,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  Search,
  BarChart3,
  TrendingUp,
  Percent,
  Upload,
} from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import {
  useReceptiveManagement,
  useUpdateReceptiveAttendance,
  useReceptiveStats,
  ReceptiveFilters,
} from '@/hooks/useReceptiveManagement';
import { useTranscribeCall } from '@/hooks/useReceptiveTranscription';
import { useUsers } from '@/hooks/useUsers';
import { useNonPurchaseReasons } from '@/hooks/useNonPurchaseReasons';
import { CONVERSATION_MODES } from '@/hooks/useReceptiveModule';
import { RecordingUploader } from '@/components/receptive/RecordingUploader';
import { useAuth } from '@/hooks/useAuth';
import { extractReceptiveRecordingStoragePath } from '@/lib/receptive-recordings';
import { toast } from 'sonner';

export default function ReceptiveManagement() {
  const { profile } = useAuth();
  const [filters, setFilters] = useState<ReceptiveFilters>({
    hasRecording: 'all',
    hasTranscription: 'all',
    outcome: 'all',
  });
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [editingRecording, setEditingRecording] = useState<string | null>(null);
  const [uploadingRecording, setUploadingRecording] = useState<Record<string, boolean>>({});
  const [storagePaths, setStoragePaths] = useState<Record<string, string>>({});
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesValues, setNotesValues] = useState<Record<string, string>>({});

  const { data: attendances = [], isLoading } = useReceptiveManagement(filters);
  const { data: stats } = useReceptiveStats(filters);
  const { data: users = [] } = useUsers();
  const { data: nonPurchaseReasons = [] } = useNonPurchaseReasons();
  const updateAttendance = useUpdateReceptiveAttendance();
  const transcribeCall = useTranscribeCall();

  const getModeLabel = (mode: string) => {
    const found = CONVERSATION_MODES.find(m => m.value === mode);
    return found?.label || mode;
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

  const handleRecordingUploaded = async (attendanceId: string, url: string, storagePath?: string) => {
    await updateAttendance.mutateAsync({ id: attendanceId, updates: { call_recording_url: url } });
    if (storagePath) {
      // Store the storage path to pass to transcription later
      setStoragePaths(prev => ({ ...prev, [attendanceId]: storagePath }));
    }
    setEditingRecording(null);
  };

  const handleSaveNotes = async (id: string) => {
    const notes = notesValues[id];
    await updateAttendance.mutateAsync({ id, updates: { notes } });
    setEditingNotes(null);
  };

  const handleTranscribe = async (id: string, audioUrl: string) => {
    // IMPORTANT: signed URLs expire; try to recover the storage path from the URL when possible
    const storagePath = storagePaths[id] || extractReceptiveRecordingStoragePath(audioUrl) || undefined;
    await transcribeCall.mutateAsync({ attendanceId: id, audioUrl, storagePath });
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600';
    if (score >= 5) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gerência de Receptivos</h1>
          <p className="text-muted-foreground">Gerencie atendimentos, áudios e transcrições</p>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Phone className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-2xl font-bold">{stats.total}</p>
                    <p className="text-xs text-muted-foreground">Atendimentos</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-500" />
                  <div>
                    <p className="text-2xl font-bold">{stats.conversionRate}%</p>
                    <p className="text-xs text-muted-foreground">Conversão</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Mic className="w-5 h-5 text-blue-500" />
                  <div>
                    <p className="text-2xl font-bold">{stats.recordingRate}%</p>
                    <p className="text-xs text-muted-foreground">Com Gravação</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Star className="w-5 h-5 text-yellow-500" />
                  <div>
                    <p className="text-2xl font-bold">{stats.avgQualityScore}</p>
                    <p className="text-xs text-muted-foreground">Nota Média</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Data Inicial</Label>
                <Input
                  type="date"
                  value={filters.dateFrom || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value || undefined }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Data Final</Label>
                <Input
                  type="date"
                  value={filters.dateTo || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value || undefined }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Vendedor</Label>
                <Select
                  value={filters.userId || 'all'}
                  onValueChange={(v) => setFilters(prev => ({ ...prev, userId: v === 'all' ? undefined : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.first_name} {user.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Resultado</Label>
                <Select
                  value={filters.outcome || 'all'}
                  onValueChange={(v) => setFilters(prev => ({ ...prev, outcome: v as ReceptiveFilters['outcome'] }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="sale">Venda Realizada</SelectItem>
                    <SelectItem value="no_purchase">Sem Venda</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Gravação</Label>
                <Select
                  value={filters.hasRecording || 'all'}
                  onValueChange={(v) => setFilters(prev => ({ ...prev, hasRecording: v as ReceptiveFilters['hasRecording'] }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="yes">Com Gravação</SelectItem>
                    <SelectItem value="no">Sem Gravação</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Transcrição</Label>
                <Select
                  value={filters.hasTranscription || 'all'}
                  onValueChange={(v) => setFilters(prev => ({ ...prev, hasTranscription: v as ReceptiveFilters['hasTranscription'] }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="yes">Com Transcrição</SelectItem>
                    <SelectItem value="no">Sem Transcrição</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Motivo de Não Compra</Label>
                <Select
                  value={filters.nonPurchaseReasonId || 'all'}
                  onValueChange={(v) => setFilters(prev => ({ ...prev, nonPurchaseReasonId: v === 'all' ? undefined : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {nonPurchaseReasons.map((reason) => (
                      <SelectItem key={reason.id} value={reason.id}>
                        {reason.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Atendimentos</span>
              <Badge variant="secondary">{attendances.length} resultados</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : attendances.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Phone className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>Nenhum atendimento encontrado com os filtros selecionados.</p>
              </div>
            ) : (
              attendances.map((item) => {
                const isExpanded = expandedItems.has(item.id);
                const hasRecording = !!item.call_recording_url;
                const hasTranscription = !!item.transcription;
                const isTranscribing = item.transcription_status === 'processing' ||
                  (transcribeCall.isPending && transcribeCall.variables?.attendanceId === item.id);

                return (
                  <Collapsible key={item.id} open={isExpanded} onOpenChange={() => toggleExpanded(item.id)}>
                    <div className="p-4 rounded-lg bg-muted/50 border border-border/50">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm font-medium">
                              {format(new Date(item.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {getModeLabel(item.conversation_mode)}
                            </Badge>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <User className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm">{item.user_name}</span>
                            {item.lead_name && (
                              <>
                                <span className="text-muted-foreground">→</span>
                                <span className="text-sm font-medium">{item.lead_name}</span>
                              </>
                            )}
                            <span className="text-xs text-muted-foreground">({item.phone_searched})</span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {item.sale_id ? (
                              <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                                <ShoppingCart className="w-3 h-3 mr-1" />
                                Venda Realizada
                              </Badge>
                            ) : item.reason_name ? (
                              <Badge variant="outline" className="text-amber-600 border-amber-500/30">
                                <XCircle className="w-3 h-3 mr-1" />
                                {item.reason_name}
                              </Badge>
                            ) : (
                              <Badge variant="secondary">Pendente</Badge>
                            )}

                            {item.product_name && (
                              <Badge variant="secondary">{item.product_name}</Badge>
                            )}

                            {hasRecording && (
                              <Badge variant="outline" className="text-blue-600 border-blue-500/30">
                                <FileAudio className="w-3 h-3 mr-1" />
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
                                className={`${getScoreColor(item.call_quality_score.overall_score)} border-current`}
                              >
                                <Star className="w-3 h-3 mr-1" />
                                {item.call_quality_score.overall_score}/10
                              </Badge>
                            )}
                          </div>
                        </div>

                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm">
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </Button>
                        </CollapsibleTrigger>
                      </div>

                      <CollapsibleContent className="mt-4 pt-4 border-t border-border/50 space-y-4">
                        {/* Recording Section */}
                        <div className="space-y-2">
                          <p className="text-sm font-medium flex items-center gap-2">
                            <Mic className="w-4 h-4" />
                            Gravação
                          </p>

                          {hasRecording ? (
                            <div className="flex items-center gap-2">
                              <audio controls src={item.call_recording_url!} className="flex-1 h-10" />
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
                            <RecordingUploader
                              attendanceId={item.id}
                              organizationId={item.organization_id}
                              onUploadComplete={(url, storagePath) => {
                                handleRecordingUploaded(item.id, url, storagePath);
                              }}
                              onCancel={() => setEditingRecording(null)}
                              isUploading={uploadingRecording[item.id] || false}
                              setIsUploading={(value) => setUploadingRecording(prev => ({ ...prev, [item.id]: value }))}
                            />
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingRecording(item.id)}
                            >
                              <Upload className="w-4 h-4 mr-2" />
                              Enviar Gravação
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
                          <div className="p-3 bg-muted/30 rounded-lg space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">Análise de Qualidade</span>
                              <span className={`text-lg font-bold ${getScoreColor(item.call_quality_score.overall_score)}`}>
                                {item.call_quality_score.overall_score}/10
                              </span>
                            </div>
                            <Progress value={item.call_quality_score.overall_score * 10} className="h-2" />
                            {item.call_quality_score.summary && (
                              <p className="text-xs text-muted-foreground italic">
                                "{item.call_quality_score.summary}"
                              </p>
                            )}
                          </div>
                        )}

                        {/* Notes Section */}
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Observações</p>
                          {editingNotes === item.id ? (
                            <div className="space-y-2">
                              <Textarea
                                value={notesValues[item.id] ?? item.notes ?? ''}
                                onChange={(e) => setNotesValues(prev => ({ ...prev, [item.id]: e.target.value }))}
                                placeholder="Adicione observações..."
                                rows={3}
                              />
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleSaveNotes(item.id)}
                                  disabled={updateAttendance.isPending}
                                >
                                  Salvar
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setEditingNotes(null)}>
                                  Cancelar
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div
                              className="p-2 bg-background rounded border text-sm cursor-pointer hover:bg-muted/50 min-h-[40px]"
                              onClick={() => {
                                setNotesValues(prev => ({ ...prev, [item.id]: item.notes || '' }));
                                setEditingNotes(item.id);
                              }}
                            >
                              {item.notes || <span className="text-muted-foreground">Clique para adicionar...</span>}
                            </div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
