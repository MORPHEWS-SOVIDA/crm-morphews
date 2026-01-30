import { useEffect, useState } from 'react';

interface CustomDomainResult {
  isCustomDomain: boolean;
  storefrontSlug: string | null;
  isLoading: boolean;
}

// List of main app domains that should NOT trigger custom domain behavior
const MAIN_DOMAINS = [
  'localhost',
  '127.0.0.1',
  'lovable.app',
  'lovable.dev',
  'lovableproject.com',
];

function isMainDomain(hostname: string): boolean {
  return MAIN_DOMAINS.some(domain => 
    hostname === domain || hostname.endsWith(`.${domain}`)
  );
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/**
 * Hook to detect if the current domain is a custom storefront domain
 * and return the corresponding storefront slug.
 * Uses direct fetch to avoid TypeScript recursion issues with Supabase types.
 */
export function useCustomDomainDetection(): CustomDomainResult {
  const [result, setResult] = useState<CustomDomainResult>({
    isCustomDomain: false,
    storefrontSlug: null,
    isLoading: true,
  });

  useEffect(() => {
    const hostname = window.location.hostname;
    
    // Skip detection for main domains
    if (isMainDomain(hostname)) {
      setResult({
        isCustomDomain: false,
        storefrontSlug: null,
        isLoading: false,
      });
      return;
    }

    async function detectDomain() {
      try {
        // Check storefront_domains table for verified domain (verified_at is not null)
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
              isLoading: false,
            });
            return;
          }
        }

        // No matching domain found
        setResult({
          isCustomDomain: false,
          storefrontSlug: null,
          isLoading: false,
        });
      } catch (error) {
        console.error('Error detecting custom domain:', error);
        setResult({
          isCustomDomain: false,
          storefrontSlug: null,
          isLoading: false,
        });
      }
    }

    detectDomain();
  }, []);

  return result;
}
