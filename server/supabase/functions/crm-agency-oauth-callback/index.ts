import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');

    if (error) {
      console.error('OAuth error from GHL:', error);
      return new Response(
        `<html><body><h1>Authorization Failed</h1><p>${error}</p><script>setTimeout(() => window.close(), 3000);</script></body></html>`,
        { headers: { ...corsHeaders, 'Content-Type': 'text/html' }, status: 400 }
      );
    }

    if (!code) {
      return new Response(
        '<html><body><h1>Missing Authorization Code</h1></body></html>',
        { headers: { ...corsHeaders, 'Content-Type': 'text/html' }, status: 400 }
      );
    }

    // NOTE: Trim to avoid copy/paste whitespace causing invalid_client errors
    const clientId = Deno.env.get('GHL_CLIENT_ID')?.trim();
    const clientSecret = Deno.env.get('GHL_CLIENT_SECRET')?.trim();

    if (!clientId || !clientSecret) {
      throw new Error('GHL credentials not configured');
    }

    // Must match the redirect URI registered in the GHL marketplace app
    const redirectUri = 'https://nhebotmrnxixvcvtspet.supabase.co/functions/v1/crm-agency-oauth-callback';

    // Exchange code for tokens (GHL requires x-www-form-urlencoded despite docs saying JSON)
    const tokenResponse = await fetch('https://services.leadconnectorhq.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        user_type: 'Location',
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', tokenResponse.status, errorText);
      throw new Error(`Token exchange failed (${tokenResponse.status}): ${errorText}`);
    }

    const tokenData = await tokenResponse.json();
    console.log('Token exchange successful, location:', tokenData.locationId);

    // Get location info
    const locationResponse = await fetch(
      `https://services.leadconnectorhq.com/locations/${tokenData.locationId}`,
      {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Version': '2021-07-28',
        },
      }
    );

    let locationName = tokenData.locationId;
    if (locationResponse.ok) {
      const locationData = await locationResponse.json();
      locationName = locationData.location?.name || tokenData.locationId;
    }

    // Store tokens in database
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000));

    const { error: dbError } = await supabase
      .from('ghl_oauth_tokens')
      .upsert({
        location_id: tokenData.locationId,
        location_name: locationName,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: expiresAt.toISOString(),
        token_type: tokenData.token_type || 'Bearer',
        scope: tokenData.scope || null,
        company_id: tokenData.companyId || null,
      }, {
        onConflict: 'location_id',
      });

    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error(`Failed to store tokens: ${dbError.message || JSON.stringify(dbError)}`);
    }

    // Auto-create client_account_mapping if a matching managed_client exists
    try {
      const { data: clients } = await supabase
        .from('managed_clients')
        .select('client_name')
        .eq('is_active', true);
      if (clients && clients.length > 0) {
        const locLower = locationName.toLowerCase();
        const match = clients.find((c: any) => {
          const cn = c.client_name.toLowerCase();
          return cn === locLower || locLower.includes(cn) || cn.includes(locLower);
        });
        if (match) {
          await supabase
            .from('client_account_mappings')
            .upsert({
              client_name: match.client_name,
              platform: 'ghl',
              account_id: tokenData.locationId,
              account_name: locationName,
            }, { onConflict: 'client_name,platform,account_id' })
            .then(({ error: mapErr }) => {
              if (mapErr) console.error('Auto-mapping error:', mapErr);
              else console.log(`Auto-mapped GHL location "${locationName}" to client "${match.client_name}"`);
            });
        }
      }
    } catch (e) {
      console.error('Auto-mapping lookup failed:', e);
    }

    // Redirect back to Client Settings
    const appUrl = Deno.env.get('SUPABASE_URL')?.includes('localhost')
      ? 'http://localhost:5173'
      : 'https://team.melleka.com';

    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': `${appUrl}/settings/clients?ghl_connected=true&location=${encodeURIComponent(locationName)}`,
      },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('OAuth callback error:', error);
    return new Response(
      `<html><body><h1>Connection Failed</h1><p>${errorMessage}</p><script>setTimeout(() => window.close(), 5000);</script></body></html>`,
      { headers: { ...corsHeaders, 'Content-Type': 'text/html' }, status: 500 }
    );
  }
});
