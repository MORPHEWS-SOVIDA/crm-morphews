import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useDemand, useDeleteDemand } from '@/hooks/useDemands';
import {
  useDemandComments,
  useAddDemandComment,
  useDemandAttachments,
  useUploadDemandAttachment,
  useDeleteDemandAttachment,
  useDemandChecklist,
  useAddChecklistItem,
  useToggleChecklistItem,
  useDeleteChecklistItem,
  useDemandTimeEntries,
  useActiveTimeEntry,
  useStartTimeEntry,
  useStopTimeEntry,
  useDemandHistory,
} from '@/hooks/useDemandDetails';
import { URGENCY_CONFIG } from '@/types/demand';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { DemandEditForm } from '@/components/demands/DemandEditForm';
import {
  Clock,
  User,
  Calendar,
  Building2,
  MessageSquare,
  Paperclip,
  CheckSquare,
  History,
  Play,
  Square,
  Plus,
  Trash2,
  Download,
  FileText,
  Image as ImageIcon,
  File,
  Send,
  Timer,
  Pencil,
} from 'lucide-react';
import { format, formatDistanceToNow, differenceInSeconds } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface DemandDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  demandId: string;
  boardId: string;
}

export function DemandDetailDialog({ open, onOpenChange, demandId, boardId }: DemandDetailDialogProps) {
  const { profile } = useAuth();
  const { data: demand, isLoading } = useDemand(open ? demandId : null);
  const deleteDemand = useDeleteDemand();
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!open) setIsEditing(false);
  }, [open]);

  useEffect(() => {
    setIsEditing(false);
  }, [demandId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : demand ? (
          <>
            {/* Header */}
            <DialogHeader className="p-6 pb-0">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1 flex-1">
                  <DialogTitle className="text-xl">{demand.title}</DialogTitle>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                    {demand.board && (
                      <Badge variant="outline">
                        <Building2 className="h-3 w-3 mr-1" />
                        {demand.board.name}
                      </Badge>
                    )}
                    {demand.column && (
                      <Badge
                        variant="secondary"
                        style={{
                          backgroundColor: demand.column.color ? `${demand.column.color}20` : undefined,
                          borderColor: demand.column.color || undefined
                        }}
                      >
                        {demand.column.name}
                      </Badge>
                    )}
                    {demand.labels?.map(label => (
                      <Badge
                        key={label.id}
                        className="text-white text-xs"
                        style={{ backgroundColor: label.color }}
                      >
                        {label.name}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge className={cn(URGENCY_CONFIG[demand.urgency].bgColor, URGENCY_CONFIG[demand.urgency].color)}>
                    {URGENCY_CONFIG[demand.urgency].label}
                  </Badge>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing(v => !v)}
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    {isEditing ? 'Fechar edição' : 'Editar'}
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm" disabled={deleteDemand.isPending}>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir demanda?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação é permanente e não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={async () => {
                            await deleteDemand.mutateAsync({ id: demand.id, boardId });
                            onOpenChange(false);
                          }}
                        >
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </DialogHeader>

            {/* Info Bar */}
            <div className="px-6 py-3 flex flex-wrap gap-4 text-sm border-b bg-muted/30">
              {demand.sla_deadline && (
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">SLA:</span>
                  <span className="font-medium">
                    {format(new Date(demand.sla_deadline), "dd/MM 'às' HH:mm", { locale: ptBR })}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Criado:</span>
                <span className="font-medium">
                  {format(new Date(demand.created_at), "dd/MM/yyyy", { locale: ptBR })}
                </span>
              </div>
              {demand.total_time_seconds > 0 && (
                <div className="flex items-center gap-1.5">
                  <Timer className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Tempo:</span>
                  <span className="font-medium">
                    {Math.floor(demand.total_time_seconds / 3600)}h {Math.floor((demand.total_time_seconds % 3600) / 60)}m
                  </span>
                </div>
              )}
              {demand.lead && (
                <div className="flex items-center gap-1.5">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Cliente:</span>
                  <span className="font-medium">{demand.lead.name}</span>
                </div>
              )}
            </div>

            {/* Description */}
            {!isEditing && demand.description && (
              <div className="px-6 py-3 border-b">
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {demand.description}
                </p>
              </div>
            )}

            {/* Tabs */}
            <Tabs defaultValue="details" className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="mx-6 mt-2 w-fit">
                <TabsTrigger value="details" className="gap-1.5">
                  <User className="h-4 w-4" />
                  Detalhes
                </TabsTrigger>
                <TabsTrigger value="comments" className="gap-1.5">
                  <MessageSquare className="h-4 w-4" />
                  Comentários
                </TabsTrigger>
                <TabsTrigger value="checklist" className="gap-1.5">
                  <CheckSquare className="h-4 w-4" />
                  Checklist
                </TabsTrigger>
                <TabsTrigger value="attachments" className="gap-1.5">
                  <Paperclip className="h-4 w-4" />
                  Anexos
                </TabsTrigger>
                <TabsTrigger value="time" className="gap-1.5">
                  <Clock className="h-4 w-4" />
                  Tempo
                </TabsTrigger>
                <TabsTrigger value="history" className="gap-1.5">
                  <History className="h-4 w-4" />
                  Histórico
                </TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-hidden">
                <TabsContent value="details" className="h-full m-0">
                  <ScrollArea className="h-full">
                    <div className="p-6">
                      {isEditing ? (
                        <DemandEditForm
                          demand={demand}
                          onCancel={() => setIsEditing(false)}
                          onSaved={() => setIsEditing(false)}
                        />
                      ) : (
                        <DetailsTab demand={demand} />
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>
                <TabsContent value="comments" className="h-full m-0">
                  <CommentsTab demandId={demandId} />
                </TabsContent>
                <TabsContent value="checklist" className="h-full m-0 p-6">
                  <ChecklistTab demandId={demandId} />
                </TabsContent>
                <TabsContent value="attachments" className="h-full m-0 p-6">
                  <AttachmentsTab demandId={demandId} />
                </TabsContent>
                <TabsContent value="time" className="h-full m-0 p-6">
                  <TimeTrackingTab demandId={demandId} />
                </TabsContent>
                <TabsContent value="history" className="h-full m-0 p-6">
                  <HistoryTab demandId={demandId} />
                </TabsContent>
              </div>
            </Tabs>
          </>
        ) : (
          <p className="text-muted-foreground text-center py-8">Demanda não encontrada</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// DETAILS TAB
// ============================================================================

function DetailsTab({ demand }: { demand: any }) {
  const getUserInitials = (user: any) => {
    if (!user) return '?';
    return `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase() || '?';
  };

  return (
    <div className="space-y-6">
      {/* Assignees */}
      <div>
        <h4 className="font-medium mb-3 flex items-center gap-2">
          <User className="h-4 w-4" />
          Responsáveis ({demand.assignees?.length || 0})
        </h4>
        {demand.assignees && demand.assignees.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {demand.assignees.map((assignee: any) => (
              <div key={assignee.id} className="flex items-center gap-2 bg-muted rounded-full pl-1 pr-3 py-1">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={assignee.user?.avatar_url} />
                  <AvatarFallback className="text-xs">{getUserInitials(assignee.user)}</AvatarFallback>
                </Avatar>
                <span className="text-sm">
                  {assignee.user?.first_name} {assignee.user?.last_name}
                </span>
                <Badge variant="outline" className="text-[10px] ml-1">
                  {assignee.role === 'responsible' ? 'Responsável' : assignee.role}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum responsável atribuído</p>
        )}
      </div>

      {/* Estimated Time */}
      {demand.estimated_time_seconds && (
        <div>
          <h4 className="font-medium mb-2">Tempo Estimado</h4>
          <p className="text-sm">
            {Math.floor(demand.estimated_time_seconds / 3600)}h {Math.floor((demand.estimated_time_seconds % 3600) / 60)}m
          </p>
        </div>
      )}

      {/* Due Date */}
      {demand.due_at && (
        <div>
          <h4 className="font-medium mb-2">Data de Entrega</h4>
          <p className="text-sm">
            {format(new Date(demand.due_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// COMMENTS TAB
// ============================================================================

function CommentsTab({ demandId }: { demandId: string }) {
  const { data: comments, isLoading } = useDemandComments(demandId);
  const addComment = useAddDemandComment();
  const [newComment, setNewComment] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    await addComment.mutateAsync({ demandId, content: newComment });
    setNewComment('');
  };

  const getUserInitials = (user: any) => {
    if (!user) return '?';
    return `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase() || '?';
  };

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 p-6">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
          </div>
        ) : comments?.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-20" />
            <p>Nenhum comentário ainda</p>
          </div>
        ) : (
          <div className="space-y-4">
            {comments?.map((comment: any) => (
              <div key={comment.id} className="flex gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={comment.user?.avatar_url} />
                  <AvatarFallback className="text-xs">{getUserInitials(comment.user)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">
                      {comment.user?.first_name} {comment.user?.last_name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: ptBR })}
                    </span>
                  </div>
                  <p className="text-sm mt-1 whitespace-pre-wrap">{comment.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      <Separator />

      <form onSubmit={handleSubmit} className="p-4 flex gap-2">
        <Textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Escreva um comentário..."
          className="min-h-[60px] resize-none"
        />
        <Button type="submit" disabled={!newComment.trim() || addComment.isPending} size="icon" className="h-auto">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}

// ============================================================================
// CHECKLIST TAB
// ============================================================================

function ChecklistTab({ demandId }: { demandId: string }) {
  const { data: checklist, isLoading } = useDemandChecklist(demandId);
  const addItem = useAddChecklistItem();
  const toggleItem = useToggleChecklistItem();
  const deleteItem = useDeleteChecklistItem();
  const [newItem, setNewItem] = useState('');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.trim()) return;
    await addItem.mutateAsync({ demandId, title: newItem });
    setNewItem('');
  };

  const completedCount = checklist?.filter(i => i.is_completed).length || 0;
  const totalCount = checklist?.length || 0;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Progress */}
      {totalCount > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progresso</span>
            <span className="font-medium">{completedCount}/{totalCount}</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all" 
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Add Item */}
      <form onSubmit={handleAdd} className="flex gap-2">
        <Input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder="Adicionar item..."
          className="flex-1"
        />
        <Button type="submit" disabled={!newItem.trim() || addItem.isPending} size="icon">
          <Plus className="h-4 w-4" />
        </Button>
      </form>

      {/* Items */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      ) : checklist?.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <CheckSquare className="h-12 w-12 mx-auto mb-2 opacity-20" />
          <p>Nenhum item no checklist</p>
        </div>
      ) : (
        <div className="space-y-2">
          {checklist?.map((item) => (
            <div 
              key={item.id} 
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                item.is_completed && "bg-muted/50"
              )}
            >
              <Checkbox
                checked={item.is_completed}
                onCheckedChange={(checked) => 
                  toggleItem.mutate({ id: item.id, demandId, isCompleted: !!checked })
                }
              />
              <span className={cn("flex-1 text-sm", item.is_completed && "line-through text-muted-foreground")}>
                {item.title}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => deleteItem.mutate({ id: item.id, demandId })}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// ATTACHMENTS TAB
// ============================================================================

function AttachmentsTab({ demandId }: { demandId: string }) {
  const { data: attachments, isLoading } = useDemandAttachments(demandId);
  const uploadAttachment = useUploadDemandAttachment();
  const deleteAttachment = useDeleteDemandAttachment();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadAttachment.mutateAsync({ demandId, file });
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownload = async (attachment: any) => {
    const { data } = await supabase.storage
      .from('demand-attachments')
      .createSignedUrl(attachment.file_path, 60);
    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank');
    }
  };

  const getFileIcon = (type: string) => {
    if (type?.startsWith('image/')) return <ImageIcon className="h-8 w-8 text-blue-500" />;
    if (type?.includes('pdf')) return <FileText className="h-8 w-8 text-red-500" />;
    return <File className="h-8 w-8 text-muted-foreground" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      {/* Upload Button */}
      <div>
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileChange}
          className="hidden"
          id="file-upload"
        />
        <Button
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadAttachment.isPending}
          className="w-full border-dashed"
        >
          <Plus className="h-4 w-4 mr-2" />
          {uploadAttachment.isPending ? 'Enviando...' : 'Adicionar Anexo'}
        </Button>
      </div>

      {/* Attachments List */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map(i => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : attachments?.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Paperclip className="h-12 w-12 mx-auto mb-2 opacity-20" />
          <p>Nenhum anexo</p>
        </div>
      ) : (
        <div className="space-y-2">
          {attachments?.map((attachment: any) => (
            <div key={attachment.id} className="flex items-center gap-3 p-3 rounded-lg border">
              {getFileIcon(attachment.file_type)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{attachment.file_name}</p>
                <p className="text-xs text-muted-foreground">
                  {attachment.file_size && formatFileSize(attachment.file_size)} • {attachment.user?.first_name} {attachment.user?.last_name}
                </p>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleDownload(attachment)}
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteAttachment.mutate({ 
                    id: attachment.id, 
                    filePath: attachment.file_path, 
                    demandId 
                  })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// TIME TRACKING TAB
// ============================================================================

function TimeTrackingTab({ demandId }: { demandId: string }) {
  const { data: entries, isLoading } = useDemandTimeEntries(demandId);
  const { data: activeEntry } = useActiveTimeEntry(demandId);
  const startTimer = useStartTimeEntry();
  const stopTimer = useStopTimeEntry();

  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Update elapsed time for active entry
  useState(() => {
    if (!activeEntry) return;
    const interval = setInterval(() => {
      setElapsedSeconds(differenceInSeconds(new Date(), new Date(activeEntry.started_at)));
    }, 1000);
    return () => clearInterval(interval);
  });

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getUserInitials = (user: any) => {
    if (!user) return '?';
    return `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase() || '?';
  };

  return (
    <div className="space-y-6">
      {/* Timer Controls */}
      <div className="flex items-center justify-center gap-4 p-6 bg-muted/30 rounded-lg">
        {activeEntry ? (
          <>
            <div className="text-3xl font-mono font-bold">
              {formatDuration(elapsedSeconds || differenceInSeconds(new Date(), new Date(activeEntry.started_at)))}
            </div>
            <Button 
              variant="destructive" 
              size="lg"
              onClick={() => stopTimer.mutate({ id: activeEntry.id, demandId })}
              disabled={stopTimer.isPending}
            >
              <Square className="h-4 w-4 mr-2" />
              Parar
            </Button>
          </>
        ) : (
          <Button 
            size="lg"
            onClick={() => startTimer.mutate(demandId)}
            disabled={startTimer.isPending}
          >
            <Play className="h-4 w-4 mr-2" />
            Iniciar Timer
          </Button>
        )}
      </div>

      {/* Time Entries List */}
      <div>
        <h4 className="font-medium mb-3">Registros de Tempo</h4>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : entries?.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-2 opacity-20" />
            <p>Nenhum registro de tempo</p>
          </div>
        ) : (
          <div className="space-y-2">
            {entries?.map((entry: any) => (
              <div key={entry.id} className="flex items-center gap-3 p-3 rounded-lg border">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={entry.user?.avatar_url} />
                  <AvatarFallback className="text-xs">{getUserInitials(entry.user)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {entry.user?.first_name} {entry.user?.last_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(entry.started_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                    {entry.ended_at && ` - ${format(new Date(entry.ended_at), "HH:mm", { locale: ptBR })}`}
                  </p>
                </div>
                <div className="text-right">
                  {entry.duration_seconds ? (
                    <Badge variant="secondary">
                      {Math.floor(entry.duration_seconds / 3600)}h {Math.floor((entry.duration_seconds % 3600) / 60)}m
                    </Badge>
                  ) : (
                    <Badge variant="default" className="animate-pulse">
                      Em andamento
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// HISTORY TAB
// ============================================================================

function HistoryTab({ demandId }: { demandId: string }) {
  const { data: history, isLoading } = useDemandHistory(demandId);

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      'created': 'Criou a demanda',
      'updated': 'Atualizou a demanda',
      'moved': 'Moveu a demanda',
      'assigned': 'Atribuiu responsável',
      'unassigned': 'Removeu responsável',
      'comment_added': 'Adicionou comentário',
      'attachment_added': 'Adicionou anexo',
      'checklist_item_added': 'Adicionou item ao checklist',
      'checklist_item_completed': 'Completou item do checklist',
      'time_started': 'Iniciou timer',
      'time_stopped': 'Parou timer',
    };
    return labels[action] || action;
  };

  const getUserInitials = (user: any) => {
    if (!user) return '?';
    return `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase() || '?';
  };

  return (
    <div>
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : history?.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <History className="h-12 w-12 mx-auto mb-2 opacity-20" />
          <p>Nenhum histórico</p>
        </div>
      ) : (
        <div className="space-y-3">
          {history?.map((item: any) => (
            <div key={item.id} className="flex items-start gap-3">
              <Avatar className="h-6 w-6 mt-0.5">
                <AvatarImage src={item.user?.avatar_url} />
                <AvatarFallback className="text-[10px]">{getUserInitials(item.user)}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="text-sm">
                  <span className="font-medium">{item.user?.first_name || 'Sistema'}</span>
                  {' '}
                  {getActionLabel(item.action)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: ptBR })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
