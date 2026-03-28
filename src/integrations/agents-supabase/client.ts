/**
 * Client Supabase secundário para o projeto atomic-agents (Agentes IA 2.0)
 * Usa variáveis de ambiente VITE_AGENTS_SUPABASE_URL e VITE_AGENTS_SUPABASE_ANON_KEY
 */
import { createClient } from '@supabase/supabase-js';

const AGENTS_SUPABASE_URL = import.meta.env.VITE_AGENTS_SUPABASE_URL || 'https://cplgdbhojuypgeslayaf.supabase.co';
const AGENTS_SUPABASE_ANON_KEY = import.meta.env.VITE_AGENTS_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwbGdkYmhvanV5cGdlc2xheWFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MTk3NDQsImV4cCI6MjA5MDI5NTc0NH0.lXH8i18h0NPo4qkWTHt_4qMmelbCOt_WBXohDWoiD28';

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
