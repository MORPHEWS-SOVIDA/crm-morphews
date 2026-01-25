/**
 * N8N Setup Correios - Cria automaticamente o workflow de proxy para Correios no n8n
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const n8nApiKey = Deno.env.get('N8N_API_KEY');
  const n8nBaseUrl = Deno.env.get('N8N_BASE_URL');

  if (!n8nApiKey || !n8nBaseUrl) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'N8N_API_KEY ou N8N_BASE_URL não configurados' 
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'create_workflow') {
      // Workflow definition for Correios proxy
      const workflowDefinition = {
        name: "Correios API Proxy",
        nodes: [
          {
            id: "webhook",
            name: "Webhook",
            type: "n8n-nodes-base.webhook",
            typeVersion: 2,
            position: [250, 300],
            webhookId: "correios-proxy",
            parameters: {
              path: "correios-proxy",
              responseMode: "responseNode",
              options: {}
            }
          },
          {
            id: "auth",
            name: "Autenticar Correios",
            type: "n8n-nodes-base.httpRequest",
            typeVersion: 4.2,
            position: [500, 300],
            parameters: {
              method: "POST",
              url: "={{ $json.credentials.ambiente === 'PRODUCAO' ? 'https://api.correios.com.br' : 'https://apihom.correios.com.br' }}/token/v1/autentica/cartaopostagem",
              authentication: "genericCredentialType",
              genericAuthType: "httpBasicAuth",
              sendHeaders: true,
              headerParameters: {
                parameters: [
                  {
                    name: "Content-Type",
                    value: "application/json"
                  }
                ]
              },
              sendBody: true,
              bodyParameters: {
                parameters: [
                  {
                    name: "numero",
                    value: "={{ $json.credentials.cartao_postagem }}"
                  }
                ]
              },
              options: {
                response: {
                  response: {
                    fullResponse: false
                  }
                }
              }
            },
            credentials: {
              httpBasicAuth: {
                id: "correios-basic-auth",
                name: "Correios Basic Auth"
              }
            }
          },
          {
            id: "build-payload",
            name: "Build Payload",
            type: "n8n-nodes-base.code",
            typeVersion: 2,
            position: [750, 300],
            parameters: {
              jsCode: `
const webhookData = $('Webhook').first().json;
const tokenResponse = $input.first().json;
const token = tokenResponse.token;

const { credentials, sender, recipient, package: pkg, service_code, invoice_key } = webhookData;

const baseUrl = credentials.ambiente === 'PRODUCAO' 
  ? 'https://api.correios.com.br' 
  : 'https://apihom.correios.com.br';

// Check if we have a valid invoice key (44 digits)
const invoiceKeyDigits = String(invoice_key || '').replace(/\\D/g, '');
const hasValidInvoiceKey = invoiceKeyDigits.length === 44;

// Build objeto postal
const objetoPostal = {
  tipo: "2",
  peso: String(pkg.weight_grams || 300),
  dimensao: {
    altura: String(pkg.height_cm || 4),
    largura: String(pkg.width_cm || 12),
    comprimento: String(pkg.length_cm || 17),
    tipo: "2"
  }
};

// Add declared value if present
if (pkg.declared_value_cents && pkg.declared_value_cents > 0) {
  objetoPostal.valorDeclarado = (pkg.declared_value_cents / 100).toFixed(2);
}

// Build main payload
const payload = {
  idCorreios: credentials.id_correios,
  codigoServico: service_code || '03298',
  remetente: {
    nome: sender.name,
    cpfCnpj: sender.cpf_cnpj.replace(/\\D/g, ''),
    endereco: {
      logradouro: sender.street,
      numero: sender.number,
      complemento: sender.complement || '',
      bairro: sender.neighborhood,
      cidade: sender.city,
      uf: sender.state,
      cep: sender.cep.replace(/\\D/g, '')
    },
    celular: (sender.phone || '').replace(/\\D/g, ''),
    email: sender.email || ''
  },
  destinatario: {
    nome: recipient.name,
    cpfCnpj: (recipient.cpf_cnpj || '').replace(/\\D/g, ''),
    endereco: {
      logradouro: recipient.street,
      numero: recipient.number,
      complemento: recipient.complement || '',
      bairro: recipient.neighborhood,
      cidade: recipient.city,
      uf: recipient.state,
      cep: recipient.cep.replace(/\\D/g, '')
    },
    celular: (recipient.phone || '').replace(/\\D/g, ''),
    email: recipient.email || ''
  },
  objetoPostal
};

// Add declaration if no valid invoice key
if (!hasValidInvoiceKey) {
  payload.possuiDeclaracaoConteudo = "S";
  payload.itensDeclaracaoConteudo = [{
    descricao: "Mercadoria",
    quantidade: "1",
    valor: pkg.declared_value_cents 
      ? (pkg.declared_value_cents / 100).toFixed(2) 
      : "1.00"
  }];
}

return [{
  json: {
    token,
    baseUrl,
    payload,
    credentials
  }
}];
`
            }
          },
          {
            id: "create-prepostagem",
            name: "Criar Pre-Postagem",
            type: "n8n-nodes-base.httpRequest",
            typeVersion: 4.2,
            position: [1000, 300],
            parameters: {
              method: "POST",
              url: "={{ $json.baseUrl }}/prepostagem/v1/prepostagens",
              sendHeaders: true,
              headerParameters: {
                parameters: [
                  {
                    name: "Authorization",
                    value: "=Bearer {{ $json.token }}"
                  },
                  {
                    name: "Content-Type",
                    value: "application/json"
                  }
                ]
              },
              sendBody: true,
              specifyBody: "json",
              jsonBody: "={{ JSON.stringify($json.payload) }}",
              options: {
                response: {
                  response: {
                    fullResponse: true
                  }
                }
              }
            }
          },
          {
            id: "check-success",
            name: "Check Success",
            type: "n8n-nodes-base.if",
            typeVersion: 2,
            position: [1250, 300],
            parameters: {
              conditions: {
                options: {
                  caseSensitive: true,
                  leftValue: "",
                  typeValidation: "strict"
                },
                conditions: [
                  {
                    id: "success-check",
                    leftValue: "={{ $json.statusCode }}",
                    rightValue: 201,
                    operator: {
                      type: "number",
                      operation: "equals"
                    }
                  }
                ],
                combinator: "and"
              }
            }
          },
          {
            id: "get-label",
            name: "Buscar Etiqueta PDF",
            type: "n8n-nodes-base.httpRequest",
            typeVersion: 4.2,
            position: [1500, 200],
            parameters: {
              method: "GET",
              url: "={{ $('Build Payload').first().json.baseUrl }}/prepostagem/v1/prepostagens/{{ $json.body.id }}/rotulo",
              sendHeaders: true,
              headerParameters: {
                parameters: [
                  {
                    name: "Authorization",
                    value: "=Bearer {{ $('Build Payload').first().json.token }}"
                  }
                ]
              },
              options: {
                response: {
                  response: {
                    responseFormat: "file"
                  }
                }
              }
            }
          },
          {
            id: "success-response",
            name: "Success Response",
            type: "n8n-nodes-base.respondToWebhook",
            typeVersion: 1.1,
            position: [1750, 200],
            parameters: {
              respondWith: "json",
              responseBody: `={
  "success": true,
  "tracking_code": "{{ $('Criar Pre-Postagem').first().json.body.codigoRastreio }}",
  "prepostagem_id": "{{ $('Criar Pre-Postagem').first().json.body.id }}",
  "label_pdf_base64": "{{ $('Buscar Etiqueta PDF').first().binary.data.toString('base64') }}"
}`
            }
          },
          {
            id: "error-response",
            name: "Error Response",
            type: "n8n-nodes-base.respondToWebhook",
            typeVersion: 1.1,
            position: [1500, 400],
            parameters: {
              respondWith: "json",
              responseBody: `={
  "success": false,
  "error": "Falha ao criar pré-postagem",
  "details": {{ JSON.stringify($json) }}
}`
            }
          }
        ],
        connections: {
          "Webhook": {
            main: [[{ node: "Autenticar Correios", type: "main", index: 0 }]]
          },
          "Autenticar Correios": {
            main: [[{ node: "Build Payload", type: "main", index: 0 }]]
          },
          "Build Payload": {
            main: [[{ node: "Criar Pre-Postagem", type: "main", index: 0 }]]
          },
          "Criar Pre-Postagem": {
            main: [[{ node: "Check Success", type: "main", index: 0 }]]
          },
          "Check Success": {
            main: [
              [{ node: "Buscar Etiqueta PDF", type: "main", index: 0 }],
              [{ node: "Error Response", type: "main", index: 0 }]
            ]
          },
          "Buscar Etiqueta PDF": {
            main: [[{ node: "Success Response", type: "main", index: 0 }]]
          }
        },
        settings: {
          executionOrder: "v1"
        }
      };

      // Create workflow via n8n API
      const createResponse = await fetch(`${n8nBaseUrl}/api/v1/workflows`, {
        method: 'POST',
        headers: {
          'X-N8N-API-KEY': n8nApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(workflowDefinition),
      });

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        console.error('n8n API error:', errorText);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Erro ao criar workflow: ${createResponse.status}`,
            details: errorText
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const createdWorkflow = await createResponse.json();
      console.log('Workflow created:', createdWorkflow);

      // Activate the workflow
      const activateResponse = await fetch(`${n8nBaseUrl}/api/v1/workflows/${createdWorkflow.id}/activate`, {
        method: 'POST',
        headers: {
          'X-N8N-API-KEY': n8nApiKey,
        },
      });

      const webhookUrl = `${n8nBaseUrl}/webhook/correios-proxy`;

      return new Response(
        JSON.stringify({
          success: true,
          workflow_id: createdWorkflow.id,
          workflow_name: createdWorkflow.name,
          webhook_url: webhookUrl,
          message: 'Workflow criado e ativado com sucesso!'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'list_workflows') {
      const response = await fetch(`${n8nBaseUrl}/api/v1/workflows`, {
        headers: {
          'X-N8N-API-KEY': n8nApiKey,
        },
      });

      const workflows = await response.json();
      return new Response(
        JSON.stringify({ success: true, workflows }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'test_connection') {
      const response = await fetch(`${n8nBaseUrl}/api/v1/workflows`, {
        headers: {
          'X-N8N-API-KEY': n8nApiKey,
        },
      });

      if (response.ok) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Conexão com n8n estabelecida com sucesso!',
            n8n_url: n8nBaseUrl
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Erro ao conectar: ${response.status}` 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Ação desconhecida' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
