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
}

/**
 * Hook to schedule automated messages when a non-purchase reason is selected.
 * Fetches templates for the reason and creates scheduled messages.
 */
export function useScheduleMessages() {
  const { tenantId } = useTenant();
  const { user } = useAuth();

  const scheduleMessagesForReason = async (params: ScheduleMessagesParams) => {
    if (!tenantId) {
      console.error('No tenant ID for scheduling messages');
      return { scheduled: 0, error: 'No tenant ID' };
    }

    try {
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

      const now = new Date();
      const scheduledMessages = [];

      for (const template of templates) {
        // Calculate scheduled time
        let scheduledAt = new Date(now.getTime() + template.delay_minutes * 60 * 1000);

        // Check business hours constraint
        if (template.send_start_hour !== null && template.send_end_hour !== null) {
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

  return { scheduleMessagesForReason };
}
