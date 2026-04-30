import { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2, Search } from 'lucide-react';

interface Props {
  title: string;
  count?: number;
  search: string;
  onSearchChange: (v: string) => void;
  filters?: ReactNode;
  actions?: ReactNode;
  isLoading?: boolean;
  empty?: string;
  hasItems: boolean;
  children: ReactNode;
}

export function RegistryShell({
  title, count, search, onSearchChange, filters, actions,
  isLoading, empty, hasItems, children,
}: Props) {
  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            {title}
            {count != null && (
              <span className="text-xs font-normal text-muted-foreground">({count})</span>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">{actions}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => onSearchChange(e.target.value)}
              placeholder="Pesquisar..."
              className="pl-8"
            />
          </div>
          {filters}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : !hasItems ? (
          <p className="text-sm text-muted-foreground py-8 text-center">{empty ?? 'Nada cadastrado ainda.'}</p>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}
