import { QueryClient } from "@tanstack/react-query";

/**
 * QueryClient otimizado para SaaS multi-tenant com alta escala
 * 
 * Configurações pensadas para:
 * - 50+ tenants
 * - 10+ usuários por tenant
 * - Múltiplas instâncias WhatsApp
 * - Dados em tempo real
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Dados considerados frescos por 5 minutos (evita refetches desnecessários)
      staleTime: 5 * 60 * 1000,
      
      // Cache mantido por 15 minutos após query ficar inativa
      gcTime: 15 * 60 * 1000,
      
      // Retry com backoff exponencial (reduzido para 2 retries)
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 15000),
      
      // Não refetch automaticamente ao focar janela (economiza requests)
      refetchOnWindowFocus: false,
      
      // Não refetch ao reconectar imediatamente
      refetchOnReconnect: false,
      
      // Usar dados em cache enquanto busca novos (melhor UX)
      placeholderData: (previousData: unknown) => previousData,
    },
    mutations: {
      // Retry apenas 1 vez em mutations
      retry: 1,
      
      // Mostrar erro após falha
      onError: (error) => {
        console.error('[Mutation Error]', error);
      },
    },
  },
});

// Query keys organizados por domínio para invalidação eficiente
export const queryKeys = {
  // Leads
  leads: {
    all: ['leads'] as const,
    list: (filters?: Record<string, unknown>) => ['leads', 'list', filters] as const,
    detail: (id: string) => ['leads', 'detail', id] as const,
    addresses: (id: string) => ['leads', 'addresses', id] as const,
    followups: (id: string) => ['leads', 'followups', id] as const,
  },
  
  // Sales
  sales: {
    all: ['sales'] as const,
    list: (filters?: Record<string, unknown>) => ['sales', 'list', filters] as const,
    detail: (id: string) => ['sales', 'detail', id] as const,
    items: (id: string) => ['sales', 'items', id] as const,
  },
  
  // WhatsApp
  whatsapp: {
    all: ['whatsapp'] as const,
    instances: () => ['whatsapp', 'instances'] as const,
    conversations: (instanceId?: string) => ['whatsapp', 'conversations', instanceId] as const,
    messages: (conversationId: string) => ['whatsapp', 'messages', conversationId] as const,
  },
  
  // Products
  products: {
    all: ['products'] as const,
    list: () => ['products', 'list'] as const,
    detail: (id: string) => ['products', 'detail', id] as const,
  },
  
  // Organization
  organization: {
    current: () => ['organization', 'current'] as const,
    settings: () => ['organization', 'settings'] as const,
    members: () => ['organization', 'members'] as const,
  },
  
  // User/Profile
  user: {
    current: () => ['user', 'current'] as const,
    profile: () => ['user', 'profile'] as const,
    permissions: () => ['user', 'permissions'] as const,
  },
  
  // Fiscal
  fiscal: {
    companies: () => ['fiscal', 'companies'] as const,
    invoices: (filters?: Record<string, unknown>) => ['fiscal', 'invoices', filters] as const,
    invoice: (id: string) => ['fiscal', 'invoice', id] as const,
  },
  
  // Correios
  correios: {
    config: () => ['correios', 'config'] as const,
    services: () => ['correios', 'services'] as const,
    labels: (filters?: Record<string, unknown>) => ['correios', 'labels', filters] as const,
  },
  
  // AI Bots
  bots: {
    all: ['bots'] as const,
    list: () => ['bots', 'list'] as const,
    detail: (id: string) => ['bots', 'detail', id] as const,
  },
  
  // Demands
  demands: {
    all: ['demands'] as const,
    boards: () => ['demands', 'boards'] as const,
    board: (id: string) => ['demands', 'board', id] as const,
  },
} as const;
