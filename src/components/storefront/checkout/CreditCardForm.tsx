import { useState, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Lock } from 'lucide-react';
import { CreditCardVisual } from './CreditCardVisual';

// Default installment fees if not configured
const DEFAULT_INSTALLMENT_FEES: Record<string, number> = {
  "2": 3.49,
  "3": 4.29,
  "4": 4.99,
  "5": 5.49,
  "6": 5.99,
  "7": 6.49,
  "8": 6.99,
  "9": 7.49,
  "10": 7.99,
  "11": 8.49,
  "12": 8.99,
};

export interface InstallmentConfig {
  installment_fees?: Record<string, number>;
  installment_fee_passed_to_buyer?: boolean;
  max_installments?: number;
}

interface CreditCardFormProps {
  onCardDataChange: (data: CreditCardData | null) => void;
  totalCents: number;
  installmentConfig?: InstallmentConfig;
  onTotalWithInterestChange?: (totalWithInterest: number, installments: number) => void;
}

export interface CreditCardData {
  card_number: string;
  card_holder_name: string;
  card_expiration_month: string;
  card_expiration_year: string;
  card_cvv: string;
  installments: number;
  total_with_interest?: number;
}

// Card brand detection based on BIN ranges
function detectCardBrand(number: string): string | null {
  const cleanNumber = number.replace(/\D/g, '');
  if (!cleanNumber) return null;
  
  if (/^4/.test(cleanNumber)) return 'visa';
  if (/^5[1-5]/.test(cleanNumber)) return 'mastercard';
  if (/^3[47]/.test(cleanNumber)) return 'amex';
  if (/^6(?:011|5)/.test(cleanNumber)) return 'discover';
  if (/^(?:636368|636369|438935|504175|451416|636297|5067|4576|4011)/.test(cleanNumber)) return 'elo';
  if (/^606282/.test(cleanNumber)) return 'hipercard';
  
  return null;
}

function formatCardNumber(value: string): string {
  const cleaned = value.replace(/\D/g, '');
  const limited = cleaned.slice(0, 16);
  const groups = limited.match(/.{1,4}/g);
  return groups ? groups.join(' ') : limited;
}

function formatExpiryDate(value: string): string {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length >= 2) {
    return `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}`;
  }
  return cleaned;
}

export function CreditCardForm({ onCardDataChange, totalCents, installmentConfig, onTotalWithInterestChange }: CreditCardFormProps) {
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolderName, setCardHolderName] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  // Default to max installments (12x) to maximize platform interest revenue
  const [installments, setInstallments] = useState(String(installmentConfig?.max_installments || 12));
  const [cardBrand, setCardBrand] = useState<string | null>(null);
  const [isCvvFocused, setIsCvvFocused] = useState(false);

  // Determine if interest should be applied
  const passFeeToCustomer = installmentConfig?.installment_fee_passed_to_buyer ?? true;
  const installmentFees = installmentConfig?.installment_fees || DEFAULT_INSTALLMENT_FEES;
  const maxInstallments = installmentConfig?.max_installments || 12;

  // Generate installment options with interest if applicable
  const installmentOptions = useMemo(() => {
    return Array.from({ length: maxInstallments }, (_, i) => {
      const n = i + 1;
      let totalForInstallment = totalCents;
      let installmentValue = totalCents / n;
      let hasInterest = false;

      // Apply interest for installments > 1 if fee should be passed to customer
      if (n > 1 && passFeeToCustomer) {
        const feePercentage = installmentFees[String(n)] || 0;
        if (feePercentage > 0) {
          totalForInstallment = Math.round(totalCents * (1 + feePercentage / 100));
          installmentValue = totalForInstallment / n;
          hasInterest = true;
        }
      }

      const formatted = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(installmentValue / 100);

      const totalFormatted = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(totalForInstallment / 100);
      
      return {
        value: String(n),
        // Never show total - only show installment value to encourage purchase
        label: n === 1 
          ? `À vista - ${formatted}` 
          : `${n}x de ${formatted}`,
        totalWithInterest: totalForInstallment,
      };
    });
  }, [totalCents, passFeeToCustomer, installmentFees, maxInstallments]);

  useEffect(() => {
    const brand = detectCardBrand(cardNumber);
    setCardBrand(brand);
  }, [cardNumber]);

  // Notify parent about total with interest when installments change
  useEffect(() => {
    const selectedOption = installmentOptions.find(o => o.value === installments);
    if (selectedOption && onTotalWithInterestChange) {
      onTotalWithInterestChange(selectedOption.totalWithInterest, parseInt(installments));
    }
  }, [installments, installmentOptions, onTotalWithInterestChange]);

  useEffect(() => {
    const cleanNumber = cardNumber.replace(/\D/g, '');
    const [month, year] = expiryDate.split('/');
    
    // Validate all fields are filled
    const isComplete = 
      cleanNumber.length >= 13 && 
      cleanNumber.length <= 16 &&
      cardHolderName.trim().length >= 3 &&
      month && month.length === 2 &&
      year && year.length === 2 &&
      cvv.length >= 3 && cvv.length <= 4;

    // Get total with interest for current installment
    const selectedOption = installmentOptions.find(o => o.value === installments);
    const totalWithInterest = selectedOption?.totalWithInterest || totalCents;

    if (isComplete) {
      onCardDataChange({
        card_number: cleanNumber,
        card_holder_name: cardHolderName.trim().toUpperCase(),
        card_expiration_month: month,
        card_expiration_year: `20${year}`,
        card_cvv: cvv,
        installments: parseInt(installments),
        total_with_interest: totalWithInterest,
      });
    } else {
      onCardDataChange(null);
    }
  }, [cardNumber, cardHolderName, expiryDate, cvv, installments, onCardDataChange, installmentOptions, totalCents]);

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCardNumber(e.target.value);
    setCardNumber(formatted);
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatExpiryDate(e.target.value);
    setExpiryDate(formatted);
  };

  const handleCvvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = e.target.value.replace(/\D/g, '').slice(0, 4);
    setCvv(cleaned);
  };

  return (
    <div className="space-y-4 p-4 bg-muted/30 rounded-lg border mt-4">
      {/* Visual Credit Card */}
      <CreditCardVisual
        cardNumber={cardNumber}
        cardHolderName={cardHolderName}
        expiryDate={expiryDate}
        cvv={cvv}
        cardBrand={cardBrand}
        isFlipped={isCvvFocused}
      />

      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
        <Lock className="h-4 w-4" />
        <span>Seus dados são criptografados</span>
      </div>

      {/* Card Number */}
      <div className="space-y-2">
        <Label htmlFor="card_number">Número do Cartão *</Label>
        <Input
          id="card_number"
          type="text"
          inputMode="numeric"
          placeholder="0000 0000 0000 0000"
          value={cardNumber}
          onChange={handleCardNumberChange}
          maxLength={19}
          required
        />
      </div>

      {/* Card Holder Name */}
      <div className="space-y-2">
        <Label htmlFor="card_holder">Nome no Cartão *</Label>
        <Input
          id="card_holder"
          type="text"
          placeholder="NOME COMO ESTÁ NO CARTÃO"
          value={cardHolderName}
          onChange={(e) => setCardHolderName(e.target.value.toUpperCase())}
          className="uppercase"
          required
        />
      </div>

      {/* Expiry and CVV */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="expiry">Validade *</Label>
          <Input
            id="expiry"
            type="text"
            inputMode="numeric"
            placeholder="MM/AA"
            value={expiryDate}
            onChange={handleExpiryChange}
            maxLength={5}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cvv">CVV *</Label>
          <Input
            id="cvv"
            type="text"
            inputMode="numeric"
            placeholder="123"
            value={cvv}
            onChange={handleCvvChange}
            onFocus={() => setIsCvvFocused(true)}
            onBlur={() => setIsCvvFocused(false)}
            maxLength={4}
            required
          />
        </div>
      </div>

      {/* Installments */}
      <div className="space-y-2">
        <Label htmlFor="installments">Parcelas</Label>
        <Select value={installments} onValueChange={setInstallments}>
          <SelectTrigger id="installments">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {installmentOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
