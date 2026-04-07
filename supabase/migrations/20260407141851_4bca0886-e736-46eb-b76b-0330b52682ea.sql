UPDATE whatsapp_instances 
SET status = 'active', is_connected = true, updated_at = now()
WHERE id IN ('3ae1a51c-7478-488f-9f02-012eaf5bf5d8', '64c17f1b-4b02-4a18-a9b4-4acd2f8b046a');

UPDATE whatsapp_instances 
SET status = 'disconnected', is_connected = false, updated_at = now()
WHERE id IN ('98f00a62-bbb1-41d1-9ada-a94cdb40516f', 'cbd47b45-8bb6-40ba-be93-40326cfa12af')
AND status = 'pending';