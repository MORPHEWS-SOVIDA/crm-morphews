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
  // Types
  type StorefrontTemplate,
  type Storefront,
  type StorefrontDomain,
  type StorefrontProduct,
  type CreateStorefrontInput,
} from './useStorefronts';

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
