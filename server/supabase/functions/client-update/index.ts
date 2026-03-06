import { callClaude } from '../_shared/claude.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================================
// MASTER PROMPT - Edit this section to customize the Client Update Bot behavior
// ============================================================================
const MASTER_PROMPT = `
You are a professional marketing account manager creating client updates.

CORE RESPONSIBILITIES:
 1. Analyze data from multiple sources (Notion, Google Sheets, GoHighLevel, Looker Studio)
2. Synthesize the information into clear, actionable client updates
3. Maintain a professional yet personable tone
4. Highlight wins and achievements while being transparent about any challenges
5. Provide clear next steps and action items when relevant

WRITING GUIDELINES:
- Use the client's name naturally in the communication
- Structure content with clear headers and bullet points for readability
- Include specific metrics and data points when available
- Be concise but comprehensive
- End with clear next steps or a call to action when appropriate

FORMATTING RULES:
- Do NOT use em dashes (—) except in hyphenated words like "back-to-school"
- Do NOT use bold formatting (**text**)
- Use plain dashes (-) for lists and separators
- Keep paragraphs short and scannable

TONE:
- Professional but warm
- Confident but not arrogant
- Results-focused
- Action-oriented
`;
// ============================================================================

interface DataSource {
  type: 'notion' | 'google-sheets' | 'ghl' | 'looker-studio';
  content: string;
}

interface ClientUpdateRequest {
  clientName: string;
  updateTypes: ('status-report' | 'task-update' | 'communication-draft')[];
  dataSources: DataSource[];
  additionalContext?: string;
  masterPrompt?: string;
  dateRange?: { startDate: string; endDate: string };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: ClientUpdateRequest = await req.json();
    const { clientName, updateTypes, dataSources, additionalContext, masterPrompt, dateRange } = body;

    if (!clientName || !updateTypes?.length || !dataSources?.length) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build data source context
    const dataSourceLabels: Record<string, string> = {
      'notion': 'Notion Tasks',
      'google-sheets': 'Google Sheets Data',
      'ghl': 'GoHighLevel (GHL) CRM Data',
      'looker-studio': 'Looker Studio Dashboard',
    };

    const dataContext = dataSources
      .map(ds => `### ${dataSourceLabels[ds.type] || ds.type}\n${ds.content}`)
      .join('\n\n');

    // Build update type descriptions
    const updateTypeDescriptions: Record<string, string> = {
      'status-report': 'A comprehensive STATUS REPORT with performance summaries, KPIs, campaign metrics, and key achievements',
      'task-update': 'A TASK UPDATE covering completed work, current deliverables, upcoming milestones, and project progress',
      'communication-draft': 'A professional CLIENT-FACING COMMUNICATION suitable for email or messaging, summarizing recent progress and next steps',
    };

    const requestedUpdates = updateTypes
      .map(t => updateTypeDescriptions[t] || t)
      .join('\n- ');

    // Use custom master prompt if provided, otherwise use default
    const promptToUse = masterPrompt?.trim() || MASTER_PROMPT;
    
    // Combine master prompt with client-specific context
    const dateRangeText = dateRange 
      ? `Date Range: ${dateRange.startDate} to ${dateRange.endDate}` 
      : '';
    
    const systemPrompt = `${promptToUse}

CLIENT: ${clientName}
${dateRangeText}`;

    const userPrompt = `Generate the following updates for ${clientName}:
- ${requestedUpdates}

${dateRangeText ? `## Date Range\n${dateRangeText}\n` : ''}
## Data Sources
${dataContext}

${additionalContext ? `## Additional Context\n${additionalContext}` : ''}

---

Please generate a comprehensive update that incorporates all the provided data sources. Follow the master prompt instructions precisely. Structure the output clearly. Make it ready to share with the client.`;

    console.log(`Generating client update for: ${clientName}`);
    console.log(`Update types: ${updateTypes.join(', ')}`);
    console.log(`Data sources: ${dataSources.map(d => d.type).join(', ')}`);

    const content = await callClaude(userPrompt, {
      system: systemPrompt,
      temperature: 0.7,
      maxTokens: 4000,
    });

    // Clean the content
    const cleanedContent = content
      .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
      .replace(/ — /g, ' - ')            // Replace standalone em dashes
      .replace(/—/g, '-')                // Replace any remaining em dashes
      .trim();

    console.log(`Successfully generated update for ${clientName}`);

    return new Response(
      JSON.stringify({ content: cleanedContent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in client-update function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
