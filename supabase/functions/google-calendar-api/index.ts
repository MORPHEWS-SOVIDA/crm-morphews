import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get user
    const supabase = createClient(
      SUPABASE_URL,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get request body
    const body = await req.json()
    const { action, ...params } = body

    console.log('Google Calendar API action:', action, 'for user:', user.id)

    // Get user's Google tokens using service role
    const adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data: tokenData, error: tokenError } = await adminSupabase
      .from('google_tokens')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (tokenError || !tokenData) {
      return new Response(JSON.stringify({ error: 'Google Calendar not connected', needsAuth: true }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check if token needs refresh
    let accessToken = tokenData.access_token
    if (new Date(tokenData.token_expires_at) <= new Date()) {
      console.log('Token expired, refreshing...')
      accessToken = await refreshAccessToken(tokenData.refresh_token, user.id, adminSupabase)
    }

    // Execute the requested action
    let result
    switch (action) {
      case 'listEvents':
        result = await listEvents(accessToken, params)
        break
      case 'createEvent':
        result = await createEvent(accessToken, params)
        break
      case 'updateEvent':
        result = await updateEvent(accessToken, params)
        break
      case 'deleteEvent':
        result = await deleteEvent(accessToken, params)
        break
      case 'checkConnection':
        result = { connected: true }
        break
      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error in google-calendar-api:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

async function refreshAccessToken(refreshToken: string, userId: string, supabase: any) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  const data = await response.json()

  if (!response.ok) {
    console.error('Token refresh error:', data)
    throw new Error('Failed to refresh token')
  }

  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString()

  await supabase
    .from('google_tokens')
    .update({
      access_token: data.access_token,
      token_expires_at: expiresAt,
    })
    .eq('user_id', userId)

  console.log('Token refreshed for user:', userId)
  return data.access_token
}

async function listEvents(accessToken: string, params: any) {
  const { timeMin, timeMax, maxResults = 50 } = params

  const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events')
  url.searchParams.set('maxResults', maxResults.toString())
  url.searchParams.set('singleEvents', 'true')
  url.searchParams.set('orderBy', 'startTime')
  
  if (timeMin) url.searchParams.set('timeMin', timeMin)
  if (timeMax) url.searchParams.set('timeMax', timeMax)

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  const data = await response.json()

  if (!response.ok) {
    console.error('List events error:', data)
    throw new Error(data.error?.message || 'Failed to list events')
  }

  console.log('Listed', data.items?.length || 0, 'events')
  return { events: data.items || [] }
}

async function createEvent(accessToken: string, params: any) {
  const { summary, description, start, end, location, attendees } = params

  const event: any = {
    summary,
    description,
    start: { dateTime: start, timeZone: 'America/Sao_Paulo' },
    end: { dateTime: end, timeZone: 'America/Sao_Paulo' },
  }

  if (location) event.location = location
  if (attendees) event.attendees = attendees.map((email: string) => ({ email }))

  const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  })

  const data = await response.json()

  if (!response.ok) {
    console.error('Create event error:', data)
    throw new Error(data.error?.message || 'Failed to create event')
  }

  console.log('Created event:', data.id)
  return { event: data }
}

async function updateEvent(accessToken: string, params: any) {
  const { eventId, summary, description, start, end, location } = params

  const event: any = {}
  if (summary) event.summary = summary
  if (description) event.description = description
  if (start) event.start = { dateTime: start, timeZone: 'America/Sao_Paulo' }
  if (end) event.end = { dateTime: end, timeZone: 'America/Sao_Paulo' }
  if (location) event.location = location

  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  })

  const data = await response.json()

  if (!response.ok) {
    console.error('Update event error:', data)
    throw new Error(data.error?.message || 'Failed to update event')
  }

  console.log('Updated event:', eventId)
  return { event: data }
}

async function deleteEvent(accessToken: string, params: any) {
  const { eventId } = params

  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok && response.status !== 204) {
    const data = await response.json()
    console.error('Delete event error:', data)
    throw new Error(data.error?.message || 'Failed to delete event')
  }

  console.log('Deleted event:', eventId)
  return { success: true }
}
