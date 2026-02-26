import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Plus, Trash2, Edit2, Loader2, Mic, Image as ImageIcon, FileIcon, X,
  MicOff, Square, MessageSquareText, Zap
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useQuickMessagesAdmin, QuickMessage } from "@/hooks/useQuickMessages";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { WhatsAppMessageInput } from "@/components/whatsapp/WhatsAppMessageInput";

function getBestAudioFormat(): { mimeType: string; supported: boolean } {
  if (typeof MediaRecorder === "undefined") return { mimeType: "", supported: false };
  const formats = ["audio/ogg; codecs=opus", "audio/ogg", "audio/webm; codecs=opus", "audio/webm", "audio/mp4"];
  for (const f of formats) {
    if (MediaRecorder.isTypeSupported(f)) return { mimeType: f, supported: true };
  }
  return { mimeType: "", supported: false };
}

export default function WhatsAppQuickMessages() {
  const { profile } = useAuth();
  const orgId = profile?.organization_id;
  const { data: messages, isLoading, createMessage, updateMessage, deleteMessage, isCreating } = useQuickMessagesAdmin();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMessage, setEditingMessage] = useState<QuickMessage | null>(null);
  const [title, setTitle] = useState("");
  const [messageText, setMessageText] = useState("");
  const [mediaType, setMediaType] = useState<"image" | "audio" | "document" | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaFilename, setMediaFilename] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const resetForm = () => {
    setTitle("");
    setMessageText("");
    setMediaType(null);
    setMediaUrl(null);
    setMediaFilename(null);
    setEditingMessage(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (msg: QuickMessage) => {
    setEditingMessage(msg);
    setTitle(msg.title);
    setMessageText(msg.message_text || "");
    setMediaType(msg.media_type);
    setMediaUrl(msg.media_url);
    setMediaFilename(msg.media_filename);
    setDialogOpen(true);
  };

  const uploadToStorage = async (file: Blob, filename: string): Promise<string | null> => {
    if (!orgId) return null;
    const timestamp = Date.now();
    const safeName = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
    const path = `${orgId}/quick_${timestamp}_${safeName}`;
    const { error } = await supabase.storage
      .from("scheduled-messages-media")
      .upload(path, file, { cacheControl: "3600", upsert: false });
    if (error) throw error;
    const { data: signedData, error: signedError } = await supabase.storage
      .from("scheduled-messages-media")
      .createSignedUrl(path, 60 * 60 * 24 * 365);
    if (signedError) throw signedError;
    return signedData.signedUrl;
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Selecione uma imagem"); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("Imagem muito grande (máx. 10MB)"); return; }
    setIsUploading(true);
    try {
      const url = await uploadToStorage(file, file.name);
      if (url) { setMediaType("image"); setMediaUrl(url); setMediaFilename(file.name); toast.success("Imagem anexada"); }
    } catch { toast.error("Erro ao fazer upload"); }
    finally { setIsUploading(false); if (imageInputRef.current) imageInputRef.current.value = ""; }
  };

  const handleDocumentSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { toast.error("Arquivo muito grande (máx. 20MB)"); return; }
    setIsUploading(true);
    try {
      const url = await uploadToStorage(file, file.name);
      if (url) { setMediaType("document"); setMediaUrl(url); setMediaFilename(file.name); toast.success("Documento anexado"); }
    } catch { toast.error("Erro ao fazer upload"); }
    finally { setIsUploading(false); if (documentInputRef.current) documentInputRef.current.value = ""; }
  };

  const startRecording = async () => {
    const formatInfo = getBestAudioFormat();
    if (!formatInfo.supported) { toast.error("Navegador não suporta gravação"); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream, { mimeType: formatInfo.mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        if (chunksRef.current.length === 0) return;
        setIsUploading(true);
        const mType = formatInfo.mimeType.split(";")[0];
        const ext = mType.includes("ogg") ? "ogg" : mType.includes("webm") ? "webm" : "m4a";
        const blob = new Blob(chunksRef.current, { type: mType });
        try {
          const filename = `audio_${Date.now()}.${ext}`;
          const url = await uploadToStorage(blob, filename);
          if (url) { setMediaType("audio"); setMediaUrl(url); setMediaFilename(filename); toast.success("Áudio gravado"); }
        } catch { toast.error("Erro ao salvar áudio"); }
        finally { setIsUploading(false); }
      };

      recorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime((p) => p + 1), 1000);
    } catch { toast.error("Erro ao acessar microfone"); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    }
  };

  const removeMedia = () => { setMediaType(null); setMediaUrl(null); setMediaFilename(null); };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const handleSave = async () => {
    if (!title.trim()) { toast.error("Informe um título"); return; }
    if (!messageText.trim() && !mediaUrl) { toast.error("Informe uma mensagem ou anexe mídia"); return; }
    try {
      if (editingMessage) {
        await updateMessage({
          id: editingMessage.id,
          title: title.trim(),
          message_text: messageText || null,
          media_type: mediaType,
          media_url: mediaUrl,
          media_filename: mediaFilename,
        });
        toast.success("Mensagem atualizada");
      } else {
        await createMessage({
          title: title.trim(),
          message_text: messageText || undefined,
          media_type: mediaType,
          media_url: mediaUrl,
          media_filename: mediaFilename,
        });
        toast.success("Mensagem criada");
      }
      setDialogOpen(false);
      resetForm();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta mensagem rápida?")) return;
    try {
      await deleteMessage(id);
      toast.success("Mensagem excluída");
    } catch { toast.error("Erro ao excluir"); }
  };

  const handleToggleActive = async (msg: QuickMessage) => {
    try {
      await updateMessage({ id: msg.id, is_active: !msg.is_active });
      toast.success(msg.is_active ? "Mensagem desativada" : "Mensagem ativada");
    } catch { toast.error("Erro ao atualizar"); }
  };

  const audioSupported = getBestAudioFormat().supported;

  return (
    <div className="container max-w-4xl mx-auto py-6 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            Mensagens Rápidas
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Crie mensagens prontas para seus vendedores enviarem rapidamente no chat
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Nova mensagem
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : !messages?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <MessageSquareText className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-medium text-lg">Nenhuma mensagem rápida</h3>
            <p className="text-muted-foreground text-sm mt-1 max-w-md">
              Crie mensagens prontas com texto, imagem ou áudio para que seus vendedores possam enviar rapidamente durante as conversas.
            </p>
            <Button onClick={openCreate} className="mt-4 gap-2"><Plus className="h-4 w-4" /> Criar primeira mensagem</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {messages.map((msg) => (
            <Card key={msg.id} className={cn("transition-opacity", !msg.is_active && "opacity-50")}>
              <CardContent className="flex items-center gap-4 py-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{msg.title}</span>
                    {msg.media_type && (
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {msg.media_type === "image" ? "📷 Imagem" : msg.media_type === "audio" ? "🎙️ Áudio" : "📄 Documento"}
                      </Badge>
                    )}
                    {msg.message_text && !msg.media_type && (
                      <Badge variant="outline" className="text-xs shrink-0">📝 Texto</Badge>
                    )}
                  </div>
                  {msg.message_text && (
                    <p className="text-sm text-muted-foreground truncate mt-1">{msg.message_text.substring(0, 100)}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch checked={msg.is_active} onCheckedChange={() => handleToggleActive(msg)} />
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(msg)}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(msg.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) { resetForm(); } setDialogOpen(o); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingMessage ? "Editar mensagem rápida" : "Nova mensagem rápida"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título (identificação interna)</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Tabela de preços Spark" className="mt-1" />
            </div>

            <div>
              <Label>Mensagem de texto (opcional se tiver mídia)</Label>
              <div className="mt-1">
                <WhatsAppMessageInput
                  value={messageText}
                  onChange={setMessageText}
                  onSend={() => {}}
                  placeholder="Digite a mensagem..."
                />
              </div>
            </div>

            {/* Media section */}
            <div>
              <Label>Mídia (opcional)</Label>
              <input type="file" ref={imageInputRef} onChange={handleImageSelect} accept="image/*" className="hidden" />
              <input type="file" ref={documentInputRef} onChange={handleDocumentSelect} accept=".pdf,.doc,.docx,.xls,.xlsx,.txt" className="hidden" />

              {mediaUrl && mediaType ? (
                <div className="flex items-center gap-2 p-2 bg-muted rounded-md mt-1">
                  {mediaType === "image" && <img src={mediaUrl} alt="Preview" className="h-10 w-10 object-cover rounded" />}
                  {mediaType === "audio" && <div className="h-10 w-10 bg-primary/10 rounded flex items-center justify-center"><Mic className="h-5 w-5 text-primary" /></div>}
                  {mediaType === "document" && <div className="h-10 w-10 bg-primary/10 rounded flex items-center justify-center"><FileIcon className="h-5 w-5 text-primary" /></div>}
                  <span className="text-sm truncate flex-1">{mediaFilename}</span>
                  <Button variant="ghost" size="icon" onClick={removeMedia} className="h-7 w-7"><X className="h-4 w-4" /></Button>
                </div>
              ) : isRecording ? (
                <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-950/30 rounded-md mt-1">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-sm font-medium text-red-600 dark:text-red-400">Gravando: {formatTime(recordingTime)}</span>
                  <div className="ml-auto">
                    <Button variant="default" size="icon" onClick={stopRecording} className="h-7 w-7 bg-red-500 hover:bg-red-600">
                      <Square className="h-3 w-3 fill-current" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2 mt-1">
                  <Button variant="outline" size="sm" onClick={() => imageInputRef.current?.click()} disabled={isUploading} className="gap-1">
                    {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />} Imagem
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => documentInputRef.current?.click()} disabled={isUploading} className="gap-1">
                    <FileIcon className="h-4 w-4" /> Documento
                  </Button>
                  <Button variant="outline" size="sm" onClick={startRecording} disabled={!audioSupported || isUploading} className="gap-1">
                    {audioSupported ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />} Gravar áudio
                  </Button>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancelar</Button>
            <Button onClick={handleSave} disabled={isCreating || isUploading}>
              {isCreating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingMessage ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
