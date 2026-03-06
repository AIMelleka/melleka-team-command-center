import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdminAuth, createUnauthorizedResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    const { websiteUrl, pageHints } = await req.json();

    if (!websiteUrl) {
      return new Response(
        JSON.stringify({ success: false, error: "websiteUrl is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Firecrawl not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let formattedUrl = websiteUrl.trim();
    if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) {
      formattedUrl = `https://${formattedUrl}`;
    }

    // Step 1: Map the website to discover pages
    console.log("Mapping website:", formattedUrl);
    let discoveredPages: string[] = [];

    try {
      const mapResponse = await fetch("https://api.firecrawl.dev/v1/map", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: formattedUrl,
          limit: 100,
          includeSubdomains: false,
        }),
      });

      const mapData = await mapResponse.json();
      if (mapResponse.ok && mapData.success) {
        discoveredPages = mapData.links || [];
        console.log(`Discovered ${discoveredPages.length} pages`);
      }
    } catch (e) {
      console.warn("Map failed:", e);
    }

    // Step 2: Match page hints to discovered URLs
    const hints: string[] = pageHints || [];
    const matchedPages: { hint: string; url: string }[] = [];

    // Common page name to URL path patterns
    const hintPatterns: Record<string, RegExp[]> = {
      'home': [/^https?:\/\/[^\/]+\/?$/i],
      'about': [/about/i, /who-we-are/i, /our-story/i, /our-company/i],
      'services': [/service/i, /what-we-do/i, /solutions/i, /offering/i],
      'contact': [/contact/i, /get-in-touch/i, /reach-us/i],
      'blog': [/blog/i, /news/i, /articles/i, /resources/i],
      'portfolio': [/portfolio/i, /work/i, /case-stud/i, /projects/i, /gallery/i],
      'team': [/team/i, /staff/i, /people/i, /leadership/i],
      'faq': [/faq/i, /questions/i],
      'pricing': [/pricing/i, /packages/i, /plans/i, /rates/i],
      'testimonials': [/testimonial/i, /review/i, /client/i],
      'careers': [/career/i, /jobs/i, /hiring/i, /join/i],
      'privacy': [/privacy/i],
      'terms': [/terms/i],
      'landing': [/landing/i, /lp\//i],
      'products': [/product/i, /shop/i, /store/i],
      'locations': [/location/i, /areas/i, /where/i],
    };

    for (const hint of hints) {
      const lowerHint = hint.toLowerCase().trim();
      let matched = false;

      // Try exact keyword patterns
      for (const [key, patterns] of Object.entries(hintPatterns)) {
        if (lowerHint.includes(key)) {
          for (const pattern of patterns) {
            const found = discoveredPages.find(p => pattern.test(p) && !matchedPages.some(m => m.url === p));
            if (found) {
              matchedPages.push({ hint, url: found });
              matched = true;
              break;
            }
          }
          if (matched) break;
        }
      }

      // Fallback: fuzzy match hint words against URLs
      if (!matched) {
        const words = lowerHint.split(/\s+/).filter(w => w.length > 3);
        for (const page of discoveredPages) {
          const pageLower = page.toLowerCase();
          if (words.some(w => pageLower.includes(w)) && !matchedPages.some(m => m.url === page)) {
            matchedPages.push({ hint, url: page });
            matched = true;
            break;
          }
        }
      }

      // Last resort: use homepage
      if (!matched) {
        matchedPages.push({ hint, url: formattedUrl });
      }
    }

    // If no hints, screenshot the homepage
    if (matchedPages.length === 0) {
      matchedPages.push({ hint: 'Homepage', url: formattedUrl });
    }

    // Deduplicate URLs
    const uniqueUrls = [...new Set(matchedPages.map(m => m.url))];
    console.log(`Screenshotting ${uniqueUrls.length} unique pages`);

    // Step 3: Screenshot each matched page (limit to 8)
    const pagesToScreenshot = uniqueUrls.slice(0, 8);
    const screenshotResults = await Promise.all(
      pagesToScreenshot.map(async (pageUrl) => {
        try {
          console.log(`Screenshotting: ${pageUrl}`);
          const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              url: pageUrl,
              formats: ["screenshot"],
              waitFor: 3000,
              timeout: 30000,
            }),
          });

          const data = await response.json();
          if (response.ok && data.success !== false) {
            const scraped = data.data || data;
            return {
              url: pageUrl,
              screenshot: scraped.screenshot || null,
              title: scraped.metadata?.title || new URL(pageUrl).pathname.replace(/\//g, ' ').trim() || 'Homepage',
            };
          }
          return { url: pageUrl, screenshot: null, title: pageUrl };
        } catch (e) {
          console.error(`Error screenshotting ${pageUrl}:`, e);
          return { url: pageUrl, screenshot: null, title: pageUrl };
        }
      })
    );

    // Step 4: Map screenshots back to hints
    const results = matchedPages.map(({ hint, url }) => {
      const screenshotData = screenshotResults.find(s => s.url === url);
      return {
        hint,
        url,
        screenshot: screenshotData?.screenshot || null,
        title: screenshotData?.title || hint,
      };
    });

    return new Response(
      JSON.stringify({
        success: true,
        pages: results,
        discoveredPages: discoveredPages.slice(0, 30),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
