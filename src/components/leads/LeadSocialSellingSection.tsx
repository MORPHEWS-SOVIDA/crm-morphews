import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Instagram, Send, MessageSquare, UserCheck, CalendarCheck, PhoneCall, User } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SocialSellingActivity {
  activity_type: string;
  instagram_username: string | null;
  created_at: string;
  seller_name: string | null;
  profile_username: string | null;
}

const ACTIVITY_LABELS: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  message_sent: { label: 'Mensagem enviada', icon: <Send className="h-3 w-3" />, className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  reply_received: { label: 'Respondeu', icon: <MessageSquare className="h-3 w-3" />, className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  whatsapp_shared: { label: 'Enviou WhatsApp', icon: <UserCheck className="h-3 w-3" />, className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  call_scheduled: { label: 'Call Agendada', icon: <CalendarCheck className="h-3 w-3" />, className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  call_done: { label: 'Call Feita', icon: <PhoneCall className="h-3 w-3" />, className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
};

export function LeadSocialSellingSection({ leadId }: { leadId: string }) {
  const { data: activities, isLoading } = useQuery({
    queryKey: ['lead-social-selling', leadId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('social_selling_activities')
        .select(`
          activity_type,
          instagram_username,
          created_at,
          social_sellers(name),
          social_selling_profiles(instagram_username)
        `)
        .eq('lead_id', leadId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      return (data || []).map((a: any) => ({
        activity_type: a.activity_type,
        instagram_username: a.instagram_username,
        created_at: a.created_at,
        seller_name: a.social_sellers?.name || null,
        profile_username: a.social_selling_profiles?.instagram_username || null,
      })) as SocialSellingActivity[];
    },
    enabled: !!leadId,
  });

  if (isLoading || !activities || activities.length === 0) return null;

  const firstActivity = activities[0];

  return (
    <div className="bg-card rounded-xl p-6 shadow-card">
      <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
        <Instagram className="w-5 h-5 text-pink-500" />
        Social Selling
      </h2>

      {/* Origin info */}
      <div className="space-y-3 mb-4">
        {firstActivity.profile_username && (
          <div className="flex items-center gap-2 text-sm">
            <Instagram className="h-4 w-4 text-pink-500" />
            <span className="text-muted-foreground">Perfil que chamou:</span>
            <span className="font-medium">@{firstActivity.profile_username}</span>
          </div>
        )}
        {firstActivity.seller_name && (
          <div className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Seller:</span>
            <span className="font-medium">{firstActivity.seller_name}</span>
          </div>
        )}
      </div>

      {/* Activity timeline */}
      <div className="space-y-2">
        {activities.map((activity, i) => {
          const config = ACTIVITY_LABELS[activity.activity_type];
          if (!config) return null;

          return (
            <div key={i} className="flex items-center gap-2">
              <Badge className={`text-xs gap-1 border-0 ${config.className}`}>
                {config.icon}
                {config.label}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {format(new Date(activity.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
