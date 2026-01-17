-- Add user preference columns to user_permissions table
ALTER TABLE public.user_permissions 
ADD COLUMN IF NOT EXISTS default_landing_page text DEFAULT '/dashboard',
ADD COLUMN IF NOT EXISTS hide_sidebar boolean DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.user_permissions.default_landing_page IS 'Página inicial ao fazer login (ex: /dashboard, /expedicao, /minhas-entregas)';
COMMENT ON COLUMN public.user_permissions.hide_sidebar IS 'Se true, esconde o menu lateral para maximizar espaço útil';