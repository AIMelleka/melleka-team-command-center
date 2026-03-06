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
}

async function fetchGHLData({ endpoint, locationId, params }: GHLRequestOptions) {
  const apiKey = Deno.env.get('GHL_AGENCY_API_KEY');
  
  if (!apiKey) {
    throw new Error('GHL_AGENCY_API_KEY not configured');
  }

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
      'Authorization': `Bearer ${apiKey}`,
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

    console.log(`Fetching GHL data for location ${locationId} from ${dateStart} to ${dateEnd}`);

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
        params: {
          startDate: dateStart,
          endDate: dateEnd,
        },
      }),
      
      // Appointments in date range
      fetchGHLData({
        endpoint: '/calendars/events',
        locationId,
        params: {
          startTime: dateStart ? new Date(dateStart).getTime().toString() : undefined,
          endTime: dateEnd ? new Date(dateEnd).getTime().toString() : undefined,
        },
      }),
      
      // Conversations (messages)
      fetchGHLData({
        endpoint: '/conversations/search',
        locationId,
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
