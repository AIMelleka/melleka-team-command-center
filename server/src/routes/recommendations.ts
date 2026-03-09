import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { supabase } from "../services/supabase.js";
import { executeTool } from "../services/tools.js";

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

export default router;
