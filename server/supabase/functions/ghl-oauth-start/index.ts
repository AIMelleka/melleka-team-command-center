import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const clientId = Deno.env.get('GHL_CLIENT_ID');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');

    if (!clientId) {
      throw new Error('GHL_CLIENT_ID not configured');
    }

    // Must match the redirect URI registered in the GHL marketplace app
    const redirectUri = 'https://nhebotmrnxixvcvtspet.supabase.co/functions/v1/crm-agency-oauth-callback';
    
    // GHL OAuth scopes needed for deck data
    const scopes = [
      // Contacts
      'contacts.readonly', 'contacts.write',
      // Calendars
      'calendars.readonly', 'calendars.write',
      'calendars/events.readonly', 'calendars/events.write',
      'calendars/groups.readonly', 'calendars/groups.write',
      'calendars/resources.readonly', 'calendars/resources.write',
      // Conversations
      'conversations.readonly', 'conversations.write',
      'conversations/message.readonly', 'conversations/message.write',
      // Opportunities
      'opportunities.readonly', 'opportunities.write',
      // Locations
      'locations.readonly',
      'locations/customFields.readonly', 'locations/customFields.write',
      'locations/customValues.readonly', 'locations/customValues.write',
      'locations/tags.readonly', 'locations/tags.write',
      // Users
      'users.readonly', 'users.write',
      // Workflows
      'workflows.readonly',
      // Campaigns
      'campaigns.readonly',
      // Forms & Surveys
      'forms.readonly',
      'surveys.readonly',
      // Invoices
      'invoices.readonly', 'invoices.write',
      // Products
      'products.readonly', 'products.write',
      'products/prices.readonly', 'products/prices.write',
      // Social Media
      'socialplanner/post.readonly', 'socialplanner/post.write',
      // Media
      'medias.readonly', 'medias.write',
      // Businesses
      'businesses.readonly', 'businesses.write',
    ].join(' ');

    const authUrl = new URL('https://marketplace.leadconnectorhq.com/oauth/chooselocation');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', scopes);

    // Redirect directly to GHL authorization page
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': authUrl.toString(),
      },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('OAuth start error:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
