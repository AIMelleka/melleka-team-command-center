import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import Anthropic from "@anthropic-ai/sdk";

const router = Router();

// POST /api/deep-analysis — AI multi-day trend analysis for a single client
router.post("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { clientName, startDate, endDate, reports } = req.body as {
      clientName: string;
      startDate: string;
      endDate: string;
      reports: any[];
    };

    if (!clientName || !reports || reports.length === 0) {
      res.status(400).json({ error: "clientName and reports are required" });
      return;
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });
      return;
    }

    const claude = new Anthropic({ apiKey });

    // Compress the reports to reduce token usage -- keep only the most relevant fields
    const compressed = reports.map((r: any) => ({
      date: r.reviewDate,
      summary: r.summary,
      platforms: (r.platforms || []).map((p: any) => ({
        name: p.name,
        spend: p.spend,
        clicks: p.clicks,
        conversions: p.conversions,
        leads: p.leads,
        ctr: p.ctr,
        cpc: p.cpc,
        costPerLead: p.costPerLead,
        costPerConversion: p.costPerConversion,
        health: p.health,
        trend: p.trend,
      })),
      cplCpaAnalysis: r.cplCpaAnalysis,
      insights: (r.insights || []).slice(0, 5),
      recommendations: (r.recommendations || []).slice(0, 5),
      weekOverWeek: r.weekOverWeek,
    }));

    const response = await claude.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: `You are an expert PPC/digital advertising analyst for a marketing agency. You analyze multi-day ad performance data to identify trends, patterns, and anomalies.

Your analysis must be specific, quantitative, and actionable. Use actual numbers from the data. Focus on CPL (Cost Per Lead) and CPA (Cost Per Acquisition) as the PRIMARY performance indicators.

Return a JSON object with this EXACT structure (no markdown, no explanation, just valid JSON):
{
  "trendSummary": "2-3 sentence executive summary of the period's performance trajectory",
  "patterns": [
    {
      "pattern": "Short pattern name",
      "description": "Detailed description with numbers",
      "confidence": "high|medium|low",
      "affectedMetrics": ["CPA", "CTR", etc]
    }
  ],
  "anomalies": [
    {
      "date": "YYYY-MM-DD",
      "metric": "Metric name",
      "expected": "Expected value",
      "actual": "Actual value",
      "severity": "high|medium|low",
      "possibleCause": "Explanation"
    }
  ],
  "periodComparison": {
    "spendTrend": "increasing|decreasing|stable",
    "conversionTrend": "increasing|decreasing|stable",
    "cplTrend": "improving|declining|stable",
    "cpaTrend": "improving|declining|stable",
    "bestDay": "YYYY-MM-DD with reason",
    "worstDay": "YYYY-MM-DD with reason"
  },
  "strategicOutlook": "2-3 sentence forward-looking assessment",
  "actionableRecommendations": [
    {
      "priority": "high|medium|low",
      "action": "Specific action to take",
      "expectedImpact": "Quantified expected result",
      "platform": "Google Ads|Meta Ads|Both",
      "effort": "quick-win|medium|strategic",
      "timeline": "immediate|this-week|this-month",
      "changeType": "pause_campaign|update_budget|add_negative_keyword|adjust_bid|restructure|advisory",
      "platformTarget": "google|meta|both",
      "entityType": "campaigns|adGroups|campaignCriteria|adsets",
      "entityName": "Name of the campaign/adgroup/keyword if applicable",
      "confidence": "high|medium|low"
    }
  ]
}

Rules:
- If data is insufficient for a section, return an empty array (not null)
- patterns should have 2-5 items, anomalies 0-3 items, recommendations 3-7 items
- "advisory" changeType means it cannot be auto-executed (needs human judgment)
- Only include entityType/entityName when they can be determined from the data
- Be conservative with confidence -- "high" only when data clearly supports it`,
      messages: [
        {
          role: "user",
          content: `Analyze the following ${reports.length} days of ad performance data for "${clientName}" from ${startDate} to ${endDate}:\n\n${JSON.stringify(compressed, null, 2)}`,
        },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";

    // Extract JSON from response (handle potential markdown wrapping)
    let jsonStr = text;
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1];

    const analysis = JSON.parse(jsonStr.trim());
    analysis.clientName = clientName;

    // Ensure all actionable recommendations have required fields
    if (Array.isArray(analysis.actionableRecommendations)) {
      analysis.actionableRecommendations = analysis.actionableRecommendations.map((rec: any) => ({
        ...rec,
        clientName,
        approvalStatus: "pending",
        platformTarget: rec.platformTarget || rec.platform?.toLowerCase() || "both",
      }));
    }

    res.json({ analysis });
  } catch (err: any) {
    console.error("[deep-analysis] Error:", err);
    res.status(500).json({ error: err.message || "Deep analysis failed" });
  }
});

export default router;
