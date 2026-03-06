import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { callClaude } from '../_shared/claude.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { docId, fileUrl, fileName } = await req.json();
    if (!docId || !fileUrl) {
      return new Response(JSON.stringify({ error: 'Missing docId or fileUrl' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Download the file
    console.log(`[PARSE] Downloading: ${fileName}`);
    const fileRes = await fetch(fileUrl);
    if (!fileRes.ok) throw new Error(`Failed to download file: ${fileRes.status}`);
    
    const fileBlob = await fileRes.blob();
    const fileText = await extractTextFromFile(fileBlob, fileName);

    if (!fileText || fileText.trim().length < 20) {
      // If extraction fails or is too short, use AI to describe what we know
      await supabase
        .from('strategist_knowledge_docs')
        .update({ 
          parsed_content: `[File: ${fileName}] — Content could not be fully extracted. File size: ${fileBlob.size} bytes.`,
          summary: `Uploaded document: ${fileName}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', docId);

      return new Response(JSON.stringify({ success: true, parsed: false, reason: 'minimal_content' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Truncate to ~50k chars for AI processing
    const truncatedContent = fileText.slice(0, 50000);

    // Use AI to summarize and extract key insights
    const parseSystemPrompt = `You are a PPC and digital marketing data analyst. You're given a document that was uploaded to train an AI PPC Strategy Bot. Extract ALL useful information including:
- Performance metrics, KPIs, benchmarks
- Strategy insights, recommendations
- Graph/chart data points (describe what they show)
- Client-specific information
- Industry benchmarks
- Campaign structures, targeting info
- Budget allocations, ROAS targets
- Any rules, thresholds, or guidelines

Output a JSON object:
{
  "summary": "2-3 sentence summary of what this document contains",
  "key_insights": ["insight1", "insight2", ...],
  "metrics": { "metric_name": "value", ... },
  "strategies": ["strategy1", "strategy2", ...],
  "rules": ["rule1", "rule2", ...],
  "category": "performance_report|strategy_doc|benchmark_data|client_brief|training_material|other"
}

Be thorough — every data point matters for training the strategy bot.`;

    let summary = `Uploaded: ${fileName}`;
    let category = 'general';
    let parsedInsights = '';

    try {
      const raw = await callClaude(
        `Document: "${fileName}"\n\nContent:\n${truncatedContent}`,
        { system: parseSystemPrompt, temperature: 0.2 }
      );
      try {
        const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(cleaned);
        summary = parsed.summary || summary;
        category = parsed.category || 'general';
        
        const parts: string[] = [];
        if (parsed.key_insights?.length) {
          parts.push('KEY INSIGHTS:\n' + parsed.key_insights.map((i: string) => `• ${i}`).join('\n'));
        }
        if (parsed.metrics && Object.keys(parsed.metrics).length) {
          parts.push('METRICS:\n' + Object.entries(parsed.metrics).map(([k, v]) => `• ${k}: ${v}`).join('\n'));
        }
        if (parsed.strategies?.length) {
          parts.push('STRATEGIES:\n' + parsed.strategies.map((s: string) => `• ${s}`).join('\n'));
        }
        if (parsed.rules?.length) {
          parts.push('RULES/GUIDELINES:\n' + parsed.rules.map((r: string) => `• ${r}`).join('\n'));
        }
        parsedInsights = parts.join('\n\n');
      } catch {
        parsedInsights = raw;
      }
    } catch (aiError) {
      console.error('[PARSE] AI analysis failed:', aiError);
    }

    // Store the full text + AI-extracted insights
    const finalContent = parsedInsights 
      ? `=== AI-EXTRACTED INSIGHTS ===\n${parsedInsights}\n\n=== RAW CONTENT ===\n${truncatedContent}`
      : truncatedContent;

    await supabase
      .from('strategist_knowledge_docs')
      .update({
        parsed_content: finalContent.slice(0, 100000),
        summary,
        category,
        updated_at: new Date().toISOString(),
      })
      .eq('id', docId);

    console.log(`[PARSE] Done: ${fileName} → ${finalContent.length} chars, category: ${category}`);

    return new Response(JSON.stringify({ success: true, parsed: true, category, summaryLength: summary.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (e) {
    console.error('[PARSE] Error:', e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function extractTextFromFile(blob: Blob, fileName: string): Promise<string> {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  
  if (ext === 'txt' || ext === 'csv' || ext === 'md') {
    return await blob.text();
  }
  
  if (ext === 'pdf') {
    // For PDFs, we'll extract what we can from the raw bytes
    // Looking for text streams in the PDF
    const text = await blob.text();
    
    // Extract readable text between stream markers
    const textParts: string[] = [];
    const lines = text.split('\n');
    let inText = false;
    
    for (const line of lines) {
      // Look for text that appears readable (ASCII printable)
      const readable = line.replace(/[^\x20-\x7E]/g, ' ').trim();
      if (readable.length > 10 && !/^[%\/\[\]<>{}()\\]/.test(readable)) {
        textParts.push(readable);
      }
    }
    
    // Also try to find text in parentheses (PDF text objects)
    const parenMatches = text.match(/\(([^)]{3,})\)/g);
    if (parenMatches) {
      for (const m of parenMatches) {
        const inner = m.slice(1, -1).replace(/\\/g, '');
        if (inner.length > 3 && /[a-zA-Z]/.test(inner)) {
          textParts.push(inner);
        }
      }
    }
    
    return textParts.join('\n');
  }
  
  // For other file types, try to read as text
  try {
    return await blob.text();
  } catch {
    return '';
  }
}
