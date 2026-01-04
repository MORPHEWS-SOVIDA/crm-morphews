import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Command, 
  CommandEmpty, 
  CommandGroup, 
  CommandInput, 
  CommandItem, 
  CommandList 
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ChevronDown, Star, Search, Package, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Product } from '@/hooks/useProducts';
import { useProductsForCurrentUser } from '@/hooks/useProductVisibility';

interface ProductSelectorForSaleProps {
  products?: Product[]; // Optional - if not provided, will use visibility-filtered products
  isLoading?: boolean;
  onSelect: (product: Product) => void;
  placeholder?: string;
  className?: string;
  emptyAction?: () => void;
}

export function ProductSelectorForSale({
  products: externalProducts,
  isLoading: externalLoading = false,
  onSelect,
  placeholder = 'Buscar produto...',
  className,
  emptyAction,
}: ProductSelectorForSaleProps) {
  const [open, setOpen] = useState(false);
  
  // Use visibility-filtered products if external products not provided
  const { data: visibilityProducts = [], isLoading: visibilityLoading } = useProductsForCurrentUser();
  
  const products = externalProducts ?? visibilityProducts as Product[];
  const isLoading = externalLoading || (!externalProducts && visibilityLoading);

  // Separate featured and non-featured products
  const { featuredProducts, allProducts } = useMemo(() => {
    const activeProducts = products.filter(p => p.is_active);
    const featured = activeProducts.filter(p => p.is_featured);
    return {
      featuredProducts: featured,
      allProducts: activeProducts,
    };
  }, [products]);

  const handleSelect = (product: Product) => {
    onSelect(product);
    setOpen(false);
  };

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground">Carregando produtos...</p>
    );
  }

  if (allProducts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhum produto cadastrado.{' '}
        {emptyAction && (
          <Button variant="link" className="p-0 h-auto" onClick={emptyAction}>
            Cadastrar produtos
          </Button>
        )}
      </p>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Featured Products - Quick Action Buttons */}
      {featuredProducts.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Star className="w-3 h-3" />
            Destaques
          </p>
          <div className="flex flex-wrap gap-2">
            {featuredProducts.map((product) => (
              <Button
                key={product.id}
                variant="outline"
                size="sm"
                className="justify-start gap-2"
                onClick={() => handleSelect(product)}
              >
                {product.image_url ? (
                  <img 
                    src={product.image_url} 
                    alt={product.name}
                    className="w-5 h-5 rounded object-cover"
                  />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                {product.name}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Searchable Dropdown for All Products */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            size="sm"
          >
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">{placeholder}</span>
            </div>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[350px] p-0" align="start">
          <Command>
            <CommandInput placeholder={placeholder} />
            <CommandList>
              <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
              <CommandGroup>
                {allProducts.map((product) => (
                  <CommandItem
                    key={product.id}
                    value={product.name}
                    onSelect={() => handleSelect(product)}
                    className="cursor-pointer"
                  >
                    <div className="flex items-center gap-2 flex-1">
                      {product.image_url ? (
                        <img 
                          src={product.image_url} 
                          alt={product.name}
                          className="w-8 h-8 rounded object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded bg-muted flex items-center justify-center flex-shrink-0">
                          <Package className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate">{product.name}</span>
                          {product.is_featured && (
                            <Star className="w-3 h-3 text-amber-500 fill-amber-500 flex-shrink-0" />
                          )}
                        </div>
                        {product.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {product.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
