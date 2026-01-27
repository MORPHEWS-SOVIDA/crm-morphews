import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Receipt } from 'lucide-react';
import { formatCurrency } from '@/hooks/useSales';
import { 
  PAYMENT_CATEGORIES, 
  type CategoryTotals,
  type PaymentCategoryConfig 
} from '@/lib/paymentCategories';

interface PaymentCategoryTotalsProps {
  total: number;
  byCategory: CategoryTotals;
  colorConfig: {
    gradient: string;
    text: string;
    title: string;
  };
}

function CategoryCard({ config, amount }: { config: PaymentCategoryConfig; amount: number }) {
  if (amount === 0) return null;
  
  const Icon = config.icon;
  
  return (
    <Card className={config.borderClass}>
      <CardContent className="p-3 text-center">
        <Icon className={`w-4 h-4 mx-auto mb-1 ${config.colorClass}`} />
        <p className="text-base font-semibold">{formatCurrency(amount)}</p>
        <p className="text-xs text-muted-foreground truncate">{config.shortLabel}</p>
      </CardContent>
    </Card>
  );
}

export function PaymentCategoryTotals({ total, byCategory, colorConfig }: PaymentCategoryTotalsProps) {
  // Filter categories that have values
  const activeCategories = PAYMENT_CATEGORIES.filter(cat => byCategory[cat.key] > 0);
  
  // Calculate grid columns based on active categories (max 6 per row on desktop)
  const gridCols = Math.min(activeCategories.length + 1, 6); // +1 for total
  
  return (
    <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-${gridCols} lg:grid-cols-${Math.min(activeCategories.length + 1, 8)} gap-2`}>
      {/* Total Card - always first */}
      <Card className={`bg-gradient-to-br ${colorConfig.gradient} col-span-1`}>
        <CardContent className="p-3 text-center">
          <Receipt className={`w-5 h-5 mx-auto mb-1 ${colorConfig.text}`} />
          <p className={`text-lg font-bold ${colorConfig.title}`}>{formatCurrency(total)}</p>
          <p className={`text-xs ${colorConfig.text}`}>Total Geral</p>
        </CardContent>
      </Card>
      
      {/* Category Cards */}
      {activeCategories.map(cat => (
        <CategoryCard key={cat.key} config={cat} amount={byCategory[cat.key]} />
      ))}
    </div>
  );
}

// Compact version for history view
interface PaymentCategoryBadgesProps {
  byCategory: CategoryTotals;
}

export function PaymentCategoryBadges({ byCategory }: PaymentCategoryBadgesProps) {
  const activeCategories = PAYMENT_CATEGORIES.filter(cat => byCategory[cat.key] > 0);
  
  return (
    <div className="flex flex-wrap gap-2 text-sm">
      {activeCategories.map(cat => (
        <div key={cat.key} className="flex items-center gap-1">
          <span className="text-muted-foreground">{cat.emoji}</span>
          <span className="text-muted-foreground">{cat.shortLabel}:</span>
          <span className="font-medium">{formatCurrency(byCategory[cat.key])}</span>
        </div>
      ))}
    </div>
  );
}
