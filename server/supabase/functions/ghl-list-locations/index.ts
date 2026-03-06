import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GHL_API_BASE = 'https://services.leadconnectorhq.com';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('GHL_AGENCY_API_KEY');
    
    if (!apiKey) {
      throw new Error('GHL_AGENCY_API_KEY not configured');
    }

    // Fetch locations using Agency API
    const response = await fetch(`${GHL_API_BASE}/locations/search`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        limit: 100,
        skip: 0,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('GHL locations error:', errorText);
      throw new Error(`Failed to fetch locations: ${response.status}`);
    }

    const data = await response.json();
    
    const locations = (data.locations || []).map((loc: any) => ({
      id: loc.id,
      name: loc.name,
      address: loc.address,
      city: loc.city,
      state: loc.state,
      phone: loc.phone,
      email: loc.email,
      website: loc.website,
      timezone: loc.timezone,
    }));

    return new Response(
      JSON.stringify({ 
        success: true, 
        locations,
        total: data.total || locations.length,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('GHL list locations error:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage, locations: [] }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
