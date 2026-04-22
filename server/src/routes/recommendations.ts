import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { supabase } from "../services/supabase.js";
import { executeTool } from "../services/tools.js";
import Anthropic from "@anthropic-ai/sdk";

const router = Router();

// POST /api/recommendations/approve — approve a recommendation, persist to ppc_proposed_changes
router.post("/approve", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { recommendation, clientName } = req.body as {
      recommendation: any;
      clientName: string;
    };

    if (!recommendation || !clientName) {
      res.status(400).json({ error: "recommendation and clientName are required" });
      return;
    }

    // Create an optimization session for this approval batch
    const { data: session, error: sessErr } = await supabase
      .from("ppc_optimization_sessions")
      .insert({
        client_name: clientName,
        platform: recommendation.platformTarget || "both",
        date_range_start: new Date().toISOString().split("T")[0],
        date_range_end: new Date().toISOString().split("T")[0],
        ai_summary: "Daily report recommendation approval",
        status: "approved",
      })
      .select("id")
      .single();

    if (sessErr) {
      console.error("[recommendations] Session create error:", sessErr);
      res.status(500).json({ error: "Failed to create optimization session" });
      return;
    }

    // Insert the proposed change
    const { data: change, error: changeErr } = await supabase
      .from("ppc_proposed_changes")
      .insert({
        session_id: session.id,
        client_name: clientName,
        platform: recommendation.platformTarget || "both",
        change_type: recommendation.changeType || "advisory",
        entity_type: recommendation.entityType || null,
        entity_id: recommendation.entityId || null,
        entity_name: recommendation.entityName || null,
        before_value: recommendation.beforeValue || {},
        after_value: recommendation.afterValue || {},
        ai_rationale: `${recommendation.action} | Expected: ${recommendation.expectedImpact}`,
        confidence: recommendation.confidence || "medium",
        expected_impact: recommendation.expectedImpact,
        priority: recommendation.priority || "medium",
        approval_status: "approved",
        approved_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (changeErr) {
      console.error("[recommendations] Change insert error:", changeErr);
      res.status(500).json({ error: "Failed to save approved change" });
      return;
    }

    console.log(`[recommendations] Approved change ${change.id} for ${clientName}: ${recommendation.changeType}`);
    res.json({ change, sessionId: session.id });
  } catch (err: any) {
    console.error("[recommendations] Approve error:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/recommendations/reject — reject a recommendation
router.post("/reject", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { changeId } = req.body as { changeId: string };
    if (!changeId) {
      res.status(400).json({ error: "changeId is required" });
      return;
    }

    const { error } = await supabase
      .from("ppc_proposed_changes")
      .update({ approval_status: "rejected" })
      .eq("id", changeId);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ ok: true });
  } catch (err: any) {
    console.error("[recommendations] Reject error:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/recommendations/execute — execute an approved recommendation via ad platform APIs
router.post("/execute", requireAuth, async (req: AuthRequest, res) => {
  const memberName = req.memberName || "system";

  try {
    const { changeId } = req.body as { changeId: string };
    if (!changeId) {
      res.status(400).json({ error: "changeId is required" });
      return;
    }

    // Fetch the approved change
    const { data: change, error: fetchErr } = await supabase
      .from("ppc_proposed_changes")
      .select("*")
      .eq("id", changeId)
      .eq("approval_status", "approved")
      .is("executed_at", null)
      .single();

    if (fetchErr || !change) {
      res.status(404).json({ error: "Change not found, not approved, or already executed" });
      return;
    }

    // Advisory changes cannot be auto-executed
    if (change.change_type === "advisory") {
      res.status(400).json({ error: "Advisory recommendations require manual execution" });
      return;
    }

    const platform = (change.platform || "").toLowerCase();
    let result: string;

    if (platform === "google" || platform === "both") {
      // Look up Google Ads account
      const { data: mapping } = await supabase
        .from("client_account_mappings")
        .select("account_id")
        .eq("client_name", change.client_name)
        .ilike("platform", "%google%")
        .limit(1)
        .maybeSingle();

      if (!mapping) {
        throw new Error(`No Google Ads account linked for ${change.client_name}`);
      }

      result = await executeTool(
        "google_ads_mutate",
        {
          customer_id: mapping.account_id,
          resource: change.entity_type || "campaigns",
          operations: [change.after_value],
        },
        memberName
      );
    } else if (platform === "meta") {
      // Look up Meta Ads account
      const { data: mapping } = await supabase
        .from("client_account_mappings")
        .select("account_id")
        .eq("client_name", change.client_name)
        .ilike("platform", "%meta%")
        .limit(1)
        .maybeSingle();

      if (!mapping) {
        throw new Error(`No Meta Ads account linked for ${change.client_name}`);
      }

      result = await executeTool(
        "meta_ads_manage",
        {
          method: "POST",
          endpoint: change.entity_id ? `/${change.entity_id}` : `/act_${mapping.account_id}/campaigns`,
          params: change.after_value,
        },
        memberName
      );
    } else {
      throw new Error(`Unsupported platform: ${platform}`);
    }

    // Mark as executed
    await supabase
      .from("ppc_proposed_changes")
      .update({ executed_at: new Date().toISOString(), execution_error: null })
      .eq("id", changeId);

    // Record result
    await supabase.from("ppc_change_results").insert({
      change_id: changeId,
      session_id: change.session_id,
      outcome: "success",
      ai_assessment: (result || "").slice(0, 2000),
    });

    console.log(`[recommendations] Executed change ${changeId} for ${change.client_name}`);
    res.json({ ok: true, result });
  } catch (err: any) {
    console.error("[recommendations] Execute error:", err);

    // Record failure
    const { changeId } = req.body;
    if (changeId) {
      try {
        await supabase
          .from("ppc_proposed_changes")
          .update({ execution_error: err.message })
          .eq("id", changeId);
      } catch { /* ignore */ }
    }

    res.status(500).json({ error: err.message });
  }
});

// POST /api/recommendations/make-change — one-click AI enrichment + auto-approve + auto-execute
router.post("/make-change", requireAuth, async (req: AuthRequest, res) => {
  const memberName = req.memberName || "system";

  try {
    const { recommendation, clientName, platforms } = req.body as {
      recommendation: any;
      clientName: string;
      platforms: any[];
    };

    if (!recommendation || !clientName) {
      res.status(400).json({ error: "recommendation and clientName are required" });
      return;
    }

    // Step 1: Use Claude to enrich the plain recommendation into an ActionableRecommendation
    const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const enrichResponse = await claude.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: `You are an expert PPC/digital advertising analyst. Given a recommendation and platform context, determine the exact technical change needed.

Return ONLY valid JSON (no markdown) with these fields:
{
  "changeType": "pause_campaign" | "update_budget" | "add_negative_keyword" | "adjust_bid" | "restructure" | "advisory",
  "platformTarget": "google" | "meta" | "both",
  "entityType": "campaigns" | "adGroups" | "campaignCriteria" | "adsets" | null,
  "entityName": "name of the campaign/entity if determinable from the recommendation text, or null",
  "beforeValue": {},
  "afterValue": {},
  "confidence": "high" | "medium" | "low"
}

Rules:
- If the recommendation clearly specifies a concrete, automatable change (pause, budget change, bid adjustment, add negative keyword), set the appropriate changeType and fill afterValue with the Google Ads or Meta Ads API-compatible mutation object.
- For Google Ads budget changes, afterValue should be: { "update": { "resourceName": "customers/{customer_id}/campaignBudgets/{budget_id}", "amountMicros": "<new_amount_in_micros>" }, "updateMask": { "paths": ["amount_micros"] } }
- For pausing a Google campaign, afterValue should be: { "update": { "resourceName": "customers/{customer_id}/campaigns/{campaign_id}", "status": "PAUSED" }, "updateMask": { "paths": ["status"] } }
- For Meta Ads changes, afterValue should contain the params for a POST to the entity endpoint.
- If the recommendation is strategic, vague, or requires human judgment, set changeType to "advisory".
- Set confidence to "low" if you're uncertain about the exact parameters.`,
      messages: [{
        role: "user",
        content: `Recommendation: "${recommendation.action}"
Expected Impact: "${recommendation.expectedImpact || "N/A"}"
Priority: "${recommendation.priority || "medium"}"
Platform mentioned: "${recommendation.platform || "unknown"}"
Client: "${clientName}"

Available platforms for this client: ${JSON.stringify((platforms || []).map((p: any) => ({ name: p.name, spend: p.spend, clicks: p.clicks, conversions: p.conversions })))}

Determine the exact technical change needed.`,
      }],
    });

    // Parse AI response
    const aiText = enrichResponse.content[0].type === "text" ? enrichResponse.content[0].text : "";
    let enriched: any;
    try {
      let jsonStr = aiText;
      const jsonMatch = aiText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonStr = jsonMatch[1];
      enriched = JSON.parse(jsonStr.trim());
    } catch {
      enriched = {
        changeType: "advisory",
        platformTarget: recommendation.platform?.toLowerCase() || "both",
        entityType: null,
        entityName: null,
        beforeValue: {},
        afterValue: {},
        confidence: "low",
      };
    }

    // Step 2: Create session + proposed change (auto-approved)
    const platformTarget = enriched.platformTarget || recommendation.platform?.toLowerCase() || "both";

    const { data: session, error: sessErr } = await supabase
      .from("ppc_optimization_sessions")
      .insert({
        client_name: clientName,
        platform: platformTarget,
        date_range_start: new Date().toISOString().split("T")[0],
        date_range_end: new Date().toISOString().split("T")[0],
        ai_summary: `One-click: ${recommendation.action}`,
        status: "approved",
      })
      .select("id")
      .single();

    if (sessErr) {
      console.error("[make-change] Session create error:", sessErr);
      res.status(500).json({ error: "Failed to create optimization session" });
      return;
    }

    const { data: change, error: changeErr } = await supabase
      .from("ppc_proposed_changes")
      .insert({
        session_id: session.id,
        client_name: clientName,
        platform: platformTarget,
        change_type: enriched.changeType || "advisory",
        entity_type: enriched.entityType || null,
        entity_id: null,
        entity_name: enriched.entityName || null,
        before_value: enriched.beforeValue || {},
        after_value: enriched.afterValue || {},
        ai_rationale: `${recommendation.action} | Expected: ${recommendation.expectedImpact || "N/A"}`,
        confidence: enriched.confidence || "medium",
        expected_impact: recommendation.expectedImpact || "",
        priority: recommendation.priority || "medium",
        approval_status: "approved",
        approved_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (changeErr) {
      console.error("[make-change] Change insert error:", changeErr);
      res.status(500).json({ error: "Failed to save change record" });
      return;
    }

    // Step 3: If not advisory, auto-execute
    if (enriched.changeType === "advisory" || enriched.confidence === "low") {
      console.log(`[make-change] Advisory/low-confidence change ${change.id} for ${clientName} — skipping auto-execute`);
      res.json({ changeId: change.id, status: "advisory" });
      return;
    }

    // Auto-execute
    try {
      const platform = platformTarget.toLowerCase();
      let result: string;

      if (platform === "google" || platform === "both") {
        const { data: mapping } = await supabase
          .from("client_account_mappings")
          .select("account_id")
          .eq("client_name", clientName)
          .ilike("platform", "%google%")
          .limit(1)
          .maybeSingle();

        if (!mapping) {
          throw new Error(`No Google Ads account linked for ${clientName}`);
        }

        result = await executeTool(
          "google_ads_mutate",
          {
            customer_id: mapping.account_id,
            resource: enriched.entityType || "campaigns",
            operations: [enriched.afterValue],
          },
          memberName
        );
      } else if (platform === "meta") {
        const { data: mapping } = await supabase
          .from("client_account_mappings")
          .select("account_id")
          .eq("client_name", clientName)
          .ilike("platform", "%meta%")
          .limit(1)
          .maybeSingle();

        if (!mapping) {
          throw new Error(`No Meta Ads account linked for ${clientName}`);
        }

        result = await executeTool(
          "meta_ads_manage",
          {
            method: "POST",
            endpoint: `/act_${mapping.account_id}/campaigns`,
            params: enriched.afterValue,
          },
          memberName
        );
      } else {
        throw new Error(`Unsupported platform: ${platform}`);
      }

      // Mark as executed
      await supabase
        .from("ppc_proposed_changes")
        .update({ executed_at: new Date().toISOString(), execution_error: null })
        .eq("id", change.id);

      await supabase.from("ppc_change_results").insert({
        change_id: change.id,
        session_id: session.id,
        outcome: "success",
        ai_assessment: (result || "").slice(0, 2000),
      });

      console.log(`[make-change] Executed change ${change.id} for ${clientName}`);
      res.json({ changeId: change.id, status: "executed", result });
    } catch (execErr: any) {
      console.error("[make-change] Execution error:", execErr);

      await supabase
        .from("ppc_proposed_changes")
        .update({ execution_error: execErr.message })
        .eq("id", change.id);

      res.json({ changeId: change.id, status: "failed", error: execErr.message });
    }
  } catch (err: any) {
    console.error("[make-change] Error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
