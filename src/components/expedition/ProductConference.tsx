import { useState, useEffect } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

interface ProductItem {
  id: string;
  product_name: string;
  quantity: number;
}

interface ProductConferenceProps {
  items: ProductItem[];
  saleId: string;
  onAllChecked?: (allChecked: boolean) => void;
}

export function ProductConference({ items, saleId, onAllChecked }: ProductConferenceProps) {
  // State to track checked items per quantity
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean[]>>({});
  
  // Initialize checked state for each item
  useEffect(() => {
    const initialState: Record<string, boolean[]> = {};
    items.forEach(item => {
      // Create array of booleans for each unit
      initialState[item.id] = Array(item.quantity).fill(false);
    });
    setCheckedItems(initialState);
  }, [items, saleId]);

  // Check if all items are checked
  useEffect(() => {
    const allChecked = Object.values(checkedItems).every(checks => 
      checks.length > 0 && checks.every(c => c)
    );
    onAllChecked?.(allChecked);
  }, [checkedItems, onAllChecked]);

  const toggleCheck = (itemId: string, index: number) => {
    setCheckedItems(prev => {
      const itemChecks = [...(prev[itemId] || [])];
      itemChecks[index] = !itemChecks[index];
      return { ...prev, [itemId]: itemChecks };
    });
  };

  const isItemFullyChecked = (itemId: string) => {
    const checks = checkedItems[itemId] || [];
    return checks.length > 0 && checks.every(c => c);
  };

  return (
    <div className="space-y-1.5 bg-muted/50 rounded-md p-2">
      {items.map((item) => {
        const checks = checkedItems[item.id] || [];
        const fullyChecked = isItemFullyChecked(item.id);
        
        return (
          <div 
            key={item.id}
            className={cn(
              "flex items-center gap-2 p-1.5 rounded transition-colors",
              fullyChecked 
                ? "bg-green-100 dark:bg-green-900/30" 
                : "bg-background"
            )}
          >
            {/* Quantity checkboxes */}
            <div className="flex gap-1">
              {Array.from({ length: item.quantity }, (_, i) => (
                <Checkbox
                  key={i}
                  checked={checks[i] || false}
                  onCheckedChange={() => toggleCheck(item.id, i)}
                  className={cn(
                    "h-5 w-5 transition-colors",
                    checks[i] 
                      ? "data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600" 
                      : ""
                  )}
                />
              ))}
            </div>
            
            {/* Product name */}
            <span 
              className={cn(
                "text-sm flex-1 truncate",
                fullyChecked 
                  ? "text-green-700 dark:text-green-400 line-through" 
                  : "text-foreground"
              )}
            >
              {item.quantity}x {item.product_name}
            </span>
          </div>
        );
      })}
    </div>
  );
}
