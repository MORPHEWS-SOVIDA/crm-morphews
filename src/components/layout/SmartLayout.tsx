import { ReactNode } from 'react';
import { Layout } from './Layout';
import { LayoutMinimal } from './LayoutMinimal';
import { useMyPermissions } from '@/hooks/useUserPermissions';

interface SmartLayoutProps {
  children: ReactNode;
}

/**
 * Componente que escolhe automaticamente entre Layout completo
 * ou LayoutMinimal baseado nas preferências do usuário.
 */
export function SmartLayout({ children }: SmartLayoutProps) {
  const { data: permissions } = useMyPermissions();
  
  // Se o usuário tem hide_sidebar=true, usa layout minimal
  if (permissions?.hide_sidebar) {
    return <LayoutMinimal>{children}</LayoutMinimal>;
  }
  
  // Caso contrário, usa layout padrão com sidebar
  return <Layout>{children}</Layout>;
}
