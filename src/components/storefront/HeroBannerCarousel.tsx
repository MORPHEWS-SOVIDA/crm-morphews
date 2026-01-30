import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { StorefrontBanner } from '@/hooks/ecommerce';

interface HeroBannerCarouselProps {
  banners: StorefrontBanner[];
  storefrontSlug: string;
  storefrontName: string;
  primaryColor?: string;
  autoplayInterval?: number;
}

export function HeroBannerCarousel({
  banners,
  storefrontSlug,
  storefrontName,
  primaryColor = '#000',
  autoplayInterval = 5000,
}: HeroBannerCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % banners.length);
  }, [banners.length]);

  const goToPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length);
  }, [banners.length]);

  const goToSlide = useCallback((index: number) => {
    setCurrentIndex(index);
  }, []);

  // Autoplay
  useEffect(() => {
    if (banners.length <= 1 || isHovered) return;

    const timer = setInterval(goToNext, autoplayInterval);
    return () => clearInterval(timer);
  }, [banners.length, autoplayInterval, goToNext, isHovered]);

  if (banners.length === 0) return null;

  const currentBanner = banners[currentIndex];

  return (
    <section
      className="relative w-full overflow-hidden"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Slides Container */}
      <div className="relative">
        {banners.map((banner, index) => (
          <div
            key={banner.id}
            className={cn(
              'transition-opacity duration-700 ease-in-out',
              index === currentIndex ? 'opacity-100' : 'opacity-0 absolute inset-0'
            )}
          >
            {/* Desktop Image */}
            <div
              className="relative w-full min-h-[400px] md:min-h-[500px] lg:min-h-[600px] bg-cover bg-center"
              style={{
                backgroundImage: `url(${banner.image_url})`,
              }}
            >
              {/* Mobile Image Override */}
              {banner.image_mobile_url && (
                <div
                  className="absolute inset-0 bg-cover bg-center md:hidden"
                  style={{
                    backgroundImage: `url(${banner.image_mobile_url})`,
                  }}
                />
              )}

              {/* Overlay */}
              {banner.overlay_color && (
                <div
                  className="absolute inset-0"
                  style={{ backgroundColor: banner.overlay_color }}
                />
              )}

              {/* Content */}
              <div className="absolute inset-0 flex items-center">
                <div className="container mx-auto px-4">
                  <div
                    className={cn(
                      'max-w-xl space-y-4',
                      banner.position === 'center' && 'mx-auto text-center',
                      banner.position === 'right' && 'ml-auto text-right'
                    )}
                  >
                    {banner.title && (
                      <h2
                        className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight animate-fade-in"
                        style={{ color: banner.text_color || '#fff' }}
                      >
                        {banner.title}
                      </h2>
                    )}
                    {banner.subtitle && (
                      <p
                        className="text-lg md:text-xl opacity-90 animate-fade-in"
                        style={{ color: banner.text_color || '#fff', animationDelay: '0.1s' }}
                      >
                        {banner.subtitle}
                      </p>
                    )}
                    {banner.button_text && banner.link_url && (
                      <div className="pt-2 animate-fade-in" style={{ animationDelay: '0.2s' }}>
                        <Link
                          to={banner.link_url}
                          target={banner.link_target === '_blank' ? '_blank' : undefined}
                        >
                          <Button
                            size="lg"
                            className={cn(
                              'px-8 py-6 text-base font-semibold shadow-lg hover:shadow-xl transition-all',
                              banner.button_style === 'outline' && 'bg-transparent border-2'
                            )}
                            style={{
                              backgroundColor:
                                banner.button_style === 'outline' ? 'transparent' : primaryColor,
                              borderColor: banner.button_style === 'outline' ? primaryColor : undefined,
                              color: banner.button_style === 'outline' ? primaryColor : '#fff',
                            }}
                          >
                            {banner.button_text}
                          </Button>
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Navigation Arrows - Only show if more than 1 banner */}
      {banners.length > 1 && (
        <>
          <button
            onClick={goToPrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/30 hover:bg-black/50 text-white transition-all opacity-0 group-hover:opacity-100 hover:opacity-100 focus:opacity-100"
            style={{ opacity: isHovered ? 1 : 0.5 }}
            aria-label="Banner anterior"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            onClick={goToNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/30 hover:bg-black/50 text-white transition-all opacity-0 group-hover:opacity-100 hover:opacity-100 focus:opacity-100"
            style={{ opacity: isHovered ? 1 : 0.5 }}
            aria-label="Próximo banner"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}

      {/* Dots Indicator - Only show if more than 1 banner */}
      {banners.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex gap-2">
          {banners.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={cn(
                'w-3 h-3 rounded-full transition-all duration-300',
                index === currentIndex
                  ? 'w-8 bg-white'
                  : 'bg-white/50 hover:bg-white/75'
              )}
              aria-label={`Ir para banner ${index + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
