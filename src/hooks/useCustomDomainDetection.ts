import { useEffect, useState } from 'react';

interface CustomDomainResult {
  isCustomDomain: boolean;
  storefrontSlug: string | null;
  whiteLabelSlug: string | null;
  domainType: 'storefront' | 'white-label' | null;
  isLoading: boolean;
}

// List of main app domains that should NOT trigger custom domain behavior
const MAIN_DOMAINS = [
  'localhost',
  '127.0.0.1',
  'lovable.app',
  'lovable.dev',
  'lovableproject.com',
  'morphews.com',
  'sales.morphews.com',
  'crm-morphews.lovable.app',
];

function isMainDomain(hostname: string): boolean {
  return MAIN_DOMAINS.some(domain => 
    hostname === domain || hostname.endsWith(`.${domain}`)
  );
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/**
 * Hook to detect if the current domain is a custom domain
 * and return the corresponding storefront or white-label slug.
 * Supports both storefront custom domains and white-label custom domains.
 */
export function useCustomDomainDetection(): CustomDomainResult {
  const [result, setResult] = useState<CustomDomainResult>({
    isCustomDomain: false,
    storefrontSlug: null,
    whiteLabelSlug: null,
    domainType: null,
    isLoading: true,
  });

  useEffect(() => {
    const hostname = window.location.hostname;
    
    // Skip detection for main domains
    if (isMainDomain(hostname)) {
      setResult({
        isCustomDomain: false,
        storefrontSlug: null,
        whiteLabelSlug: null,
        domainType: null,
        isLoading: false,
      });
      return;
    }

    async function detectDomain() {
      try {
        // First, check storefront_domains table for verified domain
        const domainResponse = await fetch(
          `${SUPABASE_URL}/rest/v1/storefront_domains?domain=eq.${encodeURIComponent(hostname)}&verified_at=not.is.null&select=storefront_id`,
          {
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
            },
          }
        );
        
        const domainData = await domainResponse.json();
        
        if (domainData && domainData.length > 0) {
          const storefrontId = domainData[0].storefront_id;
          
          // Get the storefront slug
          const storefrontResponse = await fetch(
            `${SUPABASE_URL}/rest/v1/tenant_storefronts?id=eq.${storefrontId}&is_active=eq.true&select=slug`,
            {
              headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
              },
            }
          );
          
          const storefrontData = await storefrontResponse.json();
          
          if (storefrontData && storefrontData.length > 0) {
            setResult({
              isCustomDomain: true,
              storefrontSlug: storefrontData[0].slug,
              whiteLabelSlug: null,
              domainType: 'storefront',
              isLoading: false,
            });
            return;
          }
        }

        // Second, check white_label_configs table for custom domain or app_domain
        // We check both custom_domain and app_domain fields
        const whiteLabelResponse = await fetch(
          `${SUPABASE_URL}/rest/v1/white_label_configs?or=(custom_domain.eq.${encodeURIComponent(hostname)},app_domain.eq.${encodeURIComponent(hostname)})&is_active=eq.true&select=sales_page_slug`,
          {
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
            },
          }
        );
        
        const whiteLabelData = await whiteLabelResponse.json();
        
        if (whiteLabelData && whiteLabelData.length > 0) {
          setResult({
            isCustomDomain: true,
            storefrontSlug: null,
            whiteLabelSlug: whiteLabelData[0].sales_page_slug,
            domainType: 'white-label',
            isLoading: false,
          });
          return;
        }

        // No matching domain found
        setResult({
          isCustomDomain: false,
          storefrontSlug: null,
          whiteLabelSlug: null,
          domainType: null,
          isLoading: false,
        });
      } catch (error) {
        console.error('Error detecting custom domain:', error);
        setResult({
          isCustomDomain: false,
          storefrontSlug: null,
          whiteLabelSlug: null,
          domainType: null,
          isLoading: false,
        });
      }
    }

    detectDomain();
  }, []);

  return result;
}
