/**
 * User-friendly error messages for common database and validation errors
 * Maps technical error codes/messages to human-readable Portuguese messages
 */

interface FriendlyError {
  title: string;
  description: string;
  suggestion?: string;
}

/**
 * Common error patterns and their friendly translations
 */
const ERROR_PATTERNS: Array<{
  pattern: RegExp | ((msg: string) => boolean);
  getError: (msg: string, details?: string) => FriendlyError;
}> = [
  // WhatsApp Duplicado
  {
    pattern: (msg) => 
      (msg.toLowerCase().includes('whatsapp') && 
       (msg.toLowerCase().includes('duplicat') || 
        msg.toLowerCase().includes('existe') || 
        msg.toLowerCase().includes('já'))) ||
      msg === 'DUPLICATE_WHATSAPP' ||
      (msg.includes('23505') && msg.toLowerCase().includes('whatsapp')),
    getError: () => ({
      title: 'WhatsApp já cadastrado',
      description: 'Este número de WhatsApp já está vinculado a outro cliente.',
      suggestion: 'Busque pelo número existente ou use um número diferente.'
    })
  },
  // Unique constraint violation (general)
  {
    pattern: /23505|unique.*constraint|duplicate.*key|violates.*unique/i,
    getError: (msg) => {
      // Try to extract the field name
      const fieldMatch = msg.match(/Key \(([^)]+)\)/i) || msg.match(/column[s]?\s+"([^"]+)"/i);
      const field = fieldMatch?.[1] || 'campo';
      const fieldName = translateFieldName(field);
      return {
        title: 'Registro duplicado',
        description: `Este valor de ${fieldName} já existe em outro cadastro.`,
        suggestion: `Verifique se este ${fieldName} já está cadastrado ou use um valor diferente.`
      };
    }
  },
  // Required field (stage, etc.)
  {
    pattern: /required|obrigatório|cannot be null|null value|violates not-null/i,
    getError: (msg) => {
      const fieldMatch = msg.match(/column[s]?\s+"([^"]+)"/i) || msg.match(/field[s]?\s+"([^"]+)"/i);
      const field = fieldMatch?.[1] || extractFieldFromMessage(msg);
      const fieldName = translateFieldName(field);
      return {
        title: 'Campo obrigatório',
        description: `O campo "${fieldName}" é obrigatório e precisa ser preenchido.`,
        suggestion: 'Preencha todos os campos marcados com * antes de salvar.'
      };
    }
  },
  // Check constraint violations
  {
    pattern: /23514|violates.*check.*constraint/i,
    getError: (msg) => {
      const constraintMatch = msg.match(/constraint\s+"([^"]+)"/i);
      const constraint = constraintMatch?.[1] || '';
      
      // Handle specific known constraints
      if (constraint.includes('message_type')) {
        return {
          title: 'Tipo de mensagem inválido',
          description: 'O sistema tentou salvar um tipo de mensagem não suportado.',
          suggestion: 'Isso é um problema técnico. Por favor, reporte ao suporte.'
        };
      }
      
      return {
        title: 'Valor inválido',
        description: 'Um dos valores inseridos não é válido para este campo.',
        suggestion: 'Verifique os dados e tente novamente.'
      };
    }
  },
  // Foreign key violations
  {
    pattern: /23503|violates.*foreign.*key|referenced.*does not exist/i,
    getError: () => ({
      title: 'Referência inválida',
      description: 'O registro referenciado não existe ou foi removido.',
      suggestion: 'Atualize a página e tente novamente.'
    })
  },
  // RLS Policy violations
  {
    pattern: /row.*level.*security|rls|policy|insufficient.*privilege/i,
    getError: () => ({
      title: 'Sem permissão',
      description: 'Você não tem permissão para realizar esta ação.',
      suggestion: 'Entre em contato com o administrador se precisar de acesso.'
    })
  },
  // Authentication errors
  {
    pattern: /unauthorized|not.*authenticated|token.*expired|jwt.*expired/i,
    getError: () => ({
      title: 'Sessão expirada',
      description: 'Sua sessão expirou ou você não está autenticado.',
      suggestion: 'Faça login novamente para continuar.'
    })
  },
  // Network/timeout errors
  {
    pattern: /timeout|network|connection|fetch.*failed|econnrefused/i,
    getError: () => ({
      title: 'Erro de conexão',
      description: 'Não foi possível conectar ao servidor.',
      suggestion: 'Verifique sua conexão com a internet e tente novamente.'
    })
  },
  // Limit exceeded
  {
    pattern: /limit.*atingido|limite.*excedido|max.*leads|quota/i,
    getError: (msg) => {
      const limitMatch = msg.match(/(\d+)\s*leads?/i);
      const limit = limitMatch?.[1] || '';
      return {
        title: 'Limite atingido',
        description: limit ? `Você atingiu o limite de ${limit} cadastros do seu plano.` : 'Você atingiu o limite do seu plano.',
        suggestion: 'Faça upgrade do seu plano para continuar cadastrando.'
      };
    }
  },
  // Email format
  {
    pattern: /e-?mail.*inválido|invalid.*email/i,
    getError: () => ({
      title: 'E-mail inválido',
      description: 'O formato do e-mail não está correto.',
      suggestion: 'Verifique se o e-mail está no formato correto (ex: nome@email.com).'
    })
  },
  // Phone format
  {
    pattern: /telefone|phone|whatsapp.*inválido|número.*inválido/i,
    getError: (msg) => ({
      title: 'Número inválido',
      description: msg.includes(':') ? msg.split(':').slice(1).join(':').trim() : 'O formato do número de telefone não está correto.',
      suggestion: 'Use o formato: 55 + DDD + número (ex: 5511999998888).'
    })
  },
];

/**
 * Translate technical field names to user-friendly Portuguese names
 */
function translateFieldName(field: string): string {
  const translations: Record<string, string> = {
    // Lead fields
    'name': 'Nome',
    'whatsapp': 'WhatsApp',
    'email': 'E-mail',
    'stage': 'Etapa',
    'funnel_stage_id': 'Etapa do Funil',
    'assigned_to': 'Responsável',
    'instagram': 'Instagram',
    'phone': 'Telefone',
    'secondary_phone': 'Telefone Secundário',
    'cpf_cnpj': 'CPF/CNPJ',
    'organization_id': 'Organização',
    'user_id': 'Usuário',
    'created_by': 'Criado por',
    
    // Address fields
    'cep': 'CEP',
    'street': 'Rua',
    'city': 'Cidade',
    'state': 'Estado',
    'neighborhood': 'Bairro',
    
    // Other common fields
    'description': 'Descrição',
    'title': 'Título',
    'value': 'Valor',
    'amount': 'Valor',
    'date': 'Data',
    'status': 'Status',
    'type': 'Tipo',
  };
  
  // Try exact match
  const lowerField = field.toLowerCase().replace(/_/g, '');
  for (const [key, value] of Object.entries(translations)) {
    if (key.toLowerCase().replace(/_/g, '') === lowerField) {
      return value;
    }
  }
  
  // Try partial match
  for (const [key, value] of Object.entries(translations)) {
    if (field.toLowerCase().includes(key.toLowerCase())) {
      return value;
    }
  }
  
  // Return original with better formatting
  return field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Try to extract field name from error message
 */
function extractFieldFromMessage(msg: string): string {
  // Look for common patterns
  const patterns = [
    /campo\s+"([^"]+)"/i,
    /"([^"]+)"\s+é\s+obrigatório/i,
    /(\w+):\s*required/i,
    /(\w+)\s+is\s+required/i,
  ];
  
  for (const pattern of patterns) {
    const match = msg.match(pattern);
    if (match?.[1]) return match[1];
  }
  
  return 'campo';
}

/**
 * Parse an error and return a user-friendly message
 */
export function getFriendlyError(error: unknown): FriendlyError {
  // Extract message from various error types
  let message = 'Erro desconhecido';
  let details = '';
  
  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'string') {
    message = error;
  } else if (error && typeof error === 'object') {
    const err = error as any;
    message = err.message || err.error || err.msg || JSON.stringify(error);
    details = err.details || err.hint || '';
  }
  
  // Try to match against known patterns
  for (const { pattern, getError } of ERROR_PATTERNS) {
    const matches = typeof pattern === 'function' 
      ? pattern(message) || pattern(details)
      : pattern.test(message) || pattern.test(details);
      
    if (matches) {
      return getError(message, details);
    }
  }
  
  // Default fallback
  return {
    title: 'Erro ao salvar',
    description: message.length > 100 ? message.substring(0, 100) + '...' : message,
    suggestion: 'Tente novamente. Se o problema persistir, entre em contato com o suporte.'
  };
}

/**
 * Format a friendly error for toast display
 */
export function toastFriendlyError(error: unknown): { title: string; description: string } {
  const friendly = getFriendlyError(error);
  return {
    title: friendly.title,
    description: friendly.suggestion 
      ? `${friendly.description} ${friendly.suggestion}`
      : friendly.description
  };
}
