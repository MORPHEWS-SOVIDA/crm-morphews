import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Phone, UserCheck, Loader2, Instagram, CalendarCheck, PhoneCall } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type ActivityType = 'reply_received' | 'whatsapp_shared' | 'call_scheduled' | 'call_done';

interface SocialSellingQuickActionsProps {
  leadId: string;
  leadInstagram?: string | null;
}

const BUTTONS: { type: ActivityType; label: string; icon: React.ReactNode; color: string }[] = [
  { type: 'reply_received', label: 'Respondeu', icon: <MessageSquare className="h-3 w-3" />, color: 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400' },
  { type: 'whatsapp_shared', label: 'WhatsApp', icon: <UserCheck className="h-3 w-3" />, color: 'bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-400' },
  { type: 'call_scheduled', label: 'Call Agendada', icon: <CalendarCheck className="h-3 w-3" />, color: 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400' },
  { type: 'call_done', label: 'Call Feita', icon: <PhoneCall className="h-3 w-3" />, color: 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400' },
];

export function SocialSellingQuickActions({ leadId, leadInstagram }: SocialSellingQuickActionsProps) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [pendingType, setPendingType] = useState<string | null>(null);

  // Fetch existing activities for this lead
  const { data: existingActivities } = useQuery({
    queryKey: ['social-selling-lead-activities', leadId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('social_selling_activities')
        .select('activity_type, seller_id, profile_id')
        .eq('lead_id', leadId);
      return data || [];
    },
    enabled: !!leadId,
  });

  const doneTypes = new Set((existingActivities || []).map((a: any) => a.activity_type));
  const meta = existingActivities?.[0]; // get seller_id/profile_id from first activity

  const logActivity = useMutation({
    mutationFn: async (type: ActivityType) => {
      if (!meta) throw new Error('Lead sem atividade de social selling');
      if (doneTypes.has(type)) throw new Error('Já registrado');

      const { error } = await (supabase as any)
        .from('social_selling_activities')
        .insert({
          organization_id: profile!.organization_id,
          lead_id: leadId,
          activity_type: type,
          seller_id: meta.seller_id,
          profile_id: meta.profile_id,
          instagram_username: leadInstagram?.replace(/^@/, '') || null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Evolução registrada!');
      queryClient.invalidateQueries({ queryKey: ['social-selling-lead-activities', leadId] });
      queryClient.invalidateQueries({ queryKey: ['social-selling-all-activities'] });
      queryClient.invalidateQueries({ queryKey: ['social-selling-activities'] });
      setPendingType(null);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro');
      setPendingType(null);
    },
  });

  if (!existingActivities || existingActivities.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Instagram className="h-3.5 w-3.5 text-pink-500" />
        <span className="text-xs font-medium text-muted-foreground">Social Selling</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {BUTTONS.map(btn => {
          const isDone = doneTypes.has(btn.type);
          const isLoading = pendingType === btn.type;
          return (
            <Button
              key={btn.type}
              variant="ghost"
              size="sm"
              disabled={isDone || isLoading}
              onClick={() => {
                setPendingType(btn.type);
                logActivity.mutate(btn.type);
              }}
              className={`h-6 px-2 text-[11px] gap-1 ${isDone ? 'opacity-40' : btn.color}`}
              title={isDone ? `${btn.label} já registrado` : `Marcar: ${btn.label}`}
            >
              {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : btn.icon}
              {btn.label}
              {isDone && <Badge variant="outline" className="h-3 px-0.5 text-[8px] ml-0.5">✓</Badge>}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
