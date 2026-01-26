import { useState } from 'react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Check, X, Clock, UserCheck, Link2, Mail, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  usePartnerApplications,
  useApprovePartnerApplication,
  useRejectPartnerApplication,
} from '@/hooks/ecommerce/usePartnerPublicLinks';
import {
  partnerTypeLabels,
  partnerTypeColors,
  formatCommission,
} from '@/hooks/ecommerce/usePartners';
import { supabase } from '@/integrations/supabase/client';

export function PartnerApplicationsTab() {
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [sendingNotification, setSendingNotification] = useState<string | null>(null);

  const { data: applications, isLoading } = usePartnerApplications();
  const approveApplication = useApprovePartnerApplication();
  const rejectApplication = useRejectPartnerApplication();

  const pendingApplications = applications?.filter(a => a.status === 'pending') || [];
  const processedApplications = applications?.filter(a => a.status !== 'pending') || [];

  const handleApprove = async (application: typeof pendingApplications[0]) => {
    approveApplication.mutate(application.id, {
      onSuccess: async (result) => {
        toast.success('Solicitação aprovada!');
        
        // Enviar notificações
        if (result.email || result.whatsapp) {
          setSendingNotification(application.id);
          try {
            // Mapear partner_type para partner_role
            const partnerRoleMap: Record<string, string> = {
              affiliate: 'partner_affiliate',
              coproducer: 'partner_coproducer',
              industry: 'partner_industry',
              factory: 'partner_factory',
            };

            await supabase.functions.invoke('partner-notification', {
              body: {
                type: 'application_approved',
                data: {
                  email: result.email,
                  name: result.name,
                  whatsapp: result.whatsapp,
                  temp_password: result.temp_password,
                  org_name: result.org_name,
                  affiliate_code: result.affiliate_code,
                  needs_user_creation: result.needs_user_creation,
                  organization_id: application.organization_id,
                  partner_role: partnerRoleMap[application.partner_type] || 'partner_affiliate',
                },
              },
            });
            toast.success('Notificações enviadas para o parceiro!');
          } catch (err) {
            console.error('Erro ao enviar notificações:', err);
            toast.error('Aprovado, mas houve erro ao enviar notificações');
          } finally {
            setSendingNotification(null);
          }
        }
      },
      onError: (error: Error) => {
        toast.error(error.message);
      },
    });
  };

  const handleReject = () => {
    if (!selectedApplicationId) return;
    
    rejectApplication.mutate({
      applicationId: selectedApplicationId,
      reason: rejectionReason,
    }, {
      onSuccess: () => {
        toast.success('Solicitação rejeitada');
        setRejectDialogOpen(false);
        setSelectedApplicationId(null);
        setRejectionReason('');
      },
      onError: (error: Error) => {
        toast.error(error.message);
      },
    });
  };

  const openRejectDialog = (id: string) => {
    setSelectedApplicationId(id);
    setRejectDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pending Applications */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-amber-500" />
          <h3 className="font-medium">Aguardando Aprovação</h3>
          {pendingApplications.length > 0 && (
            <Badge variant="secondary">{pendingApplications.length}</Badge>
          )}
        </div>

        {pendingApplications.length > 0 ? (
          <div className="grid gap-3">
            {pendingApplications.map((app) => (
              <Card key={app.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{app.name}</span>
                        <Badge variant="outline" className={partnerTypeColors[app.partner_type]}>
                          {partnerTypeLabels[app.partner_type]}
                        </Badge>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground mb-2">
                        {app.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {app.email}
                          </span>
                        )}
                        {app.whatsapp && (
                          <span className="flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" />
                            {app.whatsapp}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>
                          Comissão: <strong>{formatCommission(app.commission_type, app.commission_value)}</strong>
                        </span>
                        {app.public_link && (
                          <span className="flex items-center gap-1">
                            <Link2 className="h-3 w-3" />
                            via {app.public_link.name}
                          </span>
                        )}
                        <span>
                          {format(new Date(app.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openRejectDialog(app.id)}
                        disabled={rejectApplication.isPending}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Rejeitar
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleApprove(app)}
                        disabled={approveApplication.isPending || sendingNotification === app.id}
                        className="gap-1"
                      >
                        <Check className="h-4 w-4" />
                        Aprovar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
              <UserCheck className="h-10 w-10 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">
                Nenhuma solicitação pendente
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Processed Applications */}
      {processedApplications.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-medium text-muted-foreground">Histórico</h3>
          <div className="grid gap-3">
            {processedApplications.slice(0, 10).map((app) => (
              <Card key={app.id} className="opacity-60">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {app.status === 'approved' ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <X className="h-4 w-4 text-red-500" />
                      )}
                      <span className="font-medium">{app.name}</span>
                      <Badge variant={app.status === 'approved' ? 'default' : 'destructive'}>
                        {app.status === 'approved' ? 'Aprovado' : 'Rejeitado'}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {app.reviewed_at && format(new Date(app.reviewed_at), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar Solicitação</DialogTitle>
            <DialogDescription>
              Informe o motivo da rejeição (opcional)
            </DialogDescription>
          </DialogHeader>
          
          <Input
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="Motivo da rejeição..."
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={rejectApplication.isPending}
            >
              Rejeitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
