import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Correios API URLs
const CORREIOS_API_URLS = {
  HOMOLOGACAO: 'https://apihom.correios.com.br',
  PRODUCAO: 'https://api.correios.com.br',
};

type CorreiosErrorBody = {
  codigo?: string | number;
  mensagem?: string;
  causa?: unknown;
  [key: string]: unknown;
};

class CorreiosApiError extends Error {
  status: number;
  endpoint: string;
  rawBody: string;
  parsedBody?: CorreiosErrorBody;

  constructor(args: {
    message: string;
    status: number;
    endpoint: string;
    rawBody: string;
    parsedBody?: CorreiosErrorBody;
  }) {
    super(args.message);
    this.name = 'CorreiosApiError';
    this.status = args.status;
    this.endpoint = args.endpoint;
    this.rawBody = args.rawBody;
    this.parsedBody = args.parsedBody;
  }
}

async function parseCorreiosErrorResponse(response: Response, endpoint: string) {
  const rawBody = await response.text();
  let parsedBody: CorreiosErrorBody | undefined;

  try {
    parsedBody = rawBody ? (JSON.parse(rawBody) as CorreiosErrorBody) : undefined;
  } catch {
    parsedBody = undefined;
  }

  // Correios costuma devolver { codigo, mensagem }
  const humanMessage =
    parsedBody?.mensagem ||
    (typeof parsedBody?.message === 'string' ? (parsedBody.message as string) : undefined) ||
    rawBody ||
    'Erro desconhecido retornado pelos Correios.';

  return { rawBody, parsedBody, humanMessage };
}

interface CorreiosConfig {
  id_correios: string;
  codigo_acesso_encrypted: string;
  contrato: string;
  cartao_postagem: string;
  ambiente: 'HOMOLOGACAO' | 'PRODUCAO';
  sender_name: string;
  sender_cpf_cnpj: string;
  sender_street: string;
  sender_number: string;
  sender_complement: string;
  sender_neighborhood: string;
  sender_city: string;
  sender_state: string;
  sender_cep: string;
  sender_phone: string;
  sender_email: string;
  default_service_code: string;
  default_package_type: string;
  default_weight_grams: number;
  default_height_cm: number;
  default_width_cm: number;
  default_length_cm: number;
}

interface LabelRequest {
  organization_id: string;
  sale_id?: string;
  recipient: {
    name: string;
    cpf_cnpj?: string;
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    cep: string;
    phone?: string;
    email?: string;
  };
  package?: {
    weight_grams?: number;
    height_cm?: number;
    width_cm?: number;
    length_cm?: number;
    declared_value_cents?: number;
  };
  service_code?: string;
  invoice_number?: string;
  invoice_key?: string;
}

// Simple encryption/decryption using base64 + XOR (for demo - in production use proper encryption)
function decrypt(encrypted: string): string {
  try {
    const key = Deno.env.get('CORREIOS_ENCRYPTION_KEY') || 'morphews-correios-2024';
    const decoded = atob(encrypted);
    let result = '';
    for (let i = 0; i < decoded.length; i++) {
      result += String.fromCharCode(decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return result;
  } catch {
    return encrypted; // Return as-is if not encrypted
  }
}

async function authenticateCorreios(config: CorreiosConfig): Promise<string> {
  const baseUrl = CORREIOS_API_URLS[config.ambiente];
  const codigoAcesso = decrypt(config.codigo_acesso_encrypted);
  
  // Create Basic Auth header
  const credentials = btoa(`${config.id_correios}:${codigoAcesso}`);
  
  const endpoint = `${baseUrl}/token/v1/autentica/cartaopostagem`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      numero: config.cartao_postagem,
    }),
  });

  if (!response.ok) {
    const { rawBody, parsedBody, humanMessage } = await parseCorreiosErrorResponse(response, endpoint);
    console.error('Correios auth error:', response.status, rawBody);
    throw new CorreiosApiError({
      message: `Falha na autenticação com Correios (${response.status}): ${humanMessage}`,
      status: response.status,
      endpoint,
      rawBody,
      parsedBody,
    });
  }

  const data = await response.json();
  return data.token;
}

// Correios dimension and weight limits per service type
// Reference: https://www.correios.com.br/enviar/encomendas/limites-de-dimensoes-e-peso
interface ServiceLimits {
  minWeight: number; // grams
  maxWeight: number; // grams
  minHeight: number; // cm
  maxHeight: number; // cm
  minWidth: number; // cm
  maxWidth: number; // cm
  minLength: number; // cm
  maxLength: number; // cm
  minSumDimensions: number; // cm (altura + largura + comprimento)
  maxSumDimensions: number; // cm
}

const SERVICE_LIMITS: Record<string, ServiceLimits> = {
  // PAC services
  '03298': { minWeight: 1, maxWeight: 30000, minHeight: 2, maxHeight: 100, minWidth: 11, maxWidth: 100, minLength: 16, maxLength: 100, minSumDimensions: 29, maxSumDimensions: 200 },
  '03085': { minWeight: 1, maxWeight: 30000, minHeight: 2, maxHeight: 100, minWidth: 11, maxWidth: 100, minLength: 16, maxLength: 100, minSumDimensions: 29, maxSumDimensions: 200 },
  // SEDEX services
  '03220': { minWeight: 1, maxWeight: 30000, minHeight: 2, maxHeight: 100, minWidth: 11, maxWidth: 100, minLength: 16, maxLength: 100, minSumDimensions: 29, maxSumDimensions: 200 },
  '03050': { minWeight: 1, maxWeight: 30000, minHeight: 2, maxHeight: 100, minWidth: 11, maxWidth: 100, minLength: 16, maxLength: 100, minSumDimensions: 29, maxSumDimensions: 200 },
  // SEDEX 10
  '03158': { minWeight: 1, maxWeight: 10000, minHeight: 2, maxHeight: 60, minWidth: 11, maxWidth: 60, minLength: 16, maxLength: 60, minSumDimensions: 29, maxSumDimensions: 150 },
  // SEDEX 12
  '03140': { minWeight: 1, maxWeight: 10000, minHeight: 2, maxHeight: 60, minWidth: 11, maxWidth: 60, minLength: 16, maxLength: 60, minSumDimensions: 29, maxSumDimensions: 150 },
  // SEDEX Hoje
  '03204': { minWeight: 1, maxWeight: 10000, minHeight: 2, maxHeight: 60, minWidth: 11, maxWidth: 60, minLength: 16, maxLength: 60, minSumDimensions: 29, maxSumDimensions: 150 },
};

// Default limits for unknown services
const DEFAULT_LIMITS: ServiceLimits = {
  minWeight: 1, maxWeight: 30000,
  minHeight: 2, maxHeight: 100,
  minWidth: 11, maxWidth: 100,
  minLength: 16, maxLength: 100,
  minSumDimensions: 29, maxSumDimensions: 200
};

function validateAndAdjustDimensions(
  pkg: { weight_grams?: number; height_cm?: number; width_cm?: number; length_cm?: number },
  config: CorreiosConfig,
  serviceCode: string
): { weight: number; height: number; width: number; length: number } {
  const limits = SERVICE_LIMITS[serviceCode] || DEFAULT_LIMITS;
  
  // CRITICAL: Parse values as integers to ensure proper typing for Correios API
  // The API strictly requires integer values, not strings or floats
  const parseIntSafe = (val: unknown, fallback: number): number => {
    if (val === null || val === undefined) return fallback;
    const parsed = parseInt(String(val), 10);
    return isNaN(parsed) ? fallback : parsed;
  };
  
  // Get values with explicit integer parsing and fallbacks
  let weight = parseIntSafe(pkg.weight_grams, 0) || parseIntSafe(config.default_weight_grams, 500);
  let height = parseIntSafe(pkg.height_cm, 0) || parseIntSafe(config.default_height_cm, 2);
  let width = parseIntSafe(pkg.width_cm, 0) || parseIntSafe(config.default_width_cm, 11);
  let length = parseIntSafe(pkg.length_cm, 0) || parseIntSafe(config.default_length_cm, 16);
  
  // Apply minimum limits
  weight = Math.max(weight, limits.minWeight);
  height = Math.max(height, limits.minHeight);
  width = Math.max(width, limits.minWidth);
  length = Math.max(length, limits.minLength);
  
  // Apply maximum limits
  weight = Math.min(weight, limits.maxWeight);
  height = Math.min(height, limits.maxHeight);
  width = Math.min(width, limits.maxWidth);
  length = Math.min(length, limits.maxLength);
  
  // Ensure sum of dimensions is at least minSumDimensions
  const sumDimensions = height + width + length;
  if (sumDimensions < limits.minSumDimensions) {
    // Increase length to meet minimum
    length = limits.minSumDimensions - height - width;
  }
  
  // Ensure all values are integers (Correios API requirement)
  weight = Math.round(weight);
  height = Math.round(height);
  width = Math.round(width);
  length = Math.round(length);
  
  console.log(`Dimensions validated: weight=${weight}g, height=${height}cm, width=${width}cm, length=${length}cm (sum=${height + width + length}cm)`);
  
  return { weight, height, width, length };
}

// Build objetoPostal structure for PPN v3 API
// CRITICAL: The API requires specific field names and structure
// Based on latest Correios API docs: https://cws.correios.com.br/
function buildObjetoPostalPPNv3(
  tipoObjeto: string,
  formatCode: number,
  dimensions: { weight: number; height: number; width: number; length: number },
  declaredValueCents?: number,
  includeDeclaracao: boolean = true
): Record<string, unknown> {
  // CRITICAL: ALL fields must be STRINGS for Correios API compatibility
  // The Correios API parser is very strict and some contracts only accept strings
  const pesoNum = Math.max(1, Math.round(Number(dimensions.weight) || 500));
  const alturaNum = Math.max(2, Math.round(Number(dimensions.height) || 10));
  const larguraNum = Math.max(11, Math.round(Number(dimensions.width) || 15));
  const comprimentoNum = Math.max(16, Math.round(Number(dimensions.length) || 20));
  
  // Valor declarado em reais (decimal) - minimum R$ 25,00 for PAC/SEDEX with declared value
  const valorDeclaradoNum = declaredValueCents && declaredValueCents > 0 
    ? Number((declaredValueCents / 100).toFixed(2)) 
    : 100.00; // Default R$ 100 if not specified

  // Convert ALL to strings for maximum compatibility
  const peso = String(pesoNum);
  const altura = String(alturaNum);
  const largura = String(larguraNum);
  const comprimento = String(comprimentoNum);
  const valorDeclarado = String(valorDeclaradoNum);
  const codigoFormato = String(formatCode);

  console.log('Building objetoPostal with STRING values:', {
    tipoObjeto: String(tipoObjeto).toUpperCase(),
    codigoFormatoObjeto: codigoFormato,
    peso,
    altura,
    largura,
    comprimento,
    valorDeclarado,
    includeDeclaracao
  });

  const obj: Record<string, unknown> = {
    tipoObjeto: String(tipoObjeto).toUpperCase(),
    codigoFormatoObjeto: codigoFormato,  // "1"=Envelope, "2"=Caixa, "3"=Cilindro/Rolo
    peso: peso,  // String em gramas
    objetosProibidos: "N",
    vlrDeclarado: valorDeclarado,
    dimensao: {
      altura: altura,
      largura: largura,
      comprimento: comprimento,
    },
  };

  // Include declaration content INSIDE the object (PPN v3 requirement)
  // This is REQUIRED when not sending invoice (NFe)
  // The itensDeclaracaoConteudo MUST include: conteudo, quantidade, valor, peso - ALL AS STRINGS
  if (includeDeclaracao) {
    obj.itensDeclaracaoConteudo = [
      {
        conteudo: "Produtos diversos",
        quantidade: "1",           // STRING
        valor: valorDeclarado,     // STRING
        peso: peso,                // STRING - CRITICAL: peso is required in each item
      }
    ];
  }

  console.log('Built objetoPostal:', JSON.stringify(obj, null, 2));
  return obj;
}

async function getDeclaracaoConteudoPdf(
  config: CorreiosConfig,
  token: string,
  prePostagemId: string
): Promise<ArrayBuffer> {
  const baseUrl = CORREIOS_API_URLS[config.ambiente];

  // A documentação já mudou esse endpoint algumas vezes; tentamos os 2 formatos mais comuns.
  const endpoints = [
    `${baseUrl}/prepostagem/v1/prepostagens/${prePostagemId}/declaracaoConteudo`,
    `${baseUrl}/prepostagem/v1/prepostagens/declaracaoconteudo/${prePostagemId}`,
  ];

  let lastError: unknown = null;
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/pdf',
        },
      });

      if (!response.ok) {
        const { rawBody, parsedBody, humanMessage } = await parseCorreiosErrorResponse(response, endpoint);
        throw new CorreiosApiError({
          message: `Falha ao obter declaração de conteúdo (${response.status}): ${humanMessage}`,
          status: response.status,
          endpoint,
          rawBody,
          parsedBody,
        });
      }

      return await response.arrayBuffer();
    } catch (e) {
      lastError = e;
    }
  }

  throw lastError;
}

async function createPrePostagem(
  config: CorreiosConfig,
  token: string,
  request: LabelRequest
): Promise<any> {
  const baseUrl = CORREIOS_API_URLS[config.ambiente];
  
  const serviceCode = request.service_code || config.default_service_code;
  const pkg = request.package || {};
  
  console.log('=== createPrePostagem DEBUG ===');
  console.log('Config defaults:', {
    default_weight_grams: config.default_weight_grams,
    default_height_cm: config.default_height_cm,
    default_width_cm: config.default_width_cm,
    default_length_cm: config.default_length_cm,
    default_package_type: config.default_package_type,
    default_service_code: config.default_service_code,
  });
  console.log('Request package:', pkg);
  console.log('Service code to use:', serviceCode);
  
  // Validate and adjust dimensions according to Correios limits
  const dimensions = validateAndAdjustDimensions(pkg, config, serviceCode);
  
  console.log('Final dimensions after validation:', dimensions);
  
  // Determine package format
  const packageType = (config.default_package_type || 'caixa').toLowerCase().trim();
  const formatCode: number = packageType === 'envelope' ? 1 :
                             packageType === 'cilindro' ? 3 : 2;
  const tipoObjeto: string = packageType === 'envelope' ? 'ENVELOPE' : 
                             packageType === 'cilindro' ? 'ROLO' : 'CAIXA';
  
  console.log(`Package type: ${packageType}, formatCode: ${formatCode} (type: ${typeof formatCode}), tipoObjeto: ${tipoObjeto}`);
  
  // Parse phones
  type ParsedPhone = { ddd: string; numero: string; kind: 'mobile' | 'landline' } | null;
  
  const parseBrPhone = (phone?: string | null): ParsedPhone => {
    if (!phone) return null;
    let digits = phone.replace(/\D/g, '');
    
    console.log(`Parsing phone: "${phone}" -> digits: "${digits}" (length: ${digits.length})`);

    while (digits.length > 11 && digits.startsWith('55')) {
      digits = digits.slice(2);
    }
    
    if (digits.length > 11) {
      digits = digits.slice(-11);
    }

    if (digits.length < 10) {
      console.log(`Phone too short after processing: ${digits.length} digits`);
      return null;
    }
    
    if (digits.length === 10) {
      return { ddd: digits.slice(0, 2), numero: digits.slice(2), kind: 'landline' };
    }
    
    if (digits.length === 11) {
      const ddd = digits.slice(0, 2);
      const numero = digits.slice(2);
      if (numero.startsWith('9')) {
        return { ddd, numero, kind: 'mobile' };
      } else {
        console.log(`11 digits but not starting with 9 - treating as landline`);
        return { ddd, numero: numero.slice(1), kind: 'landline' };
      }
    }
    
    return null;
  };

  const senderPhone = parseBrPhone(config.sender_phone);
  const recipientPhone = parseBrPhone(request.recipient.phone);
  
  console.log('Sender phone parsed:', senderPhone);
  console.log('Recipient phone parsed:', recipientPhone);

  // Build remetente object
  const remetente: Record<string, unknown> = {
    nome: config.sender_name,
    cpfCnpj: config.sender_cpf_cnpj?.replace(/\D/g, ''),
    endereco: {
      logradouro: config.sender_street,
      numero: config.sender_number,
      complemento: config.sender_complement || '',
      bairro: config.sender_neighborhood,
      cidade: config.sender_city,
      uf: config.sender_state?.toUpperCase(),
      cep: config.sender_cep?.replace(/\D/g, ''),
    },
    email: config.sender_email,
  };
  
  if (senderPhone) {
    if (senderPhone.kind === 'mobile') {
      remetente.dddCelular = senderPhone.ddd;
      remetente.celular = senderPhone.numero;
    } else {
      remetente.dddTelefone = senderPhone.ddd;
      remetente.telefone = senderPhone.numero;
    }
  }

  // Build destinatario object
  const destinatario: Record<string, unknown> = {
    nome: request.recipient.name,
    cpfCnpj: request.recipient.cpf_cnpj?.replace(/\D/g, '') || undefined,
    endereco: {
      logradouro: request.recipient.street,
      numero: request.recipient.number,
      complemento: request.recipient.complement || '',
      bairro: request.recipient.neighborhood,
      cidade: request.recipient.city,
      uf: request.recipient.state?.toUpperCase(),
      cep: request.recipient.cep?.replace(/\D/g, ''),
    },
    email: request.recipient.email || undefined,
  };
  
  if (recipientPhone) {
    if (recipientPhone.kind === 'mobile') {
      destinatario.dddCelular = recipientPhone.ddd;
      destinatario.celular = recipientPhone.numero;
    } else {
      destinatario.dddTelefone = recipientPhone.ddd;
      destinatario.telefone = recipientPhone.numero;
    }
  }

  // ======================================================
  // IMPORTANT: NF-e key validation (44 digits)
  // Some clients accidentally send invoice_key as a non-empty string
  // like "undefined" / "null" / whitespace / partial digits.
  // If we treat that as "has invoice", we stop sending Declaração de
  // Conteúdo, and the Correios API responds with PPN-347 + cascaded null errors.
  // ======================================================
  const invoiceKeyDigits = String((request as any)?.invoice_key ?? '').replace(/\D/g, '');
  const hasValidInvoiceKey = invoiceKeyDigits.length === 44;

  // Build objetoPostal with declaração de conteúdo INSIDE (PPN v3 requirement)
  const useDeclaracao = !hasValidInvoiceKey;
  const objetoPostal = buildObjetoPostalPPNv3(
    tipoObjeto,
    formatCode,
    dimensions,
    pkg.declared_value_cents,
    useDeclaracao
  );

  // Build documentoFiscal ONLY when we have a valid NF-e key
  let documentoFiscal: Record<string, unknown> | undefined;
  if (hasValidInvoiceKey) {
    documentoFiscal = {
      tipo: 'NFE',
      numero: request.invoice_number || '',
      chave: invoiceKeyDigits,
    };
  }

  // ======================================================
  // PPN v3: CRITICAL STRUCTURE
  // 1. possuiDeclaracaoConteudo: "S" (string, not boolean!) at root level
  // 2. itensDeclaracaoConteudo INSIDE objetosPostais (not at root)
  // 3. objetosPostais (plural array), never objetoPostal (singular)
  // Without this exact structure, the API ignores the entire object
  // and returns misleading "null" errors for all fields.
  // ======================================================
  
  const payload: Record<string, unknown> = {
    codigoServico: serviceCode,
    remetente,
    destinatario,
    objetosPostais: [objetoPostal],
  };
  
  // CRITICAL: possuiDeclaracaoConteudo must be "S" (string) when no valid NF-e is provided
  // This flag at root level tells the API to expect itensDeclaracaoConteudo inside objetosPostais
  if (useDeclaracao) {
    payload.possuiDeclaracaoConteudo = "S";
  }

  // idCorreios é opcional e NUNCA deve ir como null
  if (config.id_correios) {
    payload.idCorreios = config.id_correios;
  }

  if (documentoFiscal) {
    payload.documentoFiscal = documentoFiscal;
  }

  // Compact debug line (keeps logs readable and avoids truncation)
  try {
    const op0 = objetoPostal as any;
    console.log(
      'PPN payload summary:',
      JSON.stringify(
        {
          codigoServico: serviceCode,
          possuiDeclaracaoConteudo: (payload as any).possuiDeclaracaoConteudo ?? null,
          hasValidInvoiceKey,
          objetoPostal: {
            codigoFormatoObjeto: op0?.codigoFormatoObjeto ?? null,
            peso: op0?.peso ?? null,
            objetosProibidos: op0?.objetosProibidos ?? null,
            itensDeclaracaoConteudo_len: Array.isArray(op0?.itensDeclaracaoConteudo)
              ? op0.itensDeclaracaoConteudo.length
              : 0,
          },
        },
        null,
        0
      )
    );
  } catch {
    // ignore logging errors
  }

  const endpoint = `${baseUrl}/prepostagem/v1/prepostagens`;
  console.log(`\n========== Creating prepostagem (PPN v3) ==========`);
  console.log('Full Payload:', JSON.stringify(payload, null, 2));
  
  // Store payload for debugging in case of error
  const payloadForDebug = structuredClone(payload);

  const doRequest = async (payloadToSend: Record<string, unknown>) => {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payloadToSend),
    });

    if (response.ok) {
      return { ok: true as const, data: await response.json() };
    }

    const { rawBody, parsedBody, humanMessage } = await parseCorreiosErrorResponse(response, endpoint);
    return { ok: false as const, status: response.status, rawBody, parsedBody, humanMessage };
  };

  const first = await doRequest(payload);
  if (first.ok) return first.data;

  // Heuristic retry:
  // Correios frequentemente retorna validações como se os campos estivessem "null"
  // mesmo quando enviados (parse/contrato extremamente rígido). Na prática, alguns
  // contratos/ambientes aceitam apenas strings em certos campos.
  const shouldRetry =
    first.status === 400 &&
    typeof first.rawBody === 'string' &&
    (first.rawBody.includes('PPN-347') ||
      first.rawBody.includes('Formato de objeto nao encontrado para o codigo: null') ||
      first.rawBody.includes('Peso: Peso do objeto não informado') ||
      first.rawBody.includes('PPN-330'));

  if (shouldRetry) {
    // ======================================================
    // IMPORTANT:
    // Os Correios têm múltiplas variações de schema em produção (dependendo do contrato/cartão).
    // Quando o parser NÃO reconhece a estrutura, ele acusa campos como se fossem "null".
    // Então, além de stringificar, tentamos variações de nesting comuns:
    //  - objetosPostais: [ { ... } ]  (nosso padrão)
    //  - objetoPostal: { ... }       (variante singular)
    //  - campos do objeto no root    (variante legacy)
    // ======================================================

    const stringifyObjetoPostal = (op: any) => {
      if (!op || typeof op !== 'object') return op;
      const next = structuredClone(op);
      if (next.codigoFormatoObjeto != null) next.codigoFormatoObjeto = String(next.codigoFormatoObjeto);
      if (next.peso != null) next.peso = String(next.peso);
      if (next.objetosProibidos != null) next.objetosProibidos = String(next.objetosProibidos);
      if (next.vlrDeclarado != null) next.vlrDeclarado = String(next.vlrDeclarado);

      if (next.dimensao && typeof next.dimensao === 'object') {
        if (next.dimensao.altura != null) next.dimensao.altura = String(next.dimensao.altura);
        if (next.dimensao.largura != null) next.dimensao.largura = String(next.dimensao.largura);
        if (next.dimensao.comprimento != null) next.dimensao.comprimento = String(next.dimensao.comprimento);
      }

      if (Array.isArray(next.itensDeclaracaoConteudo)) {
        next.itensDeclaracaoConteudo = next.itensDeclaracaoConteudo.map((it: any) => ({
          ...it,
          quantidade: it?.quantidade != null ? String(it.quantidade) : it?.quantidade,
          valor: it?.valor != null ? String(it.valor) : it?.valor,
          peso: it?.peso != null ? String(it.peso) : it?.peso,
        }));
      }
      return next;
    };

    const baseRetry = structuredClone(payload) as any;
    baseRetry.possuiDeclaracaoConteudo = baseRetry.possuiDeclaracaoConteudo ?? 'S';
    const op0 = baseRetry?.objetosPostais?.[0];
    const op0Str = stringifyObjetoPostal(op0);
    if (op0Str && typeof op0Str === 'object') {
      op0Str.possuiDeclaracaoConteudo = baseRetry.possuiDeclaracaoConteudo;
      baseRetry.objetosPostais = [op0Str];
    }

    console.log('Retry variant A (objetosPostais + stringified):', JSON.stringify(baseRetry, null, 2));
    const secondA = await doRequest(baseRetry);
    if (secondA.ok) return secondA.data;

    // Variant B: objetoPostal (singular)
    const variantB = structuredClone(baseRetry) as any;
    const opB = variantB?.objetosPostais?.[0];
    delete variantB.objetosPostais;
    variantB.objetoPostal = opB;
    console.log('Retry variant B (objetoPostal singular):', JSON.stringify(variantB, null, 2));
    const secondB = await doRequest(variantB);
    if (secondB.ok) return secondB.data;

    // Variant C: campos do objeto no root (legacy)
    const variantC = structuredClone(baseRetry) as any;
    const opC = variantC?.objetosPostais?.[0];
    delete variantC.objetosPostais;
    if (opC && typeof opC === 'object') {
      // remove duplicações que poderiam conflitar no root
      const { possuiDeclaracaoConteudo: _pdc, ...opNoFlag } = opC;
      Object.assign(variantC, opNoFlag);
    }
    console.log('Retry variant C (flatten objetoPostal to root):', JSON.stringify(variantC, null, 2));
    const secondC = await doRequest(variantC);
    if (secondC.ok) return secondC.data;

    // Se todas as variações falharam, devolve o último erro (mantendo rawBody)
    console.error(`Prepostagem failed after retries (A/B/C). Last status (${secondC.status}):`, secondC.rawBody);
    const err = new CorreiosApiError({
      message: `Falha ao criar pré-postagem (${secondC.status}): ${secondC.humanMessage}`,
      status: secondC.status,
      endpoint,
      rawBody: secondC.rawBody,
      parsedBody: secondC.parsedBody,
    });
    // Attach original payload for debugging
    (err as any).payloadSent = payloadForDebug;
    throw err;
  }

  console.error(`Prepostagem failed (${first.status}):`, first.rawBody);
  const err = new CorreiosApiError({
    message: `Falha ao criar pré-postagem (${first.status}): ${first.humanMessage}`,
    status: first.status,
    endpoint,
    rawBody: first.rawBody,
    parsedBody: first.parsedBody,
  });
  // Attach original payload for debugging
  (err as any).payloadSent = payloadForDebug;
  throw err;
}

async function getLabel(config: CorreiosConfig, token: string, prePostagemId: string): Promise<ArrayBuffer> {
  const baseUrl = CORREIOS_API_URLS[config.ambiente];

  const endpoint = `${baseUrl}/prepostagem/v1/prepostagens/${prePostagemId}/rotulo`;
  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/pdf',
    },
  });

  if (!response.ok) {
    const { rawBody, parsedBody, humanMessage } = await parseCorreiosErrorResponse(response, endpoint);
    console.error('Correios label error:', response.status, rawBody);
    throw new CorreiosApiError({
      message: `Falha ao obter etiqueta (${response.status}): ${humanMessage}`,
      status: response.status,
      endpoint,
      rawBody,
      parsedBody,
    });
  }

  return await response.arrayBuffer();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let action: string | undefined;
  let paramsForLog: Record<string, unknown> | undefined;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    action = body?.action;
    const { action: _action, ...params } = body;
    paramsForLog = params;

    switch (action) {
      case 'test_connection': {
        const { organization_id } = params;
        
        // Get config
        const { data: config, error: configError } = await supabase
          .from('correios_config')
          .select('*')
          .eq('organization_id', organization_id)
          .single();

        if (configError || !config) {
          throw new Error('Configuração de Correios não encontrada');
        }

        // Test authentication
        const token = await authenticateCorreios(config);
        
        return new Response(
          JSON.stringify({ success: true, message: 'Conexão com Correios estabelecida com sucesso!' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'generate_label': {
        const { organization_id, sale_id, recipient, package: pkg, service_code, invoice_number, invoice_key } = params as LabelRequest;

        // Get config
        const { data: config, error: configError } = await supabase
          .from('correios_config')
          .select('*')
          .eq('organization_id', organization_id)
          .single();

        if (configError || !config) {
          throw new Error('Configuração de Correios não encontrada. Configure suas credenciais primeiro.');
        }

        if (!config.is_active) {
          throw new Error('Integração com Correios está desativada.');
        }

        // Authenticate
        const token = await authenticateCorreios(config);

        // Create pre-postagem
        const prePostagem = await createPrePostagem(config, token, {
          organization_id,
          sale_id,
          recipient,
          package: pkg,
          service_code,
          invoice_number,
          invoice_key,
        });

        console.log('Pre-postagem created:', prePostagem);

        // Get label PDF
        const labelPdf = await getLabel(config, token, prePostagem.id);

        // (Opcional) Get declaração de conteúdo PDF quando NÃO há NF-e válida (44 dígitos)
        // Não deve bloquear a geração da etiqueta se falhar.
        let declaracaoPublicUrl: string | null = null;
        const invoiceKeyDigits = String(invoice_key ?? '').replace(/\D/g, '');
        const hasValidInvoiceKey = invoiceKeyDigits.length === 44;
        if (!hasValidInvoiceKey) {
          try {
            const declPdf = await getDeclaracaoConteudoPdf(config, token, prePostagem.id);
            const declFileName = `correios-declaracoes/${organization_id}/${prePostagem.codigoRastreio || prePostagem.id}.pdf`;

            const { error: declUploadError } = await supabase.storage
              .from('sales-documents')
              .upload(declFileName, declPdf, {
                contentType: 'application/pdf',
                upsert: true,
              });

            if (declUploadError) {
              console.error('Declaration upload error:', declUploadError);
            } else {
              const { data: declUrlData } = supabase.storage
                .from('sales-documents')
                .getPublicUrl(declFileName);
              declaracaoPublicUrl = declUrlData?.publicUrl ?? null;
            }
          } catch (e) {
            console.error('Declaration PDF fetch error (non-blocking):', e);
          }
        }

        // Upload PDF to Supabase Storage
        const fileName = `correios-labels/${organization_id}/${prePostagem.codigoRastreio || prePostagem.id}.pdf`;
        
        const { error: uploadError } = await supabase.storage
          .from('sales-documents')
          .upload(fileName, labelPdf, {
            contentType: 'application/pdf',
            upsert: true,
          });

        if (uploadError) {
          console.error('Upload error:', uploadError);
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('sales-documents')
          .getPublicUrl(fileName);

        // Save label record
        const { data: labelRecord, error: insertError } = await supabase
          .from('correios_labels')
          .insert({
            organization_id,
            sale_id,
            tracking_code: prePostagem.codigoRastreio || prePostagem.id,
            service_code: service_code || config.default_service_code,
            service_name: getServiceName(service_code || config.default_service_code),
            recipient_name: recipient.name,
            recipient_cpf_cnpj: recipient.cpf_cnpj,
            recipient_street: recipient.street,
            recipient_number: recipient.number,
            recipient_complement: recipient.complement,
            recipient_neighborhood: recipient.neighborhood,
            recipient_city: recipient.city,
            recipient_state: recipient.state,
            recipient_cep: recipient.cep,
            recipient_phone: recipient.phone,
            weight_grams: pkg?.weight_grams || config.default_weight_grams,
            height_cm: pkg?.height_cm || config.default_height_cm,
            width_cm: pkg?.width_cm || config.default_width_cm,
            length_cm: pkg?.length_cm || config.default_length_cm,
            declared_value_cents: pkg?.declared_value_cents,
            label_pdf_url: urlData?.publicUrl,
            declaration_pdf_url: declaracaoPublicUrl,
            status: 'generated',
            correios_prepostagem_id: prePostagem.id,
            api_response: prePostagem,
          })
          .select()
          .single();

        if (insertError) {
          console.error('Insert label error:', insertError);
        }

        // Update sale with tracking code and carrier tracking status if sale_id provided
        if (sale_id && prePostagem.codigoRastreio) {
          await supabase
            .from('sales')
            .update({ 
              tracking_code: prePostagem.codigoRastreio,
              carrier_tracking_status: 'waiting_post',
            })
            .eq('id', sale_id);

          // Insert carrier tracking history entry
          const { data: saleData } = await supabase
            .from('sales')
            .select('organization_id')
            .eq('id', sale_id)
            .single();

          if (saleData) {
            await supabase
              .from('carrier_tracking_history')
              .insert({
                sale_id,
                organization_id: saleData.organization_id,
                status: 'waiting_post',
                notes: `Etiqueta gerada - Rastreio: ${prePostagem.codigoRastreio}`,
              });
          }
        }

        // Extract shipping cost from API response if available
        const shippingCostCents = prePostagem.valorServico 
          ? Math.round(parseFloat(prePostagem.valorServico) * 100) 
          : prePostagem.valorTotal 
            ? Math.round(parseFloat(prePostagem.valorTotal) * 100) 
            : null;

        return new Response(
          JSON.stringify({
            success: true,
            label: labelRecord,
            tracking_code: prePostagem.codigoRastreio,
            pdf_url: urlData?.publicUrl,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get_services': {
        // Return available Correios services
        const services = [
          { code: '03220', name: 'SEDEX', description: 'Entrega expressa' },
          { code: '03298', name: 'PAC', description: 'Entrega econômica' },
          { code: '04162', name: 'SEDEX 12', description: 'Entrega até 12h' },
          { code: '04170', name: 'SEDEX 10', description: 'Entrega até 10h' },
          { code: '04669', name: 'PAC Mini', description: 'Para objetos pequenos' },
          { code: '04227', name: 'Mini Envios', description: 'Objetos até 300g' },
        ];

        return new Response(
          JSON.stringify({ success: true, services }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'save_config': {
        const { organization_id, config: newConfig } = params;
        
        // Encrypt the codigo_acesso if provided
        let encryptedCodigo = newConfig.codigo_acesso_encrypted;
        if (newConfig.codigo_acesso && !newConfig.codigo_acesso.startsWith('enc:')) {
          const key = Deno.env.get('CORREIOS_ENCRYPTION_KEY') || 'morphews-correios-2024';
          let encrypted = '';
          for (let i = 0; i < newConfig.codigo_acesso.length; i++) {
            encrypted += String.fromCharCode(newConfig.codigo_acesso.charCodeAt(i) ^ key.charCodeAt(i % key.length));
          }
          encryptedCodigo = btoa(encrypted);
        }

        const configData = {
          organization_id,
          ...newConfig,
          codigo_acesso_encrypted: encryptedCodigo,
        };
        delete configData.codigo_acesso; // Remove plain text password

        const { data, error } = await supabase
          .from('correios_config')
          .upsert(configData, { onConflict: 'organization_id' })
          .select()
          .single();

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true, config: data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        throw new Error(`Ação desconhecida: ${action}`);
    }
  } catch (error: any) {
    console.error('Correios API error:', error);

    // Persistir o erro para investigação (sem travar o usuário em erro “genérico”)
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const organization_id = (paramsForLog?.organization_id as string | undefined) || null;
      const details: Record<string, unknown> = {
        action: action || null,
        sale_id: (paramsForLog?.sale_id as string | undefined) || null,
        // Full payload sent to Correios API for debugging
        payload_sent: (paramsForLog as any)?.payloadForDebug || null,
        recipient: (paramsForLog as any)?.recipient || null,
        package: (paramsForLog as any)?.package || null,
        service_code: (paramsForLog as any)?.service_code || null,
      };

      if (error?.name === 'CorreiosApiError') {
        const e = error as CorreiosApiError;
        details.endpoint = e.endpoint;
        details.status = e.status;
        details.rawBody = e.rawBody;
        details.parsedBody = e.parsedBody;
        // Include the exact payload sent to Correios API
        details.payload_sent = (e as any).payloadSent || null;
      }

      await supabase.from('error_logs').insert({
        organization_id,
        source: 'correios-api',
        error_type: 'correios_label',
        error_message: String(error?.message || 'Erro desconhecido'),
        error_details: details,
      });
    } catch (logError) {
      console.error('Failed to persist Correios error log:', logError);
    }

    // IMPORTANT: retornar 200 para o client sempre receber o body com o erro real
    const payload: Record<string, unknown> = {
      success: false,
      error: String(error?.message || 'Erro desconhecido'),
    };

    if (error?.name === 'CorreiosApiError') {
      const e = error as CorreiosApiError;
      payload.error_code = e.parsedBody?.codigo || e.status;
      payload.correios = {
        status: e.status,
        endpoint: e.endpoint,
        mensagem: e.parsedBody?.mensagem,
        causa: e.parsedBody?.causa,
      };
    }

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function getServiceName(code: string): string {
  const services: Record<string, string> = {
    '03220': 'SEDEX',
    '03298': 'PAC',
    '04162': 'SEDEX 12',
    '04170': 'SEDEX 10',
    '04669': 'PAC Mini',
    '04227': 'Mini Envios',
  };
  return services[code] || code;
}
