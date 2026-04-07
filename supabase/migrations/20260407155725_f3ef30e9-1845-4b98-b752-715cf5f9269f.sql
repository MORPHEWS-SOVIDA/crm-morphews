UPDATE whatsapp_instances 
SET status = 'active', is_connected = true, updated_at = now()
WHERE evolution_instance_id IN ('atomicatcomercial-950d92d3-cr43', 'atomicsales-950d92d3-6rqi')
AND status != 'active';

UPDATE whatsapp_instances 
SET status = 'disconnected', is_connected = false, updated_at = now()
WHERE evolution_instance_id = 'fernandao-950d92d3-v3j2'
AND status = 'pending';