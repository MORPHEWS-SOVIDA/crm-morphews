import { supabase } from '@/integrations/supabase/client';

/**
 * Ensures the 'delivered' checkpoint exists in sale_checkpoints when a sale is marked as delivered.
 * This should be called whenever sale status is set to 'delivered' outside of the checkpoint toggle flow.
 */
export async function ensureDeliveredCheckpoint(saleId: string, userId: string) {
  try {
    // Get organization_id from sale
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .select('organization_id')
      .eq('id', saleId)
      .single();

    if (saleError || !sale) {
      console.error('ensureDeliveredCheckpoint: failed to fetch sale', saleError);
      return;
    }

    // Check if checkpoint already exists
    const { data: existing } = await supabase
      .from('sale_checkpoints')
      .select('id, completed_at')
      .eq('sale_id', saleId)
      .eq('checkpoint_type', 'delivered')
      .maybeSingle();

    const now = new Date().toISOString();

    if (existing) {
      // Update if not already completed
      if (!existing.completed_at) {
        await supabase
          .from('sale_checkpoints')
          .update({ completed_at: now, completed_by: userId })
          .eq('id', existing.id);
      }
    } else {
      // Create new checkpoint
      const { data: newCheckpoint } = await supabase
        .from('sale_checkpoints')
        .insert({
          sale_id: saleId,
          organization_id: sale.organization_id,
          checkpoint_type: 'delivered',
          completed_at: now,
          completed_by: userId,
        })
        .select('id')
        .single();

      // Insert history record
      if (newCheckpoint) {
        await supabase.from('sale_checkpoint_history').insert({
          checkpoint_id: newCheckpoint.id,
          sale_id: saleId,
          organization_id: sale.organization_id,
          checkpoint_type: 'delivered',
          action: 'completed',
          changed_by: userId,
          notes: 'Marcado automaticamente ao confirmar entrega',
        });
      }
    }
  } catch (error) {
    console.error('ensureDeliveredCheckpoint: error', error);
  }
}
