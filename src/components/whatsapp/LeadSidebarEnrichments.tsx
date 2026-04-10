import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  StickyNote, ShoppingBag, Clock, FileText, ChevronDown, ChevronUp,
  Save, Loader2, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface LeadSidebarEnrichmentsProps {
  leadId: string;
  observations: string | null;
  updatedAt: string | null;
  lastMessageAt: string | null;
  onObservationsUpdated?: (obs: string) => void;
}

interface SaleItem {
  id: string;
  created_at: string;
  total_cents: number;
  status: string;
}

interface SummaryItem {
  id: string;
  summary_text: string;
  key_topics: string[] | null;
  sentiment: string | null;
  next_steps: string | null;
  created_at: string;
}

export function LeadSidebarEnrichments({
  leadId,
  observations,
  updatedAt,
  lastMessageAt,
  onObservationsUpdated,
}: LeadSidebarEnrichmentsProps) {
  const [obs, setObs] = useState(observations || '');
  const [isSavingObs, setIsSavingObs] = useState(false);
  const [obsChanged, setObsChanged] = useState(false);
  const [sales, setSales] = useState<SaleItem[]>([]);
  const [briefing, setBriefing] = useState<SummaryItem | null>(null);
  const [openSections, setOpenSections] = useState({
    observations: true,
    briefing: true,
    sales: false,
    inactivity: true,
  });

  useEffect(() => {
    setObs(observations || '');
    setObsChanged(false);
  }, [observations, leadId]);

  // Fetch sales and briefing
  useEffect(() => {
    if (!leadId) return;

    const fetchData = async () => {
      const [salesRes, briefingRes] = await Promise.all([
        supabase
          .from('sales')
          .select('id, created_at, total_cents, status')
          .eq('lead_id', leadId)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('lead_conversation_summaries')
          .select('id, summary_text, key_topics, sentiment, next_steps, created_at')
          .eq('lead_id', leadId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (salesRes.data) setSales(salesRes.data as SaleItem[]);
      if (briefingRes.data) setBriefing(briefingRes.data as SummaryItem);
    };

    fetchData();
  }, [leadId]);

  const saveObservations = async () => {
    setIsSavingObs(true);
    try {
      const { error } = await supabase
        .from('leads')
        .update({ observations: obs })
        .eq('id', leadId);
      if (error) throw error;
      setObsChanged(false);
      onObservationsUpdated?.(obs);
      toast.success('Observações salvas!');
    } catch {
      toast.error('Erro ao salvar observações');
    } finally {
      setIsSavingObs(false);
    }
  };

  const toggleSection = (key: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Calculate inactivity
  const inactivityText = lastMessageAt
    ? formatDistanceToNow(new Date(lastMessageAt), { locale: ptBR, addSuffix: false })
    : updatedAt
      ? formatDistanceToNow(new Date(updatedAt), { locale: ptBR, addSuffix: false })
      : null;

  const inactivityDays = lastMessageAt
    ? Math.floor((Date.now() - new Date(lastMessageAt).getTime()) / (1000 * 60 * 60 * 24))
    : updatedAt
      ? Math.floor((Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24))
      : null;

  const inactivityColor =
    inactivityDays === null ? 'text-muted-foreground'
    : inactivityDays <= 1 ? 'text-green-600'
    : inactivityDays <= 3 ? 'text-yellow-600'
    : inactivityDays <= 7 ? 'text-orange-500'
    : 'text-red-500';

  return (
    <div className="space-y-1">
      {/* Tempo sem interação */}
      {inactivityText && (
        <div className="flex items-center gap-2 px-1 py-1.5">
          <Clock className={`h-3.5 w-3.5 ${inactivityColor}`} />
          <span className={`text-xs font-medium ${inactivityColor}`}>
            Sem interação há {inactivityText}
          </span>
        </div>
      )}

      <Separator />

      {/* Briefing */}
      {briefing && (
        <>
          <Collapsible open={openSections.briefing} onOpenChange={() => toggleSection('briefing')}>
            <CollapsibleTrigger className="flex items-center justify-between w-full px-1 py-1.5 hover:bg-muted/50 rounded text-xs font-medium">
              <span className="flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-amber-600" />
                📋 Briefing do Lead
              </span>
              {openSections.briefing ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="px-1 pb-2">
              <div className="bg-amber-50 dark:bg-amber-950/20 rounded-lg p-2 text-xs space-y-1.5">
                <p className="text-foreground leading-relaxed">{briefing.summary_text}</p>
                {briefing.key_topics && briefing.key_topics.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {briefing.key_topics.map((topic, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0">
                        {topic}
                      </Badge>
                    ))}
                  </div>
                )}
                {briefing.sentiment && (
                  <p className="text-muted-foreground">
                    Sentimento: <span className="font-medium">{briefing.sentiment}</span>
                  </p>
                )}
                {briefing.next_steps && (
                  <p className="text-muted-foreground">
                    Próximos passos: <span className="font-medium">{briefing.next_steps}</span>
                  </p>
                )}
                <p className="text-muted-foreground/70 text-[10px]">
                  {format(new Date(briefing.created_at), "dd/MM/yy HH:mm")}
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>
          <Separator />
        </>
      )}

      {/* Observações */}
      <Collapsible open={openSections.observations} onOpenChange={() => toggleSection('observations')}>
        <CollapsibleTrigger className="flex items-center justify-between w-full px-1 py-1.5 hover:bg-muted/50 rounded text-xs font-medium">
          <span className="flex items-center gap-1.5">
            <StickyNote className="h-3.5 w-3.5 text-blue-500" />
            Observações
          </span>
          {openSections.observations ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </CollapsibleTrigger>
        <CollapsibleContent className="px-1 pb-2">
          <Textarea
            value={obs}
            onChange={(e) => {
              setObs(e.target.value);
              setObsChanged(true);
            }}
            placeholder="Anotações sobre o lead..."
            className="min-h-[60px] max-h-[120px] text-xs resize-none"
          />
          {obsChanged && (
            <Button
              size="sm"
              className="w-full mt-1.5 h-7 text-xs"
              onClick={saveObservations}
              disabled={isSavingObs}
            >
              {isSavingObs ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
              Salvar
            </Button>
          )}
        </CollapsibleContent>
      </Collapsible>

      <Separator />

      {/* Histórico de compras */}
      <Collapsible open={openSections.sales} onOpenChange={() => toggleSection('sales')}>
        <CollapsibleTrigger className="flex items-center justify-between w-full px-1 py-1.5 hover:bg-muted/50 rounded text-xs font-medium">
          <span className="flex items-center gap-1.5">
            <ShoppingBag className="h-3.5 w-3.5 text-green-600" />
            Compras ({sales.length})
          </span>
          {openSections.sales ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </CollapsibleTrigger>
        <CollapsibleContent className="px-1 pb-2">
          {sales.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2 text-center">Nenhuma compra</p>
          ) : (
            <div className="space-y-1.5">
              {sales.map((sale) => (
                <div
                  key={sale.id}
                  className="flex items-center justify-between bg-muted/50 rounded px-2 py-1.5 text-xs"
                >
                  <div>
                    <span className="font-medium">
                      R$ {(sale.total_cents / 100).toFixed(2)}
                    </span>
                    <span className="text-muted-foreground ml-1.5">
                      {format(new Date(sale.created_at), "dd/MM/yy")}
                    </span>
                  </div>
                  <Badge
                    variant={sale.status === 'completed' || sale.status === 'paid' ? 'default' : 'secondary'}
                    className="text-[10px] px-1.5 py-0"
                  >
                    {sale.status === 'completed' || sale.status === 'paid' ? '✅' : sale.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
