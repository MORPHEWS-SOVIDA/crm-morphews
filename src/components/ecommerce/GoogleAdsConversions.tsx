import { useEffect } from 'react';

interface ConversionData {
  transactionId: string;
  value: number; // in cents
  currency?: string;
  items?: {
    id: string;
    name: string;
    quantity: number;
    price: number; // in cents
  }[];
}

interface GoogleAdsConfig {
  conversionId: string; // e.g., 'AW-123456789'
  conversionLabel?: string; // e.g., 'abc123'
}

declare global {
  interface Window {
    gtag: (...args: unknown[]) => void;
    dataLayer: unknown[];
  }
}

// Initialize Google Ads tracking
export function useGoogleAdsInit(conversionId: string | undefined) {
  useEffect(() => {
    if (!conversionId) return;

    // Check if gtag already loaded via GTM or GA
    if (!window.gtag) {
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${conversionId}`;
      document.head.appendChild(script);

      window.dataLayer = window.dataLayer || [];
      window.gtag = function gtag() {
        window.dataLayer.push(arguments);
      };
      window.gtag('js', new Date());
    }

    window.gtag('config', conversionId);
  }, [conversionId]);
}

// Track a conversion event
export function trackGoogleAdsConversion(
  config: GoogleAdsConfig,
  data: ConversionData
) {
  if (!window.gtag || !config.conversionId) return;

  const conversionParams: Record<string, unknown> = {
    send_to: config.conversionLabel 
      ? `${config.conversionId}/${config.conversionLabel}`
      : config.conversionId,
    transaction_id: data.transactionId,
    value: data.value / 100,
    currency: data.currency || 'BRL',
  };

  if (data.items && data.items.length > 0) {
    conversionParams.items = data.items.map(item => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      price: item.price / 100,
    }));
  }

  window.gtag('event', 'conversion', conversionParams);
  console.log('📊 Google Ads conversion tracked:', conversionParams);
}

// Track enhanced conversion with user data (for better attribution)
export function trackEnhancedConversion(
  config: GoogleAdsConfig,
  data: ConversionData,
  userData: {
    email?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  }
) {
  if (!window.gtag || !config.conversionId) return;

  // Hash PII data (Google handles hashing automatically when using gtag)
  const enhancedConversionData: Record<string, unknown> = {};
  
  if (userData.email) enhancedConversionData.email = userData.email.toLowerCase().trim();
  if (userData.phone) enhancedConversionData.phone_number = userData.phone.replace(/\D/g, '');
  if (userData.firstName) enhancedConversionData.first_name = userData.firstName.toLowerCase().trim();
  if (userData.lastName) enhancedConversionData.last_name = userData.lastName.toLowerCase().trim();
  if (userData.city) enhancedConversionData.city = userData.city.toLowerCase().trim();
  if (userData.state) enhancedConversionData.region = userData.state.toUpperCase();
  if (userData.country) enhancedConversionData.country = userData.country.toUpperCase();
  if (userData.postalCode) enhancedConversionData.postal_code = userData.postalCode.replace(/\D/g, '');

  // Set user data for enhanced conversions
  window.gtag('set', 'user_data', enhancedConversionData);

  // Then track the conversion
  trackGoogleAdsConversion(config, data);
}

// Component for automatic page-level conversion tracking
export function GoogleAdsConversionTracker({
  conversionId,
  conversionLabel,
  transactionId,
  value,
  currency = 'BRL',
}: {
  conversionId: string;
  conversionLabel?: string;
  transactionId: string;
  value: number;
  currency?: string;
}) {
  useGoogleAdsInit(conversionId);

  useEffect(() => {
    if (!conversionId || !transactionId) return;

    // Track conversion on mount
    trackGoogleAdsConversion(
      { conversionId, conversionLabel },
      { transactionId, value, currency }
    );
  }, [conversionId, conversionLabel, transactionId, value, currency]);

  return null;
}

// Helper to track purchase from checkout
export function trackPurchaseConversion(
  saleId: string,
  totalCents: number,
  items: { id: string; name: string; quantity: number; priceCents: number }[],
  config?: {
    googleAdsId?: string;
    googleAdsLabel?: string;
  }
) {
  // Track in Google Analytics (GA4)
  if (window.gtag) {
    window.gtag('event', 'purchase', {
      transaction_id: saleId,
      value: totalCents / 100,
      currency: 'BRL',
      items: items.map(item => ({
        item_id: item.id,
        item_name: item.name,
        quantity: item.quantity,
        price: item.priceCents / 100,
      })),
    });
  }

  // Track in Google Ads if configured
  if (config?.googleAdsId) {
    trackGoogleAdsConversion(
      { conversionId: config.googleAdsId, conversionLabel: config.googleAdsLabel },
      {
        transactionId: saleId,
        value: totalCents,
        items: items.map(item => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          price: item.priceCents,
        })),
      }
    );
  }
}
