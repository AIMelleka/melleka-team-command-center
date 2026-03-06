import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  validateString,
  validateArray,
  createValidationErrorResponse,
} from "../_shared/validation.ts";
import { callClaude } from '../_shared/claude.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Maximum allowed lengths
const MAX_CLIENT_NAME_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 5000;
const MAX_SERVICE_LENGTH = 200;
const MAX_SERVICES_COUNT = 50;
const MAX_MESSAGES_COUNT = 20; // Tighter limit for public endpoint
const MAX_MESSAGE_CONTENT_LENGTH = 2000; // Tighter limit for public endpoint

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // No auth required - this is a public demo chatbot embedded in client-facing proposals

  try {
    const { messages, clientName, clientServices, clientDescription } = await req.json();
    
    // Validate clientName (required)
    const clientNameValidation = validateString(clientName, MAX_CLIENT_NAME_LENGTH, "Client name", true);
    if (!clientNameValidation.valid) {
      return createValidationErrorResponse(clientNameValidation.error!, corsHeaders);
    }

    // Validate messages array (required)
    const messagesValidation = validateArray(messages, MAX_MESSAGES_COUNT, "Messages", true);
    if (!messagesValidation.valid) {
      return createValidationErrorResponse(messagesValidation.error!, corsHeaders);
    }

    // Validate each message in the array
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (!msg || typeof msg !== 'object') {
        return createValidationErrorResponse(`Message ${i + 1} must be an object`, corsHeaders);
      }
      if (!['user', 'assistant'].includes(msg.role)) {
        return createValidationErrorResponse(`Message ${i + 1} has invalid role`, corsHeaders);
      }
      if (typeof msg.content !== 'string') {
        return createValidationErrorResponse(`Message ${i + 1} content must be a string`, corsHeaders);
      }
      if (msg.content.length > MAX_MESSAGE_CONTENT_LENGTH) {
        return createValidationErrorResponse(
          `Message ${i + 1} exceeds maximum length of ${MAX_MESSAGE_CONTENT_LENGTH} characters`,
          corsHeaders
        );
      }
    }

    // Validate optional clientServices array
    if (clientServices !== undefined && clientServices !== null) {
      const servicesValidation = validateArray(clientServices, MAX_SERVICES_COUNT, "Client services");
      if (!servicesValidation.valid) {
        return createValidationErrorResponse(servicesValidation.error!, corsHeaders);
      }
      // Validate each service string
      if (Array.isArray(clientServices)) {
        for (let i = 0; i < clientServices.length; i++) {
          const svc = clientServices[i];
          if (typeof svc !== 'string' || svc.length > MAX_SERVICE_LENGTH) {
            return createValidationErrorResponse(
              `Service ${i + 1} must be a string with maximum ${MAX_SERVICE_LENGTH} characters`,
              corsHeaders
            );
          }
        }
      }
    }

    // Validate optional clientDescription
    const descValidation = validateString(clientDescription, MAX_DESCRIPTION_LENGTH, "Client description");
    if (!descValidation.valid) {
      return createValidationErrorResponse(descValidation.error!, corsHeaders);
    }
    
    // Build context about the client's business
    const servicesContext = clientServices && clientServices.length > 0 
      ? `Their main services include: ${clientServices.join(', ')}.`
      : '';
    
    const descriptionContext = clientDescription 
      ? `Business description: ${clientDescription}`
      : '';

    const systemPrompt = `You are a friendly, helpful AI assistant for ${clientName}. You're embedded in their marketing proposal to demonstrate how their future AI chatbot will work.

${descriptionContext}
${servicesContext}

YOUR ROLE:
- Act as ${clientName}'s virtual assistant, helping potential customers learn about their business
- Be warm, professional, and conversational - not robotic
- Provide helpful information about their services when asked
- If you don't have specific information, acknowledge it gracefully and offer to help in other ways
- Keep responses concise but helpful (2-4 sentences typically)
- Show enthusiasm about ${clientName}'s business and services
- If asked about booking or scheduling, explain you can help them get connected with the team
- If asked about pricing, give general guidance and offer to connect them with the team for specifics

CONVERSATION STYLE:
- Use a friendly, approachable tone
- Include occasional emojis where appropriate (but don't overdo it)
- Ask follow-up questions to understand their needs
- Provide value in every response

Remember: This is a DEMO to show ${clientName} how effective an AI chatbot can be for their business. Make it impressive!`;

    const aiResponse = await callClaude('', {
      system: systemPrompt,
      messages: messages,
      maxTokens: 500,
      temperature: 0.7,
    });

    // Return as SSE stream format for frontend compatibility
    const sseData = [
      `data: ${JSON.stringify({ choices: [{ delta: { content: aiResponse } }] })}\n\n`,
      `data: [DONE]\n\n`,
    ].join('');

    return new Response(sseData, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });

  } catch (error) {
    console.error("Proposal chatbot error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
