import { useState } from 'react';
import { MessageSquare, ArrowRight, UserPlus, CalendarPlus, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useFunnelStages, type FunnelStageCustom } from '@/hooks/useFunnelStages';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { useCreateFollowup } from '@/hooks/useLeadFollowups';
import { useAddStageHistory } from '@/hooks/useLeadStageHistory';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { FunnelStage } from '@/types/lead';

interface Voip3cLeadActionsProps {
  leadId: string;
  leadName: string;
  leadWhatsapp: string;
  leadStage: string;
  compact?: boolean;
}

export function Voip3cLeadActions({ leadId, leadName, leadWhatsapp, leadStage, compact }: Voip3cLeadActionsProps) {
  const { profile, user } = useAuth();
  const { data: stages } = useFunnelStages();
  const { data: members } = useTeamMembers();
  const createFollowup = useCreateFollowup();
  const addStageHistory = useAddStageHistory();
  
  const [stageDialogOpen, setStageDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [followupDialogOpen, setFollowupDialogOpen] = useState(false);
  const [selectedStageId, setSelectedStageId] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [followupDate, setFollowupDate] = useState('');
  const [followupReason, setFollowupReason] = useState('');
  const [saving, setSaving] = useState(false);

  const openWhatsApp = () => {
    if (!leadWhatsapp) return;
    const clean = leadWhatsapp.replace(/\D/g, '');
    window.open(`https://wa.me/${clean}`, '_blank');
  };

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
      const member = members?.find(m => m.user_id === selectedUserId);
      toast.success(`Lead atribuído a ${member?.full_name || 'vendedor'}`);
      setAssignDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao atribuir lead');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateFollowup = async () => {
    if (!followupDate) return;
    createFollowup.mutate({
      lead_id: leadId,
      scheduled_at: new Date(followupDate),
      reason: followupReason || 'Follow-up 3C+',
      source_type: 'voip_3c',
    }, {
      onSuccess: () => {
        toast.success('Follow-up criado!');
        setFollowupDialogOpen(false);
        setFollowupDate('');
        setFollowupReason('');
      },
    });
  };

  const funnelStages = (stages || []).filter(s => s.stage_type === 'funnel');

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1">
        {/* WhatsApp */}
        {leadWhatsapp && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={openWhatsApp}>
                <MessageSquare className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>WhatsApp</TooltipContent>
          </Tooltip>
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
                {(members || []).map(m => (
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
            <DialogTitle>Criar Follow-up</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Lead: <strong>{leadName}</strong>
            </p>
            <div className="space-y-1.5">
              <Label>Data/Hora</Label>
              <Input type="datetime-local" value={followupDate} onChange={e => setFollowupDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Motivo</Label>
              <Input 
                placeholder="Ex: Retorno 3C+" 
                value={followupReason} 
                onChange={e => setFollowupReason(e.target.value)} 
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreateFollowup} disabled={createFollowup.isPending || !followupDate}>
              {createFollowup.isPending ? 'Criando...' : 'Criar Follow-up'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
