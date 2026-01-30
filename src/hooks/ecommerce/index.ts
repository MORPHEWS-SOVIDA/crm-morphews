/**
 * Hooks de E-commerce Multi-Tenant
 * 
 * Este módulo contém todos os hooks para o sistema de e-commerce,
 * incluindo storefronts, landing pages, carrinhos e contas virtuais.
 */

// =============================================================================
// STOREFRONTS (Lojas Completas)
// =============================================================================
export {
  // Query hooks
  useStorefrontTemplates,
  useStorefronts,
  useStorefront,
  useStorefrontProducts,
  // Mutation hooks
  useCreateStorefront,
  useUpdateStorefront,
  useDeleteStorefront,
  useAddStorefrontDomain,
  useUpdateStorefrontProducts,
  useUpdateStorefrontProduct,
  // Types
  type StorefrontTemplate,
  type Storefront,
  type StorefrontDomain,
  type StorefrontProduct,
  type CreateStorefrontInput,
} from './useStorefronts';

// =============================================================================
// STOREFRONT BANNERS
// =============================================================================
export {
  useStorefrontBanners,
  useCreateStorefrontBanner,
  useUpdateStorefrontBanner,
  useDeleteStorefrontBanner,
  useReorderStorefrontBanners,
  type StorefrontBanner,
  type CreateBannerInput,
} from './useStorefrontBanners';

// =============================================================================
// STOREFRONT TESTIMONIALS
// =============================================================================
export {
  useStorefrontTestimonials,
  useCreateStorefrontTestimonial,
  useUpdateStorefrontTestimonial,
  useDeleteStorefrontTestimonial,
  useReorderStorefrontTestimonials,
  useToggleTestimonialsEnabled,
  type StorefrontTestimonial,
  type CreateTestimonialInput,
} from './useStorefrontTestimonials';

// =============================================================================
// STOREFRONT PAGES (Institucionais)
// =============================================================================
export {
  useStorefrontPages,
  useStorefrontPage,
  useCreateStorefrontPage,
  useUpdateStorefrontPage,
  useDeleteStorefrontPage,
  useCreateDefaultPages,
  PAGE_TYPE_LABELS,
  DEFAULT_PAGE_TEMPLATES,
  type StorefrontPage,
  type PageType,
  type CreatePageInput,
} from './useStorefrontPages';

// =============================================================================
// STOREFRONT CATEGORIES
// =============================================================================
export {
  useStorefrontCategories,
  useFlatStorefrontCategories,
  useCreateStorefrontCategory,
  useUpdateStorefrontCategory,
  useDeleteStorefrontCategory,
  useAssignProductToCategory,
  useRemoveProductFromCategory,
  useUpdateProductCategories,
  type StorefrontCategory,
  type CreateCategoryInput,
} from './useStorefrontCategories';

// =============================================================================
// LANDING PAGES (VSL)
// =============================================================================
export {
  // Query hooks
  useLandingPages,
  useLandingPage,
  // Mutation hooks
  useCreateLandingPage,
  useUpdateLandingPage,
  useDeleteLandingPage,
  useDuplicateLandingPage,
  // Types
  type LandingPage,
  type LandingOffer,
  type CreateLandingPageInput,
} from './useLandingPages';

// =============================================================================
// VIRTUAL ACCOUNTS & PAYMENTS (Modelo Gateway)
// =============================================================================
export {
  // User hooks
  useMyVirtualAccount,
  useTenantVirtualAccount,
  usePartnerVirtualAccount,
  useSmartVirtualAccount,
  useVirtualTransactions,
  useMyWithdrawals,
  useUpdateBankData,
  useRequestWithdrawal,
  // Admin hooks
  useAllVirtualAccounts,
  usePendingWithdrawals,
  useReviewWithdrawal,
  usePlatformSettings,
  useUpdatePlatformSettings,
  // Types
  type AccountType,
  type TransactionType,
  type TransactionStatus,
  type WithdrawalStatus,
  type VirtualAccount,
  type BankData,
  type VirtualTransaction,
  type WithdrawalRequest,
} from './useVirtualAccounts';

// =============================================================================
// PAYMENT GATEWAYS (Pagarme, Appmax, Stripe, Asaas)
// =============================================================================
export {
  // Query hooks
  usePaymentGateways,
  useActivePaymentGateways,
  // Mutation hooks
  useCreatePaymentGateway,
  useUpdatePaymentGateway,
  useTogglePaymentGateway,
  useDeletePaymentGateway,
  // Constants
  GATEWAY_LABELS,
  // Types
  type GatewayType,
  type PaymentGateway,
  type CreateGatewayInput,
} from './usePaymentGateways';

// =============================================================================
// PLATFORM GATEWAYS (Super Admin - Multi-Gateway Fallback)
// =============================================================================
export {
  useActivePlatformGateways,
  useGatewayFallbackConfig,
  useTenantPaymentFees,
  usePaymentAttempts,
  useSavedPaymentMethods,
  calculateTransactionFees,
  GATEWAY_INFO,
  PAYMENT_METHOD_LABELS,
  type PlatformGatewayConfig,
  type GatewayFallbackConfig,
  type TenantPaymentFees,
  type PaymentAttempt,
  type SavedPaymentMethod,
  type PaymentMethodType,
} from './usePlatformGateways';

// =============================================================================
// INDUSTRIES (Fornecedores/Indústrias)
// =============================================================================
export {
  useIndustries,
  useActiveIndustries,
  useCreateIndustry,
  useUpdateIndustry,
  useDeleteIndustry,
  useProductIndustryCosts,
  useCreateProductIndustryCost,
  useUpdateProductIndustryCost,
  useDeleteProductIndustryCost,
  calculateIndustryCost,
  type Industry,
  type ProductIndustryCost,
} from './useIndustries';

// =============================================================================
// PUBLIC STOREFRONT (Frontend Público)
// =============================================================================
export {
  usePublicStorefront,
  usePublicProduct,
  usePublicCategoryProducts,
  usePublicPage,
  type PublicProduct,
  type StorefrontData,
} from './usePublicStorefront';

// =============================================================================
// QUIZ BUILDER
// =============================================================================
export {
  // Query hooks
  useQuizzes,
  useQuiz,
  useQuizBySlug,
  useQuizSessions,
  useQuizAnalytics,
  // Mutation hooks
  useCreateQuiz,
  useUpdateQuiz,
  useDeleteQuiz,
  useCreateQuizStep,
  useUpdateQuizStep,
  useDeleteQuizStep,
  useCreateQuizOption,
  useUpdateQuizOption,
  useDeleteQuizOption,
  useCreateQuizSession,
  useUpdateQuizSession,
  useTrackQuizEvent,
  useSaveQuizAnswer,
  // Constants
  STEP_TYPE_LABELS,
  CTA_TYPE_LABELS,
  // Types
  type Quiz,
  type QuizStep,
  type QuizStepOption,
  type QuizSession,
  type QuizEvent,
  type QuizAnalytics,
  type QuizStepType,
  type QuizCtaType,
  type QuizEventType,
} from './useQuizzes';
