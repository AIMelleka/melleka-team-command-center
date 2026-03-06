import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  validateUrl,
  validateString,
  createValidationErrorResponse,
} from "../_shared/validation.ts";
import { requireAdminAuth, createUnauthorizedResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Require admin authentication
  const authResult = await requireAdminAuth(req);
  if (!authResult.authorized) {
    return createUnauthorizedResponse(
      authResult.error || "Unauthorized",
      authResult.status || 401,
      corsHeaders
    );
  }

  try {
    const { url, advertiserName } = await req.json();

    // Validate that at least one is provided
    if (!url && !advertiserName) {
      return new Response(
        JSON.stringify({ success: false, error: "URL or advertiser name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate URL if provided
    if (url) {
      const urlValidation = validateUrl(url, "URL");
      if (!urlValidation.valid) {
        return createValidationErrorResponse(urlValidation.error!, corsHeaders);
      }
    }

    // Validate advertiser name if provided
    if (advertiserName) {
      const nameValidation = validateString(advertiserName, 500, "Advertiser name");
      if (!nameValidation.valid) {
        return createValidationErrorResponse(nameValidation.error!, corsHeaders);
      }
    }

    const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!apiKey) {
      console.error("FIRECRAWL_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: "Firecrawl connector not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format URL for Google Ads Transparency Center
    let targetUrl = url;
    if (!targetUrl && advertiserName) {
      const encodedName = encodeURIComponent(advertiserName);
      targetUrl = `https://adstransparency.google.com/?region=US&hl=en&q=${encodedName}`;
    }

    console.log("Scraping ad transparency page:", targetUrl);

    // Attempt 1: Scrape with screenshot and content
    let scrapedData: Record<string, any> | null = null;

    try {
      const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: targetUrl,
          formats: ["screenshot", "markdown"],
          waitFor: 8000,
          timeout: 45000,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success !== false) {
        scrapedData = data.data || data;
        console.log("Ad transparency scrape successful (attempt 1)");
      } else {
        console.warn("Firecrawl attempt 1 failed:", data.error || response.status);
      }
    } catch (e) {
      console.warn("Firecrawl attempt 1 exception:", e);
    }

    // Attempt 2: Simpler scrape without screenshot if first fails
    if (!scrapedData) {
      try {
        console.log("Retrying with simpler scrape (markdown only)...");
        const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: targetUrl,
            formats: ["markdown"],
            waitFor: 5000,
            timeout: 30000,
          }),
        });

        const data = await response.json();

        if (response.ok && data.success !== false) {
          scrapedData = data.data || data;
          console.log("Ad transparency scrape successful (attempt 2, no screenshot)");
        } else {
          console.warn("Firecrawl attempt 2 failed:", data.error || response.status);
        }
      } catch (e) {
        console.warn("Firecrawl attempt 2 exception:", e);
      }
    }

    // If both attempts fail, return a partial result so the pipeline can continue
    if (!scrapedData) {
      console.log("All scrape attempts failed, returning partial data");
      const result = {
        success: true,
        partial: true,
        warning: "Google Ads Transparency page could not be fully scraped. The page may use anti-scraping protections.",
        screenshot: null,
        content: advertiserName
          ? `Ad Transparency search for "${advertiserName}" - page could not be scraped. Try visiting ${targetUrl} directly for ad insights.`
          : `Ad Transparency page at ${targetUrl} could not be scraped.`,
        markdown: "",
        html: "",
        metadata: { sourceURL: targetUrl },
        url: targetUrl,
        advertiserName: advertiserName || null,
      };

      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = {
      success: true,
      screenshot: scrapedData.screenshot || null,
      content: scrapedData.markdown || "",
      html: scrapedData.html || "",
      metadata: scrapedData.metadata || {},
      url: targetUrl,
      advertiserName: advertiserName || null,
    };

    console.log("Ad transparency scrape complete");
    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error scraping ad transparency:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to scrape ad transparency";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
