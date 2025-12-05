import { z } from 'zod';

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

// Lead validations
export const leadSchema = z.object({
  name: z.string().trim().min(1, { message: 'Nome é obrigatório' }).max(200, { message: 'Nome muito longo' }),
  specialty: z.string().max(200, { message: 'Empresa/Especialidade muito longa' }).optional().or(z.literal('')),
  instagram: z.string().max(100, { message: 'Instagram muito longo' }).optional().or(z.literal('')),
  followers: z.string().optional().or(z.literal('')),
  whatsapp: z.string().trim()
    .min(1, { message: 'Telefone/WhatsApp é obrigatório' })
    .max(20, { message: 'Número muito longo' })
    .regex(/^\d+$/, { message: 'Apenas números, sem símbolos ou espaços' }),
  secondary_phone: z.string().max(20, { message: 'Número muito longo' }).optional().or(z.literal('')),
  email: z.string().email({ message: 'E-mail inválido' }).optional().or(z.literal('')),
  stage: z.string(),
  stars: z.number().min(1).max(5),
  assigned_to: z.string().trim().min(1, { message: 'Responsável é obrigatório' }).max(100, { message: 'Nome muito longo' }),
  whatsapp_group: z.string().max(200).optional().or(z.literal('')),
  desired_products: z.string().max(1000).optional().or(z.literal('')),
  negotiated_value: z.string().optional().or(z.literal('')),
  observations: z.string().max(2000).optional().or(z.literal('')),
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
