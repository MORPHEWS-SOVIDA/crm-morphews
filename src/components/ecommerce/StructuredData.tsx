import { useEffect } from 'react';

interface ProductStructuredData {
  name: string;
  description?: string;
  image?: string | string[];
  sku?: string;
  brand?: string;
  price: number; // in cents
  priceCurrency?: string;
  availability?: 'InStock' | 'OutOfStock' | 'PreOrder';
  url?: string;
  reviewCount?: number;
  ratingValue?: number;
}

interface OrganizationStructuredData {
  name: string;
  logo?: string;
  url?: string;
  phone?: string;
  email?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  sameAs?: string[]; // Social media links
}

interface BreadcrumbItem {
  name: string;
  url: string;
}

interface FAQItem {
  question: string;
  answer: string;
}

interface StructuredDataProps {
  type: 'Product' | 'Organization' | 'BreadcrumbList' | 'FAQPage' | 'WebSite';
  product?: ProductStructuredData;
  organization?: OrganizationStructuredData;
  breadcrumbs?: BreadcrumbItem[];
  faqs?: FAQItem[];
  website?: {
    name: string;
    url: string;
    searchUrl?: string;
  };
}

export function StructuredData({ type, product, organization, breadcrumbs, faqs, website }: StructuredDataProps) {
  useEffect(() => {
    let jsonLd: Record<string, unknown> | null = null;

    switch (type) {
      case 'Product':
        if (product) {
          jsonLd = {
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: product.name,
            description: product.description,
            image: product.image,
            sku: product.sku,
            brand: product.brand ? {
              '@type': 'Brand',
              name: product.brand,
            } : undefined,
            offers: {
              '@type': 'Offer',
              price: (product.price / 100).toFixed(2),
              priceCurrency: product.priceCurrency || 'BRL',
              availability: `https://schema.org/${product.availability || 'InStock'}`,
              url: product.url,
            },
            ...(product.reviewCount && product.ratingValue ? {
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: product.ratingValue,
                reviewCount: product.reviewCount,
              },
            } : {}),
          };
        }
        break;

      case 'Organization':
        if (organization) {
          jsonLd = {
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: organization.name,
            logo: organization.logo,
            url: organization.url,
            telephone: organization.phone,
            email: organization.email,
            sameAs: organization.sameAs,
            ...(organization.address ? {
              address: {
                '@type': 'PostalAddress',
                streetAddress: organization.address.street,
                addressLocality: organization.address.city,
                addressRegion: organization.address.state,
                postalCode: organization.address.postalCode,
                addressCountry: organization.address.country || 'BR',
              },
            } : {}),
          };
        }
        break;

      case 'BreadcrumbList':
        if (breadcrumbs && breadcrumbs.length > 0) {
          jsonLd = {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: breadcrumbs.map((item, index) => ({
              '@type': 'ListItem',
              position: index + 1,
              name: item.name,
              item: item.url,
            })),
          };
        }
        break;

      case 'FAQPage':
        if (faqs && faqs.length > 0) {
          jsonLd = {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faqs.map(faq => ({
              '@type': 'Question',
              name: faq.question,
              acceptedAnswer: {
                '@type': 'Answer',
                text: faq.answer,
              },
            })),
          };
        }
        break;

      case 'WebSite':
        if (website) {
          jsonLd = {
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: website.name,
            url: website.url,
            ...(website.searchUrl ? {
              potentialAction: {
                '@type': 'SearchAction',
                target: {
                  '@type': 'EntryPoint',
                  urlTemplate: `${website.searchUrl}?q={search_term_string}`,
                },
                'query-input': 'required name=search_term_string',
              },
            } : {}),
          };
        }
        break;
    }

    if (jsonLd) {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.id = `structured-data-${type}`;
      script.textContent = JSON.stringify(jsonLd);
      
      // Remove existing script if present
      const existing = document.getElementById(`structured-data-${type}`);
      if (existing) existing.remove();
      
      document.head.appendChild(script);

      return () => {
        const toRemove = document.getElementById(`structured-data-${type}`);
        if (toRemove) toRemove.remove();
      };
    }
  }, [type, product, organization, breadcrumbs, faqs, website]);

  return null;
}

// Helper component for product pages
export function ProductStructuredData({ 
  product, 
  storeUrl 
}: { 
  product: ProductStructuredData; 
  storeUrl: string;
}) {
  return (
    <StructuredData
      type="Product"
      product={{
        ...product,
        url: product.url || `${storeUrl}/produto/${product.sku}`,
      }}
    />
  );
}

// Helper for landing pages with FAQ
export function LandingPageStructuredData({
  productName,
  productDescription,
  productImage,
  productPrice,
  faqs,
  organizationName,
  organizationLogo,
  pageUrl,
}: {
  productName: string;
  productDescription?: string;
  productImage?: string;
  productPrice: number;
  faqs?: FAQItem[];
  organizationName: string;
  organizationLogo?: string;
  pageUrl: string;
}) {
  return (
    <>
      <StructuredData
        type="Product"
        product={{
          name: productName,
          description: productDescription,
          image: productImage,
          price: productPrice,
          url: pageUrl,
          availability: 'InStock',
        }}
      />
      <StructuredData
        type="Organization"
        organization={{
          name: organizationName,
          logo: organizationLogo,
          url: pageUrl,
        }}
      />
      {faqs && faqs.length > 0 && (
        <StructuredData type="FAQPage" faqs={faqs} />
      )}
    </>
  );
}
