import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { requireAuth } from "../middleware/auth.js";
import { supabase } from "../services/supabase.js";
import { SOP_CONTENT } from "../data/sopTextContent.js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Full SOP text embedded as a compiled constant (no file-system dependency)
const SOP_TEXT = SOP_CONTENT;

const router = Router();

// Maps guide section slugs to their website projects/pages (bypasses member_name filter)
const GUIDE_SECTIONS: Record<string, { projectId: string; projectSlug: string; pageId: string } | null> = {
  "sales-guide": {
    projectId: "43ae0a0c-41f2-4d47-9bac-4aafaf14cb62",
    projectSlug: "melleka-sales-script",
    pageId: "7722c5d8-7e1c-4523-9a9f-97a157da9700",
  },
  "new-hire": {
    projectId: "4961b17b-9e1a-443c-a2dc-ea9f0ce14e86",
    projectSlug: "melleka-new-hire-guide",
    pageId: "2a866a0d-ea90-45d4-858b-d4fda30efcc0",
  },
  "sop": null, // built as dedicated /sop page
};

// GET /api/guide/:section — returns HTML content for a guide section
router.get("/:section", requireAuth, async (req, res) => {
  const { section } = req.params;

  if (!(section in GUIDE_SECTIONS)) {
    res.status(404).json({ error: "Unknown section" });
    return;
  }

  const config = GUIDE_SECTIONS[section];

  if (!config) {
    res.json({ html: null, projectSlug: null, projectId: null, pageId: null });
    return;
  }

  const { data: page, error } = await supabase
    .from("website_pages")
    .select("html_content")
    .eq("id", config.pageId)
    .single();

  if (error || !page) {
    res.status(404).json({ error: "Page not found" });
    return;
  }

  res.json({
    html: page.html_content,
    projectSlug: config.projectSlug,
    projectId: config.projectId,
    pageId: config.pageId,
  });
});

// POST /api/guide/value-provider — AI-generated value pitch for a prospect
router.post("/value-provider", requireAuth, async (req, res) => {
  const { industry, notes } = req.body as { industry?: string; notes?: string };

  if (!industry?.trim()) {
    res.status(400).json({ error: "industry is required" });
    return;
  }

  try {
    const systemPrompt = `You are a senior marketing strategist at Melleka Marketing, a full-service digital marketing agency in Los Angeles.

A sales rep is on the phone with a prospect and needs real, specific marketing advice to give them VALUE right now — not a pitch, actual advice.

Your job is to give a free consultation with concrete, industry-specific marketing recommendations. Structure your response EXACTLY like this:

**Best Channels for [Industry]**
List the top 2-3 paid/organic channels and WHY they work for this specific industry (be specific — e.g. "Google Search Ads work here because people search 'medspa near me' with high purchase intent" not just "Google Ads work well").

**What to Run (Campaign Types)**
Specific ad types, offers, and creative angles that convert in this industry. Give real examples of what the ads should say or promote.

**Who to Target**
Key audience segments, demographics, or targeting parameters. Be specific to the industry.

**Quick Wins They Can Do Now**
2-3 things they can implement immediately, with or without an agency.

**Common Mistakes in This Industry**
2-3 marketing mistakes businesses in this space make and how to avoid them.

Keep everything specific to the industry. No generic advice. The sales rep will read this to the prospect live on the phone — make it sound like expert knowledge, not a template. Never use em dashes.`;

    const userMessage = `Industry: ${industry.trim()}${notes?.trim() ? `\n\nCall notes: ${notes.trim()}` : ""}`;

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 900,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const recommendation =
      response.content[0]?.type === "text" ? response.content[0].text : "";

    res.json({ recommendation });
  } catch (err) {
    console.error("[guide/value-provider] error:", err);
    res.status(500).json({ error: "Failed to generate recommendation" });
  }
});

// POST /api/guide/industry-advice — broader free consultation for FreeConsultation tool in LiveScript
router.post("/industry-advice", requireAuth, async (req, res) => {
  const { industry, notes } = req.body as { industry?: string; notes?: string };

  if (!industry?.trim()) {
    res.status(400).json({ error: "industry is required" });
    return;
  }

  try {
    const systemPrompt = `You are a senior sales coach at Melleka Marketing, a full-service digital marketing agency.

Your job is to give a free, actionable marketing consultation to a prospect on a sales call. The sales rep will read this aloud to the prospect.

Include:
1. Top 2-3 advertising platforms they should be on and why
2. Types of ads/campaigns that work best in their industry
3. Key verticals or audience segments to target
4. Quick wins they can implement immediately (with or without us)
5. Common mistakes businesses in their industry make with marketing

Keep it conversational, specific, and under 200 words. Use bullet points for easy reading. Never use em dashes.`;

    const userMessage = `Industry: ${industry.trim()}${notes?.trim() ? `\n\nCall context: ${notes.trim()}` : ""}`;

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const advice =
      response.content[0]?.type === "text" ? response.content[0].text : "";

    res.json({ advice });
  } catch (err) {
    console.error("[guide/industry-advice] error:", err);
    res.status(500).json({ error: "Failed to generate advice" });
  }
});

// POST /api/guide/sop-chat — AI answers questions about the Melleka SOP
router.post("/sop-chat", requireAuth, async (req, res) => {
  const { question, history } = req.body as {
    question?: string;
    history?: { role: "user" | "assistant"; content: string }[];
  };

  if (!question?.trim()) {
    res.status(400).json({ error: "question is required" });
    return;
  }

  if (!SOP_TEXT) {
    console.error("[guide/sop-chat] SOP text not loaded");
    res.status(500).json({ error: "SOP context unavailable" });
    return;
  }

  try {
    const systemPrompt = `You are the Melleka SOP Assistant — an expert on the Melleka Marketing Master Operating Manual and Standard Operating Procedures. You help team members quickly find accurate answers about company policy, procedures, roles, and responsibilities.

Below is the full text of the Melleka Marketing Master Operating Manual & SOP. Use it as your primary source of truth:

---
${SOP_TEXT}
---

Rules:
- Answer based only on the SOP content above. If something is not covered in the SOP, say so clearly.
- Be concise and specific. Cite section numbers when helpful (e.g., "Per section 10.2...").
- Write in plain text only. No markdown formatting whatsoever: no asterisks, no bold (**text**), no headers (## or ###), no backticks, no underscores for formatting.
- For procedural steps, use plain numbered lines: "1. Do this" on one line, "2. Do that" on the next.
- For lists, use plain dashes or just line breaks.
- Never use em dashes.
- IMPORTANT: Only refer to C-level leadership by name: Anthony (CEO), Lexie (COO), Bryan (CMO), David (CSO). Never name any other specific individual. For all non-C-level roles, refer to them by their function only, for example: "the sales rep", "the assigned employee", "the CRM/communications team member", "the sales development rep", "the accountant", "the developing team member". This SOP is for all current and future team members, so no specific person below C-level should ever be called out by name.
- If a question involves authority or who to contact, refer to the appropriate C-level leader or use a generic role description.
- "Recommended Future-State" items are NOT current policy unless adopted. Make this clear when relevant.`;

    const messages: Anthropic.MessageParam[] = [
      ...(history ?? []).slice(-6).map((h) => ({
        role: h.role,
        content: h.content,
      })),
      { role: "user", content: question.trim() },
    ];

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      system: systemPrompt,
      messages,
    });

    const answer =
      response.content[0]?.type === "text" ? response.content[0].text : "";

    res.json({ answer });
  } catch (err) {
    console.error("[guide/sop-chat] error:", err);
    res.status(500).json({ error: "Failed to get answer" });
  }
});

export default router;
