import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const error = url.searchParams.get('error')

    if (error) {
      console.error('OAuth error:', error)
      return new Response(getErrorHtml('Erro na autenticação: ' + error), {
        headers: { 'Content-Type': 'text/html' },
      })
    }

    if (!code || !state) {
      console.error('Missing code or state')
      return new Response(getErrorHtml('Parâmetros inválidos'), {
        headers: { 'Content-Type': 'text/html' },
      })
    }

    // Decode state to get user info
    let stateData: { userId: string; token: string }
    try {
      stateData = JSON.parse(atob(state))
    } catch {
      console.error('Invalid state')
      return new Response(getErrorHtml('Estado inválido'), {
        headers: { 'Content-Type': 'text/html' },
      })
    }

    const redirectUri = `${SUPABASE_URL}/functions/v1/google-calendar-callback`

    // Exchange code for tokens
    console.log('Exchanging code for tokens...')
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    const tokenData = await tokenResponse.json()

    if (!tokenResponse.ok) {
      console.error('Token exchange error:', tokenData)
      return new Response(getErrorHtml('Erro ao obter tokens: ' + tokenData.error_description), {
        headers: { 'Content-Type': 'text/html' },
      })
    }

    console.log('Tokens received successfully')

    // Save tokens to database using service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString()

    const { error: upsertError } = await supabase
      .from('google_tokens')
      .upsert({
        user_id: stateData.userId,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_expires_at: expiresAt,
      }, {
        onConflict: 'user_id',
      })

    if (upsertError) {
      console.error('Error saving tokens:', upsertError)
      return new Response(getErrorHtml('Erro ao salvar tokens'), {
        headers: { 'Content-Type': 'text/html' },
      })
    }

    console.log('Tokens saved for user:', stateData.userId)

    // Return success page that closes and redirects
    return new Response(getSuccessHtml(), {
      headers: { 'Content-Type': 'text/html' },
    })
  } catch (error) {
    console.error('Callback error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(getErrorHtml('Erro interno: ' + errorMessage), {
      headers: { 'Content-Type': 'text/html' },
    })
  }
})

function getSuccessHtml() {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Conectado!</title>
      <style>
        body { font-family: system-ui; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f0f9ff; }
        .container { text-align: center; padding: 2rem; background: white; border-radius: 1rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        h1 { color: #22c55e; }
        p { color: #64748b; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>✅ Google Calendar Conectado!</h1>
        <p>Você pode fechar esta janela.</p>
        <script>
          setTimeout(() => {
            if (window.opener) {
              window.opener.postMessage({ type: 'GOOGLE_CALENDAR_CONNECTED' }, '*');
              window.close();
            } else {
              window.location.href = '/settings';
            }
          }, 2000);
        </script>
      </div>
    </body>
    </html>
  `
}

function getErrorHtml(message: string) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Erro</title>
      <style>
        body { font-family: system-ui; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #fef2f2; }
        .container { text-align: center; padding: 2rem; background: white; border-radius: 1rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        h1 { color: #ef4444; }
        p { color: #64748b; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>❌ Erro</h1>
        <p>${message}</p>
        <script>
          setTimeout(() => window.close(), 5000);
        </script>
      </div>
    </body>
    </html>
  `
}
