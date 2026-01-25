import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Quiz } from './useQuizzes';
import '@/types/tracking.d.ts';

interface UseQuizTrackingOptions {
  quiz: Quiz | null | undefined;
  sessionId?: string;
  leadData?: {
    name?: string;
    email?: string;
    whatsapp?: string;
  };
  trackingParams?: {
    fbclid?: string;
    gclid?: string;
    ttclid?: string;
  };
}

// Função para obter cookies de tracking do Facebook
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

// Gerar event_id único para deduplicação
function generateEventId(sessionId: string, eventType: string): string {
  return `${sessionId}_${eventType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function useQuizTracking({ quiz, sessionId, leadData, trackingParams }: UseQuizTrackingOptions) {
  const initializedRef = useRef(false);

  // Initialize Facebook Pixel (client-side)
  useEffect(() => {
    if (!quiz?.facebook_pixel_id) return;
    
    const pixelId = quiz.facebook_pixel_id;
    
    if (window.fbq) {
      window.fbq('init', pixelId);
      window.fbq('track', 'PageView');
      return;
    }

    const script = document.createElement('script');
    script.innerHTML = `
      !function(f,b,e,v,n,t,s)
      {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};
      if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
      n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t,s)}(window, document,'script',
      'https://connect.facebook.net/en_US/fbevents.js');
      fbq('init', '${pixelId}');
      fbq('track', 'PageView');
    `;
    document.head.appendChild(script);

    return () => {
      script.remove();
    };
  }, [quiz?.facebook_pixel_id]);

  // Initialize Google Analytics (client-side)
  useEffect(() => {
    if (!quiz?.google_analytics_id) return;

    const gaId = quiz.google_analytics_id;

    if (window.gtag) {
      window.gtag('config', gaId);
      return;
    }

    const script1 = document.createElement('script');
    script1.async = true;
    script1.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
    document.head.appendChild(script1);

    const script2 = document.createElement('script');
    script2.innerHTML = `
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${gaId}');
    `;
    document.head.appendChild(script2);

    return () => {
      script1.remove();
      script2.remove();
    };
  }, [quiz?.google_analytics_id]);

  // Initialize TikTok Pixel (client-side)
  useEffect(() => {
    if (!quiz?.tiktok_pixel_id) return;

    const ttId = quiz.tiktok_pixel_id;

    if (window.ttq) {
      window.ttq.page();
      return;
    }

    const script = document.createElement('script');
    script.innerHTML = `
      !function (w, d, t) {
        w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
        ttq.load('${ttId}');
        ttq.page();
      }(window, document, 'ttq');
    `;
    document.head.appendChild(script);

    return () => {
      script.remove();
    };
  }, [quiz?.tiktok_pixel_id]);

  // Envia evento para server-side (CAPI/Events API)
  const sendServerSideEvent = useCallback(async (
    eventType: 'ViewContent' | 'Lead' | 'CompleteRegistration' | 'InitiateCheckout',
    extraData?: Record<string, unknown>
  ) => {
    if (!quiz || !sessionId) return;

    const { fbc, fbp } = getFacebookCookies();
    const eventId = generateEventId(sessionId, eventType);

    try {
      const payload = {
        quiz_id: quiz.id,
        session_id: sessionId,
        organization_id: quiz.organization_id,
        event_type: eventType,
        event_id: eventId,
        // Lead data
        email: leadData?.email,
        phone: leadData?.whatsapp,
        name: leadData?.name,
        // Tracking IDs
        fbclid: trackingParams?.fbclid,
        gclid: trackingParams?.gclid,
        ttclid: trackingParams?.ttclid,
        fbc,
        fbp,
        // Client info
        client_user_agent: navigator.userAgent,
        event_source_url: window.location.href,
        // Extra
        quiz_name: quiz.name,
        ...extraData,
      };

      // Enviar para edge function
      const response = await supabase.functions.invoke('quiz-tracking', {
        body: payload,
      });

      if (response.error) {
        console.error('Server-side tracking error:', response.error);
      } else {
        console.log('Server-side tracking sent:', eventType, response.data);
      }

      return eventId;
    } catch (error) {
      console.error('Server-side tracking exception:', error);
    }
  }, [quiz, sessionId, leadData, trackingParams]);

  // Track Quiz Start (client + server)
  const trackQuizStart = useCallback(() => {
    const eventId = generateEventId(sessionId || 'unknown', 'ViewContent');

    // Client-side
    if (window.fbq) {
      window.fbq('track', 'ViewContent', {
        content_name: quiz?.name,
        content_category: 'Quiz',
        eventID: eventId, // Para deduplicação
      });
    }
    if (window.gtag) {
      window.gtag('event', 'quiz_start', {
        quiz_name: quiz?.name,
      });
    }
    if (window.ttq) {
      window.ttq.track('ViewContent', {
        content_name: quiz?.name,
        content_type: 'quiz',
      });
    }

    // Server-side
    sendServerSideEvent('ViewContent');
  }, [quiz?.name, sessionId, sendServerSideEvent]);

  // Track Step View (client only - menos importante para server)
  const trackStepView = useCallback((stepIndex: number, stepTitle: string) => {
    if (window.gtag) {
      window.gtag('event', 'quiz_step_view', {
        quiz_name: quiz?.name,
        step_index: stepIndex,
        step_title: stepTitle,
      });
    }
  }, [quiz?.name]);

  // Track Lead Capture (client + server - CRÍTICO)
  const trackLeadCapture = useCallback((capturedData: { name?: string; email?: string; whatsapp?: string }) => {
    const eventId = generateEventId(sessionId || 'unknown', 'Lead');

    // Client-side
    if (window.fbq) {
      window.fbq('track', 'Lead', {
        content_name: quiz?.name,
        eventID: eventId,
      });
    }
    if (window.gtag) {
      window.gtag('event', 'generate_lead', {
        quiz_name: quiz?.name,
      });
    }
    if (window.ttq) {
      window.ttq.track('SubmitForm', {
        content_name: quiz?.name,
      });
    }

    // Server-side com dados do lead (MAIS IMPORTANTE)
    sendServerSideEvent('Lead', {
      email: capturedData.email,
      phone: capturedData.whatsapp,
      name: capturedData.name,
    });
  }, [quiz?.name, sessionId, sendServerSideEvent]);

  // Track Quiz Complete (client + server)
  const trackQuizComplete = useCallback((totalScore?: number) => {
    const eventId = generateEventId(sessionId || 'unknown', 'CompleteRegistration');

    // Client-side
    if (window.fbq) {
      window.fbq('track', 'CompleteRegistration', {
        content_name: quiz?.name,
        value: totalScore,
        eventID: eventId,
      });
    }
    if (window.gtag) {
      window.gtag('event', 'quiz_complete', {
        quiz_name: quiz?.name,
        score: totalScore,
      });
    }
    if (window.ttq) {
      window.ttq.track('CompleteRegistration', {
        content_name: quiz?.name,
      });
    }

    // Server-side
    sendServerSideEvent('CompleteRegistration', { total_score: totalScore });
  }, [quiz?.name, sessionId, sendServerSideEvent]);

  // Track CTA Click (client + server)
  const trackCtaClick = useCallback((ctaText?: string, ctaUrl?: string, valueCents?: number) => {
    const eventId = generateEventId(sessionId || 'unknown', 'InitiateCheckout');

    // Client-side
    if (window.fbq) {
      window.fbq('track', 'InitiateCheckout', {
        content_name: quiz?.name,
        content_category: ctaText,
        eventID: eventId,
      });
    }
    if (window.gtag) {
      window.gtag('event', 'cta_click', {
        quiz_name: quiz?.name,
        cta_text: ctaText,
        cta_url: ctaUrl,
      });
    }
    if (window.ttq) {
      window.ttq.track('InitiateCheckout', {
        content_name: quiz?.name,
        description: ctaText,
      });
    }

    // Server-side
    sendServerSideEvent('InitiateCheckout', { 
      step_title: ctaText,
      value_cents: valueCents,
    });
  }, [quiz?.name, sessionId, sendServerSideEvent]);

  return {
    trackQuizStart,
    trackStepView,
    trackLeadCapture,
    trackQuizComplete,
    trackCtaClick,
    sendServerSideEvent,
  };
}
