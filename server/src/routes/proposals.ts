import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import Anthropic from "@anthropic-ai/sdk";

const router = Router();
const anthropic = new Anthropic();

interface GenerateSectionRequest {
  prompt: string;
  sectionType: "text-block" | "stats" | "feature-list" | "testimonial" | "cta-block";
  clientName: string;
  proposalContext?: string;
}

const SECTION_CONTENT_FORMATS: Record<string, string> = {
  "text-block": `{ "heading": "Section Title", "body": "Paragraph content..." }`,
  stats: `{ "stats": [{ "value": "100+", "label": "Metric Label" }, { "value": "50%", "label": "Another Metric" }, { "value": "24/7", "label": "Third Metric" }] }`,
  "feature-list": `{ "heading": "List Title", "items": ["Feature one", "Feature two", "Feature three", "Feature four"] }`,
  testimonial: `{ "quote": "\\"Client testimonial text...\\"", "author": "Person Name", "company": "Company Name" }`,
  "cta-block": `{ "heading": "Call to Action Heading", "body": "Supporting text for the CTA.", "buttonText": "Get Started", "buttonUrl": "#" }`,
};

// POST /api/proposals/generate-section
router.post("/generate-section", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { prompt, sectionType, clientName, proposalContext } =
      req.body as GenerateSectionRequest;

    if (!prompt || !sectionType || !clientName) {
      res
        .status(400)
        .json({ error: "prompt, sectionType, and clientName are required" });
      return;
    }

    const format = SECTION_CONTENT_FORMATS[sectionType];
    if (!format) {
      res.status(400).json({ error: `Invalid sectionType: ${sectionType}` });
      return;
    }

    const systemPrompt = `You are a marketing proposal content writer for Melleka Marketing agency. Generate content for a proposal section.

Client: ${clientName}
${proposalContext ? `Context: ${proposalContext}` : ""}

You MUST respond with ONLY valid JSON matching this exact format (no markdown, no extra text):
${format}

Write professional, compelling marketing content tailored to the client. Keep copy concise and impactful.`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
      system: systemPrompt,
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      res.status(500).json({ error: "No text response from AI" });
      return;
    }

    // Parse the JSON response
    const rawText = textBlock.text.trim();
    // Strip markdown code fences if present
    const jsonStr = rawText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();

    const content = JSON.parse(jsonStr);
    res.json({ content, title: content.heading || clientName });
  } catch (err: any) {
    console.error("[proposals] generate-section error:", err?.message || err);
    res.status(500).json({ error: "Failed to generate section content" });
  }
});

export default router;
