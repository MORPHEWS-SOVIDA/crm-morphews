import { Cloud, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Lead, FunnelStage, FUNNEL_STAGES } from '@/types/lead';

interface FunnelVisualizationProps {
  leads: Lead[];
  selectedStage: FunnelStage | null;
  onSelectStage: (stage: FunnelStage | null) => void;
}

const funnelStages: FunnelStage[] = [
  'prospect',
  'contacted',
  'convincing',
  'scheduled',
  'positive',
  'waiting_payment',
  'success',
];

export function FunnelVisualization({ leads, selectedStage, onSelectStage }: FunnelVisualizationProps) {
  const getStageCounts = (stage: FunnelStage) => 
    leads.filter((lead) => lead.stage === stage).length;

  const cloudCount = getStageCounts('cloud');
  const trashCount = getStageCounts('trash');

  return (
    <div className="bg-card rounded-xl p-6 shadow-card hover:shadow-card-hover transition-shadow duration-300">
      <h3 className="text-lg font-semibold text-foreground mb-4">Funil de Vendas</h3>
      
      {/* Cloud - "Não está na hora" */}
      <div className="flex justify-center mb-4">
        <button
          onClick={() => onSelectStage(selectedStage === 'cloud' ? null : 'cloud')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-300 animate-float',
            selectedStage === 'cloud'
              ? 'bg-funnel-cloud ring-2 ring-primary scale-105'
              : 'bg-funnel-cloud/80 hover:bg-funnel-cloud hover:scale-105'
          )}
        >
          <Cloud className="w-5 h-5 text-funnel-cloud-foreground" />
          <span className="text-sm font-medium text-funnel-cloud-foreground">
            Não classificado ({cloudCount})
          </span>
        </button>
      </div>

      <div className="relative">
        {/* Funnel */}
        <div className="flex flex-col items-center gap-1">
          {funnelStages.map((stage, index) => {
            const count = getStageCounts(stage);
            const { label, color, textColor } = FUNNEL_STAGES[stage];
            const widthPercent = 100 - (index * 10);
            
            return (
              <button
                key={stage}
                onClick={() => onSelectStage(selectedStage === stage ? null : stage)}
                style={{ width: `${widthPercent}%` }}
                className={cn(
                  'relative py-3 px-4 transition-all duration-300 group',
                  color,
                  selectedStage === stage
                    ? 'ring-2 ring-primary scale-105 z-10'
                    : 'hover:scale-[1.02] hover:z-10',
                  index === 0 && 'rounded-t-xl',
                  index === funnelStages.length - 1 && 'rounded-b-xl'
                )}
              >
                <div className="flex items-center justify-between">
                  <span className={cn('text-sm font-medium', textColor)}>
                    {label}
                  </span>
                  <span className={cn(
                    'px-2 py-0.5 rounded-full text-xs font-bold bg-white/30',
                    textColor
                  )}>
                    {count}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Trash - "Não tem interesse" */}
        <button
          onClick={() => onSelectStage(selectedStage === 'trash' ? null : 'trash')}
          className={cn(
            'absolute -bottom-4 -right-4 flex items-center gap-2 px-4 py-3 rounded-xl transition-all duration-300',
            selectedStage === 'trash'
              ? 'bg-funnel-trash ring-2 ring-primary scale-105'
              : 'bg-funnel-trash/80 hover:bg-funnel-trash hover:scale-105'
          )}
        >
          <Trash2 className="w-5 h-5 text-funnel-trash-foreground" />
          <span className="text-sm font-medium text-funnel-trash-foreground">
            Sem interesse ({trashCount})
          </span>
        </button>
      </div>
    </div>
  );
}
