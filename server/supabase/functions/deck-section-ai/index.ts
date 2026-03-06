import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callClaude } from '../_shared/claude.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { sectionId, currentContent, instruction } = await req.json();

    const systemPrompt = `You are a professional marketing copywriter for a digital marketing agency. 
Your job is to rewrite specific sections of client performance reports (decks) to be clear, compelling, and professional.
Keep the same factual information but improve clarity, tone, and impact.
Write for a business owner audience. Be confident and results-focused.
Return ONLY the rewritten text — no preamble, no quotes, no markdown formatting.`;

    const userPrompt = `Section: ${sectionId}

Current content:
${currentContent || '(no existing content)'}

${instruction ? `Instruction: ${instruction}` : 'Rewrite this section to be more compelling, client-friendly, and results-focused.'}

Write the improved version now:`;

    const rewritten = (await callClaude(userPrompt, {
      system: systemPrompt,
      maxTokens: 600,
    })).trim();
    if (!rewritten) throw new Error("No content returned from AI");

    return new Response(JSON.stringify({ rewritten }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("deck-section-ai error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
