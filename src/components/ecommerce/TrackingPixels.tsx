import { useEffect } from 'react';

interface TrackingPixelsProps {
  facebookPixelId?: string | null;
  googleAnalyticsId?: string | null;
  tiktokPixelId?: string | null;
  gtmId?: string | null;
}

declare global {
  interface Window {
    fbq: (...args: unknown[]) => void;
    _fbq: unknown;
    gtag: (...args: unknown[]) => void;
    dataLayer: unknown[];
    ttq: {
      load: (id: string) => void;
      page: () => void;
      track: (event: string, data?: Record<string, unknown>) => void;
    };
  }
}

export function TrackingPixels({
  facebookPixelId,
  googleAnalyticsId,
  tiktokPixelId,
  gtmId,
}: TrackingPixelsProps) {
  // Facebook Pixel
  useEffect(() => {
    if (!facebookPixelId) return;

    // Skip if already loaded
    if (window.fbq) {
      window.fbq('init', facebookPixelId);
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
      fbq('init', '${facebookPixelId}');
      fbq('track', 'PageView');
    `;
    document.head.appendChild(script);

    // Noscript fallback
    const noscript = document.createElement('noscript');
    const img = document.createElement('img');
    img.height = 1;
    img.width = 1;
    img.style.display = 'none';
    img.src = `https://www.facebook.com/tr?id=${facebookPixelId}&ev=PageView&noscript=1`;
    noscript.appendChild(img);
    document.body.appendChild(noscript);

    return () => {
      document.head.removeChild(script);
      document.body.removeChild(noscript);
    };
  }, [facebookPixelId]);

  // Google Analytics 4
  useEffect(() => {
    if (!googleAnalyticsId) return;

    // Skip if already loaded
    if (window.gtag) {
      window.gtag('config', googleAnalyticsId);
      return;
    }

    const script1 = document.createElement('script');
    script1.async = true;
    script1.src = `https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsId}`;
    document.head.appendChild(script1);

    const script2 = document.createElement('script');
    script2.innerHTML = `
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${googleAnalyticsId}');
    `;
    document.head.appendChild(script2);

    return () => {
      document.head.removeChild(script1);
      document.head.removeChild(script2);
    };
  }, [googleAnalyticsId]);

  // TikTok Pixel
  useEffect(() => {
    if (!tiktokPixelId) return;

    const script = document.createElement('script');
    script.innerHTML = `
      !function (w, d, t) {
        w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
        ttq.load('${tiktokPixelId}');
        ttq.page();
      }(window, document, 'ttq');
    `;
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, [tiktokPixelId]);

  // Google Tag Manager
  useEffect(() => {
    if (!gtmId) return;

    const script = document.createElement('script');
    script.innerHTML = `
      (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
      new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
      j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
      'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
      })(window,document,'script','dataLayer','${gtmId}');
    `;
    document.head.appendChild(script);

    // Noscript fallback
    const noscript = document.createElement('noscript');
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.googletagmanager.com/ns.html?id=${gtmId}`;
    iframe.height = '0';
    iframe.width = '0';
    iframe.style.display = 'none';
    iframe.style.visibility = 'hidden';
    noscript.appendChild(iframe);
    document.body.insertBefore(noscript, document.body.firstChild);

    return () => {
      document.head.removeChild(script);
      document.body.removeChild(noscript);
    };
  }, [gtmId]);

  return null;
}

// Helper functions for tracking events
export const trackEvent = {
  // Facebook Pixel Events
  facebook: {
    viewContent: (data?: { content_name?: string; content_id?: string; value?: number; currency?: string }) => {
      if (window.fbq) window.fbq('track', 'ViewContent', data);
    },
    addToCart: (data?: { content_name?: string; content_id?: string; value?: number; currency?: string }) => {
      if (window.fbq) window.fbq('track', 'AddToCart', data);
    },
    initiateCheckout: (data?: { value?: number; currency?: string; num_items?: number }) => {
      if (window.fbq) window.fbq('track', 'InitiateCheckout', data);
    },
    purchase: (data?: { value?: number; currency?: string; content_ids?: string[] }) => {
      if (window.fbq) window.fbq('track', 'Purchase', data);
    },
    lead: (data?: { content_name?: string; value?: number }) => {
      if (window.fbq) window.fbq('track', 'Lead', data);
    },
  },
  
  // Google Analytics Events
  google: {
    event: (eventName: string, params?: Record<string, unknown>) => {
      if (window.gtag) window.gtag('event', eventName, params);
    },
    purchase: (data: { transaction_id: string; value: number; currency?: string; items?: unknown[] }) => {
      if (window.gtag) window.gtag('event', 'purchase', data);
    },
    beginCheckout: (data?: { value?: number; currency?: string; items?: unknown[] }) => {
      if (window.gtag) window.gtag('event', 'begin_checkout', data);
    },
    addToCart: (data?: { currency?: string; value?: number; items?: unknown[] }) => {
      if (window.gtag) window.gtag('event', 'add_to_cart', data);
    },
  },

  // TikTok Pixel Events
  tiktok: {
    viewContent: (data?: { content_id?: string; content_name?: string; value?: number; currency?: string }) => {
      if (window.ttq) window.ttq.track('ViewContent', data);
    },
    addToCart: (data?: { content_id?: string; content_name?: string; value?: number; currency?: string }) => {
      if (window.ttq) window.ttq.track('AddToCart', data);
    },
    initiateCheckout: (data?: { value?: number; currency?: string }) => {
      if (window.ttq) window.ttq.track('InitiateCheckout', data);
    },
    completePayment: (data?: { value?: number; currency?: string; content_id?: string }) => {
      if (window.ttq) window.ttq.track('CompletePayment', data);
    },
  },
};
