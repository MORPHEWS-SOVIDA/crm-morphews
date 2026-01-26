import { toast } from 'sonner';
import { Clock, Copy, X, Mail, Phone } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  PartnerInvitation,
  partnerTypeLabels,
  partnerTypeColors,
  formatCommission,
  useCancelPartnerInvitation,
} from '@/hooks/ecommerce/usePartners';

interface PendingInvitationsProps {
  invitations: PartnerInvitation[];
  isLoading: boolean;
}

export function PendingInvitations({ invitations, isLoading }: PendingInvitationsProps) {
  const cancelInvitation = useCancelPartnerInvitation();

  const handleCopyLink = (inviteCode: string) => {
    const url = `${window.location.origin}/parceiro/convite/${inviteCode}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copiado!');
  };

  const handleCancel = (invitationId: string) => {
    cancelInvitation.mutate(invitationId, {
      onSuccess: () => toast.success('Convite cancelado'),
      onError: (error: Error) => toast.error(error.message),
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-amber-200 dark:border-amber-800">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-amber-500" />
          <CardTitle className="text-lg">Convites Pendentes</CardTitle>
        </div>
        <CardDescription>
          Convites aguardando aceite dos parceiros
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {invitations.map((invitation) => (
            <div
              key={invitation.id}
              className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{invitation.name}</span>
                  <Badge className={partnerTypeColors[invitation.partner_type]}>
                    {partnerTypeLabels[invitation.partner_type]}
                  </Badge>
                  <Badge variant="outline">
                    {formatCommission(invitation.commission_type, invitation.commission_value)}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {invitation.email}
                  </span>
                  {invitation.whatsapp && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {invitation.whatsapp}
                    </span>
                  )}
                  <span>
                    Expira em{' '}
                    {format(new Date(invitation.expires_at), "dd 'de' MMM", { locale: ptBR })}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleCopyLink(invitation.invite_code)}
                  title="Copiar link"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleCancel(invitation.id)}
                  title="Cancelar convite"
                >
                  <X className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
