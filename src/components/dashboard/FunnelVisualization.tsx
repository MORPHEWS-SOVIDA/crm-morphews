import { Cloud, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Lead, FunnelStage, FUNNEL_STAGES } from '@/types/lead';
import { FunnelStageCustom } from '@/hooks/useFunnelStages';

interface FunnelVisualizationProps {
  leads: Lead[];
  stages: FunnelStageCustom[];
  selectedStage: FunnelStage | null;
  onSelectStage: (stage: FunnelStage | null) => void;
}

// Map position to legacy enum values for lead matching
const positionToEnum: Record<number, FunnelStage> = {
  0: 'cloud',
  1: 'prospect',
  2: 'contacted',
  3: 'convincing',
  4: 'scheduled',
  5: 'positive',
  6: 'waiting_payment',
  7: 'success',
  8: 'trash',
};

export function FunnelVisualization({ leads, stages, selectedStage, onSelectStage }: FunnelVisualizationProps) {
  const getStageEnumValue = (stage: FunnelStageCustom): FunnelStage => {
    return positionToEnum[stage.position] || 'cloud';
  };

  const getStageCounts = (enumValue: FunnelStage) => 
    leads.filter((lead) => lead.stage === enumValue).length;

  const cloudStage = stages.find(s => s.stage_type === 'cloud');
  const funnelStages = stages.filter(s => s.stage_type === 'funnel').sort((a, b) => a.position - b.position);
  const trashStage = stages.find(s => s.stage_type === 'trash');

  const cloudCount = cloudStage ? getStageCounts(getStageEnumValue(cloudStage)) : getStageCounts('cloud');
  const trashCount = trashStage ? getStageCounts(getStageEnumValue(trashStage)) : getStageCounts('trash');

  return (
    <div className="bg-card rounded-xl p-6 shadow-card hover:shadow-card-hover transition-shadow duration-300">
      <h3 className="text-lg font-semibold text-foreground mb-4">Funil de Vendas</h3>
      
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
            const count = getStageCounts(enumValue);
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
