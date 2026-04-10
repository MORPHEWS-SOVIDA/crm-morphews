import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tag, User, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface StockGroup {
  product_id: string;
  product_name: string;
  prefix: string;
  min_code: string;
  max_code: string;
  total: number;
  in_stock: number;
  assigned: number;
  shipped: number;
  stocked_by: string | null;
  stocked_by_name: string | null;
  stocked_at: string | null;
}

interface StockCardProps {
  group: StockGroup;
}

export function StockCard({ group: g }: StockCardProps) {
  const [open, setOpen] = useState(false);

  const usedPercent = g.total > 0 ? Math.round(((g.assigned + g.shipped) / g.total) * 100) : 0;

  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Tag className="h-4 w-4 text-primary" />
            <span className="flex-1">{g.product_name}</span>
            <CollapsibleTrigger asChild>
              <button className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted">
                {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </CollapsibleTrigger>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-mono text-muted-foreground">
            <span>{g.min_code}</span>
            <span>→</span>
            <span>{g.max_code}</span>
            <Badge variant="outline" className="ml-auto">{g.total} etiquetas</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
              Em estoque: {g.in_stock}
            </Badge>
            {g.assigned > 0 && (
              <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                Separadas: {g.assigned}
              </Badge>
            )}
            {g.shipped > 0 && (
              <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                Enviadas: {g.shipped}
              </Badge>
            )}
          </div>

          <CollapsibleContent className="space-y-3 pt-2">
            {/* Progress bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Utilização</span>
                <span>{usedPercent}% usado</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full flex">
                  {g.shipped > 0 && (
                    <div
                      className="bg-blue-400 h-full"
                      style={{ width: `${(g.shipped / g.total) * 100}%` }}
                    />
                  )}
                  {g.assigned > 0 && (
                    <div
                      className="bg-amber-400 h-full"
                      style={{ width: `${(g.assigned / g.total) * 100}%` }}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Detailed breakdown */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-muted/50 rounded-md p-2">
                <span className="text-muted-foreground">Prefixo</span>
                <p className="font-mono font-medium">{g.prefix}</p>
              </div>
              <div className="bg-muted/50 rounded-md p-2">
                <span className="text-muted-foreground">Disponíveis</span>
                <p className="font-medium text-green-700">{g.in_stock} de {g.total}</p>
              </div>
              {g.assigned > 0 && (
                <div className="bg-muted/50 rounded-md p-2">
                  <span className="text-muted-foreground">Separadas</span>
                  <p className="font-medium text-amber-700">{g.assigned}</p>
                </div>
              )}
              {g.shipped > 0 && (
                <div className="bg-muted/50 rounded-md p-2">
                  <span className="text-muted-foreground">Enviadas</span>
                  <p className="font-medium text-blue-700">{g.shipped}</p>
                </div>
              )}
            </div>
          </CollapsibleContent>

          {/* User and date info */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1 border-t">
            {g.stocked_by_name && (
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {g.stocked_by_name}
              </span>
            )}
            {g.stocked_at && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(new Date(g.stocked_at), 'dd/MM/yyyy HH:mm')}
              </span>
            )}
          </div>
        </CardContent>
      </Collapsible>
    </Card>
  );
}
