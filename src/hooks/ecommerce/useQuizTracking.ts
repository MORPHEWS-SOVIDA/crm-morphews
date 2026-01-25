import { useEffect, useCallback } from 'react';
import type { Quiz } from './useQuizzes';
import '@/types/tracking.d.ts';

interface UseQuizTrackingOptions {
  quiz: Quiz | null | undefined;
}

export function useQuizTracking({ quiz }: UseQuizTrackingOptions) {
  // Initialize Facebook Pixel
  useEffect(() => {
    if (!quiz?.facebook_pixel_id) return;
    
    const pixelId = quiz.facebook_pixel_id;
    
    // Check if already loaded
    if (window.fbq) {
      window.fbq('init', pixelId);
      window.fbq('track', 'PageView');
      return;
    }

    // Load Facebook Pixel script
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

  // Initialize Google Analytics
  useEffect(() => {
    if (!quiz?.google_analytics_id) return;

    const gaId = quiz.google_analytics_id;

    // Check if already loaded
    if (window.gtag) {
      window.gtag('config', gaId);
      return;
    }

    // Load Google Analytics script
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

  // Initialize TikTok Pixel
  useEffect(() => {
    if (!quiz?.tiktok_pixel_id) return;

    const ttId = quiz.tiktok_pixel_id;

    // Check if already loaded
    if (window.ttq) {
      window.ttq.page();
      return;
    }

    // Load TikTok Pixel script
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

  // Track Quiz Start
  const trackQuizStart = useCallback(() => {
    if (window.fbq) {
      window.fbq('track', 'ViewContent', {
        content_name: quiz?.name,
        content_category: 'Quiz',
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
  }, [quiz?.name]);

  // Track Step View
  const trackStepView = useCallback((stepIndex: number, stepTitle: string) => {
    if (window.gtag) {
      window.gtag('event', 'quiz_step_view', {
        quiz_name: quiz?.name,
        step_index: stepIndex,
        step_title: stepTitle,
      });
    }
  }, [quiz?.name]);

  // Track Lead Capture
  const trackLeadCapture = useCallback((leadData: { name?: string; email?: string; whatsapp?: string }) => {
    if (window.fbq) {
      window.fbq('track', 'Lead', {
        content_name: quiz?.name,
        ...leadData,
      });
    }
    if (window.gtag) {
      window.gtag('event', 'generate_lead', {
        quiz_name: quiz?.name,
        ...leadData,
      });
    }
    if (window.ttq) {
      window.ttq.track('SubmitForm', {
        content_name: quiz?.name,
      });
    }
  }, [quiz?.name]);

  // Track Quiz Complete
  const trackQuizComplete = useCallback((totalScore?: number) => {
    if (window.fbq) {
      window.fbq('track', 'CompleteRegistration', {
        content_name: quiz?.name,
        value: totalScore,
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
  }, [quiz?.name]);

  // Track CTA Click
  const trackCtaClick = useCallback((ctaText?: string, ctaUrl?: string) => {
    if (window.fbq) {
      window.fbq('track', 'InitiateCheckout', {
        content_name: quiz?.name,
        content_category: ctaText,
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
      window.ttq.track('ClickButton', {
        content_name: quiz?.name,
        description: ctaText,
      });
    }
  }, [quiz?.name]);

  return {
    trackQuizStart,
    trackStepView,
    trackLeadCapture,
    trackQuizComplete,
    trackCtaClick,
  };
}
