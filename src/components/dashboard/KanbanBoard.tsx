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
import { useCreateFollowup } from '@/hooks/useLeadFollowups';
import { useScheduleMessages } from '@/hooks/useScheduleMessages';
import { useAuth } from '@/hooks/useAuth';
import { StarRating } from '@/components/StarRating';
import { WhatsAppButton } from '@/components/WhatsAppButton';
import { StageChangeDialog, StageChangeResult } from '@/components/StageChangeDialog';
import { cn } from '@/lib/utils';
import { getInstagramProfileUrl } from '@/lib/instagram';
import { GripVertical, User, DollarSign, ChevronRight, AlertTriangle } from 'lucide-react';
import { Instagram } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface KanbanBoardProps {
  leads: Lead[];
  stages: FunnelStageCustom[];
  selectedStars: number | null;
  selectedResponsavel: string | null;
}

interface KanbanCardProps {
  lead: Lead;
  stages?: FunnelStageCustom[];
  currentStageId?: string;
  onQuickMove?: (leadId: string, lead: Lead, targetStage: FunnelStageCustom) => void;
  showMissingPhoneAlert?: boolean;
}

function formatCurrency(value: number | null) {
  if (!value) return null;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
  }).format(value);
}

function KanbanCard({ lead, stages, currentStageId, onQuickMove, showMissingPhoneAlert }: KanbanCardProps) {
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
  const missingPhone = showMissingPhoneAlert && !(lead.whatsapp && String(lead.whatsapp).trim().length > 0);

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
          <div className="flex items-center gap-1.5">
            <h4 className="font-medium text-sm text-foreground truncate">{lead.name}</h4>
            {missingPhone && (
              <span
                title="Lead sem número cadastrado"
                aria-label="Lead sem número cadastrado"
                className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-destructive text-destructive-foreground flex-shrink-0"
              >
                <AlertTriangle className="w-2.5 h-2.5" />
              </span>
            )}
          </div>
          {missingPhone && (
            <p className="text-[10px] font-medium text-destructive mt-0.5">
              Lead sem número cadastrado
            </p>
          )}
          
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
              {stages && onQuickMove && (() => {
                const currentIndex = stages.findIndex(s => s.id === currentStageId);
                const nextStage = currentIndex >= 0 && currentIndex < stages.length - 1 
                  ? stages[currentIndex + 1] 
                  : null;
                if (!nextStage) return null;
                return (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onQuickMove(lead.id, lead, nextStage);
                    }}
                    className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    title={`Mover para ${nextStage.name}`}
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                );
              })()}
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
  allStages: FunnelStageCustom[];
  onQuickMove: (leadId: string, lead: Lead, targetStage: FunnelStageCustom) => void;
  showMissingPhoneAlert?: boolean;
}

function KanbanColumn({ stage, leads, allStages, onQuickMove, showMissingPhoneAlert }: KanbanColumnProps) {
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
                stages={allStages}
                currentStageId={stage.id}
                onQuickMove={onQuickMove}
                showMissingPhoneAlert={showMissingPhoneAlert}
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
  const createFollowup = useCreateFollowup();
  const { scheduleMessagesForReason } = useScheduleMessages();
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

  // Aviso visual "Lead sem número cadastrado" — restrito ao usuário antony@sovida.com.br.
  // Começa na etapa "Lead não entrou no grupo - Mensagem" e segue para todas as posteriores.
  const missingPhoneTriggerPosition = useMemo(() => {
    const userEmail = (user?.email || '').toLowerCase();
    if (userEmail !== 'antony@sovida.com.br') return null;
    const trigger = sortedStages.find((s) =>
      (s.name || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .startsWith('lead nao entrou no grupo')
    );
    return trigger ? trigger.position : null;
  }, [sortedStages, user?.email]);

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

    // Check if lead is actually changing stages using the visual stage assignment
    // This handles both funnel_stage_id and legacy enum-based leads correctly
    const currentVisualStage = findLeadStage(lead, sortedStages);
    const isChangingStage = !currentVisualStage || currentVisualStage.id !== overStage.id;
    
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

  const handleConfirmStageChange = async (result: StageChangeResult) => {
    if (!pendingChange || !profile?.organization_id) return;
    
    setIsUpdating(true);
    
    try {
      console.log('[Kanban] Updating lead stage:', {
        leadId: pendingChange.leadId,
        newStage: pendingChange.newStage,
        targetStageId: pendingChange.targetStageId,
      });

      // Update the lead stage AND funnel_stage_id (both are critical for persistence)
      await updateLead.mutateAsync({
        id: pendingChange.leadId,
        stage: pendingChange.newStage,
        funnel_stage_id: pendingChange.targetStageId,
      });

      console.log('[Kanban] Lead updated successfully');

      // Record in stage history (include to_stage_id for TracZAP CAPI events)
      await addStageHistory.mutateAsync({
        lead_id: pendingChange.leadId,
        organization_id: profile.organization_id,
        stage: pendingChange.newStage,
        previous_stage: pendingChange.previousStage,
        reason: result.reason,
        changed_by: user?.id || null,
        to_stage_id: pendingChange.targetStageId,
        source: 'manual',
      });

      // Schedule follow-up if selected
      if (result.followupReasonId && result.followupDate) {
        await createFollowup.mutateAsync({
          lead_id: pendingChange.leadId,
          scheduled_at: result.followupDate,
          reason: `Mudança de etapa: ${pendingChange.previousStage} → ${pendingChange.newStage}`,
          source_type: 'stage_change',
          source_id: result.followupReasonId,
        });

        // Schedule the actual automated messages from templates
        const leadData = pendingChange.lead;
        if (leadData?.whatsapp) {
          const { scheduled, error: schedError } = await scheduleMessagesForReason({
            leadId: pendingChange.leadId,
            leadName: leadData.name || '',
            leadWhatsapp: leadData.whatsapp,
            reasonId: result.followupReasonId,
            customScheduledAt: result.followupDate,
          });
          if (scheduled > 0) {
            console.log(`[Kanban] Scheduled ${scheduled} automated messages for lead ${pendingChange.leadId}`);
          }
          if (schedError) {
            console.error('[Kanban] Error scheduling messages:', schedError);
          }
        }
      }

      // Sync social selling metrics when moving to "Respondeu Prospecção Ativa"
      const targetStage = sortedStages.find(s => s.id === pendingChange.targetStageId);
      if (targetStage?.name === 'Respondeu Prospecção Ativa') {
        try {
          // Check if lead has social selling activities (from import)
          const { data: existingActivities } = await (supabase as any)
            .from('social_selling_activities')
            .select('seller_id, profile_id, activity_type')
            .eq('lead_id', pendingChange.leadId);

          const hasImport = existingActivities?.some((a: any) => a.activity_type === 'import');
          const hasReply = existingActivities?.some((a: any) => a.activity_type === 'reply_received');

          if (hasImport && !hasReply) {
            const importActivity = existingActivities.find((a: any) => a.activity_type === 'import');
            const lead = pendingChange.lead;
            await (supabase as any)
              .from('social_selling_activities')
              .insert({
                organization_id: profile.organization_id,
                lead_id: pendingChange.leadId,
                activity_type: 'reply_received',
                seller_id: importActivity.seller_id,
                profile_id: importActivity.profile_id,
                instagram_username: lead.instagram?.replace(/^@/, '') || null,
              });
            console.log('[Kanban] Social selling reply_received activity logged');
          }
        } catch (ssError) {
          console.warn('[Kanban] Failed to sync social selling metrics:', ssError);
        }
      }

      toast({
        title: "Etapa atualizada",
        description: result.followupReasonId 
          ? "O lead foi movido e o follow-up foi agendado."
          : "O lead foi movido e o histórico foi registrado.",
      });
    } catch (error: any) {
      console.error("[Kanban] Error updating stage:", error);
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

  const handleQuickMove = (leadId: string, lead: Lead, targetStage: FunnelStageCustom) => {
    const currentStage = findLeadStage(lead, sortedStages);
    const newStageEnum = getStageEnumValue(targetStage) as FunnelStage;
    setPendingChange({
      leadId,
      lead,
      previousStage: lead.stage as FunnelStage,
      newStage: newStageEnum,
      targetStageId: targetStage.id,
    });
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
                allStages={sortedStages}
                onQuickMove={handleQuickMove}
                showMissingPhoneAlert={
                  missingPhoneTriggerPosition !== null &&
                  stage.position >= missingPhoneTriggerPosition
                }
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
            defaultFollowupReasonId={newCustomStage?.default_followup_reason_id}
          />
        );
      })()}
    </>
  );
}