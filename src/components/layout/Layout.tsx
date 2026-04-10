import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { useMyPermissions } from '@/hooks/useUserPermissions';
import { useOrgFeatures } from '@/hooks/usePlanFeatures';
import { useCurrentMember } from '@/hooks/useCurrentMember';
import { DonnaHelperButton } from '@/components/helper';
import { TeamChatFloatingButton, TeamChatNotificationProvider } from '@/components/team-chat';
import { MelhorEnvioBalanceAlert } from '@/components/alerts/MelhorEnvioBalanceAlert';
import { TrialExpiredBlocker } from '@/components/TrialExpiredBlocker';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { data: permissions } = useMyPermissions();
  const { data: orgFeatures } = useOrgFeatures();
  const { data: currentMember } = useCurrentMember();
  
  const userCanSeeHelper = permissions?.helper_donna_view !== false;
  const orgHasDonnaFeature = orgFeatures?.donna_helper === true;
  const canSeeHelper = userCanSeeHelper && orgHasDonnaFeature;
  
  // Check if org has Conecta Time feature enabled AND user is not a partner
  const isPartner = currentMember?.role?.startsWith('partner_');
  const hasConectaTime = orgFeatures?.conecta_time === true && !isPartner;
  
  // If user has hide_sidebar preference, show minimal layout
  if (permissions?.hide_sidebar) {
    return (
      <TrialExpiredBlocker>
        <div className="min-h-screen bg-background">
          <main className="min-h-screen">
            <div className="p-4">
              {children}
            </div>
          </main>
          {hasConectaTime && <TeamChatFloatingButton />}
          {hasConectaTime && <TeamChatNotificationProvider />}
          {canSeeHelper && <DonnaHelperButton />}
        </div>
      </TrialExpiredBlocker>
    );
  }
  
  return (
    <TrialExpiredBlocker>
      <div className="min-h-screen bg-background">
        <Sidebar />
        <main className="lg:ml-64 min-h-screen pb-20 lg:pb-0">
          <MelhorEnvioBalanceAlert />
          <div className="p-4 lg:p-8">
            {children}
          </div>
        </main>
        <MobileNav />
        {/* Team Chat Floating Button + Notifications - only if feature enabled */}
        {hasConectaTime && <TeamChatFloatingButton />}
        {hasConectaTime && <TeamChatNotificationProvider />}


      </div>
    </TrialExpiredBlocker>
  );
}
