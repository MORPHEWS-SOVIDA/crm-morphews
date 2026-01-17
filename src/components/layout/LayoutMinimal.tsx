import { ReactNode } from 'react';

interface LayoutMinimalProps {
  children: ReactNode;
}

/**
 * Layout minimal sem sidebar para usuários que preferem
 * interface limpa (ex: expedição, motoboy)
 */
export function LayoutMinimal({ children }: LayoutMinimalProps) {
  return (
    <div className="min-h-screen bg-background">
      <main className="min-h-screen">
        <div className="p-4">
          {children}
        </div>
      </main>
    </div>
  );
}
