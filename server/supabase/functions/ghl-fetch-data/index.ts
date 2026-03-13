import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GHL_API_BASE = 'https://services.leadconnectorhq.com';

interface GHLRequestOptions {
  endpoint: string;
  locationId: string;
  params?: Record<string, string | undefined>;
  token: string;
}

// Try to get a valid OAuth token for this location, refreshing if needed
async function getLocationToken(locationId: string, supabase: any): Promise<string | null> {
  const { data } = await supabase
    .from('ghl_oauth_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('location_id', locationId)
    .single();

  if (!data) return null;

  const expiresAt = new Date(data.expires_at).getTime();
  const now = Date.now();
  const BUFFER = 5 * 60 * 1000; // 5 min buffer

  if (expiresAt - now > BUFFER) {
    return data.access_token;
  }

  // Token expired or about to expire, try refresh
  if (!data.refresh_token) return null;

  try {
    const clientId = Deno.env.get('GHL_CLIENT_ID')?.trim();
    const clientSecret = Deno.env.get('GHL_CLIENT_SECRET')?.trim();
    if (!clientId || !clientSecret) return null;

    const resp = await fetch('https://services.leadconnectorhq.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: data.refresh_token,
        user_type: 'Location',
      }),
    });

    if (!resp.ok) return null;

    const tokenData = await resp.json();
    const newExpiresAt = new Date(Date.now() + (tokenData.expires_in * 1000));

    await supabase.from('ghl_oauth_tokens').update({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: newExpiresAt.toISOString(),
    }).eq('location_id', locationId);

    console.log(`Refreshed OAuth token for location ${locationId}`);
    return tokenData.access_token;
  } catch (e) {
    console.error('Token refresh failed:', e);
    return null;
  }
}

async function fetchGHLData({ endpoint, locationId, params, token }: GHLRequestOptions) {
  const url = new URL(`${GHL_API_BASE}${endpoint}`);
  url.searchParams.set('locationId', locationId);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.set(key, value);
      }
    });
  }

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Version': '2021-07-28',
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`GHL API error for ${endpoint}:`, errorText);
    throw new Error(`GHL API error: ${response.status}`);
  }

  return response.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { locationId, dateStart, dateEnd } = await req.json();

    if (!locationId) {
      throw new Error('locationId is required');
    }

    // Resolve token: prefer OAuth location token, fall back to agency PIT
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let token = await getLocationToken(locationId, supabase);
    const tokenSource = token ? 'oauth' : 'agency-pit';
    if (!token) {
      token = Deno.env.get('GHL_AGENCY_API_KEY') || null;
    }
    if (!token) {
      throw new Error('No GHL token available (neither OAuth nor agency PIT)');
    }

    console.log(`Fetching GHL data for location ${locationId} using ${tokenSource} from ${dateStart} to ${dateEnd}`);

    // Fetch all data in parallel
    const [
      contactsResponse,
      opportunitiesResponse,
      appointmentsResponse,
      conversationsResponse,
    ] = await Promise.allSettled([
      // Contacts created in date range
      fetchGHLData({
        endpoint: '/contacts/',
        locationId,
        token,
        params: {
          startAfter: dateStart ? new Date(dateStart).toISOString() : undefined,
          startBefore: dateEnd ? new Date(dateEnd).toISOString() : undefined,
          limit: '100',
        },
      }),

      // Opportunities (deals/pipelines)
      fetchGHLData({
        endpoint: '/opportunities/search',
        locationId,
        token,
        params: {
          startDate: dateStart,
          endDate: dateEnd,
        },
      }),

      // Appointments in date range
      fetchGHLData({
        endpoint: '/calendars/events',
        locationId,
        token,
        params: {
          startTime: dateStart ? new Date(dateStart).getTime().toString() : undefined,
          endTime: dateEnd ? new Date(dateEnd).getTime().toString() : undefined,
        },
      }),

      // Conversations (messages)
      fetchGHLData({
        endpoint: '/conversations/search',
        locationId,
        token,
        params: {
          limit: '50',
        },
      }),
    ]);

    // Extract successful responses or defaults
    const contacts = contactsResponse.status === 'fulfilled' 
      ? contactsResponse.value.contacts || [] 
      : [];
    
    const opportunities = opportunitiesResponse.status === 'fulfilled'
      ? opportunitiesResponse.value.opportunities || []
      : [];
    
    const appointments = appointmentsResponse.status === 'fulfilled'
      ? appointmentsResponse.value.events || []
      : [];
    
    const conversations = conversationsResponse.status === 'fulfilled'
      ? conversationsResponse.value.conversations || []
      : [];

    // Calculate metrics
    const metrics = {
      totalContacts: contacts.length,
      newContacts: contacts.filter((c: any) => {
        const created = new Date(c.dateAdded);
        return (!dateStart || created >= new Date(dateStart)) && 
               (!dateEnd || created <= new Date(dateEnd));
      }).length,
      
      totalOpportunities: opportunities.length,
      openOpportunities: opportunities.filter((o: any) => o.status === 'open').length,
      wonOpportunities: opportunities.filter((o: any) => o.status === 'won').length,
      totalPipelineValue: opportunities.reduce((sum: number, o: any) => sum + (o.monetaryValue || 0), 0),
      
      totalAppointments: appointments.length,
      completedAppointments: appointments.filter((a: any) => a.status === 'completed').length,
      noShowAppointments: appointments.filter((a: any) => a.status === 'no_show').length,
      
      totalConversations: conversations.length,
      unreadConversations: conversations.filter((c: any) => c.unreadCount > 0).length,
    };

    // Log any errors for debugging
    const errors: string[] = [];
    if (contactsResponse.status === 'rejected') {
      errors.push(`Contacts: ${contactsResponse.reason}`);
    }
    if (opportunitiesResponse.status === 'rejected') {
      errors.push(`Opportunities: ${opportunitiesResponse.reason}`);
    }
    if (appointmentsResponse.status === 'rejected') {
      errors.push(`Appointments: ${appointmentsResponse.reason}`);
    }
    if (conversationsResponse.status === 'rejected') {
      errors.push(`Conversations: ${conversationsResponse.reason}`);
    }

    if (errors.length > 0) {
      console.warn('Some GHL endpoints failed:', errors);
    }

    return new Response(
      JSON.stringify({
        success: true,
        locationId,
        dateRange: { start: dateStart, end: dateEnd },
        metrics,
        data: {
          contacts: contacts.slice(0, 10), // Sample for display
          opportunities: opportunities.slice(0, 10),
          appointments: appointments.slice(0, 10),
          conversations: conversations.slice(0, 10),
        },
        warnings: errors.length > 0 ? errors : undefined,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('GHL fetch error:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
