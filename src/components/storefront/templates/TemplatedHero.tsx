import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ChevronRight, Play } from 'lucide-react';
import { getTemplateStyles, type TemplateStyleKey } from './templateUtils';

interface TemplatedHeroProps {
  templateSlug?: string | null;
  title?: string;
  subtitle?: string;
  ctaText?: string;
  ctaLink?: string;
  secondaryCtaText?: string;
  secondaryCtaLink?: string;
  imageUrl?: string;
  videoUrl?: string;
  primaryColor?: string;
  overlayOpacity?: number;
}

export function TemplatedHero({
  templateSlug,
  title = 'Descubra produtos incríveis',
  subtitle = 'Qualidade premium para você e sua família',
  ctaText = 'Ver Produtos',
  ctaLink = '#produtos',
  secondaryCtaText,
  secondaryCtaLink,
  imageUrl,
  videoUrl,
  primaryColor,
  overlayOpacity = 0.5,
}: TemplatedHeroProps) {
  const styles = getTemplateStyles(templateSlug);
  
  // Different hero layouts based on template
  if (templateSlug === 'minimal-clean') {
    return (
      <MinimalHero 
        styles={styles}
        title={title}
        subtitle={subtitle}
        ctaText={ctaText}
        ctaLink={ctaLink}
        imageUrl={imageUrl}
      />
    );
  }
  
  if (templateSlug === 'vitrine-moderna') {
    return (
      <ModernHero 
        styles={styles}
        title={title}
        subtitle={subtitle}
        ctaText={ctaText}
        ctaLink={ctaLink}
        imageUrl={imageUrl}
        primaryColor={primaryColor}
      />
    );
  }
  
  if (templateSlug === 'premium-saude') {
    return (
      <PremiumHero 
        styles={styles}
        title={title}
        subtitle={subtitle}
        ctaText={ctaText}
        ctaLink={ctaLink}
        secondaryCtaText={secondaryCtaText}
        secondaryCtaLink={secondaryCtaLink}
        imageUrl={imageUrl}
      />
    );
  }

  // Default hero
  return (
    <DefaultHero 
      styles={styles}
      title={title}
      subtitle={subtitle}
      ctaText={ctaText}
      ctaLink={ctaLink}
      imageUrl={imageUrl}
      primaryColor={primaryColor}
    />
  );
}

// Minimal Clean Hero - Stanley's style
function MinimalHero({ styles, title, subtitle, ctaText, ctaLink, imageUrl }: any) {
  return (
    <section className="relative min-h-[70vh] flex items-center">
      {/* Split layout */}
      <div className="container mx-auto px-4 grid md:grid-cols-2 gap-8 items-center">
        {/* Text side */}
        <div className="space-y-6 order-2 md:order-1">
          <h1 className={styles.heroTitle}>
            {title}
          </h1>
          <p className={styles.heroSubtitle}>
            {subtitle}
          </p>
          <Link to={ctaLink}>
            <Button className={`${styles.button} px-8 py-6 text-base`}>
              {ctaText}
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
        
        {/* Image side */}
        <div className="order-1 md:order-2">
          {imageUrl ? (
            <img 
              src={imageUrl} 
              alt={title}
              className="w-full h-[400px] md:h-[500px] object-cover"
            />
          ) : (
            <div className="w-full h-[400px] md:h-[500px] bg-neutral-100" />
          )}
        </div>
      </div>
    </section>
  );
}

// Modern/Vibrant Hero - Gummy style
function ModernHero({ styles, title, subtitle, ctaText, ctaLink, imageUrl, primaryColor }: any) {
  return (
    <section className={`relative min-h-[80vh] flex items-center ${styles.hero}`}>
      <div className="container mx-auto px-4 py-16 text-center">
        <div className="max-w-3xl mx-auto space-y-6">
          <h1 className={styles.heroTitle}>
            {title}
          </h1>
          <p className={styles.heroSubtitle}>
            {subtitle}
          </p>
          
          {/* Animated CTA */}
          <div className="pt-4">
            <Link to={ctaLink}>
              <Button 
                size="lg" 
                className={`${styles.button} px-10 py-6 text-lg animate-pulse`}
              >
                {ctaText}
                <ChevronRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>

          {/* Floating product images */}
          {imageUrl && (
            <div className="relative pt-8">
              <img 
                src={imageUrl} 
                alt={title}
                className="mx-auto h-[300px] object-contain drop-shadow-2xl"
              />
            </div>
          )}
        </div>
      </div>
      
      {/* Decorative blobs */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob" />
      <div className="absolute top-40 right-10 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-2000" />
      <div className="absolute bottom-20 left-1/3 w-72 h-72 bg-yellow-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-4000" />
    </section>
  );
}

// Premium Health Hero - Essential style
function PremiumHero({ styles, title, subtitle, ctaText, ctaLink, secondaryCtaText, secondaryCtaLink, imageUrl }: any) {
  return (
    <section className={`relative min-h-[70vh] flex items-center ${styles.hero}`}>
      <div className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Text */}
          <div className="space-y-6">
            <h1 className={styles.heroTitle}>
              {title}
            </h1>
            <p className={styles.heroSubtitle}>
              {subtitle}
            </p>
            
            <div className="flex flex-wrap gap-4 pt-2">
              <Link to={ctaLink}>
                <Button 
                  size="lg" 
                  className="bg-white text-green-800 hover:bg-green-50 px-8"
                >
                  {ctaText}
                </Button>
              </Link>
              {secondaryCtaText && secondaryCtaLink && (
                <Link to={secondaryCtaLink}>
                  <Button 
                    size="lg" 
                    variant="outline"
                    className="border-white text-white hover:bg-white/10 px-8"
                  >
                    {secondaryCtaText}
                  </Button>
                </Link>
              )}
            </div>

            {/* Trust indicators */}
            <div className="flex items-center gap-6 pt-4 text-green-100">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-white">4.9</span>
                <div className="text-xs">
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <span key={i} className="text-yellow-400">★</span>
                    ))}
                  </div>
                  <span>2.500+ avaliações</span>
                </div>
              </div>
              <div className="h-8 w-px bg-green-700" />
              <div className="text-sm">
                <span className="text-white font-semibold">100%</span> Natural
              </div>
            </div>
          </div>

          {/* Image */}
          <div className="relative">
            {imageUrl ? (
              <img 
                src={imageUrl} 
                alt={title}
                className="w-full h-[400px] object-contain drop-shadow-2xl"
              />
            ) : (
              <div className="w-full h-[400px] bg-green-800/50 rounded-xl" />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// Default Hero
function DefaultHero({ styles, title, subtitle, ctaText, ctaLink, imageUrl, primaryColor }: any) {
  return (
    <section 
      className="relative min-h-[60vh] flex items-center"
      style={{
        background: imageUrl 
          ? `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.7)), url(${imageUrl}) center/cover`
          : primaryColor || '#1a1a1a'
      }}
    >
      <div className="container mx-auto px-4 text-center text-white">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">{title}</h1>
        <p className="text-lg text-white/80 mb-8 max-w-2xl mx-auto">{subtitle}</p>
        <Link to={ctaLink}>
          <Button 
            size="lg" 
            style={{ backgroundColor: primaryColor }}
            className="px-8"
          >
            {ctaText}
          </Button>
        </Link>
      </div>
    </section>
  );
}
