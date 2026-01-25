import { useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import '@/types/tracking.d.ts';

// ============================================================
// UNIVERSAL TRACKING HOOK
// Hybrid tracking: Client-Side Pixels + Server-Side CAPI
// Works across: Landing Pages, Storefronts, Standalone Checkouts
// ============================================================

interface TrackingConfig {
  organizationId: string;
  facebookPixelId?: string | null;
  googleAnalyticsId?: string | null;
  tiktokPixelId?: string | null;
  // Source identification
  source: 'landing_page' | 'storefront' | 'standalone_checkout' | 'quiz';
  sourceId?: string; // landing_page_id, storefront_id, checkout_id
  sourceName?: string;
}

interface CustomerData {
  name?: string;
  email?: string;
  phone?: string;
  document?: string;
}

interface TrackingParams {
  fbclid?: string;
  gclid?: string;
  ttclid?: string;
  fbc?: string;
  fbp?: string;
}

// Get Facebook cookies for attribution
function getFacebookCookies(): { fbc?: string; fbp?: string } {
  if (typeof document === 'undefined') return {};
  
  const cookies = document.cookie.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    acc[key] = value;
    return acc;
  }, {} as Record<string, string>);
  
  return {
    fbc: cookies['_fbc'],
    fbp: cookies['_fbp'],
  };
}

// Extract tracking params from URL
export function extractTrackingParams(): TrackingParams {
  if (typeof window === 'undefined') return {};
  
  const params = new URLSearchParams(window.location.search);
  const { fbc, fbp } = getFacebookCookies();
  
  return {
    fbclid: params.get('fbclid') || undefined,
    gclid: params.get('gclid') || undefined,
    ttclid: params.get('ttclid') || undefined,
    fbc,
    fbp,
  };
}

// Generate unique event ID for deduplication
function generateEventId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function useUniversalTracking(config: TrackingConfig) {
  const trackingParams = useMemo(() => extractTrackingParams(), []);

  // Send event to server-side (CAPI)
  const sendServerSideEvent = useCallback(async (
    eventType: 'ViewContent' | 'Lead' | 'InitiateCheckout' | 'AddPaymentInfo' | 'Purchase',
    eventId: string,
    extraData?: {
      customer?: CustomerData;
      valueCents?: number;
      currency?: string;
      saleId?: string;
      contentName?: string;
      contentCategory?: string;
    }
  ) => {
    try {
      const payload = {
        organization_id: config.organizationId,
        source: config.source,
        source_id: config.sourceId,
        source_name: config.sourceName,
        event_type: eventType,
        event_id: eventId,
        // Customer data (will be hashed server-side)
        email: extraData?.customer?.email,
        phone: extraData?.customer?.phone,
        name: extraData?.customer?.name,
        // Tracking IDs
        fbclid: trackingParams.fbclid,
        gclid: trackingParams.gclid,
        ttclid: trackingParams.ttclid,
        fbc: trackingParams.fbc,
        fbp: trackingParams.fbp,
        // Client info
        client_user_agent: navigator.userAgent,
        event_source_url: window.location.href,
        // Transaction data
        value_cents: extraData?.valueCents,
        currency: extraData?.currency || 'BRL',
        sale_id: extraData?.saleId,
        content_name: extraData?.contentName || config.sourceName,
        content_category: extraData?.contentCategory || config.source,
      };

      const response = await supabase.functions.invoke('universal-tracking', {
        body: payload,
      });

      if (response.error) {
        console.error('Server-side tracking error:', response.error);
      } else {
        console.log('Server-side tracking sent:', eventType, response.data);
      }
    } catch (error) {
      console.error('Server-side tracking exception:', error);
    }
  }, [config, trackingParams]);

  // Track ViewContent (page/product view)
  const trackViewContent = useCallback((contentName?: string, valueCents?: number) => {
    const eventId = generateEventId('view');

    // Client-side
    if (window.fbq && config.facebookPixelId) {
      window.fbq('track', 'ViewContent', {
        content_name: contentName || config.sourceName,
        content_category: config.source,
        eventID: eventId,
      });
    }
    if (window.gtag && config.googleAnalyticsId) {
      window.gtag('event', 'view_item', {
        content_name: contentName || config.sourceName,
        source: config.source,
      });
    }
    if (window.ttq && config.tiktokPixelId) {
      window.ttq.track('ViewContent', {
        content_name: contentName || config.sourceName,
        content_type: config.source,
      });
    }

    // Server-side
    sendServerSideEvent('ViewContent', eventId, {
      contentName,
      valueCents,
    });
  }, [config, sendServerSideEvent]);

  // Track Lead capture
  const trackLead = useCallback((customer: CustomerData) => {
    const eventId = generateEventId('lead');

    // Client-side
    if (window.fbq && config.facebookPixelId) {
      window.fbq('track', 'Lead', {
        content_name: config.sourceName,
        eventID: eventId,
      });
    }
    if (window.gtag && config.googleAnalyticsId) {
      window.gtag('event', 'generate_lead', {
        source: config.source,
      });
    }
    if (window.ttq && config.tiktokPixelId) {
      window.ttq.track('SubmitForm', {
        content_name: config.sourceName,
      });
    }

    // Server-side (with PII for hashing)
    sendServerSideEvent('Lead', eventId, { customer });
  }, [config, sendServerSideEvent]);

  // Track InitiateCheckout
  const trackInitiateCheckout = useCallback((
    customer: CustomerData,
    valueCents: number,
    options?: { contentName?: string }
  ) => {
    const eventId = generateEventId('checkout');

    // Client-side
    if (window.fbq && config.facebookPixelId) {
      window.fbq('track', 'InitiateCheckout', {
        content_name: options?.contentName || config.sourceName,
        value: valueCents / 100,
        currency: 'BRL',
        eventID: eventId,
      });
    }
    if (window.gtag && config.googleAnalyticsId) {
      window.gtag('event', 'begin_checkout', {
        value: valueCents / 100,
        currency: 'BRL',
      });
    }
    if (window.ttq && config.tiktokPixelId) {
      window.ttq.track('InitiateCheckout', {
        content_name: options?.contentName || config.sourceName,
        value: valueCents / 100,
        currency: 'BRL',
      });
    }

    // Server-side
    sendServerSideEvent('InitiateCheckout', eventId, {
      customer,
      valueCents,
      contentName: options?.contentName,
    });

    return eventId;
  }, [config, sendServerSideEvent]);

  // Track AddPaymentInfo (when user fills payment form)
  const trackAddPaymentInfo = useCallback((
    customer: CustomerData,
    valueCents: number,
    paymentMethod: string
  ) => {
    const eventId = generateEventId('payment');

    // Client-side
    if (window.fbq && config.facebookPixelId) {
      window.fbq('track', 'AddPaymentInfo', {
        content_name: config.sourceName,
        value: valueCents / 100,
        currency: 'BRL',
        eventID: eventId,
      });
    }
    if (window.gtag && config.googleAnalyticsId) {
      window.gtag('event', 'add_payment_info', {
        value: valueCents / 100,
        currency: 'BRL',
        payment_type: paymentMethod,
      });
    }
    if (window.ttq && config.tiktokPixelId) {
      window.ttq.track('AddPaymentInfo', {
        content_name: config.sourceName,
        value: valueCents / 100,
        currency: 'BRL',
      });
    }

    // Server-side
    sendServerSideEvent('AddPaymentInfo', eventId, {
      customer,
      valueCents,
      contentCategory: paymentMethod,
    });
  }, [config, sendServerSideEvent]);

  // Track Purchase (called from webhook, but can also be called client-side for immediate feedback)
  const trackPurchase = useCallback((
    customer: CustomerData,
    valueCents: number,
    saleId: string
  ) => {
    const eventId = generateEventId('purchase');

    // Client-side (immediate feedback)
    if (window.fbq && config.facebookPixelId) {
      window.fbq('track', 'Purchase', {
        content_name: config.sourceName,
        value: valueCents / 100,
        currency: 'BRL',
        eventID: eventId,
      });
    }
    if (window.gtag && config.googleAnalyticsId) {
      window.gtag('event', 'purchase', {
        value: valueCents / 100,
        currency: 'BRL',
        transaction_id: saleId,
      });
    }
    if (window.ttq && config.tiktokPixelId) {
      window.ttq.track('CompletePayment', {
        content_name: config.sourceName,
        value: valueCents / 100,
        currency: 'BRL',
      });
    }

    // Server-side
    sendServerSideEvent('Purchase', eventId, {
      customer,
      valueCents,
      saleId,
    });
  }, [config, sendServerSideEvent]);

  // Get tracking params for checkout payload
  const getTrackingParams = useCallback(() => trackingParams, [trackingParams]);

  return {
    trackViewContent,
    trackLead,
    trackInitiateCheckout,
    trackAddPaymentInfo,
    trackPurchase,
    getTrackingParams,
    trackingParams,
  };
}
