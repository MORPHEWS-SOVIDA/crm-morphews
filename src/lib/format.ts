/**
 * Formata um valor em centavos para moeda brasileira (R$)
 */
export function formatCurrency(cents: number | null | undefined): string {
  if (cents == null) return 'R$ 0,00';
  const value = cents / 100;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Formata um valor em centavos para moeda sem símbolo
 */
export function formatCurrencyValue(cents: number | null | undefined): string {
  if (cents == null) return '0,00';
  const value = cents / 100;
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Converte um valor decimal para centavos
 */
export function toCents(value: number | string | null | undefined): number {
  if (value == null) return 0;
  const numValue = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : value;
  if (isNaN(numValue)) return 0;
  return Math.round(numValue * 100);
}

/**
 * Converte centavos para valor decimal
 */
export function fromCents(cents: number | null | undefined): number {
  if (cents == null) return 0;
  return cents / 100;
}

/**
 * Formata um número para exibição com separadores brasileiros
 */
export function formatNumber(value: number | null | undefined, decimals: number = 0): string {
  if (value == null) return '0';
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Formata um CNPJ
 */
export function formatCnpj(cnpj: string | null | undefined): string {
  if (!cnpj) return '';
  const cleaned = cnpj.replace(/\D/g, '');
  return cleaned.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

/**
 * Formata um CPF
 */
export function formatCpf(cpf: string | null | undefined): string {
  if (!cpf) return '';
  const cleaned = cpf.replace(/\D/g, '');
  return cleaned.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
}

/**
 * Formata um telefone brasileiro
 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return cleaned.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  }
  if (cleaned.length === 10) {
    return cleaned.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
  }
  return phone;
}

/**
 * Formata um CEP
 */
export function formatCep(cep: string | null | undefined): string {
  if (!cep) return '';
  const cleaned = cep.replace(/\D/g, '');
  return cleaned.replace(/^(\d{5})(\d{3})$/, '$1-$2');
}
