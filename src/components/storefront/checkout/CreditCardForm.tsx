import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CreditCard, Lock } from 'lucide-react';

interface CreditCardFormProps {
  onCardDataChange: (data: CreditCardData | null) => void;
  totalCents: number;
}

export interface CreditCardData {
  card_number: string;
  card_holder_name: string;
  card_expiration_month: string;
  card_expiration_year: string;
  card_cvv: string;
  installments: number;
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

export function CreditCardForm({ onCardDataChange, totalCents }: CreditCardFormProps) {
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolderName, setCardHolderName] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [installments, setInstallments] = useState('1');
  const [cardBrand, setCardBrand] = useState<string | null>(null);

  // Generate installment options (1-12x)
  const installmentOptions = Array.from({ length: 12 }, (_, i) => {
    const n = i + 1;
    const installmentValue = totalCents / n;
    const formatted = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(installmentValue / 100);
    
    return {
      value: String(n),
      label: n === 1 ? `À vista - ${formatted}` : `${n}x de ${formatted}`,
    };
  });

  useEffect(() => {
    const brand = detectCardBrand(cardNumber);
    setCardBrand(brand);
  }, [cardNumber]);

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

    if (isComplete) {
      onCardDataChange({
        card_number: cleanNumber,
        card_holder_name: cardHolderName.trim().toUpperCase(),
        card_expiration_month: month,
        card_expiration_year: `20${year}`,
        card_cvv: cvv,
        installments: parseInt(installments),
      });
    } else {
      onCardDataChange(null);
    }
  }, [cardNumber, cardHolderName, expiryDate, cvv, installments, onCardDataChange]);

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
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
        <Lock className="h-4 w-4" />
        <span>Seus dados são criptografados</span>
      </div>

      {/* Card Number */}
      <div className="space-y-2">
        <Label htmlFor="card_number">Número do Cartão *</Label>
        <div className="relative">
          <Input
            id="card_number"
            type="text"
            inputMode="numeric"
            placeholder="0000 0000 0000 0000"
            value={cardNumber}
            onChange={handleCardNumberChange}
            className="pr-12"
            maxLength={19}
            required
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {cardBrand ? (
              <span className="text-xs font-medium uppercase text-muted-foreground">
                {cardBrand}
              </span>
            ) : (
              <CreditCard className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </div>
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
