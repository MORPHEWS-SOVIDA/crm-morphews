import { useState, useMemo } from 'react';
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
  DragOverEvent,
  useDroppable,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Lead, FunnelStage } from '@/types/lead';
import { FunnelStageCustom, getStageEnumValue } from '@/hooks/useFunnelStages';
import { groupLeadsByFunnelStageId, findLeadStage } from '@/lib/funnelStageAssignment';
import { useUpdateLead } from '@/hooks/useLeads';
import { useAddStageHistory } from '@/hooks/useLeadStageHistory';
import { useAuth } from '@/hooks/useAuth';
import { StarRating } from '@/components/StarRating';
import { WhatsAppButton } from '@/components/WhatsAppButton';
import { StageChangeDialog } from '@/components/StageChangeDialog';
import { cn } from '@/lib/utils';
import { getInstagramProfileUrl } from '@/lib/instagram';
import { GripVertical, User, DollarSign } from 'lucide-react';
import { Instagram } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/hooks/use-toast';

interface KanbanBoardProps {
  leads: Lead[];
  stages: FunnelStageCustom[];
  selectedStars: number | null;
  selectedResponsavel: string | null;
}

interface KanbanCardProps {
  lead: Lead;
}

function formatCurrency(value: number | null) {
  if (!value) return null;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
  }).format(value);
}

function KanbanCard({ lead }: KanbanCardProps) {
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

  const instagramUrl = getInstagramProfileUrl(lead.instagram);
  const negotiatedValue = formatCurrency(lead.negotiated_value);

  // Open lead in new tab
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    window.open(`/leads/${lead.id}`, '_blank');
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
        
        <div className="flex-1 min-w-0" onClick={handleClick}>
          <h4 className="font-medium text-sm text-foreground truncate">{lead.name}</h4>
          
          {lead.specialty && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{lead.specialty}</p>
          )}
          
          <div className="flex items-center gap-2 mt-2">
            <StarRating rating={lead.stars as 1 | 2 | 3 | 4 | 5} size="sm" />
            {negotiatedValue && (
              <span className="flex items-center gap-0.5 text-xs font-semibold text-green-600">
                <DollarSign className="w-3 h-3" />
                {negotiatedValue}
              </span>
            )}
          </div>
          
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <User className="w-3 h-3" />
              <span className="truncate max-w-[80px]">{lead.assigned_to}</span>
            </div>
            
            <div className="flex items-center gap-1">
              {instagramUrl && (
                <a
                  href={instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-pink-500 hover:text-pink-600"
                >
                  <Instagram className="w-3.5 h-3.5" />
                </a>
              )}
              {lead.whatsapp && (
                <WhatsAppButton 
                  phone={lead.whatsapp} 
                  variant="icon" 
                />
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
}

function KanbanColumn({ stage, leads }: KanbanColumnProps) {
  // Make the column droppable using the stage ID
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
  });

  // Check if stage uses custom hex color or Tailwind class
  const isCustomColor = stage.color.startsWith('#') || stage.color.startsWith('rgb');

  return (
    <div 
      ref={setNodeRef}
      className={cn(
        "flex-shrink-0 w-72 flex flex-col bg-muted/30 rounded-xl transition-all",
        isOver && "ring-2 ring-primary ring-offset-2"
      )}
    >
      {/* Header */}
      <div 
        className={cn('p-3 rounded-t-xl', !isCustomColor && stage.color)}
        style={isCustomColor ? { backgroundColor: stage.color } : undefined}
      >
        <div className="flex items-center justify-between">
          <h3 
            className={cn('font-semibold text-sm truncate', !isCustomColor && stage.text_color)}
            style={isCustomColor ? { color: stage.text_color } : undefined}
          >
            {stage.name}
          </h3>
          <span 
            className={cn(
              'px-2 py-0.5 rounded-full text-xs font-bold bg-white/30',
              !isCustomColor && stage.text_color
            )}
            style={isCustomColor ? { color: stage.text_color } : undefined}
          >
            {leads.length}
          </span>
        </div>
      </div>

      {/* Cards */}
      <ScrollArea className="flex-1 p-2 max-h-[calc(100vh-320px)]">
        <SortableContext items={leads.map(l => l.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2 min-h-[100px]">
            {leads.map((lead) => (
              <KanbanCard
                key={lead.id}
                lead={lead}
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

interface PendingStageChange {
  leadId: string;
  lead: Lead;
  previousStage: FunnelStage;
  newStage: FunnelStage;
  targetStageId?: string; // The custom stage ID the lead is being moved to
}

export function KanbanBoard({ leads, stages, selectedStars, selectedResponsavel }: KanbanBoardProps) {
  const { profile, user } = useAuth();
  const updateLead = useUpdateLead();
  const addStageHistory = useAddStageHistory();
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  
  // State for stage change dialog
  const [pendingChange, setPendingChange] = useState<PendingStageChange | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor)
  );

  // State to track the column being hovered during drag
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);

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

  // Sort stages by position for display order
  const sortedStages = useMemo(
    () => [...stages].sort((a, b) => a.position - b.position),
    [stages]
  );

  // Group leads by funnel_stage_id (stable UUID-based grouping)
  const leadsByStage = useMemo(
    () => groupLeadsByFunnelStageId(filteredLeads, sortedStages),
    [filteredLeads, sortedStages]
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const lead = filteredLeads.find((l) => l.id === active.id);
    if (lead) setActiveLead(lead);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    if (!over) {
      setActiveColumnId(null);
      return;
    }

    // Check if over a column directly
    const overColumn = sortedStages.find(s => s.id === over.id);
    if (overColumn) {
      setActiveColumnId(overColumn.id);
      return;
    }

    // Check if over a card - find its column
    for (const stage of sortedStages) {
      const leadsInStage = leadsByStage[stage.id];
      if (leadsInStage?.some(l => l.id === over.id)) {
        setActiveColumnId(stage.id);
        return;
      }
    }
    
    setActiveColumnId(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveLead(null);
    setActiveColumnId(null);

    if (!over) return;

    const leadId = active.id as string;
    const lead = filteredLeads.find((l) => l.id === leadId);
    if (!lead) return;

    // Find which column the card was dropped in
    // First check if dropped directly on a column
    let overStage = sortedStages.find((s) => s.id === over.id);
    
    // If not, check if dropped on a card within a column
    if (!overStage) {
      for (const stage of sortedStages) {
        const leadsInStage = leadsByStage[stage.id];
        if (leadsInStage?.some((l) => l.id === over.id)) {
          overStage = stage;
          break;
        }
      }
    }

    if (!overStage) return;

    // Check if lead is actually changing stages
    const isChangingStage = lead.funnel_stage_id 
      ? lead.funnel_stage_id !== overStage.id
      : lead.stage !== getStageEnumValue(overStage);
    
    if (isChangingStage) {
      const newStageEnum = getStageEnumValue(overStage) as FunnelStage;
      // Open dialog to ask for justification
      setPendingChange({
        leadId,
        lead,
        previousStage: lead.stage as FunnelStage,
        newStage: newStageEnum,
        targetStageId: overStage.id,
      });
    }
  };

  const handleConfirmStageChange = async (reason: string | null) => {
    if (!pendingChange || !profile?.organization_id) return;
    
    setIsUpdating(true);
    
    try {
      // Update the lead stage
      await updateLead.mutateAsync({
        id: pendingChange.leadId,
        stage: pendingChange.newStage,
      });

      // Record in stage history
      await addStageHistory.mutateAsync({
        lead_id: pendingChange.leadId,
        organization_id: profile.organization_id,
        stage: pendingChange.newStage,
        previous_stage: pendingChange.previousStage,
        reason: reason,
        changed_by: user?.id || null,
      });

      toast({
        title: "Etapa atualizada",
        description: "O lead foi movido e o histórico foi registrado.",
      });
    } catch (error: any) {
      console.error("Error updating stage:", error);
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
      setPendingChange(null);
    }
  };

  const handleCancelStageChange = () => {
    setPendingChange(null);
  };

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max">
            {sortedStages.map((stage) => (
              <KanbanColumn
                key={stage.id}
                stage={stage}
                leads={leadsByStage[stage.id] || []}
              />
            ))}
          </div>
        </div>

        <DragOverlay>
          {activeLead && <KanbanCardOverlay lead={activeLead} />}
        </DragOverlay>
      </DndContext>

      {/* Stage Change Dialog */}
      {pendingChange && (() => {
        // Find tenant custom stage info for the dialog using funnel_stage_id or enum fallback
        const prevCustomStage = findLeadStage(pendingChange.lead, sortedStages);
        const newCustomStage = pendingChange.targetStageId 
          ? sortedStages.find(s => s.id === pendingChange.targetStageId)
          : sortedStages.find(s => s.enum_value === pendingChange.newStage);
        
        return (
          <StageChangeDialog
            open={!!pendingChange}
            onOpenChange={(open) => !open && handleCancelStageChange()}
            previousStage={pendingChange.previousStage}
            newStage={pendingChange.newStage}
            onConfirm={handleConfirmStageChange}
            isLoading={isUpdating}
            previousStageInfo={prevCustomStage ? {
              name: prevCustomStage.name,
              color: prevCustomStage.color,
              textColor: prevCustomStage.text_color,
            } : undefined}
            newStageInfo={newCustomStage ? {
              name: newCustomStage.name,
              color: newCustomStage.color,
              textColor: newCustomStage.text_color,
            } : undefined}
          />
        );
      })()}
    </>
  );
}