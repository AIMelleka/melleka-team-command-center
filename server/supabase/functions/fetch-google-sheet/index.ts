import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SheetRequest {
  spreadsheetId: string;
  sheetName?: string;
  range?: string;
}

// Google Sheets API base URL
const SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

async function getAccessToken(serviceAccountJson: string): Promise<string> {
  const serviceAccount = JSON.parse(serviceAccountJson);
  
  // Create JWT header
  const header = {
    alg: "RS256",
    typ: "JWT",
  };
  
  // Create JWT claims
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  
  // Base64url encode
  const base64url = (obj: object) => {
    const json = JSON.stringify(obj);
    const base64 = btoa(json);
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  
  const headerB64 = base64url(header);
  const claimsB64 = base64url(claims);
  const signatureInput = `${headerB64}.${claimsB64}`;
  
  // Import the private key and sign
  const privateKeyPem = serviceAccount.private_key;
  const pemContents = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  
  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signatureInput)
  );
  
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  
  const jwt = `${signatureInput}.${signatureB64}`;
  
  // Exchange JWT for access token
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  
  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    throw new Error(`Failed to get access token: ${error}`);
  }
  
  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const serviceAccountJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
    if (!serviceAccountJson) {
      throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not configured");
    }

    const body: SheetRequest = await req.json();
    const { spreadsheetId, sheetName, range } = body;

    if (!spreadsheetId) {
      return new Response(
        JSON.stringify({ error: "spreadsheetId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Fetching sheet: ${spreadsheetId}, sheet: ${sheetName || 'default'}`);

    // Get access token
    const accessToken = await getAccessToken(serviceAccountJson);

    // If no sheet name provided, first get all sheet names
    if (!sheetName) {
      const metadataUrl = `${SHEETS_API_BASE}/${spreadsheetId}?fields=sheets.properties.title`;
      const metadataResponse = await fetch(metadataUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!metadataResponse.ok) {
        const error = await metadataResponse.text();
        throw new Error(`Failed to fetch sheet metadata: ${error}`);
      }

      const metadata = await metadataResponse.json();
      const sheetNames = metadata.sheets?.map((s: any) => s.properties.title) || [];

      return new Response(
        JSON.stringify({ sheetNames }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the specific sheet data
    const rangeParam = range || `${sheetName}!A:Z`;
    const dataUrl = `${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(rangeParam)}`;
    
    const dataResponse = await fetch(dataUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!dataResponse.ok) {
      const error = await dataResponse.text();
      throw new Error(`Failed to fetch sheet data: ${error}`);
    }

    const sheetData = await dataResponse.json();
    const rows = sheetData.values || [];

    // Convert to a more usable format (first row as headers)
    let formattedData: Record<string, string>[] = [];
    if (rows.length > 1) {
      const headers = rows[0];
      formattedData = rows.slice(1).map((row: string[]) => {
        const obj: Record<string, string> = {};
        headers.forEach((header: string, index: number) => {
          obj[header] = row[index] || '';
        });
        return obj;
      });
    }

    console.log(`Successfully fetched ${formattedData.length} rows from ${sheetName}`);

    return new Response(
      JSON.stringify({ 
        sheetName,
        headers: rows[0] || [],
        rows: formattedData,
        rawData: rows
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in fetch-google-sheet function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
