import { z } from 'zod';

/**
 * Validates a Brazilian phone number format.
 * 
 * Valid formats:
 * - Mobile: 55 + DDD (2 digits) + 9 + 8 digits = 13 digits (e.g., 5565999934325)
 * - Landline: 55 + DDD (2 digits) + 8 digits starting with 2/3/4/5 = 12 digits (e.g., 556539934325)
 * 
 * Invalid patterns:
 * - 10, 11, 14, 15 digits (never valid)
 * - Duplicated country code (e.g., 555565...)
 * - Mobile numbers not starting with 9 after DDD
 */
export function validateBrazilianPhone(phone: string): { valid: boolean; message?: string; normalized?: string } {
  // Remove all non-digits
  let digits = phone.replace(/\D/g, '');
  
  if (!digits) {
    return { valid: false, message: 'Número de telefone é obrigatório' };
  }
  
  // Normalize: add country code if missing
  if (!digits.startsWith('55')) {
    if (digits.length === 10 || digits.length === 11) {
      digits = '55' + digits;
    }
  }
  
  const length = digits.length;
  
  // Check invalid lengths
  if (length < 12 || length > 13) {
    return { 
      valid: false, 
      message: `Número inválido: deve ter 12 ou 13 dígitos (você digitou ${length}). Ex: 5511999998888` 
    };
  }
  
  // Must start with Brazil country code
  if (!digits.startsWith('55')) {
    return { valid: false, message: 'Número deve começar com 55 (código do Brasil)' };
  }
  
  // Check for duplicated country code (e.g., 555565...)
  if (digits.startsWith('5555')) {
    return { valid: false, message: 'Número inválido: código do país duplicado (5555...)' };
  }
  
  // Extract DDD and number
  const ddd = digits.substring(2, 4);
  const number = digits.substring(4);
  
  // Validate DDD (valid Brazilian DDDs are between 11-99, excluding some)
  const dddNum = parseInt(ddd, 10);
  if (dddNum < 11 || dddNum > 99) {
    return { valid: false, message: `DDD inválido: ${ddd}` };
  }
  
  // For 13-digit numbers (mobile): must start with 9 after DDD
  if (length === 13) {
    if (!number.startsWith('9')) {
      return { 
        valid: false, 
        message: 'Celular com 13 dígitos deve começar com 9 após o DDD. Ex: 5511999998888' 
      };
    }
    // The digit after 9 should be 6, 7, 8, or 9 (valid mobile prefixes)
    const secondDigit = number.charAt(1);
    if (!['6', '7', '8', '9'].includes(secondDigit)) {
      return { 
        valid: false, 
        message: 'Celular inválido: após o 9, deve vir 6, 7, 8 ou 9. Ex: 5511999998888' 
      };
    }
  }
  
  // For 12-digit numbers (landline): should NOT start with 9
  if (length === 12) {
    const firstDigit = number.charAt(0);
    // Landlines typically start with 2, 3, 4, or 5
    if (!['2', '3', '4', '5'].includes(firstDigit)) {
      return { 
        valid: false, 
        message: 'Telefone fixo (12 dígitos) deve começar com 2, 3, 4 ou 5 após o DDD. Ex: 551133334444' 
      };
    }
  }
  
  return { valid: true, normalized: digits };
}

/**
 * Zod refinement for Brazilian phone validation
 */
export const brazilianPhoneSchema = z.string().trim()
  .min(1, { message: 'Telefone/WhatsApp é obrigatório' })
  .max(20, { message: 'Número muito longo' })
  .refine((val) => {
    const result = validateBrazilianPhone(val);
    return result.valid;
  }, (val) => {
    const result = validateBrazilianPhone(val);
    return { message: result.message || 'Número de telefone inválido' };
  });

/**
 * Optional Brazilian phone schema (for secondary phone)
 */
export const optionalBrazilianPhoneSchema = z.string()
  .max(20, { message: 'Número muito longo' })
  .optional()
  .or(z.literal(''))
  .refine((val) => {
    if (!val || val === '') return true;
    const result = validateBrazilianPhone(val);
    return result.valid;
  }, (val) => {
    if (!val || val === '') return { message: '' };
    const result = validateBrazilianPhone(val as string);
    return { message: result.message || 'Número de telefone inválido' };
  });

// Auth validations
export const loginSchema = z.object({
  email: z.string().trim().email({ message: 'E-mail inválido' }),
  password: z.string().min(1, { message: 'Senha é obrigatória' }),
});

export const setupSchema = z.object({
  firstName: z.string().trim().min(1, { message: 'Nome é obrigatório' }).max(100, { message: 'Nome muito longo' }),
  lastName: z.string().trim().min(1, { message: 'Sobrenome é obrigatório' }).max(100, { message: 'Sobrenome muito longo' }),
  email: z.string().trim().email({ message: 'E-mail inválido' }),
  password: z.string().min(6, { message: 'Senha deve ter pelo menos 6 caracteres' }),
  confirmPassword: z.string().min(1, { message: 'Confirme a senha' }),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Senhas não conferem',
  path: ['confirmPassword'],
});

export const cadastroSchema = z.object({
  firstName: z.string().trim().min(1, { message: 'Nome é obrigatório' }).max(100, { message: 'Nome muito longo' }),
  lastName: z.string().trim().min(1, { message: 'Sobrenome é obrigatório' }).max(100, { message: 'Sobrenome muito longo' }),
  instagram: z.string().max(100, { message: 'Instagram muito longo' }).optional().or(z.literal('')),
  whatsapp: z.string().max(20, { message: 'WhatsApp muito longo' }).optional().or(z.literal('')),
  email: z.string().trim().email({ message: 'E-mail inválido' }),
  password: z.string().min(6, { message: 'Senha deve ter pelo menos 6 caracteres' }),
  confirmPassword: z.string().min(1, { message: 'Confirme a senha' }),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Senhas não conferem',
  path: ['confirmPassword'],
});

// Lead validations with proper Brazilian phone validation
export const leadSchema = z.object({
  name: z.string().trim().min(1, { message: 'Preencha o nome do cliente' }).max(200, { message: 'Nome muito longo (máx. 200 caracteres)' }),
  specialty: z.string().max(200, { message: 'Empresa/Especialidade muito longa (máx. 200 caracteres)' }).optional().or(z.literal('')),
  instagram: z.string().max(100, { message: 'Instagram muito longo' }).optional().or(z.literal('')),
  followers: z.string().optional().or(z.literal('')),
  whatsapp: brazilianPhoneSchema,
  secondary_phone: optionalBrazilianPhoneSchema,
  email: z.string().email({ message: 'Formato de e-mail inválido (ex: nome@email.com)' }).optional().or(z.literal('')),
  stage: z.string().min(1, { message: 'Selecione uma etapa do funil' }),
  stars: z.number().min(0).max(5),
  assigned_to: z.string().trim().min(1, { message: 'Selecione um responsável pelo atendimento' }).max(100, { message: 'Nome muito longo' }),
  whatsapp_group: z.string().max(200).optional().or(z.literal('')),
  desired_products: z.string().max(1000).optional().or(z.literal('')),
  negotiated_value: z.string().optional().or(z.literal('')),
  observations: z.string().max(2000, { message: 'Observações muito longas (máx. 2000 caracteres)' }).optional().or(z.literal('')),
  meeting_date: z.string().optional().or(z.literal('')),
  meeting_time: z.string().optional().or(z.literal('')),
  meeting_link: z.string().optional().refine((val) => !val || val === '' || val.startsWith('http'), { message: 'Link deve começar com http:// ou https://' }),
  recorded_call_link: z.string().optional().refine((val) => !val || val === '' || val.startsWith('http'), { message: 'Link deve começar com http:// ou https://' }),
  linkedin: z.string().max(200).optional().or(z.literal('')),
  cpf_cnpj: z.string().max(20).optional().or(z.literal('')),
  site: z.string().optional().refine((val) => !val || val === '' || val.startsWith('http'), { message: 'URL deve começar com http:// ou https://' }),
  lead_source: z.string().optional().or(z.literal('')),
  products: z.array(z.string()).optional(),
  // Address fields
  cep: z.string().optional().or(z.literal('')),
  street: z.string().optional().or(z.literal('')),
  street_number: z.string().optional().or(z.literal('')),
  complement: z.string().optional().or(z.literal('')),
  neighborhood: z.string().optional().or(z.literal('')),
  city: z.string().optional().or(z.literal('')),
  state: z.string().optional().or(z.literal('')),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SetupInput = z.infer<typeof setupSchema>;
export type CadastroInput = z.infer<typeof cadastroSchema>;
export type LeadInput = z.infer<typeof leadSchema>;
