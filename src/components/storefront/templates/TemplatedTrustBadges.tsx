import { Shield, Truck, RotateCcw, CreditCard, Star, Users, Package } from 'lucide-react';
import { getTemplateStyles, TRUST_BADGES, SOCIAL_PROOF_MESSAGES } from './templateUtils';

interface TemplatedTrustBadgesProps {
  templateSlug?: string | null;
  variant?: 'horizontal' | 'grid';
}

const iconMap = {
  Shield,
  Truck,
  RotateCcw,
  CreditCard,
  Star,
  Users,
  Package,
};

export function TemplatedTrustBadges({ templateSlug, variant = 'horizontal' }: TemplatedTrustBadgesProps) {
  const styles = getTemplateStyles(templateSlug);
  
  if (variant === 'grid') {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {TRUST_BADGES.map((badge, idx) => {
          const Icon = iconMap[badge.icon as keyof typeof iconMap];
          return (
            <div 
              key={idx}
              className="flex flex-col items-center text-center p-4 rounded-lg bg-muted/50"
            >
              <Icon className="h-8 w-8 text-primary mb-2" />
              <span className="font-medium text-sm">{badge.text}</span>
              <span className="text-xs text-muted-foreground">{badge.subtext}</span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap justify-center gap-6 md:gap-10 py-6 border-y border-border/50">
      {TRUST_BADGES.map((badge, idx) => {
        const Icon = iconMap[badge.icon as keyof typeof iconMap];
        return (
          <div key={idx} className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            <div className="text-sm">
              <span className="font-medium">{badge.text}</span>
              <span className="text-muted-foreground ml-1">• {badge.subtext}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface TemplatedSocialProofProps {
  templateSlug?: string | null;
}

export function TemplatedSocialProof({ templateSlug }: TemplatedSocialProofProps) {
  return (
    <div className="flex flex-wrap justify-center gap-8 md:gap-16 py-8">
      {SOCIAL_PROOF_MESSAGES.map((item, idx) => {
        const hasIcon = 'icon' in item;
        const Icon = hasIcon ? iconMap[item.icon as keyof typeof iconMap] : null;
        return (
          <div key={idx} className="text-center">
            <div className="flex items-center justify-center gap-1">
              {Icon && <Icon className="h-6 w-6 text-yellow-500 fill-yellow-500" />}
              <span className="text-3xl font-bold">{item.count}</span>
            </div>
            <span className="text-sm text-muted-foreground">{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}
