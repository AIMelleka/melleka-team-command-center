import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireToolAuth, createUnauthorizedResponse } from "../_shared/auth.ts";
import { callClaude } from '../_shared/claude.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// TODO: Replace with user's custom prompt
const SYSTEM_PROMPT = `You are an expert email writer for a professional marketing agency. 

Your emails should be:
- Clear, concise, and well-structured
- Professional yet personable
- Free of grammar and spelling errors
- Appropriately formatted with proper greetings and sign-offs

When replying to emails:
- Address the specific points raised
- Maintain context from the original email
- Be helpful and solution-oriented

When composing new emails:
- Create a compelling subject line
- Hook the reader in the first sentence
- Structure the body logically
- End with a clear call-to-action

Always output in this exact JSON format:
{
  "subject": "Subject line here (for new emails or suggested reply subject)",
  "body": "Full email body here with proper formatting"
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authResult = await requireToolAuth(req, 'email-writer');
  if (!authResult.authorized) {
    return createUnauthorizedResponse(
      authResult.error || "Unauthorized",
      authResult.status || 401,
      corsHeaders
    );
  }

  try {
    const { 
      mode, 
      originalEmail, 
      replyIntent, 
      draftEmail,
      editInstructions,
      recipient, 
      purpose, 
      keyPoints, 
      tone = "professional" 
    } = await req.json();

    if (!mode) {
      return new Response(
        JSON.stringify({ error: "Mode is required (reply or compose)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build user prompt based on mode
    let userPrompt = "";

    if (mode === "reply") {
      userPrompt = `REPLY TO THIS EMAIL:

ORIGINAL EMAIL:
${originalEmail}

HOW TO RESPOND:
${replyIntent || "Provide a helpful and professional response"}

TONE: ${tone}

Generate a professional reply email.`;
    } else if (mode === "edit") {
      userPrompt = `EDIT AND IMPROVE THIS DRAFT EMAIL:

DRAFT EMAIL:
${draftEmail}

IMPROVEMENT INSTRUCTIONS:
${editInstructions || "Polish it for clarity, professionalism, grammar, and flow. Fix any errors and improve the overall quality."}

TONE: ${tone}

Edit and improve this email while preserving the original intent and key information. Fix any grammar, spelling, or punctuation errors. Improve clarity and flow.`;
    } else {
      userPrompt = `COMPOSE A NEW EMAIL:

RECIPIENT: ${recipient || "Not specified"}

PURPOSE: ${purpose}

KEY POINTS TO INCLUDE:
${keyPoints || "None specified"}

TONE: ${tone}

Generate a professional email with a compelling subject line.`;
    }

    console.log(`Generating ${mode} email with tone: ${tone}`);

    const aiResponse = await callClaude(userPrompt, {
      system: SYSTEM_PROMPT,
    });

    // Parse the JSON response
    let result: { subject?: string; body: string };
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = aiResponse.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, aiResponse];
      const jsonStr = jsonMatch[1].trim();
      result = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("Failed to parse AI response as JSON:", parseError);
      // Fallback: treat the entire response as the body
      result = { body: aiResponse };
    }

    console.log("Email generated successfully");

    return new Response(
      JSON.stringify({
        success: true,
        subject: result.subject || "",
        body: result.body,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Email writer error:", error);

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to generate email" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
