import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { supabase } from "../services/supabase.js";
import { cronReloadCallbacks } from "../services/tools.js";

const router = Router();

// ── GET /api/weekly-updates/settings ────────────────────────────────────────
router.get("/settings", requireAuth, async (_req: AuthRequest, res) => {
  try {
    const { data, error } = await supabase
      .from("weekly_update_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data ?? {});
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/weekly-updates/settings ────────────────────────────────────────
router.put("/settings", requireAuth, async (req: AuthRequest, res) => {
  try {
    const {
      master_prompt,
      slack_channel,
      email_recipients,
      send_slack,
      send_email,
      auto_enabled,
    } = req.body;

    // Fetch the single settings row
    const { data: existing } = await supabase
      .from("weekly_update_settings")
      .select("id")
      .limit(1)
      .maybeSingle();

    const payload: Record<string, any> = {
      updated_at: new Date().toISOString(),
      updated_by: req.memberName ?? null,
    };
    if (master_prompt !== undefined) payload.master_prompt = master_prompt;
    if (slack_channel !== undefined) payload.slack_channel = slack_channel;
    if (email_recipients !== undefined) payload.email_recipients = email_recipients;
    if (send_slack !== undefined) payload.send_slack = send_slack;
    if (send_email !== undefined) payload.send_email = send_email;
    if (auto_enabled !== undefined) payload.auto_enabled = auto_enabled;

    let data: any;
    let error: any;

    if (existing?.id) {
      ({ data, error } = await supabase
        .from("weekly_update_settings")
        .update(payload)
        .eq("id", existing.id)
        .select()
        .single());
    } else {
      ({ data, error } = await supabase
        .from("weekly_update_settings")
        .insert({ ...payload, master_prompt: master_prompt ?? "" })
        .select()
        .single());
    }

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    // If auto_enabled, upsert Monday 9am cron job
    if (auto_enabled) {
      // Fetch tagged clients for the prompt
      const { data: taggedClients } = await supabase
        .from("weekly_update_clients")
        .select("client_name")
        .eq("enabled", true);

      const clientList = (taggedClients ?? []).map((c: any) => c.client_name).join(", ") || "(no clients tagged yet)";

      const slackLine = send_slack && slack_channel
        ? `- Post the Step 9 plain-text summary to Slack channel "${slack_channel}" using slack_post.`
        : "";
      const emailLine = send_email && email_recipients?.length
        ? `- Send the full HTML report via send_email to "${Array.isArray(email_recipients) ? email_recipients.join(", ") : email_recipients}" with subject "Weekly Client Update: [CLIENT NAME] - week of [DATES]".`
        : "";
      const deliveryLines = [slackLine, emailLine].filter(Boolean).join("\n");

      const cronTask = `It is Monday morning. Run the full weekly client update workflow for each of these clients: ${clientList}.

Date range: last week Monday through last Sunday. Calculate this dynamically from today's date.

For EACH client in sequence, follow the complete CLIENT UPDATE BOT workflow exactly as defined in your system instructions (Steps 0 through 9). This includes: get client accounts, Notion completed tasks, ad performance data (Google + Meta), change histories, social media posts, branded HTML report, 4-step data audit, and plain-text summary.

After generating each client's report:
${deliveryLines || "- No delivery configured. Reports generated only."}

${master_prompt ? `Additional team instructions:\n${master_prompt}\n` : ""}Rules:
- Never send directly to the client. Only send to the internal team channels listed above.
- Do not skip any client even if one fails - continue to the next.
- Never report metrics you did not receive from a tool. Never hallucinate data.`;

      const memberName = (req.memberName ?? "system").toLowerCase();

      const { error: cronError } = await supabase
        .from("team_cron_jobs")
        .upsert(
          {
            member_name: memberName,
            name: "Weekly Client Updates",
            cron_expr: "0 9 * * 1",
            task: cronTask,
            enabled: true,
          },
          { onConflict: "member_name,name" }
        );

      if (cronError) {
        console.error("[weekly-updates] Failed to upsert cron job:", cronError.message);
      } else {
        cronReloadCallbacks.forEach((cb) => cb());
        console.log("[weekly-updates] Monday cron job upserted for", memberName);
      }
    } else if (auto_enabled === false) {
      // Disable the cron job if auto_enabled explicitly set to false
      const memberName = (req.memberName ?? "system").toLowerCase();
      await supabase
        .from("team_cron_jobs")
        .update({ enabled: false })
        .eq("name", "Weekly Client Updates")
        .eq("member_name", memberName);
      cronReloadCallbacks.forEach((cb) => cb());
    }

    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/weekly-updates/clients ─────────────────────────────────────────
router.get("/clients", requireAuth, async (_req: AuthRequest, res) => {
  try {
    const { data, error } = await supabase
      .from("weekly_update_clients")
      .select("*")
      .order("client_name", { ascending: true });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data ?? []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/weekly-updates/clients ────────────────────────────────────────
router.post("/clients", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { client_name } = req.body;
    if (!client_name || typeof client_name !== "string") {
      res.status(400).json({ error: "client_name is required" });
      return;
    }

    const { data, error } = await supabase
      .from("weekly_update_clients")
      .insert({ client_name: client_name.trim() })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        res.status(409).json({ error: "Client already tagged" });
      } else {
        res.status(500).json({ error: error.message });
      }
      return;
    }

    res.status(201).json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/weekly-updates/clients/:id ───────────────────────────────────
router.delete("/clients/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { error } = await supabase
      .from("weekly_update_clients")
      .delete()
      .eq("id", req.params.id);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/weekly-updates/reports ─────────────────────────────────────────
router.get("/reports", requireAuth, async (req: AuthRequest, res) => {
  try {
    let query = supabase
      .from("weekly_update_reports")
      .select("id, client_name, date_range_start, date_range_end, status, sent_via, created_at, updated_at")
      .order("created_at", { ascending: false });

    if (req.query.start) {
      query = query.gte("date_range_start", req.query.start as string);
    }
    if (req.query.end) {
      query = query.lte("date_range_end", req.query.end as string);
    }

    const { data, error } = await query;

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data ?? []);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/weekly-updates/reports ────────────────────────────────────────
router.post("/reports", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { client_name, date_range_start, date_range_end, html_content, plain_text } = req.body;

    if (!client_name || !date_range_start || !date_range_end) {
      res.status(400).json({ error: "client_name, date_range_start, date_range_end are required" });
      return;
    }

    const { data, error } = await supabase
      .from("weekly_update_reports")
      .insert({
        client_name,
        date_range_start,
        date_range_end,
        html_content: html_content ?? null,
        plain_text: plain_text ?? null,
        status: html_content ? "complete" : "generating",
      })
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(201).json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/weekly-updates/reports/:id ─────────────────────────────────────
router.put("/reports/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { html_content, plain_text, status } = req.body;

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (html_content !== undefined) updates.html_content = html_content;
    if (plain_text !== undefined) updates.plain_text = plain_text;
    if (status !== undefined) updates.status = status;
    if (html_content !== undefined && !status) updates.status = "complete";

    const { data, error } = await supabase
      .from("weekly_update_reports")
      .update(updates)
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/weekly-updates/reports/:id ──────────────────────────────────
router.delete("/reports/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { error } = await supabase
      .from("weekly_update_reports")
      .delete()
      .eq("id", req.params.id);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/weekly-updates/reports/:id/send ───────────────────────────────
router.post("/reports/:id/send", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { data: report, error: reportErr } = await supabase
      .from("weekly_update_reports")
      .select("*")
      .eq("id", req.params.id)
      .maybeSingle();

    if (reportErr || !report) {
      res.status(404).json({ error: "Report not found" });
      return;
    }

    const { data: settings } = await supabase
      .from("weekly_update_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (!settings) {
      res.status(400).json({ error: "No settings configured" });
      return;
    }

    const { data: slackSecret } = await supabase
      .from("team_secrets")
      .select("value")
      .eq("key", "SLACK_BOT_TOKEN")
      .maybeSingle();
    const slackToken = slackSecret?.value;

    const sentVia: string[] = [];
    const errors: string[] = [];

    // Send to Slack
    if (settings.send_slack && settings.slack_channel && slackToken) {
      try {
        const slackBody = report.plain_text || `Weekly Update: ${report.client_name} (${report.date_range_start} to ${report.date_range_end})`;
        const slackRes = await fetch("https://slack.com/api/chat.postMessage", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${slackToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            channel: settings.slack_channel,
            text: slackBody,
          }),
        });
        const slackData = await slackRes.json();
        if (slackData.ok) {
          sentVia.push("slack");
        } else {
          errors.push(`Slack: ${slackData.error || "Unknown error"}`);
        }
      } catch (err: any) {
        errors.push(`Slack: ${err.message}`);
      }
    }

    // Send email via Resend
    if (settings.send_email && settings.email_recipients?.length) {
      const { data: resendSecret } = await supabase
        .from("team_secrets")
        .select("value")
        .eq("key", "RESEND_API_KEY")
        .maybeSingle();
      const resendKey = resendSecret?.value;

      const { data: fromEmailSecret } = await supabase
        .from("team_secrets")
        .select("value")
        .eq("key", "FROM_EMAIL")
        .maybeSingle();
      const fromEmail = fromEmailSecret?.value || "Melleka Team <team@melleka.io>";

      if (resendKey) {
        try {
          const emailRes = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: fromEmail,
              to: settings.email_recipients,
              subject: `Weekly Client Update: ${report.client_name} - week of ${report.date_range_start} to ${report.date_range_end}`,
              html: report.html_content || `<p>Weekly update for ${report.client_name} — no HTML content available.</p>`,
            }),
          });
          const emailData = await emailRes.json();
          if (emailRes.ok) {
            sentVia.push("email");
          } else {
            errors.push(`Email: ${emailData.message || "Unknown error"}`);
          }
        } catch (err: any) {
          errors.push(`Email: ${err.message}`);
        }
      } else {
        errors.push("Email: RESEND_API_KEY not configured");
      }
    }

    // Update report sent_via and status
    const newSentVia = Array.from(new Set([...(report.sent_via ?? []), ...sentVia]));
    await supabase
      .from("weekly_update_reports")
      .update({
        sent_via: newSentVia,
        status: sentVia.length > 0 ? "sent" : report.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", req.params.id);

    if (errors.length > 0 && sentVia.length === 0) {
      res.status(400).json({ error: errors.join("; ") });
      return;
    }

    res.json({ ok: true, sent_via: sentVia, errors });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/weekly-updates/test-slack ─────────────────────────────────────
router.post("/test-slack", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { channel } = req.body;
    if (!channel) {
      res.status(400).json({ error: "channel is required" });
      return;
    }

    const { data: secret } = await supabase
      .from("team_secrets")
      .select("value")
      .eq("key", "SLACK_BOT_TOKEN")
      .maybeSingle();

    if (!secret?.value) {
      res.status(400).json({ error: "SLACK_BOT_TOKEN not configured in team secrets" });
      return;
    }

    const slackRes = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret.value}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel,
        text: "Test message from Weekly Client Updates. Slack integration is working!",
      }),
    });

    const data = await slackRes.json();
    if (data.ok) {
      res.json({ ok: true });
    } else {
      res.status(400).json({ error: data.error || "Slack API error" });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
