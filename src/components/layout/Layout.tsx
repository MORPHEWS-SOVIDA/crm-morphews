import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { useMyPermissions } from '@/hooks/useUserPermissions';
import { useOrgFeatures } from '@/hooks/usePlanFeatures';
import { DonnaHelperButton } from '@/components/helper';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { data: permissions } = useMyPermissions();
  const { data: orgFeatures } = useOrgFeatures();
  
  // Check if user can see the helper:
  // 1. User permission must be true (default true if not set)
  // 2. Org feature "donna_helper" must be enabled (default false if not set for this feature specifically)
  const userCanSeeHelper = permissions?.helper_donna_view !== false;
  const orgHasDonnaFeature = orgFeatures?.donna_helper === true; // Default to false for donna
  const canSeeHelper = userCanSeeHelper && orgHasDonnaFeature;
  
  // If user has hide_sidebar preference, show minimal layout
  if (permissions?.hide_sidebar) {
    return (
      <div className="min-h-screen bg-background">
        <main className="min-h-screen">
          <div className="p-4">
            {children}
          </div>
        </main>
        {canSeeHelper && <DonnaHelperButton />}
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="lg:ml-64 min-h-screen pb-20 lg:pb-0">
        <div className="p-4 lg:p-8">
          {children}
        </div>
      </main>
      <MobileNav />
      {/* Only show floating Donna on mobile - desktop Donna is in sidebar */}
      {canSeeHelper && <div className="lg:hidden"><DonnaHelperButton /></div>}
    </div>
  );
}
