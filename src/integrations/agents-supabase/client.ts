/**
 * Client Supabase secundário para o projeto atomic-agents (Agentes IA 2.0)
 * Usa variáveis de ambiente VITE_AGENTS_SUPABASE_URL e VITE_AGENTS_SUPABASE_ANON_KEY
 */
import { createClient } from '@supabase/supabase-js';

const AGENTS_SUPABASE_URL = import.meta.env.VITE_AGENTS_SUPABASE_URL;
const AGENTS_SUPABASE_ANON_KEY = import.meta.env.VITE_AGENTS_SUPABASE_ANON_KEY;

export const isAgentsSupabaseConfigured = Boolean(
  AGENTS_SUPABASE_URL && AGENTS_SUPABASE_ANON_KEY
);

if (!isAgentsSupabaseConfigured) {
  console.warn(
    '[agents-supabase] VITE_AGENTS_SUPABASE_URL ou VITE_AGENTS_SUPABASE_ANON_KEY não configurados.'
  );
}

export const agentsSupabase = isAgentsSupabaseConfigured
  ? createClient(AGENTS_SUPABASE_URL, AGENTS_SUPABASE_ANON_KEY)
  : null;
