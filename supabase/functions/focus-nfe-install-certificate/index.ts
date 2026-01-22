import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const focusToken = Deno.env.get('FOCUS_NFE_TOKEN')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { fiscal_company_id } = await req.json();

    if (!fiscal_company_id) {
      return new Response(JSON.stringify({ error: 'fiscal_company_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get the fiscal company with all details
    const { data: company, error: companyError } = await supabase
      .from('fiscal_companies')
      .select('*')
      .eq('id', fiscal_company_id)
      .single();

    if (companyError || !company) {
      return new Response(JSON.stringify({ error: 'Empresa fiscal não encontrada' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if company is homologated
    if (!company.focus_nfe_company_id) {
      return new Response(JSON.stringify({ 
        error: 'Empresa ainda não foi homologada na Focus NFe. Homologue primeiro.' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if certificate exists in our storage
    if (!company.certificate_file_path) {
      return new Response(JSON.stringify({ 
        error: 'Nenhum certificado encontrado. Faça o upload do certificado A1 primeiro.' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!company.certificate_password_encrypted) {
      return new Response(JSON.stringify({ 
        error: 'Senha do certificado não encontrada. Faça o upload novamente com a senha.' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Download the certificate from storage
    const { data: certificateData, error: downloadError } = await supabase.storage
      .from('fiscal-certificates')
      .download(company.certificate_file_path);

    if (downloadError || !certificateData) {
      console.error('Certificate download error:', downloadError);
      return new Response(JSON.stringify({ 
        error: 'Erro ao baixar o certificado do storage.' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Convert certificate to Base64
    const arrayBuffer = await certificateData.arrayBuffer();
    const base64Certificate = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

    // Clean CNPJ
    const cnpj = company.cnpj.replace(/\D/g, '');

    // Build the update payload with certificate
    const updatePayload = {
      arquivo_certificado_base64: base64Certificate,
      senha_certificado: company.certificate_password_encrypted,
    };

    // Focus NFe API - Update company with certificate
    const baseUrl = 'https://api.focusnfe.com.br';
    const apiUrl = `${baseUrl}/v2/empresas/${cnpj}`;

    console.log('Installing certificate in Focus NFe:', { 
      cnpj, 
      certificateSize: base64Certificate.length,
      endpoint: apiUrl 
    });

    const response = await fetch(`${apiUrl}?token=${focusToken}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatePayload),
    });

    const responseText = await response.text();
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    console.log('Focus NFe certificate response:', response.status, responseData);

    if (!response.ok) {
      const errorMsg = responseData?.mensagem || 
                       responseData?.erros?.[0]?.mensagem || 
                       'Erro ao instalar certificado no Focus NFe';
      
      return new Response(JSON.stringify({ 
        success: false,
        error: errorMsg,
        details: responseData,
      }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Success - update our record to mark certificate as installed
    await supabase
      .from('fiscal_companies')
      .update({ 
        updated_at: new Date().toISOString(),
      })
      .eq('id', fiscal_company_id);

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Certificado instalado com sucesso no Focus NFe!',
      company: responseData,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in focus-nfe-install-certificate:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
