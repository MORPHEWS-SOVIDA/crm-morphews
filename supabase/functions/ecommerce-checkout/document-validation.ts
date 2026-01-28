/**
 * Brazilian document validation utilities for Deno Edge Functions
 * Validates CPF and CNPJ using the official modulus-11 algorithm
 */

/**
 * Validates a Brazilian CPF (11 digits) using the modulus-11 algorithm
 */
export function validateCpf(cpf: string): { valid: boolean; message?: string } {
  const digits = cpf.replace(/\D/g, '');
  
  if (!digits) {
    return { valid: false, message: 'CPF é obrigatório' };
  }
  
  if (digits.length !== 11) {
    return { valid: false, message: `CPF deve ter 11 dígitos (${digits.length} informados)` };
  }
  
  // Check for known invalid patterns (all same digits)
  if (/^(\d)\1{10}$/.test(digits)) {
    return { valid: false, message: 'CPF inválido' };
  }
  
  // Calculate first verification digit
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits.charAt(i)) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(digits.charAt(9))) {
    return { valid: false, message: 'CPF inválido (dígito verificador incorreto)' };
  }
  
  // Calculate second verification digit
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits.charAt(i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(digits.charAt(10))) {
    return { valid: false, message: 'CPF inválido (dígito verificador incorreto)' };
  }
  
  return { valid: true };
}

/**
 * Validates a Brazilian CNPJ (14 digits) using the modulus-11 algorithm
 */
export function validateCnpj(cnpj: string): { valid: boolean; message?: string } {
  const digits = cnpj.replace(/\D/g, '');
  
  if (!digits) {
    return { valid: false, message: 'CNPJ é obrigatório' };
  }
  
  if (digits.length !== 14) {
    return { valid: false, message: `CNPJ deve ter 14 dígitos (${digits.length} informados)` };
  }
  
  // Check for known invalid patterns (all same digits)
  if (/^(\d)\1{13}$/.test(digits)) {
    return { valid: false, message: 'CNPJ inválido' };
  }
  
  // Calculate first verification digit
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(digits.charAt(i)) * weights1[i];
  }
  let remainder = sum % 11;
  const digit1 = remainder < 2 ? 0 : 11 - remainder;
  if (digit1 !== parseInt(digits.charAt(12))) {
    return { valid: false, message: 'CNPJ inválido (dígito verificador incorreto)' };
  }
  
  // Calculate second verification digit
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(digits.charAt(i)) * weights2[i];
  }
  remainder = sum % 11;
  const digit2 = remainder < 2 ? 0 : 11 - remainder;
  if (digit2 !== parseInt(digits.charAt(13))) {
    return { valid: false, message: 'CNPJ inválido (dígito verificador incorreto)' };
  }
  
  return { valid: true };
}

/**
 * Validates a Brazilian CPF or CNPJ based on the length
 */
export function validateDocument(document: string): { 
  valid: boolean; 
  message?: string; 
  type?: 'cpf' | 'cnpj';
  normalized?: string;
} {
  const digits = document.replace(/\D/g, '');
  
  if (!digits) {
    return { valid: false, message: 'CPF ou CNPJ é obrigatório' };
  }
  
  if (digits.length === 11) {
    const result = validateCpf(digits);
    return { ...result, type: 'cpf', normalized: result.valid ? digits : undefined };
  }
  
  if (digits.length === 14) {
    const result = validateCnpj(digits);
    return { ...result, type: 'cnpj', normalized: result.valid ? digits : undefined };
  }
  
  return { 
    valid: false, 
    message: `Documento inválido: deve ter 11 (CPF) ou 14 (CNPJ) dígitos (${digits.length} informados)` 
  };
}
