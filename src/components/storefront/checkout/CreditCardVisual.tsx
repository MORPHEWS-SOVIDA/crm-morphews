import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface CreditCardVisualProps {
  cardNumber: string;
  cardHolderName: string;
  expiryDate: string;
  cvv: string;
  cardBrand: string | null;
  isFlipped?: boolean;
}

// Card brand colors
const brandStyles: Record<string, { bg: string; pattern: string }> = {
  visa: { bg: 'from-blue-600 to-blue-800', pattern: 'opacity-20' },
  mastercard: { bg: 'from-red-500 to-orange-600', pattern: 'opacity-20' },
  amex: { bg: 'from-slate-600 to-slate-800', pattern: 'opacity-20' },
  elo: { bg: 'from-yellow-500 to-yellow-700', pattern: 'opacity-20' },
  hipercard: { bg: 'from-red-600 to-red-800', pattern: 'opacity-20' },
  default: { bg: 'from-cyan-500 to-teal-600', pattern: 'opacity-20' },
};

function formatDisplayNumber(number: string): string {
  const cleaned = number.replace(/\D/g, '');
  const padded = cleaned.padEnd(16, '#');
  const groups = padded.match(/.{1,4}/g) || [];
  
  return groups.map((group, i) => {
    if (i === 0) return group.replace(/#/g, '0');
    if (cleaned.length > i * 4) {
      return group.split('').map((char, j) => {
        const pos = i * 4 + j;
        if (pos < cleaned.length) return char;
        return '*';
      }).join('');
    }
    return '****';
  }).join(' ');
}

export function CreditCardVisual({
  cardNumber,
  cardHolderName,
  expiryDate,
  cvv,
  cardBrand,
  isFlipped = false,
}: CreditCardVisualProps) {
  const style = brandStyles[cardBrand || 'default'] || brandStyles.default;
  const displayNumber = formatDisplayNumber(cardNumber);
  const displayName = cardHolderName || 'NOME COMPLETO';
  const displayExpiry = expiryDate || 'MM/AA';
  const displayCvv = cvv || '***';

  return (
    <div className="perspective-1000 w-full max-w-[320px] mx-auto mb-4">
      <motion.div
        className="relative w-full h-[180px] preserve-3d"
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.6, ease: 'easeInOut' }}
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Front of card */}
        <div
          className={cn(
            'absolute inset-0 rounded-xl p-5 shadow-xl backface-hidden',
            'bg-gradient-to-br',
            style.bg
          )}
          style={{ backfaceVisibility: 'hidden' }}
        >
          {/* Pattern overlay */}
          <div className={cn('absolute inset-0 rounded-xl overflow-hidden', style.pattern)}>
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iYSIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVHJhbnNmb3JtPSJyb3RhdGUoNDUpIj48cGF0aCBkPSJNLTEwIDMwaDYwdjJoLTYweiIgZmlsbD0iI2ZmZiIgZmlsbC1vcGFjaXR5PSIuMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNhKSIvPjwvc3ZnPg==')] opacity-50" />
          </div>

          {/* Chip */}
          <div className="relative">
            <div className="w-10 h-8 bg-gradient-to-br from-yellow-300 to-yellow-500 rounded-md shadow-inner flex items-center justify-center">
              <div className="w-6 h-5 border border-yellow-600/30 rounded-sm" />
            </div>
          </div>

          {/* Card number */}
          <div className="relative mt-5">
            <div className="bg-white/10 backdrop-blur-sm rounded px-3 py-2 inline-block">
              <span className="font-mono text-lg text-white tracking-wider">
                {displayNumber}
              </span>
            </div>
          </div>

          {/* Name and expiry */}
          <div className="relative mt-4 flex justify-between items-end">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-white/60 uppercase tracking-wide mb-0.5">Titular</p>
              <p className="text-sm text-white font-medium truncate uppercase">
                {displayName}
              </p>
            </div>
            <div className="text-right ml-4">
              <p className="text-[10px] text-white/60 uppercase tracking-wide mb-0.5">Validade</p>
              <p className="text-sm text-white font-medium font-mono">
                {displayExpiry}
              </p>
            </div>
          </div>

          {/* Brand logo placeholder */}
          {cardBrand && (
            <div className="absolute top-5 right-5">
              <span className="text-white/80 text-xs font-bold uppercase tracking-wider">
                {cardBrand}
              </span>
            </div>
          )}
        </div>

        {/* Back of card */}
        <div
          className={cn(
            'absolute inset-0 rounded-xl shadow-xl backface-hidden',
            'bg-gradient-to-br',
            style.bg
          )}
          style={{ 
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)'
          }}
        >
          {/* Magnetic stripe */}
          <div className="w-full h-10 bg-black/80 mt-6" />
          
          {/* CVV area */}
          <div className="px-5 mt-4">
            <div className="bg-white/90 rounded h-8 flex items-center justify-end px-3">
              <span className="font-mono text-gray-800 tracking-wider">
                {displayCvv}
              </span>
            </div>
            <p className="text-[10px] text-white/60 uppercase tracking-wide mt-1 text-right">CVV</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
