import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "./useTenant";
import { useAuth } from "./useAuth";

interface ScheduleMessagesParams {
  leadId: string;
  leadName: string;
  leadWhatsapp: string;
  reasonId: string;
  productId?: string;
  productName?: string;
  productBrand?: string;
  sellerName?: string;
  /** Custom scheduled date/time for the follow-up. If provided, overrides the default delay calculation. */
  customScheduledAt?: Date;
}

/**
 * Hook to schedule automated messages when a non-purchase reason is selected.
 * Fetches templates for the reason and creates scheduled messages.
 * Also cancels any previously pending messages for the same lead.
 */
export function useScheduleMessages() {
  const { tenantId } = useTenant();
  const { user } = useAuth();

  /**
   * Cancels all pending scheduled messages for a lead.
   * Called when a new non-purchase reason is selected or when a sale is created.
   */
  const cancelPendingMessages = async (leadId: string, reason: string) => {
    if (!tenantId) return { cancelled: 0, error: 'No tenant ID' };

    try {
      const { data: pendingMessages, error: fetchError } = await supabase
        .from('lead_scheduled_messages')
        .select('id')
        .eq('lead_id', leadId)
        .eq('organization_id', tenantId)
        .eq('status', 'pending');

      if (fetchError) {
        console.error('Error fetching pending messages:', fetchError);
        return { cancelled: 0, error: fetchError.message };
      }

      if (!pendingMessages || pendingMessages.length === 0) {
        return { cancelled: 0, error: null };
      }

      const ids = pendingMessages.map(m => m.id);
      
      const { error: updateError } = await supabase
        .from('lead_scheduled_messages')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancel_reason: reason,
          updated_at: new Date().toISOString(),
        })
        .in('id', ids);

      if (updateError) {
        console.error('Error cancelling messages:', updateError);
        return { cancelled: 0, error: updateError.message };
      }

      console.log(`Cancelled ${ids.length} pending messages for lead ${leadId}`);
      return { cancelled: ids.length, error: null };
    } catch (error) {
      console.error('Error in cancelPendingMessages:', error);
      return { cancelled: 0, error: String(error) };
    }
  };

  const scheduleMessagesForReason = async (params: ScheduleMessagesParams) => {
    if (!tenantId) {
      console.error('No tenant ID for scheduling messages');
      return { scheduled: 0, error: 'No tenant ID' };
    }

    try {
      // FIRST: Cancel any pending messages from previous non-purchase reasons
      const { cancelled } = await cancelPendingMessages(
        params.leadId, 
        'Novo motivo de não compra selecionado'
      );
      if (cancelled > 0) {
        console.log(`Cancelled ${cancelled} previous pending messages before scheduling new ones`);
      }

      // Fetch active templates for this reason
      const { data: templates, error: templatesError } = await supabase
        .from('non_purchase_message_templates')
        .select('*')
        .eq('non_purchase_reason_id', params.reasonId)
        .eq('is_active', true)
        .order('position', { ascending: true });

      if (templatesError) {
        console.error('Error fetching templates:', templatesError);
        return { scheduled: 0, error: templatesError.message };
      }

      if (!templates || templates.length === 0) {
        console.log('No active templates for reason:', params.reasonId);
        return { scheduled: 0, error: null };
      }

      const baseTime = params.customScheduledAt || new Date();
      const scheduledMessages = [];

      for (const template of templates) {
        // Calculate scheduled time
        // If customScheduledAt is provided, use it as the base and add template delay
        // Otherwise, use now + template delay
        let scheduledAt: Date;
        
        if (params.customScheduledAt) {
          // For custom date, add template delay to the custom date
          scheduledAt = new Date(params.customScheduledAt.getTime() + template.delay_minutes * 60 * 1000);
        } else {
          // Default behavior: now + delay
          scheduledAt = new Date(new Date().getTime() + template.delay_minutes * 60 * 1000);
        }

        // Check business hours constraint (only apply if not custom scheduled)
        if (!params.customScheduledAt && template.send_start_hour !== null && template.send_end_hour !== null) {
          const hour = scheduledAt.getHours();
          
          // If outside business hours, adjust to next valid time
          if (hour < template.send_start_hour) {
            scheduledAt.setHours(template.send_start_hour, 0, 0, 0);
          } else if (hour >= template.send_end_hour) {
            // Move to next day at start hour
            scheduledAt.setDate(scheduledAt.getDate() + 1);
            scheduledAt.setHours(template.send_start_hour, 0, 0, 0);
          }
        }

        // Replace variables in message
        const firstName = params.leadName.split(' ')[0] || params.leadName;
        const finalMessage = template.message_template
          .replace(/\{\{nome\}\}/gi, params.leadName)
          .replace(/\{\{primeiro_nome\}\}/gi, firstName)
          .replace(/\{\{vendedor\}\}/gi, params.sellerName || '')
          .replace(/\{\{produto\}\}/gi, params.productName || '')
          .replace(/\{\{marca_do_produto\}\}/gi, params.productBrand || '');

        scheduledMessages.push({
          organization_id: tenantId,
          lead_id: params.leadId,
          template_id: template.id,
          whatsapp_instance_id: template.whatsapp_instance_id,
          scheduled_at: scheduledAt.toISOString(),
          original_scheduled_at: scheduledAt.toISOString(),
          final_message: finalMessage,
          status: 'pending',
          created_by: user?.id || null,
          media_type: template.media_type || null,
          media_url: template.media_url || null,
          media_filename: template.media_filename || null,
          // Bot fallback fields
          fallback_bot_enabled: template.fallback_bot_enabled ?? false,
          fallback_bot_id: template.fallback_bot_id || null,
          fallback_timeout_minutes: template.fallback_timeout_minutes ?? 30,
        });
      }

      if (scheduledMessages.length > 0) {
        const { error: insertError } = await supabase
          .from('lead_scheduled_messages')
          .insert(scheduledMessages);

        if (insertError) {
          console.error('Error scheduling messages:', insertError);
          return { scheduled: 0, error: insertError.message };
        }

        console.log(`Scheduled ${scheduledMessages.length} messages for lead ${params.leadId}`);
      }

      return { scheduled: scheduledMessages.length, error: null };
    } catch (error) {
      console.error('Error in scheduleMessagesForReason:', error);
      return { scheduled: 0, error: String(error) };
    }
  };

  return { scheduleMessagesForReason, cancelPendingMessages };
}
