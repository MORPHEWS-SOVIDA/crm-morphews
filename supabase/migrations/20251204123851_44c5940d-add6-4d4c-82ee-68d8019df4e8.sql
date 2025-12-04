-- Criar plano gratuito
INSERT INTO public.subscription_plans (name, price_cents, max_users, max_leads, extra_user_price_cents, is_active, stripe_price_id)
VALUES ('Grátis', 0, 1, 5, 3700, true, NULL);