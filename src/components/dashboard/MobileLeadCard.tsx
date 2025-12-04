import { useNavigate } from 'react-router-dom';
import { Instagram, ChevronRight } from 'lucide-react';
import { Lead, FUNNEL_STAGES } from '@/types/lead';
import { StarRating } from '@/components/StarRating';
import { WhatsAppButton } from '@/components/WhatsAppButton';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface MobileLeadCardProps {
  lead: Lead;
}

export function MobileLeadCard({ lead }: MobileLeadCardProps) {
  const navigate = useNavigate();
  const stageInfo = FUNNEL_STAGES[lead.stage];

  const formatFollowers = (num: number | null) => {
    if (!num) return '0';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
    return num.toString();
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return null;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div
      onClick={() => navigate(`/leads/${lead.id}`)}
      className="bg-card rounded-xl p-4 shadow-card border border-border/50 active:scale-[0.98] transition-transform cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-foreground truncate">{lead.name}</h3>
            <StarRating rating={lead.stars as 1 | 2 | 3 | 4 | 5} size="sm" />
          </div>
          
          {lead.specialty && (
            <p className="text-sm text-muted-foreground truncate mb-2">{lead.specialty}</p>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={cn(stageInfo.color, stageInfo.textColor, 'border-0 text-xs')}>
              {stageInfo.label}
            </Badge>
            
            <a
              href={`https://instagram.com/${lead.instagram.replace('@', '')}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 text-xs text-pink-500"
            >
              <Instagram className="w-3 h-3" />
              {formatFollowers(lead.followers)}
            </a>

            {lead.negotiated_value && (
              <span className="text-xs font-semibold text-primary">
                {formatCurrency(lead.negotiated_value)}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div onClick={(e) => e.stopPropagation()}>
            <WhatsAppButton phone={lead.whatsapp} variant="icon" />
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </div>
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
        <span className="text-xs text-muted-foreground">
          Responsável: <span className="text-foreground">{lead.assigned_to}</span>
        </span>
      </div>
    </div>
  );
}
