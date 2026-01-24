import { type PublicProduct } from '@/hooks/ecommerce/usePublicStorefront';

// Template configuration types
export interface TemplateConfig {
  inspiration?: string;
  features?: string[];
  layout?: {
    headerStyle?: 'minimal' | 'full' | 'professional';
    heroStyle?: 'single_image' | 'carousel' | 'split' | 'video';
    productGrid?: '2_columns' | '3_columns' | '4_columns' | '3_columns_detailed';
    footerStyle?: 'compact' | 'full' | 'comprehensive';
  };
  colors?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
  };
  typography?: {
    headingFont?: string;
    bodyFont?: string;
  };
}

// Style presets for each template type
export const TEMPLATE_STYLES = {
  'minimal-clean': {
    card: 'group bg-white border-0 shadow-none hover:shadow-lg transition-all duration-500',
    cardImage: 'aspect-square overflow-hidden bg-neutral-50',
    cardImageHover: 'group-hover:scale-105 transition-transform duration-700',
    cardTitle: 'font-serif text-lg font-medium text-neutral-900 tracking-tight',
    cardPrice: 'text-neutral-600 font-light',
    cardBadge: 'bg-neutral-900 text-white text-xs px-3 py-1',
    button: 'bg-neutral-900 hover:bg-neutral-800 text-white rounded-none',
    buttonSecondary: 'border-neutral-900 text-neutral-900 hover:bg-neutral-100 rounded-none',
    hero: 'bg-white text-neutral-900',
    heroTitle: 'font-serif text-4xl md:text-6xl font-light tracking-tight',
    heroSubtitle: 'text-neutral-500 text-lg font-light',
    section: 'py-16 md:py-24',
    sectionTitle: 'font-serif text-2xl md:text-3xl font-light tracking-tight text-center mb-12',
    grid: 'grid gap-8 md:gap-12',
    header: 'border-b border-neutral-100',
    headerLogo: 'h-8 md:h-10',
    nav: 'space-x-8 text-sm uppercase tracking-widest',
  },
  'vitrine-moderna': {
    card: 'group bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300',
    cardImage: 'aspect-square overflow-hidden',
    cardImageHover: 'group-hover:scale-110 transition-transform duration-500',
    cardTitle: 'font-sans text-base font-semibold text-gray-900',
    cardPrice: 'text-pink-600 font-bold text-lg',
    cardBadge: 'bg-gradient-to-r from-pink-500 to-purple-500 text-white text-xs px-3 py-1 rounded-full',
    button: 'bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white rounded-full shadow-lg hover:shadow-xl',
    buttonSecondary: 'border-2 border-pink-500 text-pink-600 hover:bg-pink-50 rounded-full',
    hero: 'bg-gradient-to-br from-pink-50 via-white to-purple-50',
    heroTitle: 'font-sans text-4xl md:text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-pink-600 to-purple-600',
    heroSubtitle: 'text-gray-600 text-lg font-medium',
    section: 'py-12 md:py-16',
    sectionTitle: 'font-sans text-2xl md:text-3xl font-bold text-center mb-8 text-gray-900',
    grid: 'grid gap-4 md:gap-6',
    header: 'bg-white shadow-sm',
    headerLogo: 'h-10 md:h-12',
    nav: 'space-x-6 text-sm font-medium',
  },
  'premium-saude': {
    card: 'group bg-white border border-gray-100 rounded-xl overflow-hidden hover:border-green-200 transition-all duration-300',
    cardImage: 'aspect-[4/5] overflow-hidden bg-gradient-to-b from-green-50 to-white',
    cardImageHover: 'group-hover:scale-105 transition-transform duration-500',
    cardTitle: 'font-sans text-base font-semibold text-gray-900',
    cardPrice: 'text-green-700 font-bold',
    cardBadge: 'bg-green-600 text-white text-xs px-3 py-1 rounded',
    button: 'bg-green-700 hover:bg-green-800 text-white rounded-lg',
    buttonSecondary: 'border border-green-700 text-green-700 hover:bg-green-50 rounded-lg',
    hero: 'bg-gradient-to-r from-green-900 via-green-800 to-emerald-900 text-white',
    heroTitle: 'font-sans text-4xl md:text-5xl font-bold',
    heroSubtitle: 'text-green-100 text-lg',
    section: 'py-12 md:py-20',
    sectionTitle: 'font-sans text-2xl md:text-3xl font-bold text-center mb-10 text-gray-900',
    grid: 'grid gap-6 md:gap-8',
    header: 'bg-white border-b border-gray-100',
    headerLogo: 'h-10 md:h-12',
    nav: 'space-x-8 text-sm font-medium text-gray-600',
  },
} as const;

export type TemplateStyleKey = keyof typeof TEMPLATE_STYLES;
export type TemplateStyles = (typeof TEMPLATE_STYLES)[TemplateStyleKey];

// Get template styles by slug or fallback to minimal-clean
export function getTemplateStyles(templateSlug?: string | null): TemplateStyles {
  if (templateSlug && templateSlug in TEMPLATE_STYLES) {
    return TEMPLATE_STYLES[templateSlug as TemplateStyleKey];
  }
  return TEMPLATE_STYLES['minimal-clean'];
}

// Get grid columns class based on template config
export function getGridColumns(config?: TemplateConfig): string {
  const productGrid = config?.layout?.productGrid || '3_columns';
  
  switch (productGrid) {
    case '2_columns':
      return 'md:grid-cols-2';
    case '4_columns':
      return 'grid-cols-2 md:grid-cols-4';
    case '3_columns_detailed':
      return 'md:grid-cols-3';
    case '3_columns':
    default:
      return 'grid-cols-2 md:grid-cols-3';
  }
}

// Format currency
export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

// Get product price with proper fallback
export function getProductPrice(
  customPrice: number | null, 
  product: Pick<PublicProduct, 'price_1_unit' | 'base_price_cents'>
): number {
  return customPrice || product.price_1_unit || product.base_price_cents || 0;
}

// Calculate discount percentage
export function getDiscountPercentage(originalPrice: number, currentPrice: number): number {
  if (originalPrice <= 0 || currentPrice >= originalPrice) return 0;
  return Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
}

// Trust badges data
export const TRUST_BADGES = [
  { icon: 'Shield', text: 'Compra Segura', subtext: 'SSL 256-bit' },
  { icon: 'Truck', text: 'Entrega Rápida', subtext: 'Todo Brasil' },
  { icon: 'RotateCcw', text: 'Troca Fácil', subtext: '7 dias' },
  { icon: 'CreditCard', text: 'Parcele', subtext: 'até 12x' },
] as const;

// Social proof messages
export const SOCIAL_PROOF_MESSAGES = [
  { count: '2.500+', label: 'Clientes satisfeitos' },
  { count: '4.9', label: 'Avaliação média', icon: 'Star' },
  { count: '50k+', label: 'Produtos entregues' },
] as const;
