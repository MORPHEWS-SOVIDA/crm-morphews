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
  
  const response = await fetch(`${baseUrl}/token/v1/autentica/cartaopostagem`, {
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
    const errorText = await response.text();
    console.error('Correios auth error:', response.status, errorText);
    throw new Error(`Falha na autenticação com Correios: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.token;
}

async function createPrePostagem(
  config: CorreiosConfig,
  token: string,
  request: LabelRequest
): Promise<any> {
  const baseUrl = CORREIOS_API_URLS[config.ambiente];
  
  const serviceCode = request.service_code || config.default_service_code;
  const pkg = request.package || {};
  
  // Determine package format based on type
  const formatCode = config.default_package_type === 'envelope' ? '1' : 
                     config.default_package_type === 'cilindro' ? '3' : '2'; // 1=Envelope, 2=Caixa, 3=Cilindro
  
  // Format phone according to Correios expectations.
  // CORREIOS API v3 (prepostagem) expects phone fields to be structured as:
  // - Mobile: separate fields `dddCelular` (2 digits) and `celular` (9 digits starting with 9)
  // - Landline: separate fields `dddTelefone` (2 digits) and `telefone` (8 digits)
  // CRITICAL: The old single `celular` field with 11 digits causes "Excedeu tamanho" errors!
  type ParsedPhone = { ddd: string; numero: string; kind: 'mobile' | 'landline' } | null;
  
  const parseBrPhone = (phone?: string | null): ParsedPhone => {
    if (!phone) return null;
    let digits = phone.replace(/\D/g, '');
    
    console.log(`Parsing phone: "${phone}" -> digits: "${digits}" (length: ${digits.length})`);

    // Strip country code (55) aggressively - handle multiple 55 prefixes too
    while (digits.length > 11 && digits.startsWith('55')) {
      digits = digits.slice(2);
    }
    
    // Handle edge case: 5554... where 55 was DDI and 54 is DDD
    // After stripping 55, we should have 11 digits max
    if (digits.length > 11) {
      // Take the last 11 digits as best effort
      digits = digits.slice(-11);
    }

    // Validate final length
    if (digits.length < 10) {
      console.log(`Phone too short after processing: ${digits.length} digits`);
      return null;
    }
    
    if (digits.length === 10) {
      // Landline: DDD (2) + number (8)
      return { ddd: digits.slice(0, 2), numero: digits.slice(2), kind: 'landline' };
    }
    
    if (digits.length === 11) {
      const ddd = digits.slice(0, 2);
      const numero = digits.slice(2);
      // Validate mobile format: must start with 9
      if (numero.startsWith('9')) {
        return { ddd, numero, kind: 'mobile' };
      } else {
        // 11 digits but doesn't start with 9 - treat as invalid mobile, try as landline
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
  
  // Ensure weight is in grams and required
  const weightGrams = pkg.weight_grams || config.default_weight_grams || 500;
  
  // Build pre-postagem payload according to Correios API v3
  // IMPORTANT: Use separate dddCelular/celular fields instead of single 11-digit celular
  const payload: any = {
    idCorreios: config.id_correios,
    codigoServico: serviceCode,
    remetente: {
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
    },
    destinatario: {
      nome: request.recipient.name,
      cpfCnpj: request.recipient.cpf_cnpj?.replace(/\D/g, ''),
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
    },
    objetoPostal: {
      tipoObjeto: config.default_package_type === 'envelope' ? 'ENVELOPE' : 
                  config.default_package_type === 'cilindro' ? 'CILINDRO' : 'CAIXA',
      codigoFormatoObjeto: formatCode,
      peso: weightGrams,
      pesoRegistrado: weightGrams,
      dimensao: {
        altura: pkg.height_cm || config.default_height_cm || 10,
        largura: pkg.width_cm || config.default_width_cm || 15,
        comprimento: pkg.length_cm || config.default_length_cm || 20,
      },
      objetosProibidos: false,
    },
    declaracaoConteudo: true,
  };

  // Add phone fields using SEPARATE ddd and number fields to avoid "Excedeu tamanho" errors
  // Correios API v3 expects: dddCelular (2 digits) + celular (9 digits) for mobile
  // Or: dddTelefone (2 digits) + telefone (8 digits) for landline
  if (senderPhone) {
    if (senderPhone.kind === 'mobile') {
      payload.remetente.dddCelular = senderPhone.ddd;
      payload.remetente.celular = senderPhone.numero;
    } else {
      payload.remetente.dddTelefone = senderPhone.ddd;
      payload.remetente.telefone = senderPhone.numero;
    }
  }
  
  if (recipientPhone) {
    if (recipientPhone.kind === 'mobile') {
      payload.destinatario.dddCelular = recipientPhone.ddd;
      payload.destinatario.celular = recipientPhone.numero;
    } else {
      payload.destinatario.dddTelefone = recipientPhone.ddd;
      payload.destinatario.telefone = recipientPhone.numero;
    }
  }

  // Add invoice info if provided
  if (request.invoice_key) {
    payload.documentoFiscal = {
      tipo: 'NFE',
      numero: request.invoice_number || '',
      chave: request.invoice_key,
    };
    payload.declaracaoConteudo = false; // When using NFe, disable declaração
  } else if (request.invoice_number) {
    payload.documentoFiscal = {
      tipo: 'DECLARACAO',
      numero: request.invoice_number,
    };
  }

  // Add declared value if provided
  if (pkg.declared_value_cents && pkg.declared_value_cents > 0) {
    payload.objetoPostal.valorDeclarado = pkg.declared_value_cents / 100;
  }

  // Add contents description for declaração de conteúdo
  if (payload.declaracaoConteudo) {
    payload.itensDeclaracaoConteudo = [
      {
        conteudo: 'Produtos de saúde e bem-estar',
        quantidade: 1,
        valor: (pkg.declared_value_cents || 10000) / 100,
      }
    ];
  }

  console.log('Creating pre-postagem with payload:', JSON.stringify(payload, null, 2));

  const response = await fetch(`${baseUrl}/prepostagem/v1/prepostagens`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Correios pre-postagem error:', response.status, errorText);
    throw new Error(`Falha ao criar pré-postagem: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

async function getLabel(config: CorreiosConfig, token: string, prePostagemId: string): Promise<ArrayBuffer> {
  const baseUrl = CORREIOS_API_URLS[config.ambiente];
  
  const response = await fetch(`${baseUrl}/prepostagem/v1/prepostagens/${prePostagemId}/rotulo`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/pdf',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Correios label error:', response.status, errorText);
    throw new Error(`Falha ao obter etiqueta: ${response.status} - ${errorText}`);
  }

  return await response.arrayBuffer();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, ...params } = await req.json();

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
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
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
