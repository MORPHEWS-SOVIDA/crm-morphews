import { useState, useMemo } from 'react';
import { ArrowRight, UserPlus, CalendarPlus, ExternalLink } from 'lucide-react';
import { WhatsAppButton } from '@/components/WhatsAppButton';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useFunnelStages } from '@/hooks/useFunnelStages';

import { useAddStageHistory } from '@/hooks/useLeadStageHistory';
import { useAuth } from '@/hooks/useAuth';
import { useLogVoip3cAction } from '@/hooks/useVoip3cActionLogs';
import { useScheduleMessages } from '@/hooks/useScheduleMessages';
import { useNonPurchaseReasons } from '@/hooks/useNonPurchaseReasons';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import type { FunnelStage } from '@/types/lead';

interface Voip3cLeadActionsProps {
  leadId: string;
  leadName: string;
  leadWhatsapp: string;
  leadStage: string;
  leadPhone?: string;
  validationId?: string | null;
  compact?: boolean;
}

export function Voip3cLeadActions({ leadId, leadName, leadWhatsapp, leadStage, leadPhone, validationId, compact }: Voip3cLeadActionsProps) {
  const { profile, user } = useAuth();
  const { data: stages } = useFunnelStages();

  // Fetch active org members directly (more reliable than useTeamMembers in dialog context)
  const orgId = profile?.organization_id;
  const { data: orgMembers } = useQuery({
    queryKey: ['org-active-members', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('organization_members')
        .select('user_id, role, is_active, profiles!inner(first_name, last_name)')
        .eq('organization_id', orgId)
        .eq('is_active', true);
      if (error) throw error;
      return (data || []).map((m: any) => ({
        user_id: m.user_id,
        role: m.role,
        full_name: `${m.profiles?.first_name || ''} ${m.profiles?.last_name || ''}`.trim() || 'Sem nome',
      }));
    },
    enabled: !!orgId,
    staleTime: 60_000,
  });

  // Filter to only sellers/managers/admins/owners (exclude delivery, shipping, etc.)
  const assignableMembers = useMemo(() => {
    return (orgMembers || []).filter(m => 
      ['seller', 'manager', 'admin', 'owner', 'member'].includes(m.role)
    ).sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [orgMembers]);

  
  const logAction = useLogVoip3cAction();
  const addStageHistory = useAddStageHistory();
  const { scheduleMessagesForReason } = useScheduleMessages();
  const { data: nonPurchaseReasons } = useNonPurchaseReasons();
  
  const [stageDialogOpen, setStageDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [followupDialogOpen, setFollowupDialogOpen] = useState(false);
  const [selectedStageId, setSelectedStageId] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedReasonId, setSelectedReasonId] = useState('');
  const [saving, setSaving] = useState(false);

  const funnelStages = (stages || []).filter(s => s.stage_type === 'funnel');

  const handleChangeStage = async () => {
    if (!selectedStageId || !profile?.organization_id) return;
    setSaving(true);
    try {
      const stage = stages?.find(s => s.id === selectedStageId);
      if (!stage) throw new Error('Etapa não encontrada');
      
      // Update lead
      const { error } = await supabase
        .from('leads')
        .update({ 
          stage: stage.enum_value || 'unclassified',
          funnel_stage_id: stage.id,
        })
        .eq('id', leadId);
      if (error) throw error;

      // Add history
      addStageHistory.mutate({
        lead_id: leadId,
        organization_id: profile.organization_id,
        stage: (stage.enum_value || 'unclassified') as FunnelStage,
        previous_stage: (leadStage || 'unclassified') as FunnelStage,
        changed_by: user?.id || null,
        to_stage_id: stage.id,
        source: 'manual',
      });

      toast.success(`Lead movido para "${stage.name}"`);
      if (validationId) {
        logAction.mutate({ validation_id: validationId, lead_id: leadId, lead_name: leadName, lead_phone: leadPhone || leadWhatsapp, action_type: 'stage_changed', action_details: { from_stage: leadStage, to_stage: stage.name } });
      }
      setStageDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao mover lead');
    } finally {
      setSaving(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedUserId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('leads')
        .update({ assigned_to: selectedUserId })
        .eq('id', leadId);
      if (error) throw error;
      const member = assignableMembers?.find(m => m.user_id === selectedUserId);
      toast.success(`Lead atribuído a ${member?.full_name || 'vendedor'}`);
      if (validationId) {
        logAction.mutate({ validation_id: validationId, lead_id: leadId, lead_name: leadName, lead_phone: leadPhone || leadWhatsapp, action_type: 'assigned_seller', action_details: { seller_name: member?.full_name || 'vendedor', seller_user_id: selectedUserId } });
      }
      setAssignDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao atribuir lead');
    } finally {
      setSaving(false);
    }
  };

  const handleActivateFollowup = async () => {
    if (!selectedReasonId) return;
    setSaving(true);
    try {
      const reason = nonPurchaseReasons?.find(r => r.id === selectedReasonId);
      
      // Update lead with non_purchase_reason_id and move to target stage if configured
      const updateData: any = { non_purchase_reason_id: selectedReasonId };
      if (reason?.target_stage_id) {
        updateData.funnel_stage_id = reason.target_stage_id;
      }
      await supabase.from('leads').update(updateData).eq('id', leadId);

      // Schedule automated messages
      const result = await scheduleMessagesForReason({
        leadId,
        leadName,
        leadWhatsapp,
        reasonId: selectedReasonId,
        sellerName: profile?.first_name || '',
      });

      toast.success(`Follow-up "${reason?.name}" ativado! ${result.scheduled} mensagem(ns) agendada(s).`);
      if (validationId) {
        logAction.mutate({ validation_id: validationId, lead_id: leadId, lead_name: leadName, lead_phone: leadPhone || leadWhatsapp, action_type: 'followup_created', action_details: { reason_id: selectedReasonId, reason_name: reason?.name, messages_scheduled: result.scheduled } });
      }
      setFollowupDialogOpen(false);
      setSelectedReasonId('');
    } catch (err) {
      toast.error('Erro ao ativar follow-up');
    } finally {
      setSaving(false);
    }
  };

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1">
        {/* WhatsApp - internal dialog */}
        {leadWhatsapp && (
          <span onClick={() => {
              if (validationId) {
                logAction.mutate({ validation_id: validationId, lead_id: leadId, lead_name: leadName, lead_phone: leadPhone || leadWhatsapp, action_type: 'whatsapp_sent' });
              }
            }}>
            <WhatsAppButton
              phone={leadWhatsapp}
              variant="icon"
              leadId={leadId}
              leadName={leadName}
              className="h-7 w-7 !rounded-md"
            />
          </span>
        )}

        {/* Change Stage */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setStageDialogOpen(true)}>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Mover etapa</TooltipContent>
        </Tooltip>

        {/* Assign */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setAssignDialogOpen(true)}>
              <UserPlus className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Atribuir vendedor</TooltipContent>
        </Tooltip>

        {/* Followup */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setFollowupDialogOpen(true)}>
              <CalendarPlus className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Criar follow-up</TooltipContent>
        </Tooltip>

        {/* Open lead */}
        <Tooltip>
          <TooltipTrigger asChild>
            <a href={`/leads/${leadId}`} target="_blank" rel="noopener noreferrer">
              <Button size="icon" variant="ghost" className="h-7 w-7">
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </a>
          </TooltipTrigger>
          <TooltipContent>Abrir lead</TooltipContent>
        </Tooltip>
      </div>

      {/* Change Stage Dialog */}
      <Dialog open={stageDialogOpen} onOpenChange={setStageDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mover Lead de Etapa</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              <strong>{leadName}</strong> — atual: <Badge variant="outline">{leadStage}</Badge>
            </p>
            <Select value={selectedStageId} onValueChange={setSelectedStageId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a nova etapa" />
              </SelectTrigger>
              <SelectContent>
                {funnelStages.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                      {s.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button onClick={handleChangeStage} disabled={saving || !selectedStageId}>
              {saving ? 'Movendo...' : 'Mover'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Atribuir Vendedor</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Lead: <strong>{leadName}</strong>
            </p>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o vendedor" />
              </SelectTrigger>
              <SelectContent>
                {assignableMembers.map(m => (
                  <SelectItem key={m.user_id} value={m.user_id}>{m.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button onClick={handleAssign} disabled={saving || !selectedUserId}>
              {saving ? 'Atribuindo...' : 'Atribuir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Followup Dialog */}
      <Dialog open={followupDialogOpen} onOpenChange={setFollowupDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ativar Follow-up Automático</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Lead: <strong>{leadName}</strong>
            </p>
            <div className="space-y-1.5">
              <Label>Motivo de Follow-up</Label>
              <Select value={selectedReasonId} onValueChange={setSelectedReasonId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o motivo" />
                </SelectTrigger>
                <SelectContent>
                  {(nonPurchaseReasons || []).map(r => (
                    <SelectItem key={r.id} value={r.id}>
                      <div className="flex items-center gap-2">
                        {r.is_featured && <span className="text-amber-500">⭐</span>}
                        <span>{r.name}</span>
                        {r.followup_hours > 0 && (
                          <Badge variant="outline" className="text-[10px] ml-1">⏱ {r.followup_hours}h</Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedReasonId && (() => {
              const reason = nonPurchaseReasons?.find(r => r.id === selectedReasonId);
              return reason ? (
                <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2 space-y-0.5">
                  <p>Visibilidade: <strong>{reason.lead_visibility === 'all_sellers' ? 'Todos' : 'Vendedor'}</strong></p>
                  {reason.target_stage_id && <p>Move para etapa configurada automaticamente</p>}
                </div>
              ) : null;
            })()}
          </div>
          <DialogFooter>
            <Button onClick={handleActivateFollowup} disabled={saving || !selectedReasonId}>
              {saving ? 'Ativando...' : 'Ativar Follow-up'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
