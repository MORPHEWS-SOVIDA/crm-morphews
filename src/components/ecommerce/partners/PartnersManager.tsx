import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, UserCheck, Factory, Building2, Clock, Link2, UserPlus } from 'lucide-react';
import { PartnersList } from './PartnersList';
import { PartnerInviteDialog } from './PartnerInviteDialog';
import { PendingInvitations } from './PendingInvitations';
import { PublicLinksTab } from './PublicLinksTab';
import { PartnerApplicationsTab } from './PartnerApplicationsTab';
import { PartnerType, usePartnerAssociations, usePartnerInvitations } from '@/hooks/ecommerce/usePartners';
import { usePartnerApplications } from '@/hooks/ecommerce/usePartnerPublicLinks';

export function PartnersManager() {
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [defaultPartnerType, setDefaultPartnerType] = useState<PartnerType>('affiliate');
  
  const { data: associations, isLoading: associationsLoading } = usePartnerAssociations();
  const { data: invitations, isLoading: invitationsLoading } = usePartnerInvitations();
  const { data: applications } = usePartnerApplications();

  const pendingInvitations = invitations?.filter(i => i.status === 'pending') || [];
  const pendingApplications = applications?.filter(a => a.status === 'pending') || [];

  const affiliates = associations?.filter(a => a.partner_type === 'affiliate') || [];
  const coproducers = associations?.filter(a => a.partner_type === 'coproducer') || [];
  const industries = associations?.filter(a => a.partner_type === 'industry') || [];
  const factories = associations?.filter(a => a.partner_type === 'factory') || [];

  const handleInvite = (type: PartnerType) => {
    setDefaultPartnerType(type);
    setInviteDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
              <Users className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{affiliates.length}</p>
              <p className="text-xs text-muted-foreground">Afiliados</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="p-2 rounded-lg bg-cyan-100 dark:bg-cyan-900/30">
              <UserCheck className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{coproducers.length}</p>
              <p className="text-xs text-muted-foreground">Co-produtores</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
              <Factory className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{industries.length}</p>
              <p className="text-xs text-muted-foreground">Indústrias</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <Building2 className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{factories.length}</p>
              <p className="text-xs text-muted-foreground">Fábricas</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
              <Clock className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pendingInvitations.length}</p>
              <p className="text-xs text-muted-foreground">Convites</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <UserPlus className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pendingApplications.length}</p>
              <p className="text-xs text-muted-foreground">Solicitações</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Invitations */}
      {pendingInvitations.length > 0 && (
        <PendingInvitations 
          invitations={pendingInvitations} 
          isLoading={invitationsLoading} 
        />
      )}

      {/* Main Tabs */}
      <Tabs defaultValue="partners" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="partners" className="gap-2">
            <Users className="h-4 w-4" />
            Parceiros
          </TabsTrigger>
          <TabsTrigger value="applications" className="gap-2">
            <UserPlus className="h-4 w-4" />
            Solicitações
            {pendingApplications.length > 0 && (
              <span className="ml-1 text-xs bg-amber-500 text-white px-1.5 py-0.5 rounded-full">
                {pendingApplications.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="links" className="gap-2">
            <Link2 className="h-4 w-4" />
            Links Públicos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="partners">
          <Card>
            <CardHeader>
              <CardTitle>Parceiros Ativos</CardTitle>
              <CardDescription>
                Gerencie todos os seus parceiros de negócio
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="affiliates" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="affiliates" className="gap-2">
                    <Users className="h-4 w-4" />
                    <span className="hidden sm:inline">Afiliados</span>
                    {affiliates.length > 0 && (
                      <span className="ml-1 text-xs bg-muted px-1.5 py-0.5 rounded">
                        {affiliates.length}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="coproducers" className="gap-2">
                    <UserCheck className="h-4 w-4" />
                    <span className="hidden sm:inline">Co-produtores</span>
                    {coproducers.length > 0 && (
                      <span className="ml-1 text-xs bg-muted px-1.5 py-0.5 rounded">
                        {coproducers.length}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="industries" className="gap-2">
                    <Factory className="h-4 w-4" />
                    <span className="hidden sm:inline">Indústrias</span>
                    {industries.length > 0 && (
                      <span className="ml-1 text-xs bg-muted px-1.5 py-0.5 rounded">
                        {industries.length}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="factories" className="gap-2">
                    <Building2 className="h-4 w-4" />
                    <span className="hidden sm:inline">Fábricas</span>
                    {factories.length > 0 && (
                      <span className="ml-1 text-xs bg-muted px-1.5 py-0.5 rounded">
                        {factories.length}
                      </span>
                    )}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="affiliates" className="mt-4">
                  <PartnersList 
                    partners={affiliates} 
                    partnerType="affiliate"
                    isLoading={associationsLoading}
                    onInvite={() => handleInvite('affiliate')}
                  />
                </TabsContent>

                <TabsContent value="coproducers" className="mt-4">
                  <PartnersList 
                    partners={coproducers} 
                    partnerType="coproducer"
                    isLoading={associationsLoading}
                    onInvite={() => handleInvite('coproducer')}
                  />
                </TabsContent>

                <TabsContent value="industries" className="mt-4">
                  <PartnersList 
                    partners={industries} 
                    partnerType="industry"
                    isLoading={associationsLoading}
                    onInvite={() => handleInvite('industry')}
                  />
                </TabsContent>

                <TabsContent value="factories" className="mt-4">
                  <PartnersList 
                    partners={factories} 
                    partnerType="factory"
                    isLoading={associationsLoading}
                    onInvite={() => handleInvite('factory')}
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="applications">
          <PartnerApplicationsTab />
        </TabsContent>

        <TabsContent value="links">
          <PublicLinksTab />
        </TabsContent>
      </Tabs>

      {/* Invite Dialog */}
      <PartnerInviteDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        defaultPartnerType={defaultPartnerType}
      />
    </div>
  );
}
