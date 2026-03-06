import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  validateUrl,
  validateInteger,
  createValidationErrorResponse,
} from "../_shared/validation.ts";
import { requireAuth, createUnauthorizedResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper function to download and store an image in Supabase Storage
async function persistImageToStorage(
  imageUrl: string,
  // deno-lint-ignore no-explicit-any
  supabase: any,
  pathPrefix: string
): Promise<string | null> {
  if (!imageUrl) return null;
  
  try {
    console.log(`Downloading image from: ${imageUrl}`);
    
    // Download the image
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MellekaBot/1.0)',
        'Accept': 'image/*',
      },
    });
    
    if (!response.ok) {
      console.warn(`Failed to download image: ${response.status}`);
      return null;
    }
    
    const contentType = response.headers.get('content-type') || 'image/png';
    const blob = await response.blob();
    
    // Validate it's actually an image
    if (!contentType.startsWith('image/') || blob.size === 0) {
      console.warn('Downloaded content is not a valid image');
      return null;
    }
    
    // Limit file size (2MB max for logos)
    if (blob.size > 2 * 1024 * 1024) {
      console.warn('Image too large, skipping storage');
      return imageUrl; // Return original URL as fallback
    }
    
    // Generate unique filename
    const extension = contentType.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
    const filename = `${pathPrefix}/logo-${Date.now()}.${extension}`;
    
    // Convert blob to array buffer for upload
    const arrayBuffer = await blob.arrayBuffer();
    
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('proposal-assets')
      .upload(filename, arrayBuffer, {
        contentType,
        cacheControl: '31536000', // 1 year cache
        upsert: true,
      });
    
    if (error) {
      console.error('Storage upload error:', error.message);
      return null;
    }
    
    // Get permanent public URL
    const { data: urlData } = supabase.storage
      .from('proposal-assets')
      .getPublicUrl(filename);
    
    console.log(`Image persisted to: ${urlData.publicUrl}`);
    return urlData.publicUrl;
  } catch (error) {
    console.error('Error persisting image:', error);
    return null;
  }
}

// Helper function for retry logic with exponential backoff
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 2,
  baseDelay = 1000
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      // If we get a timeout error response, retry
      if (response.status === 408 || response.status === 504) {
        const data = await response.json();
        if (data.code === "SCRAPE_TIMEOUT" && attempt < maxRetries) {
          console.log(`Timeout on attempt ${attempt + 1}, retrying...`);
          await new Promise(r => setTimeout(r, baseDelay * Math.pow(2, attempt)));
          continue;
        }
      }
      
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries) {
        console.log(`Error on attempt ${attempt + 1}: ${lastError.message}, retrying...`);
        await new Promise(r => setTimeout(r, baseDelay * Math.pow(2, attempt)));
      }
    }
  }
  
  throw lastError || new Error("Failed after retries");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Require authenticated user (not necessarily admin for scraping)
  const authResult = await requireAuth(req);
  if (!authResult.authorized) {
    return createUnauthorizedResponse(
      authResult.error || "Unauthorized",
      authResult.status || 401,
      corsHeaders
    );
  }

  try {
    const { url, maxScreenshots = 6 } = await req.json();

    // Format URL first before validation (users often omit protocol)
    let formattedUrl = (url || "").toString().trim();
    if (formattedUrl && !formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) {
      formattedUrl = `https://${formattedUrl}`;
    }

    // Validate URL format after adding protocol
    const urlValidation = validateUrl(formattedUrl, "Website URL");
    if (!urlValidation.valid) {
      return createValidationErrorResponse(urlValidation.error!, corsHeaders);
    }

    // Validate maxScreenshots
    const screenshotsValidation = validateInteger(maxScreenshots, 1, 20, "Max screenshots");
    if (!screenshotsValidation.valid) {
      return createValidationErrorResponse(screenshotsValidation.error!, corsHeaders);
    }
    
    // Initialize Supabase client for storage
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = supabaseUrl && supabaseServiceKey 
      ? createClient(supabaseUrl, supabaseServiceKey)
      : null;

    const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!apiKey) {
      console.error("FIRECRAWL_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: "Firecrawl connector not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // URL already formatted above

    console.log("Scraping URL for branding:", formattedUrl);

    // Step 1: Map the website to discover key pages
    console.log("Mapping website to discover pages...");
    let discoveredPages: string[] = [];
    
    try {
      const mapResponse = await fetchWithRetry("https://api.firecrawl.dev/v1/map", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: formattedUrl,
          limit: Math.max(50, maxScreenshots * 5),
          includeSubdomains: false,
        }),
      });

      const mapData = await mapResponse.json();
      
      if (mapResponse.ok && mapData.success) {
        discoveredPages = mapData.links || [];
        console.log(`Discovered ${discoveredPages.length} pages`);
      }
    } catch (mapError) {
      console.warn("Map failed, continuing with homepage only:", mapError);
    }

    // Step 2: Select key pages for screenshots (prioritize diverse pages for brand extraction)
    const keyPagePatterns = [
      /^https?:\/\/[^\/]+\/?$/i,                    // Homepage (most important)
      /about|who-we-are|our-story/i,                // About page (shows brand identity)
      /service|what-we-do|solutions|offering/i,    // Services (shows value prop)
      /product|pricing|packages/i,                  // Products/Pricing
      /portfolio|work|case-stud|projects/i,        // Portfolio (visual branding)
      /contact|get-in-touch|location/i,            // Contact page
      /team|leadership|people|staff/i,             // Team page
      /blog|news|articles|resources/i,             // Blog/Content
      /testimonial|review|client/i,                // Social proof
      /faq|help|support/i,                         // Support pages
    ];

    const selectedPages: string[] = [formattedUrl];
    
    for (const pattern of keyPagePatterns) {
      const match = discoveredPages.find(
        page => pattern.test(page) && !selectedPages.includes(page)
      );
      if (match) {
        selectedPages.push(match);
      }
      if (selectedPages.length >= maxScreenshots) break;
    }

    if (selectedPages.length < maxScreenshots) {
      for (const page of discoveredPages) {
        if (!selectedPages.includes(page)) {
          selectedPages.push(page);
        }
        if (selectedPages.length >= maxScreenshots) break;
      }
    }

    console.log(`Selected ${selectedPages.length} pages for screenshots:`, selectedPages);

    // Step 3: Scrape homepage for branding + content with retry and longer timeout
    let mainScrapedData: Record<string, unknown> | null = null;
    let mainScrapeError: string | null = null;

    try {
      const mainResponse = await fetchWithRetry("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: formattedUrl,
          formats: ["markdown", "links", "screenshot", "branding"],
          onlyMainContent: false,
          waitFor: 5000,
          timeout: 60000,
        }),
      }, 2, 2000);

      const mainData = await mainResponse.json();

      if (mainResponse.ok && mainData.success !== false) {
        mainScrapedData = mainData.data || mainData;
        console.log("Main scrape successful");
      } else {
        mainScrapeError = mainData.error || "Main scrape failed";
        console.warn("Main scrape failed:", mainScrapeError);
      }
    } catch (error) {
      mainScrapeError = error instanceof Error ? error.message : "Main scrape error";
      console.warn("Main scrape exception:", mainScrapeError);
    }

    // Fallback: Try simpler scrape without screenshot if main fails
    if (!mainScrapedData) {
      console.log("Attempting fallback scrape without screenshot...");
      try {
        const fallbackResponse = await fetchWithRetry("https://api.firecrawl.dev/v1/scrape", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: formattedUrl,
            formats: ["markdown", "branding"],
            onlyMainContent: true,
            waitFor: 2000,
          }),
        }, 1, 1000);

        const fallbackData = await fallbackResponse.json();
        
        if (fallbackResponse.ok && fallbackData.success !== false) {
          mainScrapedData = fallbackData.data || fallbackData;
          console.log("Fallback scrape successful (no screenshot)");
        }
      } catch (fallbackError) {
        console.warn("Fallback scrape also failed:", fallbackError);
      }
    }

    // Even if scrape fails, return partial data with discovered pages
    // This allows the proposal to proceed with limited info
    if (!mainScrapedData) {
      console.log("All scrapes failed, returning partial data from map");
      
      // Return minimal viable response with just the URL and discovered pages
      const partialResult = {
        success: true,
        partial: true,
        warning: "Website content could not be fully scraped. Proceeding with limited data.",
        branding: {
          logo: null,
          favicon: null,
          ogImage: null,
          colors: {},
          fonts: [],
          colorScheme: "light",
        },
        metadata: {
          title: new URL(formattedUrl).hostname.replace("www.", ""),
          description: "",
          sourceURL: formattedUrl,
        },
        content: "",
        screenshot: null,
        screenshots: [],
        discoveredPages: discoveredPages.slice(0, 20),
        links: discoveredPages,
      };

      return new Response(
        JSON.stringify(partialResult),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 4: Scrape additional pages for screenshots (with shorter timeout, no retries)
    const additionalPages = selectedPages.slice(1);
    const screenshotPromises = additionalPages.map(async (pageUrl) => {
      try {
        console.log(`Scraping screenshot from: ${pageUrl}`);
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
            title: scraped.metadata?.title || pageUrl.split('/').pop() || 'Page',
          };
        }
        return null;
      } catch (e) {
        console.error(`Error scraping ${pageUrl}:`, e);
        return null;
      }
    });

    const additionalScreenshots = (await Promise.all(screenshotPromises)).filter(Boolean);
    console.log(`Got ${additionalScreenshots.length} additional screenshots`);

    // Extract data from main scrape
    const branding = (mainScrapedData.branding as Record<string, unknown>) || {};
    const metadata = (mainScrapedData.metadata as Record<string, unknown>) || {};
    const brandingImages = (branding.images as Record<string, unknown>) || {};

    // Compile all screenshots
    const allScreenshots = [
      {
        url: formattedUrl,
        screenshot: mainScrapedData.screenshot || null,
        title: 'Homepage',
      },
      ...additionalScreenshots,
    ];

    // Extract logo URL from various sources with fallback chain:
    // 1. Branding-extracted logo (most reliable)
    // 2. OG Image (often a branded image)
    // 3. Favicon (last resort, better than nothing)
    const brandingLogo = (brandingImages.logo || branding.logo || null) as string | null;
    const ogImage = (brandingImages.ogImage || metadata.ogImage || null) as string | null;
    const favicon = (brandingImages.favicon || metadata.favicon || null) as string | null;
    
    // Choose best available image with fallback chain
    const externalLogoUrl = brandingLogo || ogImage || favicon;
    const logoSource = brandingLogo ? 'logo' : ogImage ? 'ogImage' : favicon ? 'favicon' : 'none';
    
    console.log(`Logo sources - Logo: ${brandingLogo ? 'found' : 'missing'}, OG: ${ogImage ? 'found' : 'missing'}, Favicon: ${favicon ? 'found' : 'missing'}`);
    console.log(`Selected logo source: ${logoSource} -> ${externalLogoUrl || 'none'}`);
    
    // Persist logo to Supabase Storage for permanent availability
    let persistedLogoUrl: string | null = null;
    if (externalLogoUrl && supabase) {
      // Create a unique path based on the domain
      const domain = new URL(formattedUrl).hostname.replace('www.', '').replace(/[^a-z0-9]/gi, '-');
      persistedLogoUrl = await persistImageToStorage(externalLogoUrl, supabase, `scraped/${domain}`);
      
      if (persistedLogoUrl) {
        console.log(`Logo persisted from ${externalLogoUrl} to ${persistedLogoUrl}`);
      } else {
        console.warn(`Failed to persist logo, using external URL: ${externalLogoUrl}`);
        persistedLogoUrl = externalLogoUrl; // Fall back to external URL
      }
    } else if (externalLogoUrl) {
      // No Supabase client available, use external URL
      persistedLogoUrl = externalLogoUrl;
    } else {
      console.warn('No logo, og:image, or favicon found for this website');
    }

    // Build response with persisted logo URL
    const result = {
      success: true,
      branding: {
        logo: persistedLogoUrl,
        favicon: brandingImages.favicon || metadata.favicon || null,
        ogImage: brandingImages.ogImage || metadata.ogImage || null,
        colors: branding.colors || {},
        fonts: branding.fonts || [],
        colorScheme: branding.colorScheme || "light",
      },
      metadata: {
        title: metadata.title || "",
        description: metadata.description || "",
        sourceURL: metadata.sourceURL || formattedUrl,
      },
      content: mainScrapedData.markdown || "",
      screenshot: mainScrapedData.screenshot || null,
      screenshots: allScreenshots,
      discoveredPages: discoveredPages.slice(0, 20),
      links: mainScrapedData.links || [],
    };

    console.log(`Scrape successful - ${allScreenshots.length} screenshots captured`);
    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error scraping website:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to scrape website";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
