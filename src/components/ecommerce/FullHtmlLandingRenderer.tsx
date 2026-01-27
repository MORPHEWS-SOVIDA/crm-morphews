import { useState, useEffect, useRef, useCallback } from 'react';
import { LandingCheckoutModal } from './LandingCheckoutModal';

interface LandingOffer {
  id: string;
  quantity: number;
  label: string;
  price_cents: number;
  original_price_cents: number | null;
  discount_percentage: number | null;
  badge_text: string | null;
  is_highlighted: boolean;
  display_order: number;
}

interface LandingPageData {
  id: string;
  organization_id: string;
  product_id: string;
  name: string;
  slug: string;
  full_html: string;
  checkout_selectors: string[];
  offers: LandingOffer[];
  product?: {
    id: string;
    name: string;
    base_price_cents?: number;
    price_1_unit?: number;
    image_url: string | null;
  } | null;
  facebook_pixel_id?: string | null;
  google_analytics_id?: string | null;
  settings?: Record<string, unknown>;
}

interface FullHtmlLandingRendererProps {
  landing: LandingPageData;
}

/**
 * Renders cloned landing pages using their original HTML/CSS.
 * Injects a script to intercept clicks on checkout selectors and opens our modal.
 */
export function FullHtmlLandingRenderer({ landing }: FullHtmlLandingRendererProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<LandingOffer | null>(null);

  // Auto-select highlighted or first offer
  useEffect(() => {
    if (landing.offers.length > 0 && !selectedOffer) {
      const highlighted = landing.offers.find(o => o.is_highlighted);
      setSelectedOffer(highlighted || landing.offers[0]);
    }
  }, [landing.offers, selectedOffer]);

  // Handle checkout trigger from iframe
  const handleCheckoutTrigger = useCallback(() => {
    setCheckoutOpen(true);
  }, []);

  // Listen for messages from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'MORPHEWS_CHECKOUT_TRIGGER') {
        handleCheckoutTrigger();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleCheckoutTrigger]);

  // Prepare HTML with injected checkout script
  const prepareHtmlWithCheckoutScript = useCallback((html: string, selectors: string[]): string => {
    // Build selector list for the script
    const selectorsJson = JSON.stringify(selectors);
    
    // Script to inject that captures clicks on checkout elements
    const checkoutScript = `
<script>
(function() {
  'use strict';
  
  var selectors = ${selectorsJson};
  
  function matchesSelector(element, selector) {
    try {
      // Handle :contains() pseudo-selector (jQuery-style, not native)
      if (selector.includes(':contains(')) {
        var match = selector.match(/(.+):contains\\(["']?([^"'\\)]+)["']?\\)/);
        if (match) {
          var baseSelector = match[1];
          var text = match[2].toLowerCase();
          if (element.matches && element.matches(baseSelector)) {
            return element.textContent.toLowerCase().includes(text);
          }
          return false;
        }
      }
      
      return element.matches && element.matches(selector);
    } catch (e) {
      // Invalid selector, skip
      return false;
    }
  }
  
  function shouldInterceptClick(element) {
    for (var i = 0; i < selectors.length; i++) {
      if (matchesSelector(element, selectors[i])) {
        return true;
      }
    }
    
    // Also check parent elements (for nested content inside buttons/links)
    var parent = element.parentElement;
    var depth = 0;
    while (parent && depth < 5) {
      for (var j = 0; j < selectors.length; j++) {
        if (matchesSelector(parent, selectors[j])) {
          return true;
        }
      }
      parent = parent.parentElement;
      depth++;
    }
    
    return false;
  }
  
  function interceptClicks(event) {
    var target = event.target;
    
    if (shouldInterceptClick(target)) {
      event.preventDefault();
      event.stopPropagation();
      
      // Send message to parent window to open checkout
      window.parent.postMessage({ type: 'MORPHEWS_CHECKOUT_TRIGGER' }, '*');
      return false;
    }
  }
  
  // Use capture phase to intercept before any other handlers
  document.addEventListener('click', interceptClicks, true);
  
  // Also prevent default navigation on links
  document.querySelectorAll('a').forEach(function(link) {
    var href = link.getAttribute('href') || '';
    
    // Block external links and checkout-related links
    if (href.includes('checkout') || 
        href.includes('comprar') || 
        href.includes('carrinho') ||
        href.includes('cart') ||
        href.startsWith('http') && !href.includes(window.location.hostname)) {
      link.addEventListener('click', function(e) {
        e.preventDefault();
        window.parent.postMessage({ type: 'MORPHEWS_CHECKOUT_TRIGGER' }, '*');
      });
    }
  });
  
  console.log('[Morphews] Checkout interceptor loaded with selectors:', selectors);
})();
</script>
`;

    // Find where to inject the script (before </body> or at the end)
    if (html.includes('</body>')) {
      return html.replace('</body>', checkoutScript + '</body>');
    } else if (html.includes('</html>')) {
      return html.replace('</html>', checkoutScript + '</html>');
    } else {
      return html + checkoutScript;
    }
  }, []);

  // Default selectors if none configured
  const effectiveSelectors = landing.checkout_selectors?.length > 0 
    ? landing.checkout_selectors 
    : [
        'a[href*="comprar"]',
        'a[href*="checkout"]', 
        'a[href*="carrinho"]',
        'a[href*="cart"]',
        '.elementor-button',
        'button',
        '[class*="btn"]',
        '[class*="button"]',
      ];

  const preparedHtml = prepareHtmlWithCheckoutScript(landing.full_html, effectiveSelectors);

  // Create a landing page object compatible with the modal
  const landingForModal = {
    id: landing.id,
    organization_id: landing.organization_id,
    product_id: landing.product_id,
    name: landing.name,
    slug: landing.slug,
    headline: null,
    subheadline: null,
    video_url: null,
    benefits: [],
    testimonials: [],
    faq: [],
    urgency_text: null,
    guarantee_text: null,
    logo_url: null,
    primary_color: '#000000',
    whatsapp_number: null,
    facebook_pixel_id: landing.facebook_pixel_id || null,
    google_analytics_id: landing.google_analytics_id || null,
    custom_css: null,
    settings: (landing.settings || {}) as {
      timer_enabled?: boolean;
      timer_end_date?: string;
      timer_label?: string;
      show_stock_counter?: boolean;
      stock_remaining?: number;
      tiktok_pixel_id?: string;
      gtm_id?: string;
      checkout_style?: 'modal' | 'page';
    },
    offers: landing.offers,
    product: landing.product || null,
  };

  return (
    <>
      {/* Full-screen iframe rendering the original site */}
      <iframe
        ref={iframeRef}
        srcDoc={preparedHtml}
        title={landing.name}
        className="w-full min-h-screen border-0"
        style={{ height: '100vh' }}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />

      {/* Checkout Modal */}
      {selectedOffer && (
        <LandingCheckoutModal
          open={checkoutOpen}
          onOpenChange={setCheckoutOpen}
          landingPage={landingForModal}
          offer={selectedOffer}
        />
      )}
    </>
  );
}
