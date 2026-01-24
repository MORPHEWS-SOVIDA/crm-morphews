// Types for the AI Landing Page Generator

export type OfferType = 
  | 'nutraceutico' 
  | 'cosmetico' 
  | 'eletronico' 
  | 'fisico_outro'
  | 'infoproduto' 
  | 'mentoria_high_ticket' 
  | 'low_ticket' 
  | 'webinario';

export interface OfferTypeConfig {
  value: OfferType;
  label: string;
  description: string;
  icon: string;
  requiredUploads: UploadType[];
  optionalUploads: UploadType[];
  showIngredients: boolean;
  showFaq: boolean;
  pageStyle: 'full' | 'minimal' | 'webinar';
}

export type UploadType = 
  | 'product_image' 
  | 'product_label' 
  | 'testimonial_face' 
  | 'testimonial_whatsapp' 
  | 'testimonial_holding' 
  | 'hero_background'
  | 'mentor_photo'
  | 'before_after';

export interface UploadConfig {
  type: UploadType;
  label: string;
  description: string;
  accept: string;
  multiple?: boolean;
}

export interface UploadedImage {
  type: UploadType;
  url: string;
  file?: File;
  isAiGenerated?: boolean;
}

export interface TestimonialUpload {
  id: string;
  imageUrl: string;
  imageType: 'face' | 'whatsapp' | 'holding_product';
  name?: string;
  text?: string;
}

// New: Product Offer configuration
export interface ProductOffer {
  id: string;
  quantity: number;
  label: string;
  price_cents: number;
  original_price_cents?: number;
  badge_text?: string;
  is_highlighted: boolean;
  // New: Option to multiply product image for kits
  multiplyImage: boolean;
  customKitImage?: string; // User can upload a custom kit image
}

// New: Testimonial configuration
export type TestimonialStyle = 'review' | 'whatsapp';

export interface TestimonialConfig {
  count: number; // How many testimonials
  style: TestimonialStyle;
  useRealPhotos: boolean; // If false, AI generates faces
  generateAudio: boolean; // Generate ElevenLabs audio
  generateVideoAvatar: boolean; // Generate fake video with avatar
  uploads: TestimonialUpload[];
}

// New: Guarantee configuration
export interface GuaranteeConfig {
  enabled: boolean;
  days: number;
  text: string;
}

export interface BriefingData {
  productId: string;
  productName: string;
  productDescription: string;
  promise: string;
  targetAudience: string;
  differentials: string;
  tone: 'professional' | 'informal' | 'urgent' | 'premium';
  style: 'minimal' | 'bold' | 'luxury' | 'health';
  salesScript: string;
  generateMissingImages: boolean;
}

// New: Page configuration collected before generating
export interface PageConfig {
  name: string;
  slug: string;
  whatsappNumber: string;
  videoUrl?: string;
}

export interface GeneratedContent {
  headline: string;
  subheadline: string;
  benefits: string[];
  urgencyText: string;
  guaranteeText: string;
  testimonials: GeneratedTestimonial[];
  faq: { question: string; answer: string }[];
  ctaText: string;
  primaryColor: string;
  estimatedTokens: number;
}

// New: Enhanced testimonial with audio/video support
export interface GeneratedTestimonial {
  id: string;
  name: string;
  text: string;
  imageUrl?: string;
  style: TestimonialStyle;
  audioUrl?: string; // ElevenLabs generated audio
  videoUrl?: string; // Fake avatar video
  whatsappMessages?: WhatsAppMessage[]; // For WhatsApp style
}

// New: WhatsApp conversation message
export interface WhatsAppMessage {
  id: string;
  text: string;
  isFromClient: boolean;
  timestamp: string;
  hasImage?: boolean;
  imageUrl?: string;
}

// Updated wizard state
export interface AILandingWizardState {
  step: 'type' | 'page_config' | 'offers' | 'uploads' | 'testimonials' | 'briefing' | 'generating' | 'preview' | 'editor';
  offerType: OfferType | null;
  pageConfig: PageConfig;
  offers: ProductOffer[];
  testimonialConfig: TestimonialConfig;
  guaranteeConfig: GuaranteeConfig;
  uploadedImages: UploadedImage[];
  testimonialUploads: TestimonialUpload[];
  briefing: BriefingData;
  generatedContent: GeneratedContent | null;
  productIngredients: string[];
  productFaqs: { question: string; answer: string }[];
  totalEnergyCost: number;
}

// Energy costs for different features
export const ENERGY_COSTS = {
  baseCopy: 300,
  imageGeneration: 100,
  testimonialGeneration: 50, // per testimonial
  audioGeneration: 75, // per audio with ElevenLabs
  videoAvatarGeneration: 150, // per video avatar
  whatsappStyleConversion: 25, // per WhatsApp conversation
  imageMultiplication: 50, // per kit image multiplication
};

// Config for each offer type
export const OFFER_TYPE_CONFIGS: OfferTypeConfig[] = [
  {
    value: 'nutraceutico',
    label: 'Nutracêutico',
    description: 'Suplementos, vitaminas, fórmulas naturais',
    icon: '💊',
    requiredUploads: ['product_image'],
    optionalUploads: ['product_label', 'testimonial_face', 'testimonial_whatsapp', 'testimonial_holding', 'before_after'],
    showIngredients: true,
    showFaq: true,
    pageStyle: 'full',
  },
  {
    value: 'cosmetico',
    label: 'Cosmético',
    description: 'Cremes, serums, produtos de beleza',
    icon: '✨',
    requiredUploads: ['product_image'],
    optionalUploads: ['product_label', 'testimonial_face', 'testimonial_whatsapp', 'before_after'],
    showIngredients: true,
    showFaq: true,
    pageStyle: 'full',
  },
  {
    value: 'eletronico',
    label: 'Eletrônico',
    description: 'Gadgets, dispositivos, acessórios tech',
    icon: '📱',
    requiredUploads: ['product_image'],
    optionalUploads: ['testimonial_face', 'testimonial_whatsapp'],
    showIngredients: false,
    showFaq: true,
    pageStyle: 'full',
  },
  {
    value: 'fisico_outro',
    label: 'Físico (Outros)',
    description: 'Outros produtos físicos',
    icon: '📦',
    requiredUploads: ['product_image'],
    optionalUploads: ['testimonial_face', 'testimonial_whatsapp', 'testimonial_holding'],
    showIngredients: false,
    showFaq: true,
    pageStyle: 'full',
  },
  {
    value: 'infoproduto',
    label: 'Infoproduto',
    description: 'Cursos, ebooks, materiais digitais',
    icon: '📚',
    requiredUploads: [],
    optionalUploads: ['hero_background', 'testimonial_face', 'testimonial_whatsapp'],
    showIngredients: false,
    showFaq: true,
    pageStyle: 'full',
  },
  {
    value: 'mentoria_high_ticket',
    label: 'Mentoria High Ticket',
    description: 'Mentorias, consultorias premium',
    icon: '🎯',
    requiredUploads: ['mentor_photo'],
    optionalUploads: ['testimonial_face', 'testimonial_whatsapp', 'hero_background'],
    showIngredients: false,
    showFaq: true,
    pageStyle: 'full',
  },
  {
    value: 'low_ticket',
    label: 'Low Ticket',
    description: 'Produtos de entrada, tripwires',
    icon: '🎁',
    requiredUploads: [],
    optionalUploads: ['hero_background', 'testimonial_face'],
    showIngredients: false,
    showFaq: false,
    pageStyle: 'minimal',
  },
  {
    value: 'webinario',
    label: 'Webinário',
    description: 'Página curta para inscrição em evento',
    icon: '🎥',
    requiredUploads: [],
    optionalUploads: ['mentor_photo', 'hero_background'],
    showIngredients: false,
    showFaq: false,
    pageStyle: 'webinar',
  },
];

export const UPLOAD_CONFIGS: Record<UploadType, UploadConfig> = {
  product_image: {
    type: 'product_image',
    label: 'Foto do Produto',
    description: 'Imagem principal do seu produto (PNG ou JPG de alta qualidade)',
    accept: 'image/*',
  },
  product_label: {
    type: 'product_label',
    label: 'Rótulo / Embalagem',
    description: 'Foto do rótulo ou embalagem com informações',
    accept: 'image/*',
  },
  testimonial_face: {
    type: 'testimonial_face',
    label: 'Rosto para Depoimento',
    description: 'Foto do rosto da pessoa (a IA vai escrever o depoimento)',
    accept: 'image/*',
    multiple: true,
  },
  testimonial_whatsapp: {
    type: 'testimonial_whatsapp',
    label: 'Print de WhatsApp',
    description: 'Screenshot de conversa com depoimento real',
    accept: 'image/*',
    multiple: true,
  },
  testimonial_holding: {
    type: 'testimonial_holding',
    label: 'Cliente com Produto',
    description: 'Foto de cliente segurando ou usando o produto',
    accept: 'image/*',
    multiple: true,
  },
  hero_background: {
    type: 'hero_background',
    label: 'Imagem de Fundo',
    description: 'Imagem para o banner principal (1920x1080 recomendado)',
    accept: 'image/*',
  },
  mentor_photo: {
    type: 'mentor_photo',
    label: 'Foto do Mentor/Especialista',
    description: 'Sua foto profissional ou do especialista',
    accept: 'image/*',
  },
  before_after: {
    type: 'before_after',
    label: 'Antes e Depois',
    description: 'Fotos de resultados (antes/depois)',
    accept: 'image/*',
    multiple: true,
  },
};

// Default values for new wizard
export const DEFAULT_PAGE_CONFIG: PageConfig = {
  name: '',
  slug: '',
  whatsappNumber: '',
  videoUrl: '',
};

export const DEFAULT_TESTIMONIAL_CONFIG: TestimonialConfig = {
  count: 3,
  style: 'review',
  useRealPhotos: false,
  generateAudio: false,
  generateVideoAvatar: false,
  uploads: [],
};

export const DEFAULT_GUARANTEE_CONFIG: GuaranteeConfig = {
  enabled: true,
  days: 30,
  text: 'Se você não ficar 100% satisfeito, devolvemos seu dinheiro.',
};

export const DEFAULT_OFFERS: ProductOffer[] = [
  {
    id: '1',
    quantity: 1,
    label: '1 unidade',
    price_cents: 0,
    is_highlighted: false,
    multiplyImage: false,
  },
  {
    id: '2',
    quantity: 3,
    label: 'Kit 3 unidades',
    price_cents: 0,
    badge_text: 'Mais vendido',
    is_highlighted: true,
    multiplyImage: true,
  },
  {
    id: '3',
    quantity: 6,
    label: 'Kit 6 unidades',
    price_cents: 0,
    badge_text: 'Melhor custo-benefício',
    is_highlighted: false,
    multiplyImage: true,
  },
];
