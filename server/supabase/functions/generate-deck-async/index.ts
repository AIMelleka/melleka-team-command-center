import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdminAuth, createUnauthorizedResponse } from "../_shared/auth.ts";

// Declare EdgeRuntime for Deno edge environment
declare const EdgeRuntime: {
  waitUntil: (promise: Promise<unknown>) => void;
} | undefined;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface UploadedScreenshot {
  url: string;
  name: string;
}

interface DeckJobInput {
  clientName: string;
  dateRangeStart: string;
  dateRangeEnd: string;
  lookerUrl?: string;
  ga4PropertyId?: string;
  domain?: string;
  screenshots?: UploadedScreenshot[];
  taskNotes?: string;
}

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

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ success: false, error: "Supabase environment variables not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const inputParams: DeckJobInput & { deckColors?: { primary?: string; background?: string; text?: string; textMuted?: string }; branding?: { logo?: string } } = await req.json();

    if (!inputParams.clientName || !inputParams.dateRangeStart || !inputParams.dateRangeEnd) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields: clientName, dateRangeStart, dateRangeEnd" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create a placeholder deck record immediately with status "generating"
    const placeholderSlug = `d-${generateSlug()}`;
    
    const { data: placeholderDeck, error: placeholderError } = await supabase
      .from("decks")
      .insert({
        slug: placeholderSlug,
        client_name: inputParams.clientName,
        date_range_start: inputParams.dateRangeStart,
        date_range_end: inputParams.dateRangeEnd,
        status: "generating",
        content: {
          progress: 5,
          progressMessage: "Starting deck generation...",
          inputParams,
        },
        screenshots: [],
        brand_colors: { 
          primary: inputParams.deckColors?.primary || "#6366f1", 
          secondary: "#8b5cf6",
          background: inputParams.deckColors?.background || "#1A1F2C",
          textPrimary: inputParams.deckColors?.text || undefined,
          textSecondary: inputParams.deckColors?.textMuted || undefined,
          logo: inputParams.branding?.logo || undefined,
        },
      })
      .select()
      .single();

    if (placeholderError) {
      throw new Error(`Failed to create deck placeholder: ${placeholderError.message}`);
    }

    const deckId = placeholderDeck.id;
    console.log(`Deck job created: ${deckId} (placeholder slug: ${placeholderSlug})`);

    // Trigger generation in the background.
    // IMPORTANT: We pass the placeholder deckId + slug into generate-deck.
    // generate-deck will return immediately (202) and continue processing via EdgeRuntime.waitUntil,
    // updating this placeholder record directly (no duplicates, no HTTP 504 timeouts).
    const triggerGeneration = async () => {
      const MAX_RETRIES = 3;
      const RETRY_DELAYS = [2000, 5000, 10000]; // ms backoff

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          console.log(`Triggering generate-deck background job (attempt ${attempt}/${MAX_RETRIES})...`);

          const response = await fetch(`${supabaseUrl}/functions/v1/generate-deck`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              ...inputParams,
              deckId,
              slug: placeholderSlug,
              async: true,
            }),
          });

          if (response.ok) {
            console.log("generate-deck acknowledged job start");
            return; // Success — exit retry loop
          }

          const errorText = await response.text().catch(() => "");
          const isTransient = [502, 503, 504].includes(response.status) || errorText.includes("BOOT_ERROR");

          if (isTransient && attempt < MAX_RETRIES) {
            console.warn(`Transient error (HTTP ${response.status}), retrying in ${RETRY_DELAYS[attempt - 1]}ms...`);
            await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt - 1]));
            continue;
          }

          throw new Error(`Failed to start generator: HTTP ${response.status} ${errorText.slice(0, 300)}`);
        } catch (e) {
          if (attempt < MAX_RETRIES && e instanceof Error && (e.message.includes("BOOT_ERROR") || e.message.includes("503") || e.message.includes("502"))) {
            console.warn(`Retry ${attempt}/${MAX_RETRIES} after error:`, e.message);
            await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt - 1]));
            continue;
          }

          const msg = e instanceof Error ? e.message : "Failed to start generator";
          console.error("Generator trigger failed after all retries:", e);
          await supabase
            .from("decks")
            .update({
              status: "failed",
              content: {
                progress: 0,
                progressMessage: msg,
                error: msg,
              },
              updated_at: new Date().toISOString(),
            })
            .eq("id", deckId);
          return; // Don't continue retrying
        }
      }
    };

    // Use EdgeRuntime.waitUntil if available for background processing
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
      EdgeRuntime.waitUntil(triggerGeneration());

      return new Response(
        JSON.stringify({ 
          success: true, 
          deckId,
          slug: placeholderSlug,
          message: "Deck generation started in background" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      try {
        await triggerGeneration();
        return new Response(
          JSON.stringify({ 
            success: true, 
            deckId,
            slug: placeholderSlug,
            message: "Deck generated successfully" 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (processingError) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            deckId,
            slug: placeholderSlug,
            error: processingError instanceof Error ? processingError.message : "Unknown error" 
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

  } catch (error) {
    console.error("Error starting deck generation:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Generate a unique slug for the deck
 */
function generateSlug(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
