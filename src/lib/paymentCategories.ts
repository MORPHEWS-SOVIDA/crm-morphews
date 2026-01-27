import { 
  Banknote, 
  Smartphone, 
  CreditCard, 
  Link, 
  ShoppingCart, 
  FileText,
  Gift,
  Receipt,
  LucideIcon
} from 'lucide-react';

export type PaymentCategory = 
  | 'cash'
  | 'pix'
  | 'card_machine'
  | 'payment_link'
  | 'ecommerce'
  | 'boleto_prepaid'
  | 'boleto_postpaid'
  | 'boleto_installment'
  | 'gift'
  | 'other';

export interface PaymentCategoryConfig {
  key: PaymentCategory;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  emoji: string;
  colorClass: string;
  borderClass: string;
}

export const PAYMENT_CATEGORIES: PaymentCategoryConfig[] = [
  {
    key: 'cash',
    label: 'Dinheiro',
    shortLabel: 'Dinheiro',
    icon: Banknote,
    emoji: '💵',
    colorClass: 'text-green-600',
    borderClass: 'border-green-200',
  },
  {
    key: 'pix',
    label: 'PIX',
    shortLabel: 'PIX',
    icon: Smartphone,
    emoji: '📱',
    colorClass: 'text-teal-600',
    borderClass: 'border-teal-200',
  },
  {
    key: 'card_machine',
    label: 'Maquininha',
    shortLabel: 'Maquininha',
    icon: CreditCard,
    emoji: '💳',
    colorClass: 'text-blue-600',
    borderClass: 'border-blue-200',
  },
  {
    key: 'payment_link',
    label: 'Link de Pagamento',
    shortLabel: 'Link Pgto',
    icon: Link,
    emoji: '🔗',
    colorClass: 'text-purple-600',
    borderClass: 'border-purple-200',
  },
  {
    key: 'ecommerce',
    label: 'E-commerce',
    shortLabel: 'E-commerce',
    icon: ShoppingCart,
    emoji: '🛒',
    colorClass: 'text-indigo-600',
    borderClass: 'border-indigo-200',
  },
  {
    key: 'boleto_prepaid',
    label: 'Boleto Pré-pago',
    shortLabel: 'Boleto Pré',
    icon: FileText,
    emoji: '📄',
    colorClass: 'text-orange-600',
    borderClass: 'border-orange-200',
  },
  {
    key: 'boleto_postpaid',
    label: 'Boleto Pós-pago',
    shortLabel: 'Boleto Pós',
    icon: FileText,
    emoji: '📋',
    colorClass: 'text-amber-600',
    borderClass: 'border-amber-200',
  },
  {
    key: 'boleto_installment',
    label: 'Boleto Parcelado',
    shortLabel: 'Boleto Parc',
    icon: FileText,
    emoji: '📑',
    colorClass: 'text-yellow-600',
    borderClass: 'border-yellow-200',
  },
  {
    key: 'gift',
    label: 'Vale Presente',
    shortLabel: 'Vale',
    icon: Gift,
    emoji: '🎁',
    colorClass: 'text-pink-600',
    borderClass: 'border-pink-200',
  },
  {
    key: 'other',
    label: 'Outros',
    shortLabel: 'Outros',
    icon: Receipt,
    emoji: '📝',
    colorClass: 'text-gray-600',
    borderClass: 'border-gray-200',
  },
];

export const PAYMENT_CATEGORY_MAP = PAYMENT_CATEGORIES.reduce((acc, cat) => {
  acc[cat.key] = cat;
  return acc;
}, {} as Record<PaymentCategory, PaymentCategoryConfig>);

export function getCategoryConfig(category: string | null | undefined): PaymentCategoryConfig {
  if (!category) return PAYMENT_CATEGORY_MAP.other;
  return PAYMENT_CATEGORY_MAP[category as PaymentCategory] || PAYMENT_CATEGORY_MAP.other;
}

export type CategoryTotals = Record<PaymentCategory, number>;

export function createEmptyTotals(): CategoryTotals {
  return {
    cash: 0,
    pix: 0,
    card_machine: 0,
    payment_link: 0,
    ecommerce: 0,
    boleto_prepaid: 0,
    boleto_postpaid: 0,
    boleto_installment: 0,
    gift: 0,
    other: 0,
  };
}

export function calculateCategoryTotals(
  sales: Array<{ total_cents?: number | null; payment_category?: string | null }>
): { total: number; byCategory: CategoryTotals } {
  const totals = createEmptyTotals();
  let total = 0;

  sales.forEach(sale => {
    const amount = sale.total_cents || 0;
    total += amount;
    
    const category = (sale.payment_category || 'other') as PaymentCategory;
    if (category in totals) {
      totals[category] += amount;
    } else {
      totals.other += amount;
    }
  });

  return { total, byCategory: totals };
}
