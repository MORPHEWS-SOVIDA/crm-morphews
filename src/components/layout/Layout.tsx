import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { useMyPermissions } from '@/hooks/useUserPermissions';
import { DonnaHelperButton } from '@/components/helper';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { data: permissions } = useMyPermissions();
  
  // Check if user can see the helper (default true if not set)
  const canSeeHelper = permissions?.helper_donna_view !== false;
  
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
      {canSeeHelper && <DonnaHelperButton />}
    </div>
  );
}
