import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdminAuth, createUnauthorizedResponse } from "../_shared/auth.ts";

declare const EdgeRuntime: {
  waitUntil: (promise: Promise<unknown>) => void;
} | undefined;

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
    return createUnauthorizedResponse(authResult.error || "Unauthorized", authResult.status || 401, corsHeaders);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { deckId, instructions } = await req.json();

    if (!deckId) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required field: deckId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the existing deck to get its inputParams and slug
    const { data: deck, error: fetchError } = await supabase
      .from("decks")
      .select("id, slug, content, brand_colors, client_name, date_range_start, date_range_end")
      .eq("id", deckId)
      .single();

    if (fetchError || !deck) {
      return new Response(
        JSON.stringify({ success: false, error: "Deck not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const content = deck.content as Record<string, unknown>;
    const storedInputParams = (content?.inputParams || {}) as Record<string, unknown>;

    // Build input params — prefer stored inputParams, fall back to deck fields
    const inputParams = {
      clientName: storedInputParams.clientName || deck.client_name,
      dateRangeStart: storedInputParams.dateRangeStart || deck.date_range_start,
      dateRangeEnd: storedInputParams.dateRangeEnd || deck.date_range_end,
      lookerUrl: storedInputParams.lookerUrl,
      ga4PropertyId: storedInputParams.ga4PropertyId,
      domain: storedInputParams.domain,
      screenshots: storedInputParams.screenshots,
      taskNotes: storedInputParams.taskNotes,
      supermetricsData: storedInputParams.supermetricsData,
      deckColors: storedInputParams.deckColors || deck.brand_colors,
      branding: storedInputParams.branding || { logo: (deck.brand_colors as any)?.logo },
      seoData: storedInputParams.seoData,
      seoDeckData: storedInputParams.seoDeckData,
    };

    // Reset deck status to "generating" with progress indicator
    await supabase
      .from("decks")
      .update({
        status: "generating",
        content: {
          ...content,
          progress: 5,
          progressMessage: "Re-generating deck content...",
          inputParams,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", deckId);

    // Trigger generate-deck with the existing deckId so it updates in place
    const triggerRegeneration = async () => {
      const MAX_RETRIES = 3;
      const RETRY_DELAYS = [2000, 5000, 10000];

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          console.log(`Triggering deck regeneration (attempt ${attempt}/${MAX_RETRIES}) for deck ${deckId}...`);

          const response = await fetch(`${supabaseUrl}/functions/v1/generate-deck`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseServiceKey}`,
            },
          body: JSON.stringify({
              ...inputParams,
              deckId: deck.id,
              slug: deck.slug,
              async: true,
              ...(instructions ? { regenInstructions: instructions } : {}),
            }),
          });

          if (response.ok) {
            console.log("Deck regeneration acknowledged");
            return;
          }

          const errorText = await response.text().catch(() => "");
          const isTransient = [502, 503, 504].includes(response.status) || errorText.includes("BOOT_ERROR");

          if (isTransient && attempt < MAX_RETRIES) {
            await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt - 1]));
            continue;
          }

          throw new Error(`Failed to start regeneration: HTTP ${response.status} ${errorText.slice(0, 300)}`);
        } catch (e) {
          if (attempt < MAX_RETRIES) {
            await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt - 1]));
            continue;
          }
          const msg = e instanceof Error ? e.message : "Failed to start regeneration";
          await supabase.from("decks").update({
            status: "failed",
            content: { ...content, progress: 0, progressMessage: msg, error: msg },
            updated_at: new Date().toISOString(),
          }).eq("id", deckId);
        }
      }
    };

    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
      EdgeRuntime.waitUntil(triggerRegeneration());
    } else {
      triggerRegeneration();
    }

    return new Response(
      JSON.stringify({ success: true, deckId, slug: deck.slug, message: "Deck regeneration started" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error regenerating deck:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
