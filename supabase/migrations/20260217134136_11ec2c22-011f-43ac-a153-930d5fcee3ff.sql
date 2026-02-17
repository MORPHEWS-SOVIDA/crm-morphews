
-- RPC to get comprehensive cloud infrastructure costs per tenant
CREATE OR REPLACE FUNCTION public.get_cloud_infrastructure_summary(p_days int DEFAULT 30)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'tenants', (
      SELECT COALESCE(json_agg(t ORDER BY t.total_messages DESC), '[]'::json)
      FROM (
        SELECT 
          o.id as org_id,
          o.name as org_name,
          -- WhatsApp Messages
          COALESCE(msg.total_messages, 0) as total_messages,
          COALESCE(msg.bot_messages, 0) as bot_messages,
          -- WhatsApp Instances
          COALESCE(inst.instance_count, 0) as instance_count,
          COALESCE(inst.connected_count, 0) as connected_count,
          -- AI/Energy costs
          COALESCE(ai.ai_calls, 0) as ai_calls,
          COALESCE(ai.ai_cost_usd, 0) as ai_cost_usd,
          COALESCE(ai.total_energy, 0) as total_energy,
          COALESCE(ai.total_tokens, 0) as total_tokens,
          -- Storage (all-time for this org's instances)
          COALESCE(stor.storage_files, 0) as storage_files,
          COALESCE(stor.storage_mb, 0) as storage_mb,
          -- Conversations
          COALESCE(conv.conversations_count, 0) as conversations_count
        FROM public.organizations o
        LEFT JOIN (
          SELECT wi.organization_id,
            COUNT(wm.id) as total_messages,
            COUNT(CASE WHEN wm.is_from_bot = true THEN 1 END) as bot_messages
          FROM public.whatsapp_messages wm
          JOIN public.whatsapp_instances wi ON wi.id = wm.instance_id
          WHERE wm.created_at >= NOW() - (p_days || ' days')::interval
          GROUP BY wi.organization_id
        ) msg ON msg.organization_id = o.id
        LEFT JOIN (
          SELECT organization_id,
            COUNT(*) as instance_count,
            COUNT(CASE WHEN status = 'connected' THEN 1 END) as connected_count
          FROM public.whatsapp_instances
          GROUP BY organization_id
        ) inst ON inst.organization_id = o.id
        LEFT JOIN (
          SELECT organization_id,
            COUNT(*) as ai_calls,
            SUM(COALESCE(real_cost_usd, 0))::numeric as ai_cost_usd,
            SUM(COALESCE(energy_consumed, 0)) as total_energy,
            SUM(COALESCE(tokens_used, 0)) as total_tokens
          FROM public.energy_usage_log
          WHERE created_at >= NOW() - (p_days || ' days')::interval
          GROUP BY organization_id
        ) ai ON ai.organization_id = o.id
        LEFT JOIN (
          SELECT wi.organization_id,
            COUNT(so.id) as storage_files,
            COALESCE(SUM((so.metadata->>'size')::bigint), 0) / (1024*1024) as storage_mb
          FROM storage.objects so
          JOIN public.whatsapp_instances wi ON so.name LIKE wi.id || '/%'
          WHERE so.bucket_id = 'whatsapp-media'
          GROUP BY wi.organization_id
        ) stor ON stor.organization_id = o.id
        LEFT JOIN (
          SELECT wi.organization_id,
            COUNT(*) as conversations_count
          FROM public.whatsapp_conversations wc
          JOIN public.whatsapp_instances wi ON wi.id = wc.instance_id
          WHERE wc.created_at >= NOW() - (p_days || ' days')::interval
          GROUP BY wi.organization_id
        ) conv ON conv.organization_id = o.id
        WHERE COALESCE(msg.total_messages, 0) + COALESCE(ai.ai_calls, 0) + COALESCE(inst.instance_count, 0) > 0
      ) t
    ),
    'storage_summary', (
      SELECT COALESCE(json_agg(s ORDER BY s.size_mb DESC), '[]'::json)
      FROM (
        SELECT bucket_id,
          COUNT(*) as file_count,
          COALESCE(SUM((metadata->>'size')::bigint), 0) / (1024*1024) as size_mb
        FROM storage.objects
        GROUP BY bucket_id
      ) s
    ),
    'ai_by_action', (
      SELECT COALESCE(json_agg(a ORDER BY a.cost DESC), '[]'::json)
      FROM (
        SELECT action_type,
          COUNT(*) as calls,
          SUM(COALESCE(real_cost_usd, 0))::numeric as cost,
          SUM(COALESCE(energy_consumed, 0)) as energy,
          SUM(COALESCE(tokens_used, 0)) as tokens
        FROM public.energy_usage_log
        WHERE created_at >= NOW() - (p_days || ' days')::interval
        GROUP BY action_type
      ) a
    ),
    'ai_by_model', (
      SELECT COALESCE(json_agg(m ORDER BY m.cost DESC), '[]'::json)
      FROM (
        SELECT model_used as model,
          COUNT(*) as calls,
          SUM(COALESCE(real_cost_usd, 0))::numeric as cost,
          SUM(COALESCE(energy_consumed, 0)) as energy,
          SUM(COALESCE(tokens_used, 0)) as tokens
        FROM public.energy_usage_log
        WHERE created_at >= NOW() - (p_days || ' days')::interval
        GROUP BY model_used
      ) m
    ),
    'ai_daily_trend', (
      SELECT COALESCE(json_agg(d ORDER BY d.day), '[]'::json)
      FROM (
        SELECT DATE(created_at) as day,
          COUNT(*) as calls,
          SUM(COALESCE(real_cost_usd, 0))::numeric as cost,
          SUM(COALESCE(energy_consumed, 0)) as energy
        FROM public.energy_usage_log
        WHERE created_at >= NOW() - (p_days || ' days')::interval
        GROUP BY DATE(created_at)
      ) d
    ),
    'messages_daily_trend', (
      SELECT COALESCE(json_agg(d ORDER BY d.day), '[]'::json)
      FROM (
        SELECT DATE(wm.created_at) as day,
          COUNT(*) as total_messages
        FROM public.whatsapp_messages wm
        WHERE wm.created_at >= NOW() - (p_days || ' days')::interval
        GROUP BY DATE(wm.created_at)
      ) d
    ),
    'ai_by_tenant_action', (
      SELECT COALESCE(json_agg(ta ORDER BY ta.cost DESC), '[]'::json)
      FROM (
        SELECT e.organization_id as org_id, o.name as org_name,
          e.action_type,
          e.model_used as model,
          COUNT(*) as calls,
          SUM(COALESCE(e.real_cost_usd, 0))::numeric as cost,
          SUM(COALESCE(e.energy_consumed, 0)) as energy
        FROM public.energy_usage_log e
        JOIN public.organizations o ON o.id = e.organization_id
        WHERE e.created_at >= NOW() - (p_days || ' days')::interval
        GROUP BY e.organization_id, o.name, e.action_type, e.model_used
      ) ta
    ),
    'totals', (
      SELECT json_build_object(
        'total_messages', (SELECT COUNT(*) FROM public.whatsapp_messages WHERE created_at >= NOW() - (p_days || ' days')::interval),
        'total_conversations', (SELECT COUNT(*) FROM public.whatsapp_conversations WHERE created_at >= NOW() - (p_days || ' days')::interval),
        'total_ai_calls', (SELECT COUNT(*) FROM public.energy_usage_log WHERE created_at >= NOW() - (p_days || ' days')::interval),
        'total_ai_cost_usd', (SELECT COALESCE(SUM(real_cost_usd), 0)::numeric FROM public.energy_usage_log WHERE created_at >= NOW() - (p_days || ' days')::interval),
        'total_storage_mb', (SELECT COALESCE(SUM((metadata->>'size')::bigint), 0) / (1024*1024) FROM storage.objects),
        'total_storage_files', (SELECT COUNT(*) FROM storage.objects),
        'total_instances', (SELECT COUNT(*) FROM public.whatsapp_instances),
        'connected_instances', (SELECT COUNT(*) FROM public.whatsapp_instances WHERE status = 'connected')
      )
    )
  ) INTO result;
  
  RETURN result;
END;
$$;
