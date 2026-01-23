import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Package, ExternalLink } from 'lucide-react';
import { useProductCombosContaining } from '@/hooks/useProductCombos';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface ProductCombosReadOnlyProps {
  productId: string | undefined;
}

export function ProductCombosReadOnly({ productId }: ProductCombosReadOnlyProps) {
  const { data: combos = [], isLoading } = useProductCombosContaining(productId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5" />
            Combos
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Package className="h-5 w-5" />
          Combos
          {combos.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {combos.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {combos.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Package className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">Este produto não faz parte de nenhum combo.</p>
            <Link to="/produtos/combos">
              <Button variant="link" size="sm" className="mt-2">
                Gerenciar Combos
                <ExternalLink className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground mb-4">
              Este produto faz parte dos seguintes combos:
            </p>
            <div className="grid gap-2">
              {combos.map((combo) => (
                <div
                  key={combo.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded bg-primary/10">
                      <Package className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{combo.name}</p>
                      {combo.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {combo.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge variant={combo.is_active ? 'default' : 'secondary'}>
                    {combo.is_active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
              ))}
            </div>
            <div className="pt-2">
              <Link to="/produtos/combos">
                <Button variant="outline" size="sm" className="w-full">
                  Gerenciar Combos
                  <ExternalLink className="h-3 w-3 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
