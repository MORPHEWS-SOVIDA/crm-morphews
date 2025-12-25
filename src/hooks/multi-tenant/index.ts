/**
 * Hooks de Multi-Tenancy e Multi-Atendimento
 * 
 * Este arquivo re-exporta todos os hooks relacionados ao sistema
 * multi-tenant e multi-atendimento WhatsApp do CRM Morphews.
 */

// =============================================================================
// TENANT (Empresa/Organização)
// =============================================================================
export {
  // Hooks de consulta
  useCurrentTenantId,
  useUserTenants,
  useTenantStats,
  useTenantChannels,
  useTenantMembers,
  useIsTenantAdmin,
  useTenantRole,
  useTenant,
  // Mutations
  useUpdateTenant,
  useAddTenantMember,
  useRemoveTenantMember,
  useUpdateMemberRole,
  // Tipos
  type Tenant,
  type TenantStats,
  type TenantMember,
} from '../useTenant';

// =============================================================================
// CHANNELS (Canais WhatsApp)
// =============================================================================
export {
  // Hooks de consulta
  useChannels,
  useChannel,
  useChannelUsers,
  useConnectedChannelsCount,
  // Mutations
  useAddChannelUser,
  useRemoveChannelUser,
  useUpdateChannelUserPermissions,
  useUpdateChannel,
  // Tipos
  type Channel,
  type ChannelUser,
} from '../useChannels';

// =============================================================================
// THREADS (Conversas WhatsApp)
// =============================================================================
export {
  // Hooks de consulta
  useThreads,
  useThread,
  useUnreadThreadsCount,
  useMessages,
  // Mutations
  useSendMessage,
  useMarkThreadAsRead,
  useLinkThreadToLead,
  // Tipos
  type Thread,
  type Message,
  type ThreadFilter,
} from '../useThreads';

// =============================================================================
// CONTACTS (Contatos - Visão 360)
// =============================================================================
export {
  // Hooks de consulta
  useContacts,
  useContact,
  useSearchContactByPhone,
  useContactWithThreads,
  // Mutations
  useCreateContact,
  useUpdateContact,
  useAddContactIdentity,
  useBackfillContacts,
  // Tipos
  type Contact,
  type ContactIdentity,
  type ContactWithThreads,
} from '../useContacts';
