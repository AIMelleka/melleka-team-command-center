import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAdminAuth, createUnauthorizedResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GA4Metrics {
  propertyId: string;
  dateRange: { start: string; end: string };
  overview: {
    sessions: number;
    users: number;
    newUsers: number;
    pageviews: number;
    bounceRate: number;
    avgSessionDuration: number;
    engagementRate: number;
  };
  trafficSources: Array<{
    source: string;
    medium: string;
    sessions: number;
    conversions: number;
    revenue: number;
  }>;
  campaigns: Array<{
    campaign: string;
    source: string;
    medium: string;
    sessions: number;
    users: number;
    conversions: number;
    conversionRate: number;
    revenue: number;
    cost?: number;
    roas?: number;
  }>;
  conversions: Array<{
    eventName: string;
    count: number;
    value: number;
  }>;
  pagePerformance: Array<{
    pagePath: string;
    pageviews: number;
    avgTimeOnPage: number;
    bounceRate: number;
    entrances: number;
  }>;
  deviceBreakdown: {
    desktop: number;
    mobile: number;
    tablet: number;
  };
  geoPerformance: Array<{
    country: string;
    sessions: number;
    conversions: number;
    revenue: number;
  }>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authResult = await requireAdminAuth(req);
  if (!authResult.authorized) {
    return createUnauthorizedResponse(
      authResult.error || "Unauthorized",
      authResult.status || 401,
      corsHeaders
    );
  }

  try {
    const { propertyId, startDate, endDate } = await req.json();

    if (!propertyId) {
      return new Response(
        JSON.stringify({ error: "GA4 Property ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const serviceAccountJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
    if (!serviceAccountJson) {
      console.log("GOOGLE_SERVICE_ACCOUNT_JSON not configured, returning mock data");
      return new Response(
        JSON.stringify({
          success: true,
          data: generateMockGA4Data(propertyId, startDate, endDate),
          isMock: true,
          message: "Using mock data - configure GOOGLE_SERVICE_ACCOUNT_JSON for real GA4 data"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let serviceAccount;
    try {
      serviceAccount = JSON.parse(serviceAccountJson);
    } catch (e) {
      console.error("Failed to parse service account JSON:", e);
      return new Response(
        JSON.stringify({ error: "Invalid service account configuration" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get OAuth2 access token from service account
    const accessToken = await getAccessToken(serviceAccount);
    
    const effectiveStartDate = startDate || getDateNDaysAgo(30);
    const effectiveEndDate = endDate || getDateNDaysAgo(0);

    console.log(`Fetching GA4 data for property ${propertyId} from ${effectiveStartDate} to ${effectiveEndDate}`);

    // Fetch all GA4 data in parallel
    const [
      overviewData,
      trafficSourcesData,
      campaignsData,
      conversionsData,
      pageData,
      deviceData,
      geoData
    ] = await Promise.all([
      fetchOverviewMetrics(propertyId, effectiveStartDate, effectiveEndDate, accessToken),
      fetchTrafficSources(propertyId, effectiveStartDate, effectiveEndDate, accessToken),
      fetchCampaignPerformance(propertyId, effectiveStartDate, effectiveEndDate, accessToken),
      fetchConversions(propertyId, effectiveStartDate, effectiveEndDate, accessToken),
      fetchPagePerformance(propertyId, effectiveStartDate, effectiveEndDate, accessToken),
      fetchDeviceBreakdown(propertyId, effectiveStartDate, effectiveEndDate, accessToken),
      fetchGeoPerformance(propertyId, effectiveStartDate, effectiveEndDate, accessToken)
    ]);

    const ga4Data: GA4Metrics = {
      propertyId,
      dateRange: { start: effectiveStartDate, end: effectiveEndDate },
      overview: overviewData,
      trafficSources: trafficSourcesData,
      campaigns: campaignsData,
      conversions: conversionsData,
      pagePerformance: pageData,
      deviceBreakdown: deviceData,
      geoPerformance: geoData
    };

    console.log("GA4 data fetched successfully");

    return new Response(
      JSON.stringify({ success: true, data: ga4Data, isMock: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("GA4 fetch error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to fetch GA4 data" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Get OAuth2 access token using service account JWT
async function getAccessToken(serviceAccount: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/analytics.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  
  const signature = await signRS256(signatureInput, serviceAccount.private_key);
  const jwt = `${signatureInput}.${signature}`;

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt
    })
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error("Token exchange failed:", errorText);
    throw new Error("Failed to authenticate with Google");
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

function base64UrlEncode(str: string): string {
  const base64 = btoa(str);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function signRS256(data: string, privateKeyPem: string): Promise<string> {
  // Clean the PEM key
  const pemContents = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '');
  
  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  
  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    encoder.encode(data)
  );

  return base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)));
}

// GA4 Data API v1 endpoint
const GA4_API_BASE = "https://analyticsdata.googleapis.com/v1beta";

async function fetchOverviewMetrics(propertyId: string, startDate: string, endDate: string, accessToken: string) {
  const response = await fetch(`${GA4_API_BASE}/properties/${propertyId}:runReport`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      dateRanges: [{ startDate, endDate }],
      metrics: [
        { name: "sessions" },
        { name: "totalUsers" },
        { name: "newUsers" },
        { name: "screenPageViews" },
        { name: "bounceRate" },
        { name: "averageSessionDuration" },
        { name: "engagementRate" }
      ]
    })
  });

  if (!response.ok) {
    console.error("Overview fetch failed:", await response.text());
    return getDefaultOverview();
  }

  const data = await response.json();
  const row = data.rows?.[0]?.metricValues || [];
  
  return {
    sessions: parseInt(row[0]?.value || "0"),
    users: parseInt(row[1]?.value || "0"),
    newUsers: parseInt(row[2]?.value || "0"),
    pageviews: parseInt(row[3]?.value || "0"),
    bounceRate: parseFloat(row[4]?.value || "0") * 100,
    avgSessionDuration: parseFloat(row[5]?.value || "0"),
    engagementRate: parseFloat(row[6]?.value || "0") * 100
  };
}

// Fetch ONLY paid traffic sources (cpc, ppc, paid, display, etc.) - excludes organic
async function fetchTrafficSources(propertyId: string, startDate: string, endDate: string, accessToken: string) {
  const response = await fetch(`${GA4_API_BASE}/properties/${propertyId}:runReport`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      dateRanges: [{ startDate, endDate }],
      dimensions: [
        { name: "sessionSource" },
        { name: "sessionMedium" }
      ],
      metrics: [
        { name: "sessions" },
        { name: "conversions" },
        { name: "purchaseRevenue" }
      ],
      // CRITICAL: Filter to PAID traffic only - exclude organic, referral, direct
      dimensionFilter: {
        filter: {
          fieldName: "sessionMedium",
          inListFilter: {
            values: ["cpc", "ppc", "paid", "cpm", "cpv", "display", "paid_social", "paidsocial", "paid-social", "retargeting", "remarketing", "video", "shopping", "pmax", "performance_max"]
          }
        }
      },
      limit: 20,
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }]
    })
  });

  if (!response.ok) {
    console.error("Paid traffic sources fetch failed:", await response.text());
    return [];
  }

  const data = await response.json();
  return (data.rows || []).map((row: any) => ({
    source: row.dimensionValues[0]?.value || "(not set)",
    medium: row.dimensionValues[1]?.value || "(not set)",
    sessions: parseInt(row.metricValues[0]?.value || "0"),
    conversions: parseInt(row.metricValues[1]?.value || "0"),
    revenue: parseFloat(row.metricValues[2]?.value || "0")
  }));
}

async function fetchCampaignPerformance(propertyId: string, startDate: string, endDate: string, accessToken: string) {
  const response = await fetch(`${GA4_API_BASE}/properties/${propertyId}:runReport`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      dateRanges: [{ startDate, endDate }],
      dimensions: [
        { name: "sessionCampaignName" },
        { name: "sessionSource" },
        { name: "sessionMedium" }
      ],
      metrics: [
        { name: "sessions" },
        { name: "totalUsers" },
        { name: "conversions" },
        { name: "purchaseRevenue" }
      ],
      dimensionFilter: {
        filter: {
          fieldName: "sessionMedium",
          inListFilter: {
            values: ["cpc", "ppc", "paid", "cpm", "cpv", "display", "paid_social"]
          }
        }
      },
      limit: 20,
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }]
    })
  });

  if (!response.ok) {
    console.error("Campaign fetch failed:", await response.text());
    return [];
  }

  const data = await response.json();
  return (data.rows || []).map((row: any) => {
    const sessions = parseInt(row.metricValues[0]?.value || "0");
    const conversions = parseInt(row.metricValues[2]?.value || "0");
    return {
      campaign: row.dimensionValues[0]?.value || "(not set)",
      source: row.dimensionValues[1]?.value || "(not set)",
      medium: row.dimensionValues[2]?.value || "(not set)",
      sessions,
      users: parseInt(row.metricValues[1]?.value || "0"),
      conversions,
      conversionRate: sessions > 0 ? (conversions / sessions) * 100 : 0,
      revenue: parseFloat(row.metricValues[3]?.value || "0")
    };
  });
}

async function fetchConversions(propertyId: string, startDate: string, endDate: string, accessToken: string) {
  const response = await fetch(`${GA4_API_BASE}/properties/${propertyId}:runReport`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "eventName" }],
      metrics: [
        { name: "eventCount" },
        { name: "eventValue" }
      ],
      dimensionFilter: {
        filter: {
          fieldName: "eventName",
          inListFilter: {
            values: [
              "purchase", "generate_lead", "sign_up", "form_submit",
              "phone_call", "contact", "submit_form", "conversion",
              "add_to_cart", "begin_checkout", "first_open"
            ]
          }
        }
      },
      limit: 20,
      orderBys: [{ metric: { metricName: "eventCount" }, desc: true }]
    })
  });

  if (!response.ok) {
    console.error("Conversions fetch failed:", await response.text());
    return [];
  }

  const data = await response.json();
  return (data.rows || []).map((row: any) => ({
    eventName: row.dimensionValues[0]?.value || "(not set)",
    count: parseInt(row.metricValues[0]?.value || "0"),
    value: parseFloat(row.metricValues[1]?.value || "0")
  }));
}

async function fetchPagePerformance(propertyId: string, startDate: string, endDate: string, accessToken: string) {
  const response = await fetch(`${GA4_API_BASE}/properties/${propertyId}:runReport`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "pagePath" }],
      metrics: [
        { name: "screenPageViews" },
        { name: "averageSessionDuration" },
        { name: "bounceRate" },
        { name: "entrances" }
      ],
      limit: 15,
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }]
    })
  });

  if (!response.ok) {
    console.error("Page performance fetch failed:", await response.text());
    return [];
  }

  const data = await response.json();
  return (data.rows || []).map((row: any) => ({
    pagePath: row.dimensionValues[0]?.value || "(not set)",
    pageviews: parseInt(row.metricValues[0]?.value || "0"),
    avgTimeOnPage: parseFloat(row.metricValues[1]?.value || "0"),
    bounceRate: parseFloat(row.metricValues[2]?.value || "0") * 100,
    entrances: parseInt(row.metricValues[3]?.value || "0")
  }));
}

async function fetchDeviceBreakdown(propertyId: string, startDate: string, endDate: string, accessToken: string) {
  const response = await fetch(`${GA4_API_BASE}/properties/${propertyId}:runReport`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "deviceCategory" }],
      metrics: [{ name: "sessions" }]
    })
  });

  if (!response.ok) {
    console.error("Device breakdown fetch failed:", await response.text());
    return { desktop: 0, mobile: 0, tablet: 0 };
  }

  const data = await response.json();
  const breakdown = { desktop: 0, mobile: 0, tablet: 0 };
  
  for (const row of (data.rows || [])) {
    const category = row.dimensionValues[0]?.value?.toLowerCase() || "";
    const sessions = parseInt(row.metricValues[0]?.value || "0");
    if (category === "desktop") breakdown.desktop = sessions;
    else if (category === "mobile") breakdown.mobile = sessions;
    else if (category === "tablet") breakdown.tablet = sessions;
  }
  
  return breakdown;
}

async function fetchGeoPerformance(propertyId: string, startDate: string, endDate: string, accessToken: string) {
  const response = await fetch(`${GA4_API_BASE}/properties/${propertyId}:runReport`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      dateRanges: [{ startDate, endDate }],
      dimensions: [{ name: "country" }],
      metrics: [
        { name: "sessions" },
        { name: "conversions" },
        { name: "purchaseRevenue" }
      ],
      limit: 10,
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }]
    })
  });

  if (!response.ok) {
    console.error("Geo performance fetch failed:", await response.text());
    return [];
  }

  const data = await response.json();
  return (data.rows || []).map((row: any) => ({
    country: row.dimensionValues[0]?.value || "(not set)",
    sessions: parseInt(row.metricValues[0]?.value || "0"),
    conversions: parseInt(row.metricValues[1]?.value || "0"),
    revenue: parseFloat(row.metricValues[2]?.value || "0")
  }));
}

function getDefaultOverview() {
  return {
    sessions: 0,
    users: 0,
    newUsers: 0,
    pageviews: 0,
    bounceRate: 0,
    avgSessionDuration: 0,
    engagementRate: 0
  };
}

function getDateNDaysAgo(n: number): string {
  const date = new Date();
  date.setDate(date.getDate() - n);
  return date.toISOString().split('T')[0];
}

function generateMockGA4Data(propertyId: string, startDate?: string, endDate?: string): GA4Metrics {
  const seed = propertyId.split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0);
  const rand = Math.abs(seed);
  
  return {
    propertyId,
    dateRange: {
      start: startDate || getDateNDaysAgo(30),
      end: endDate || getDateNDaysAgo(0)
    },
    overview: {
      sessions: 5000 + (rand % 10000),
      users: 3500 + (rand % 7000),
      newUsers: 2800 + (rand % 5000),
      pageviews: 15000 + (rand % 30000),
      bounceRate: 35 + (rand % 30),
      avgSessionDuration: 120 + (rand % 180),
      engagementRate: 50 + (rand % 35)
    },
    trafficSources: [
      { source: "google", medium: "cpc", sessions: 2000 + (rand % 3000), conversions: 50 + (rand % 100), revenue: 5000 + (rand % 10000) },
      { source: "facebook", medium: "paid_social", sessions: 1500 + (rand % 2000), conversions: 35 + (rand % 60), revenue: 3500 + (rand % 7000) },
      { source: "google", medium: "organic", sessions: 1000 + (rand % 1500), conversions: 20 + (rand % 40), revenue: 2000 + (rand % 4000) },
      { source: "(direct)", medium: "(none)", sessions: 800 + (rand % 1000), conversions: 15 + (rand % 30), revenue: 1500 + (rand % 3000) },
      { source: "bing", medium: "cpc", sessions: 400 + (rand % 600), conversions: 10 + (rand % 20), revenue: 1000 + (rand % 2000) }
    ],
    campaigns: [
      { campaign: "Brand - Search", source: "google", medium: "cpc", sessions: 1200, users: 1000, conversions: 45, conversionRate: 3.75, revenue: 4500 },
      { campaign: "Non-Brand - Services", source: "google", medium: "cpc", sessions: 800, users: 700, conversions: 25, conversionRate: 3.12, revenue: 2500 },
      { campaign: "Retargeting - Site Visitors", source: "facebook", medium: "paid_social", sessions: 600, users: 500, conversions: 30, conversionRate: 5.0, revenue: 3000 },
      { campaign: "Prospecting - LAL", source: "facebook", medium: "paid_social", sessions: 500, users: 450, conversions: 15, conversionRate: 3.0, revenue: 1500 }
    ],
    conversions: [
      { eventName: "generate_lead", count: 85 + (rand % 50), value: 8500 + (rand % 5000) },
      { eventName: "purchase", count: 35 + (rand % 30), value: 15000 + (rand % 10000) },
      { eventName: "form_submit", count: 120 + (rand % 80), value: 0 },
      { eventName: "phone_call", count: 45 + (rand % 30), value: 4500 + (rand % 3000) }
    ],
    pagePerformance: [
      { pagePath: "/", pageviews: 5000, avgTimeOnPage: 45, bounceRate: 40, entrances: 3500 },
      { pagePath: "/services", pageviews: 2500, avgTimeOnPage: 90, bounceRate: 35, entrances: 800 },
      { pagePath: "/contact", pageviews: 1200, avgTimeOnPage: 120, bounceRate: 25, entrances: 200 },
      { pagePath: "/about", pageviews: 800, avgTimeOnPage: 60, bounceRate: 45, entrances: 150 }
    ],
    deviceBreakdown: {
      desktop: 2500 + (rand % 2000),
      mobile: 2000 + (rand % 1500),
      tablet: 300 + (rand % 200)
    },
    geoPerformance: [
      { country: "United States", sessions: 4000 + (rand % 3000), conversions: 100 + (rand % 80), revenue: 10000 + (rand % 8000) },
      { country: "Canada", sessions: 400 + (rand % 300), conversions: 10 + (rand % 10), revenue: 1000 + (rand % 800) },
      { country: "United Kingdom", sessions: 200 + (rand % 150), conversions: 5 + (rand % 5), revenue: 500 + (rand % 400) }
    ]
  };
}
