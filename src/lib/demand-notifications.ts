import { supabase } from '@/integrations/supabase/client';

type NotificationType = 'assignment' | 'status_change' | 'sla_warning' | 'comment' | 'update';

interface SendDemandNotificationParams {
  organizationId: string;
  demandId: string;
  notificationType: NotificationType;
  targetUserIds?: string[];
  extraData?: Record<string, any>;
  creatorName?: string;
}

export async function sendDemandNotification(params: SendDemandNotificationParams) {
  try {
    const { data, error } = await supabase.functions.invoke('demand-notification', {
      body: params,
    });

    if (error) {
      console.error('Error sending demand notification:', error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Error invoking demand-notification function:', error);
    return { success: false, error };
  }
}

// Helper to send notification when user is assigned
export async function notifyDemandAssignment(
  organizationId: string,
  demandId: string,
  assignedUserIds: string[]
) {
  return sendDemandNotification({
    organizationId,
    demandId,
    notificationType: 'assignment',
    targetUserIds: assignedUserIds,
  });
}

// Helper to send notification when demand status changes
export async function notifyDemandStatusChange(
  organizationId: string,
  demandId: string,
  newColumnName: string
) {
  return sendDemandNotification({
    organizationId,
    demandId,
    notificationType: 'status_change',
    extraData: { newColumn: newColumnName },
  });
}

// Helper to send notification when comment is added
export async function notifyDemandComment(
  organizationId: string,
  demandId: string,
  commenterName: string
) {
  return sendDemandNotification({
    organizationId,
    demandId,
    notificationType: 'comment',
    extraData: { commenterName },
  });
}

// Helper to send notification when demand is updated
export async function notifyDemandUpdate(
  organizationId: string,
  demandId: string,
  targetUserIds: string[],
  updaterName: string,
  changes: string
) {
  return sendDemandNotification({
    organizationId,
    demandId,
    notificationType: 'update',
    targetUserIds,
    creatorName: updaterName,
    extraData: { changes },
  });
}
