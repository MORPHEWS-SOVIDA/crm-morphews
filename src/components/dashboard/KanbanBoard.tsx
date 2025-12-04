import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Lead } from '@/types/lead';
import { FunnelStageCustom } from '@/hooks/useFunnelStages';
import { useUpdateLead } from '@/hooks/useLeads';
import { StarRating } from '@/components/StarRating';
import { WhatsAppButton } from '@/components/WhatsAppButton';
import { cn } from '@/lib/utils';
import { GripVertical, User, Instagram } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface KanbanBoardProps {
  leads: Lead[];
  stages: FunnelStageCustom[];
  selectedStars: number | null;
  selectedResponsavel: string | null;
}

interface KanbanCardProps {
  lead: Lead;
  onClick: () => void;
}

function KanbanCard({ lead, onClick }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lead.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'bg-card rounded-lg p-3 shadow-sm border border-border/50 cursor-pointer',
        'hover:shadow-md hover:border-primary/30 transition-all',
        isDragging && 'opacity-50 shadow-lg'
      )}
    >
      <div className="flex items-start gap-2">
        <button
          {...attributes}
          {...listeners}
          className="p-1 -ml-1 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="w-4 h-4" />
        </button>
        
        <div className="flex-1 min-w-0" onClick={onClick}>
          <h4 className="font-medium text-sm text-foreground truncate">{lead.name}</h4>
          
          {lead.specialty && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{lead.specialty}</p>
          )}
          
          <div className="flex items-center gap-2 mt-2">
            <StarRating rating={lead.stars as 1 | 2 | 3 | 4 | 5} size="sm" />
          </div>
          
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <User className="w-3 h-3" />
              <span className="truncate max-w-[80px]">{lead.assigned_to}</span>
            </div>
            
            <div className="flex items-center gap-1">
              {lead.instagram && (
                <a
                  href={`https://instagram.com/${lead.instagram.replace('@', '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-pink-500 hover:text-pink-600"
                >
                  <Instagram className="w-3.5 h-3.5" />
                </a>
              )}
              {lead.whatsapp && (
                <WhatsAppButton phone={lead.whatsapp} variant="icon" />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KanbanCardOverlay({ lead }: { lead: Lead }) {
  return (
    <div className="bg-card rounded-lg p-3 shadow-xl border-2 border-primary">
      <h4 className="font-medium text-sm text-foreground">{lead.name}</h4>
      <StarRating rating={lead.stars as 1 | 2 | 3 | 4 | 5} size="sm" />
    </div>
  );
}

interface KanbanColumnProps {
  stage: FunnelStageCustom;
  leads: Lead[];
  onCardClick: (leadId: string) => void;
}

function KanbanColumn({ stage, leads, onCardClick }: KanbanColumnProps) {
  return (
    <div className="flex-shrink-0 w-72 flex flex-col bg-muted/30 rounded-xl">
      {/* Header */}
      <div className={cn('p-3 rounded-t-xl', stage.color)}>
        <div className="flex items-center justify-between">
          <h3 className={cn('font-semibold text-sm truncate', stage.text_color)}>
            {stage.name}
          </h3>
          <span className={cn(
            'px-2 py-0.5 rounded-full text-xs font-bold bg-white/30',
            stage.text_color
          )}>
            {leads.length}
          </span>
        </div>
      </div>

      {/* Cards */}
      <ScrollArea className="flex-1 p-2 max-h-[calc(100vh-320px)]">
        <SortableContext items={leads.map(l => l.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {leads.map((lead) => (
              <KanbanCard
                key={lead.id}
                lead={lead}
                onClick={() => onCardClick(lead.id)}
              />
            ))}
            {leads.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Nenhum lead
              </div>
            )}
          </div>
        </SortableContext>
      </ScrollArea>
    </div>
  );
}

export function KanbanBoard({ leads, stages, selectedStars, selectedResponsavel }: KanbanBoardProps) {
  const navigate = useNavigate();
  const updateLead = useUpdateLead();
  const [activeLead, setActiveLead] = useState<Lead | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  // Filter leads
  const filteredLeads = useMemo(() => {
    let filtered = [...leads];
    
    if (selectedStars !== null) {
      filtered = filtered.filter((lead) => lead.stars === selectedStars);
    }

    if (selectedResponsavel !== null) {
      filtered = filtered.filter((lead) => lead.assigned_to === selectedResponsavel);
    }
    
    return filtered;
  }, [leads, selectedStars, selectedResponsavel]);

  // Map stages to their legacy enum values for lead matching
  const getStageEnumValue = (stage: FunnelStageCustom): string => {
    // Map position to legacy enum values
    const positionToEnum: Record<number, string> = {
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
    return positionToEnum[stage.position] || 'cloud';
  };

  // Group leads by stage
  const leadsByStage = useMemo(() => {
    const grouped: Record<string, Lead[]> = {};
    stages.forEach((stage) => {
      const enumValue = getStageEnumValue(stage);
      grouped[stage.id] = filteredLeads.filter((lead) => lead.stage === enumValue);
    });
    return grouped;
  }, [filteredLeads, stages]);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const lead = filteredLeads.find((l) => l.id === active.id);
    if (lead) setActiveLead(lead);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveLead(null);

    if (!over) return;

    const leadId = active.id as string;
    const lead = filteredLeads.find((l) => l.id === leadId);
    if (!lead) return;

    // Find which column the card was dropped in
    const overStage = stages.find((s) => {
      const leadsInStage = leadsByStage[s.id];
      return leadsInStage.some((l) => l.id === over.id) || over.id === s.id;
    });

    if (!overStage) return;

    const newStageEnum = getStageEnumValue(overStage);
    
    if (lead.stage !== newStageEnum) {
      updateLead.mutate({
        id: leadId,
        stage: newStageEnum as Lead['stage'],
      });
    }
  };

  const handleCardClick = (leadId: string) => {
    navigate(`/leads/${leadId}`);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-max">
          {stages.map((stage) => (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              leads={leadsByStage[stage.id] || []}
              onCardClick={handleCardClick}
            />
          ))}
        </div>
      </div>

      <DragOverlay>
        {activeLead && <KanbanCardOverlay lead={activeLead} />}
      </DragOverlay>
    </DndContext>
  );
}
