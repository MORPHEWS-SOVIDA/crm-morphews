import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MapPin, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';

interface LeadSourceHistorySectionProps {
  leadId: string;
}

interface SourceHistoryItem {
  id: string;
  recorded_at: string;
  source_name: string;
  recorded_by_name: string;
}

function useLeadSourceHistory(leadId: string | undefined) {
  return useQuery({
    queryKey: ['lead-source-history', leadId],
    queryFn: async () => {
      if (!leadId) return [];

      const { data, error } = await supabase
        .from('lead_source_history')
        .select('id, source_id, recorded_by, recorded_at, notes')
        .eq('lead_id', leadId)
        .order('recorded_at', { ascending: false });

      if (error) throw error;
      if (!data || data.length === 0) return [];

      // Fetch source names
      const sourceIds = [...new Set(data.map(d => d.source_id))];
      const { data: sources } = await supabase
        .from('lead_sources')
        .select('id, name')
        .in('id', sourceIds);

      // Fetch user names
      const userIds = [...new Set(data.map(d => d.recorded_by).filter(Boolean))];
      const { data: profiles } = userIds.length > 0
        ? await supabase.from('profiles').select('user_id, first_name, last_name').in('user_id', userIds)
        : { data: [] };

      const sourceMap = new Map((sources || []).map(s => [s.id, s.name]));
      const profileMap = new Map((profiles || []).map(p => [p.user_id, `${p.first_name} ${p.last_name}`]));

      return data.map(item => ({
        id: item.id,
        recorded_at: item.recorded_at,
        source_name: sourceMap.get(item.source_id) || 'Desconhecida',
        recorded_by_name: item.recorded_by ? profileMap.get(item.recorded_by) || 'Sistema' : 'Sistema',
      })) as SourceHistoryItem[];
    },
    enabled: !!leadId,
  });
}

export function LeadSourceHistorySection({ leadId }: LeadSourceHistorySectionProps) {
  const { data: history = [], isLoading } = useLeadSourceHistory(leadId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
        <CardContent><Skeleton className="h-20 w-full" /></CardContent>
      </Card>
    );
  }

  if (history.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MapPin className="w-5 h-5 text-primary" />
          Histórico de Origens
          <Badge variant="secondary">{history.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {history.map((item, index) => (
          <div
            key={item.id}
            className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/50"
          >
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">{item.source_name}</span>
              {index === 0 && (
                <Badge variant="default" className="text-xs">Mais recente</Badge>
              )}
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              {format(new Date(item.recorded_at), "dd/MM/yy", { locale: ptBR })}
              <span className="ml-1">por {item.recorded_by_name}</span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
