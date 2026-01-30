import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Star, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StorefrontTestimonial } from '@/hooks/ecommerce/useStorefrontTestimonials';

interface TestimonialsCarouselProps {
  testimonials: StorefrontTestimonial[];
  primaryColor?: string;
  autoplayInterval?: number;
}

export function TestimonialsCarousel({
  testimonials,
  primaryColor = '#ec4899',
  autoplayInterval = 4000,
}: TestimonialsCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  // Calculate how many items to show based on screen size
  const itemsPerView = {
    mobile: 1,
    tablet: 2,
    desktop: 3,
  };

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => 
      prev + 1 >= testimonials.length ? 0 : prev + 1
    );
  }, [testimonials.length]);

  const goToPrev = useCallback(() => {
    setCurrentIndex((prev) => 
      prev - 1 < 0 ? testimonials.length - 1 : prev - 1
    );
  }, [testimonials.length]);

  // Autoplay
  useEffect(() => {
    if (testimonials.length <= 1 || isHovered) return;

    const timer = setInterval(goToNext, autoplayInterval);
    return () => clearInterval(timer);
  }, [testimonials.length, autoplayInterval, goToNext, isHovered]);

  if (testimonials.length === 0) return null;

  // Get visible testimonials (show 3 on desktop, wrapping around)
  const getVisibleTestimonials = () => {
    const visible = [];
    for (let i = 0; i < Math.min(3, testimonials.length); i++) {
      const index = (currentIndex + i) % testimonials.length;
      visible.push({ ...testimonials[index], displayIndex: i });
    }
    return visible;
  };

  const visibleTestimonials = getVisibleTestimonials();

  return (
    <section 
      className="py-12 bg-gradient-to-b from-pink-50 to-white"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="container mx-auto px-4">
        {/* Section Title */}
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
            O que nossos clientes dizem
          </h2>
          <p className="text-muted-foreground">
            Depoimentos reais de quem já experimentou
          </p>
        </div>

        {/* Carousel Container */}
        <div className="relative">
          {/* Navigation Arrows */}
          {testimonials.length > 3 && (
            <>
              <button
                onClick={goToPrev}
                className="absolute -left-4 md:left-0 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-white shadow-lg hover:bg-gray-50 transition-all"
                style={{ opacity: isHovered ? 1 : 0.7 }}
                aria-label="Anterior"
              >
                <ChevronLeft className="h-5 w-5 text-gray-600" />
              </button>
              <button
                onClick={goToNext}
                className="absolute -right-4 md:right-0 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-white shadow-lg hover:bg-gray-50 transition-all"
                style={{ opacity: isHovered ? 1 : 0.7 }}
                aria-label="Próximo"
              >
                <ChevronRight className="h-5 w-5 text-gray-600" />
              </button>
            </>
          )}

          {/* Testimonials Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-8 md:px-12">
            {visibleTestimonials.map((testimonial, idx) => (
              <div
                key={`${testimonial.id}-${idx}`}
                className={cn(
                  'bg-white rounded-2xl shadow-lg overflow-hidden transition-all duration-500',
                  'hover:shadow-xl hover:-translate-y-1',
                  idx === 0 ? 'block' : idx === 1 ? 'hidden md:block' : 'hidden lg:block'
                )}
              >
                {/* Photo */}
                <div className="aspect-square overflow-hidden">
                  {testimonial.photo_url ? (
                    <img
                      src={testimonial.photo_url}
                      alt={testimonial.customer_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div 
                      className="w-full h-full flex items-center justify-center text-6xl font-bold text-white"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {testimonial.customer_name.charAt(0)}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-4 text-center space-y-2">
                  {/* Stars */}
                  <div className="flex justify-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className="h-5 w-5"
                        style={{ fill: primaryColor, color: primaryColor }}
                      />
                    ))}
                  </div>

                  {/* Name with verified badge */}
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="font-bold text-lg text-gray-900">
                      {testimonial.customer_name}
                    </span>
                    {testimonial.is_verified && (
                      <CheckCircle className="h-5 w-5 fill-blue-500 text-white" />
                    )}
                  </div>

                  {/* Testimonial text */}
                  <p className="text-gray-600 text-sm leading-relaxed">
                    {testimonial.testimonial_text}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Dots Indicator */}
          {testimonials.length > 3 && (
            <div className="flex justify-center gap-2 mt-6">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={cn(
                    'w-2.5 h-2.5 rounded-full transition-all duration-300',
                    index === currentIndex
                      ? 'w-6'
                      : 'bg-gray-300 hover:bg-gray-400'
                  )}
                  style={{
                    backgroundColor: index === currentIndex ? primaryColor : undefined,
                  }}
                  aria-label={`Ir para depoimento ${index + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
