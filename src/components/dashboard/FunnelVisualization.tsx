import { Cloud, Trash2, Kanban } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Lead, FunnelStage } from '@/types/lead';
import { FunnelStageCustom, getStageEnumValue } from '@/hooks/useFunnelStages';
import { groupLeadsByFunnelStageId } from '@/lib/funnelStageAssignment';
import { useMemo } from 'react';

interface FunnelVisualizationProps {
  leads: Lead[];
  stages: FunnelStageCustom[];
  selectedStage: FunnelStage | null;
  onSelectStage: (stage: FunnelStage | null) => void;
  onSwitchToKanban?: () => void;
}

export function FunnelVisualization({ leads, stages, selectedStage, onSelectStage, onSwitchToKanban }: FunnelVisualizationProps) {
  // Group leads by funnel_stage_id for accurate counts
  const leadsByStage = useMemo(() => groupLeadsByFunnelStageId(leads, stages), [leads, stages]);
  
  // Sort stages by position
  const sortedStages = useMemo(() => [...stages].sort((a, b) => a.position - b.position), [stages]);

  const cloudStage = sortedStages.find(s => s.stage_type === 'cloud');
  const funnelStages = sortedStages.filter(s => s.stage_type === 'funnel');
  const trashStage = sortedStages.find(s => s.stage_type === 'trash');

  const cloudCount = cloudStage ? (leadsByStage[cloudStage.id]?.length || 0) : 0;
  const trashCount = trashStage ? (leadsByStage[trashStage.id]?.length || 0) : 0;

  return (
    <div className="bg-card rounded-xl p-6 shadow-card hover:shadow-card-hover transition-shadow duration-300">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Funil de Vendas</h3>
        {onSwitchToKanban && (
          <button
            onClick={onSwitchToKanban}
            className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors font-medium"
          >
            <Kanban className="w-4 h-4" />
            Ver em Kanban
          </button>
        )}
      </div>
      
      {/* Cloud - "Não classificado" */}
      {cloudStage && (
        <div className="flex justify-center mb-4">
          <button
            onClick={() => onSelectStage(selectedStage === 'cloud' ? null : 'cloud')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-300 animate-float',
              cloudStage.color,
              selectedStage === 'cloud'
                ? 'ring-2 ring-primary scale-105'
                : 'opacity-80 hover:opacity-100 hover:scale-105'
            )}
          >
            <Cloud className={cn('w-5 h-5', cloudStage.text_color)} />
            <span className={cn('text-sm font-medium', cloudStage.text_color)}>
              {cloudStage.name} ({cloudCount})
            </span>
          </button>
        </div>
      )}

      <div className="relative">
        {/* Funnel */}
        <div className="flex flex-col items-center gap-1">
          {funnelStages.map((stage, index) => {
            const enumValue = getStageEnumValue(stage);
            const count = leadsByStage[stage.id]?.length || 0;
            const widthPercent = 100 - (index * 10);
            
            return (
              <button
                key={stage.id}
                onClick={() => onSelectStage(selectedStage === enumValue ? null : enumValue)}
                style={{ width: `${widthPercent}%` }}
                className={cn(
                  'relative py-3 px-4 transition-all duration-300 group',
                  stage.color,
                  selectedStage === enumValue
                    ? 'ring-2 ring-primary scale-105 z-10'
                    : 'hover:scale-[1.02] hover:z-10',
                  index === 0 && 'rounded-t-xl',
                  index === funnelStages.length - 1 && 'rounded-b-xl'
                )}
              >
                <div className="flex items-center justify-between">
                  <span className={cn('text-sm font-medium', stage.text_color)}>
                    {stage.name}
                  </span>
                  <span className={cn(
                    'px-2 py-0.5 rounded-full text-xs font-bold bg-white/30',
                    stage.text_color
                  )}>
                    {count}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Trash - "Sem interesse" */}
        {trashStage && (
          <button
            onClick={() => onSelectStage(selectedStage === 'trash' ? null : 'trash')}
            className={cn(
              'absolute -bottom-4 -right-4 flex items-center gap-2 px-4 py-3 rounded-xl transition-all duration-300',
              trashStage.color,
              selectedStage === 'trash'
                ? 'ring-2 ring-primary scale-105'
                : 'opacity-80 hover:opacity-100 hover:scale-105'
            )}
          >
            <Trash2 className={cn('w-5 h-5', trashStage.text_color)} />
            <span className={cn('text-sm font-medium', trashStage.text_color)}>
              {trashStage.name} ({trashCount})
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
