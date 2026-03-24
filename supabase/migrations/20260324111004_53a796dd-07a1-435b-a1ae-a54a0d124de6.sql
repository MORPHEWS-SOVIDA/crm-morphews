
INSERT INTO public.organization_members (organization_id, user_id, role, is_active)
VALUES ('650b1667-e345-498e-9d41-b963faf824a7', '3d379563-01f0-47de-867c-0168e0efb7ae', 'partner_coproducer', true)
ON CONFLICT (organization_id, user_id) DO NOTHING;
