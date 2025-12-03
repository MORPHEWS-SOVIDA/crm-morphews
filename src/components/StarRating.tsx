import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StarRatingProps {
  rating: 1 | 2 | 3 | 4 | 5;
  onChange?: (rating: 1 | 2 | 3 | 4 | 5) => void;
  size?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
}

export function StarRating({ rating, onChange, size = 'md', interactive = false }: StarRatingProps) {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const handleClick = (star: number) => {
    if (interactive && onChange) {
      onChange(star as 1 | 2 | 3 | 4 | 5);
    }
  };

  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => handleClick(star)}
          disabled={!interactive}
          className={cn(
            'transition-all duration-200',
            interactive && 'cursor-pointer hover:scale-110',
            !interactive && 'cursor-default'
          )}
        >
          <Star
            className={cn(
              sizes[size],
              'transition-colors duration-200',
              star <= rating
                ? 'fill-star-filled text-star-filled'
                : 'fill-transparent text-star-empty'
            )}
          />
        </button>
      ))}
    </div>
  );
}
