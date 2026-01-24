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

export interface GeneratedContent {
  headline: string;
  subheadline: string;
  benefits: string[];
  urgencyText: string;
  guaranteeText: string;
  testimonials: { name: string; text: string; imageUrl?: string }[];
  faq: { question: string; answer: string }[];
  ctaText: string;
  primaryColor: string;
  estimatedTokens: number;
}

export interface AILandingWizardState {
  step: 'type' | 'uploads' | 'briefing' | 'generating' | 'preview';
  offerType: OfferType | null;
  uploadedImages: UploadedImage[];
  testimonialUploads: TestimonialUpload[];
  briefing: BriefingData;
  generatedContent: GeneratedContent | null;
  productIngredients: string[];
  productFaqs: { question: string; answer: string }[];
  totalEnergyCost: number;
}

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
