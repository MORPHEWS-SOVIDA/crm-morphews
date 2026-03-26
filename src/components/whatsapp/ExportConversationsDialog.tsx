import { useState } from "react";
import { Download, Loader2, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format, subDays } from "date-fns";

interface ExportConversationsDialogProps {
  instances?: { id: string; name: string; display_name_for_team?: string | null }[];
  currentConversationId?: string | null;
}

export function ExportConversationsDialog({
  instances = [],
  currentConversationId,
}: ExportConversationsDialogProps) {
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const today = format(new Date(), "yyyy-MM-dd");
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [instanceId, setInstanceId] = useState<string>("all");
  const [exportScope, setExportScope] = useState<"all" | "current">(
    currentConversationId ? "current" : "all"
  );

  const handleExport = async () => {
    if (!session?.access_token) {
      toast.error("Você precisa estar logado");
      return;
    }

    setLoading(true);
    try {
      const body: Record<string, any> = {
        dateFrom,
        dateTo,
      };

      if (exportScope === "current" && currentConversationId) {
        body.conversationId = currentConversationId;
      } else if (instanceId !== "all") {
        body.instanceId = instanceId;
      }

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/export-whatsapp-conversations`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Erro na exportação" }));
        throw new Error(err.error || "Erro na exportação");
      }

      const text = await response.text();
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `conversas-whatsapp-${dateFrom}-a-${dateTo}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Exportação concluída!");
      setOpen(false);
    } catch (error: any) {
      console.error("Export error:", error);
      toast.error(error.message || "Erro ao exportar conversas");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDate = (days: number) => {
    const from = format(subDays(new Date(), days), "yyyy-MM-dd");
    setDateFrom(from);
    setDateTo(today);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">Exportar</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Exportar Conversas
          </DialogTitle>
          <DialogDescription>
            Exporte conversas no formato WhatsApp com data, remetente e conteúdo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Quick date buttons */}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => handleQuickDate(0)}>
              Hoje
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleQuickDate(1)}>
              Ontem
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleQuickDate(7)}>
              Últimos 7 dias
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleQuickDate(30)}>
              Últimos 30 dias
            </Button>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="dateFrom" className="text-xs">Data início</Label>
              <Input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dateTo" className="text-xs">Data fim</Label>
              <Input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>

          {/* Scope */}
          {currentConversationId && (
            <div className="space-y-1.5">
              <Label className="text-xs">Escopo</Label>
              <Select value={exportScope} onValueChange={(v: "all" | "current") => setExportScope(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current">Apenas esta conversa</SelectItem>
                  <SelectItem value="all">Todas as conversas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Instance filter */}
          {exportScope === "all" && instances.length > 1 && (
            <div className="space-y-1.5">
              <Label className="text-xs">Instância</Label>
              <Select value={instanceId} onValueChange={setInstanceId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as instâncias</SelectItem>
                  {instances.map((inst) => (
                    <SelectItem key={inst.id} value={inst.id}>
                      {inst.display_name_for_team || inst.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button onClick={handleExport} disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exportando...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Exportar Conversas
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
