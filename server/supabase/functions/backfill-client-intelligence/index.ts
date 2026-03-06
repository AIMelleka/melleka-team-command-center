import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { callClaude } from "../_shared/claude.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Types ───────────────────────────────────────────────────────────────────

const SUPERMETRICS_API_URL = 'https://api.supermetrics.com/enterprise/v2';

interface ClientDataBundle {
  clientName: string;
  tier: string;
  industry: string;
  primaryConversionGoal: string;
  trackedConversionTypes: string[];
  domain: string | null;
  snapshots: any[];
  sessions: any[];
  changes: any[];
  changeResults: any[];
  adReviews: any[];
  healthHistory: any[];
  existingMemoryCount: number;
  campaignData: any[]; // From Supermetrics: campaign-level 90-day data
  keywordData: any[];  // From Supermetrics: keyword-level data (Google only)
  platforms: string[];  // Platforms this client has accounts for
}

interface BackfillResult {
  client: string;
  status: "success" | "skipped" | "error";
  memoriesCreated: number;
  intelligenceScore: number;
  message: string;
  dataPoints: {
    snapshots: number;
    sessions: number;
    changes: number;
    adReviews: number;
    healthDays: number;
  };
}

// ─── Data Fetching ───────────────────────────────────────────────────────────

async function fetchClientData(
  supabase: any,
  clientName: string
): Promise<ClientDataBundle> {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000)
    .toISOString()
    .split("T")[0];

  // Parallel queries (independent ones)
  const [metaRes, snapshotsRes, sessionsRes, adReviewsRes, healthRes, memCountRes] =
    await Promise.all([
      supabase
        .from("managed_clients")
        .select(
          "client_name, domain, tier, industry, primary_conversion_goal, tracked_conversion_types"
        )
        .eq("client_name", clientName)
        .single(),
      supabase
        .from("ppc_daily_snapshots")
        .select(
          "snapshot_date, platform, spend, conversions, cost_per_conversion, clicks, impressions, leads, purchases, calls, forms"
        )
        .eq("client_name", clientName)
        .gte("snapshot_date", ninetyDaysAgo)
        .order("snapshot_date", { ascending: true }),
      supabase
        .from("ppc_optimization_sessions")
        .select(
          "id, platform, date_range_start, date_range_end, ai_summary, status, auto_mode, created_at"
        )
        .eq("client_name", clientName)
        .gte("created_at", new Date(Date.now() - 90 * 86400000).toISOString())
        .order("created_at", { ascending: false })
        .limit(30),
      supabase
        .from("ad_review_history")
        .select(
          "review_date, summary, insights, recommendations, week_over_week, benchmark_comparison, action_items, changes_made, industry"
        )
        .eq("client_name", clientName)
        .gte("review_date", ninetyDaysAgo)
        .order("review_date", { ascending: false })
        .limit(15),
      supabase
        .from("client_health_history")
        .select(
          "recorded_date, health_score, seo_errors, seo_health, ad_health, days_since_ad_review, config_completeness, score_breakdown"
        )
        .eq("client_name", clientName)
        .gte("recorded_date", ninetyDaysAgo)
        .order("recorded_date", { ascending: true }),
      supabase
        .from("client_ai_memory")
        .select("id", { count: "exact", head: true })
        .eq("client_name", clientName)
        .eq("source", "backfill"),
    ]);

  const sessions = sessionsRes.data || [];
  const sessionIds = sessions.map((s: any) => s.id);

  // Sequential: changes depend on sessions, results depend on changes
  let changes: any[] = [];
  let changeResults: any[] = [];

  if (sessionIds.length > 0) {
    const changesRes = await supabase
      .from("ppc_proposed_changes")
      .select(
        "id, session_id, change_type, entity_name, confidence, approval_status, executed_at, ai_rationale, expected_impact, priority"
      )
      .in("session_id", sessionIds);
    changes = changesRes.data || [];

    const changeIds = changes.filter((c: any) => c.executed_at).map((c: any) => c.id);
    if (changeIds.length > 0) {
      const resultsRes = await supabase
        .from("ppc_change_results")
        .select(
          "change_id, session_id, metrics_before, metrics_after, delta, outcome, ai_assessment"
        )
        .in("change_id", changeIds);
      changeResults = resultsRes.data || [];
    }
  }

  const meta = metaRes.data || {};

  // Get account mappings to fetch Supermetrics data
  const { data: mappings } = await supabase
    .from("client_account_mappings")
    .select("platform, account_id")
    .eq("client_name", clientName);

  const platforms: string[] = [];
  let campaignData: any[] = [];
  let keywordData: any[] = [];

  const SUPERMETRICS_API_KEY = Deno.env.get("SUPERMETRICS_API_KEY");
  if (SUPERMETRICS_API_KEY && mappings && mappings.length > 0) {
    const today = new Date().toISOString().split("T")[0];

    for (const mapping of mappings) {
      const plat = mapping.platform;
      const acctId = mapping.account_id;
      const isGoogle = plat === "google_ads" || plat === "google";
      const isMeta = plat === "meta_ads" || plat === "meta";
      if (!isGoogle && !isMeta) continue; // Only Google and Meta for now

      const dsId = isGoogle ? "AW" : "FA";
      const canonicalPlatform = isGoogle ? "google" : "meta";
      if (!platforms.includes(canonicalPlatform)) platforms.push(canonicalPlatform);

      try {
        // Fetch 90-day campaign data from Supermetrics
        const campaignFields = isGoogle
          ? "Date,CampaignName,Impressions,Clicks,Cost,Conversions,CostPerConversion,Ctr,CPC,ConversionRate"
          : "Date,adcampaign_name,impressions,Clicks,cost,offsite_conversion,offsite_conversions_fb_pixel_lead,offsite_conversions_fb_pixel_purchase,onsite_conversion.lead_grouped,CPC,CTR";

        const campRes = await fetch(`${SUPERMETRICS_API_URL}/query/data/json`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${SUPERMETRICS_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            ds_id: dsId,
            ds_accounts: acctId,
            start_date: ninetyDaysAgo,
            end_date: today,
            fields: campaignFields,
            max_rows: 5000,
            settings: { no_headers: false },
          }),
        });

        if (campRes.ok) {
          const campJson = await campRes.json();
          if (campJson.data && campJson.data.length > 1) {
            const rows = campJson.data.slice(1) as (string | number)[][];

            // Aggregate by campaign
            const campMap: Record<string, any> = {};
            // Also build daily snapshots for seeding
            const dailyMap: Record<string, { spend: number; conv: number; clicks: number; imp: number; leads: number; purchases: number }> = {};

            for (const row of rows) {
              const dateStr = String(row[0] || "");
              const campName = String(row[1] || "");
              if (!campName) continue;

              const imp = parseFloat(String(row[2] || "0")) || 0;
              const clicks = parseFloat(String(row[3] || "0")) || 0;
              const cost = parseFloat(String(row[4] || "0")) || 0;
              let conv = 0, leads = 0, purchases = 0;

              if (isMeta) {
                const offsite = parseFloat(String(row[5] || "0")) || 0;
                const fbLeads = parseFloat(String(row[6] || "0")) || 0;
                const fbPurchases = parseFloat(String(row[7] || "0")) || 0;
                const onsiteLeads = parseFloat(String(row[8] || "0")) || 0;
                conv = offsite + fbLeads + fbPurchases + onsiteLeads;
                leads = fbLeads + onsiteLeads;
                purchases = fbPurchases;
              } else {
                conv = parseFloat(String(row[5] || "0")) || 0;
              }

              // Campaign aggregation
              if (!campMap[campName]) {
                campMap[campName] = { name: campName, platform: canonicalPlatform, impressions: 0, clicks: 0, cost: 0, conversions: 0, leads: 0, purchases: 0, days: 0 };
              }
              campMap[campName].impressions += imp;
              campMap[campName].clicks += clicks;
              campMap[campName].cost += cost;
              campMap[campName].conversions += conv;
              campMap[campName].leads += leads;
              campMap[campName].purchases += purchases;
              campMap[campName].days++;

              // Daily snapshot aggregation
              if (dateStr) {
                const dayKey = dateStr.split(" ")[0]; // Handle "2026-01-15 00:00:00" format
                if (!dailyMap[dayKey]) dailyMap[dayKey] = { spend: 0, conv: 0, clicks: 0, imp: 0, leads: 0, purchases: 0 };
                dailyMap[dayKey].spend += cost;
                dailyMap[dayKey].conv += conv;
                dailyMap[dayKey].clicks += clicks;
                dailyMap[dayKey].imp += imp;
                dailyMap[dayKey].leads += leads;
                dailyMap[dayKey].purchases += purchases;
              }
            }

            const newCampaigns = Object.values(campMap).map((c: any) => ({
              ...c,
              ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
              cpc: c.clicks > 0 ? c.cost / c.clicks : 0,
              cpa: c.conversions > 0 ? c.cost / c.conversions : Infinity,
            })).sort((a: any, b: any) => b.cost - a.cost);
            campaignData.push(...newCampaigns);

            // Seed daily snapshots into the database
            const snapshotRows = Object.entries(dailyMap).map(([date, d]) => ({
              client_name: clientName,
              platform: canonicalPlatform,
              snapshot_date: date,
              spend: d.spend,
              conversions: d.conv,
              cost_per_conversion: d.conv > 0 ? d.spend / d.conv : 0,
              clicks: d.clicks,
              impressions: d.imp,
              leads: d.leads,
              purchases: d.purchases,
              calls: 0,
              forms: 0,
            }));

            if (snapshotRows.length > 0) {
              const { error: upsertErr } = await supabase
                .from("ppc_daily_snapshots")
                .upsert(snapshotRows, { onConflict: "client_name,platform,snapshot_date" });
              if (upsertErr) console.warn(`[BACKFILL] Snapshot upsert warn for ${clientName}/${canonicalPlatform}:`, upsertErr.message);
              else console.log(`[BACKFILL] Seeded ${snapshotRows.length} daily snapshots for ${clientName}/${canonicalPlatform}`);
            }
          }
        } else {
          console.warn(`[BACKFILL] Supermetrics ${dsId} fetch failed for ${clientName}: ${campRes.status}`);
        }

        // Fetch keyword data for Google
        if (isGoogle) {
          try {
            const kwRes = await fetch(`${SUPERMETRICS_API_URL}/query/data/json`, {
              method: "POST",
              headers: { "Authorization": `Bearer ${SUPERMETRICS_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                ds_id: "AW",
                ds_accounts: acctId,
                start_date: ninetyDaysAgo,
                end_date: today,
                fields: "keyword_text,CampaignName,Impressions,Clicks,Cost,Conversions,CPC,Ctr,MatchType",
                max_rows: 2000,
                settings: { no_headers: false },
              }),
            });

            if (kwRes.ok) {
              const kwJson = await kwRes.json();
              if (kwJson.data && kwJson.data.length > 1) {
                const kwRows = kwJson.data.slice(1) as (string | number)[][];
                for (const row of kwRows) {
                  keywordData.push({
                    keyword: String(row[0] || ""),
                    campaign: String(row[1] || ""),
                    impressions: parseFloat(String(row[2] || "0")) || 0,
                    clicks: parseFloat(String(row[3] || "0")) || 0,
                    cost: parseFloat(String(row[4] || "0")) || 0,
                    conversions: parseFloat(String(row[5] || "0")) || 0,
                    cpc: parseFloat(String(row[6] || "0")) || 0,
                    ctr: parseFloat(String(row[7] || "0")) || 0,
                    matchType: String(row[8] || ""),
                  });
                }
                keywordData.sort((a: any, b: any) => b.cost - a.cost);
              }
            }
          } catch (kwErr: any) {
            console.warn(`[BACKFILL] Keyword fetch warn for ${clientName}:`, kwErr.message);
          }
        }

        await sleep(500); // Small delay between Supermetrics calls
      } catch (smErr: any) {
        console.warn(`[BACKFILL] Supermetrics error for ${clientName}/${plat}:`, smErr.message);
      }
    }
  }

  // Re-fetch snapshots since we just seeded them
  const { data: freshSnapshots } = await supabase
    .from("ppc_daily_snapshots")
    .select("snapshot_date, platform, spend, conversions, cost_per_conversion, clicks, impressions, leads, purchases, calls, forms")
    .eq("client_name", clientName)
    .gte("snapshot_date", ninetyDaysAgo)
    .order("snapshot_date", { ascending: true });

  return {
    clientName,
    tier: meta.tier || "unknown",
    industry: meta.industry || "unknown",
    primaryConversionGoal: meta.primary_conversion_goal || "all",
    trackedConversionTypes: meta.tracked_conversion_types || ["leads", "purchases", "calls"],
    domain: meta.domain || null,
    snapshots: freshSnapshots || [],
    sessions,
    changes,
    changeResults,
    adReviews: adReviewsRes.data || [],
    healthHistory: healthRes.data || [],
    existingMemoryCount: memCountRes.count || 0,
    campaignData,
    keywordData,
    platforms,
  };
}

// ─── Data Aggregation (token-efficient) ──────────────────────────────────────

function aggregateSnapshotsToWeekly(snapshots: any[]): string {
  if (!snapshots || snapshots.length === 0)
    return "No performance snapshot data available.";

  const byPlatform: Record<string, any[]> = {};
  for (const s of snapshots) {
    const plat = s.platform || "unknown";
    if (!byPlatform[plat]) byPlatform[plat] = [];
    byPlatform[plat].push(s);
  }

  const sections: string[] = [];

  for (const [platform, platSnapshots] of Object.entries(byPlatform)) {
    const weeks: Record<string, any[]> = {};
    for (const s of platSnapshots) {
      const d = new Date(s.snapshot_date);
      const day = d.getDay();
      const monday = new Date(d);
      monday.setDate(d.getDate() - ((day + 6) % 7));
      const weekKey = monday.toISOString().split("T")[0];
      if (!weeks[weekKey]) weeks[weekKey] = [];
      weeks[weekKey].push(s);
    }

    const weekLines: string[] = [];
    const sortedWeeks = Object.keys(weeks).sort();

    for (const weekStart of sortedWeeks) {
      const wk = weeks[weekStart];
      const totalSpend = wk.reduce((s: number, r: any) => s + (Number(r.spend) || 0), 0);
      const totalConv = wk.reduce((s: number, r: any) => s + (Number(r.conversions) || 0), 0);
      const totalClicks = wk.reduce((s: number, r: any) => s + (Number(r.clicks) || 0), 0);
      const totalImp = wk.reduce((s: number, r: any) => s + (Number(r.impressions) || 0), 0);
      const totalLeads = wk.reduce((s: number, r: any) => s + (Number(r.leads) || 0), 0);
      const totalPurchases = wk.reduce((s: number, r: any) => s + (Number(r.purchases) || 0), 0);
      const avgCPA = totalConv > 0 ? `$${(totalSpend / totalConv).toFixed(2)}` : "N/A";
      const ctr = totalImp > 0 ? `${((totalClicks / totalImp) * 100).toFixed(2)}%` : "N/A";

      weekLines.push(
        `  Week of ${weekStart} (${wk.length}d): $${totalSpend.toFixed(0)} spend, ${totalConv} conv, CPA ${avgCPA}, ${totalClicks} clicks, ${totalImp} imp, CTR ${ctr}, ${totalLeads} leads, ${totalPurchases} purchases`
      );
    }

    const totalSpend = platSnapshots.reduce((s: number, r: any) => s + (Number(r.spend) || 0), 0);
    const totalConv = platSnapshots.reduce((s: number, r: any) => s + (Number(r.conversions) || 0), 0);
    const avgCPA = totalConv > 0 ? `$${(totalSpend / totalConv).toFixed(2)}` : "N/A";

    sections.push(
      `WEEKLY SNAPSHOTS - ${platform.toUpperCase()} (${platSnapshots.length} days, $${totalSpend.toFixed(0)} total spend, ${totalConv} total conv, avg CPA ${avgCPA}):\n${weekLines.join("\n")}`
    );
  }

  return sections.join("\n\n");
}

function aggregateChangesAndResults(changes: any[], changeResults: any[]): string {
  if (!changes || changes.length === 0) return "No optimization changes recorded.";

  const resultMap = new Map<string, any>();
  for (const r of changeResults || []) {
    resultMap.set(r.change_id, r);
  }

  let improved = 0,
    worsened = 0,
    neutral = 0,
    noResult = 0,
    pending = 0;
  const lines: string[] = [];

  // Sort: executed first, then by confidence
  const sorted = [...changes].sort((a, b) => {
    if (a.executed_at && !b.executed_at) return -1;
    if (!a.executed_at && b.executed_at) return 1;
    const confOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    return (confOrder[a.confidence] || 2) - (confOrder[b.confidence] || 2);
  });

  for (const c of sorted.slice(0, 50)) {
    if (!c.executed_at) {
      if (c.approval_status === "pending") pending++;
      continue;
    }

    const result = resultMap.get(c.id);
    let outcomeStr = "NO RESULT DATA";

    if (result) {
      const cpaDelta = result.delta?.cpaChangePercent;
      const cpaDeltaStr = cpaDelta != null ? ` CPA ${cpaDelta > 0 ? "+" : ""}${cpaDelta.toFixed(1)}%` : "";
      if (result.outcome === "improved") {
        improved++;
        outcomeStr = `IMPROVED${cpaDeltaStr}`;
      } else if (result.outcome === "worsened") {
        worsened++;
        outcomeStr = `WORSENED${cpaDeltaStr}`;
      } else {
        neutral++;
        outcomeStr = "NEUTRAL";
      }
    } else {
      noResult++;
    }

    const dateStr = new Date(c.executed_at).toISOString().split("T")[0];
    const rationale = (c.ai_rationale || "").substring(0, 120);
    lines.push(
      `  [${dateStr}] ${c.change_type} on "${c.entity_name || "unknown"}" (${c.confidence}) -> ${outcomeStr} | ${rationale}`
    );
  }

  const executedTotal = improved + worsened + neutral + noResult;
  const successRate = executedTotal > 0 ? ((improved / executedTotal) * 100).toFixed(0) : "N/A";

  return `OPTIMIZATION CHANGES (${changes.length} total, ${executedTotal} executed, ${pending} pending):
Success rate: ${successRate}% (${improved} improved, ${worsened} worsened, ${neutral} neutral, ${noResult} no result data)
${lines.join("\n")}`;
}

function aggregateAdReviews(adReviews: any[]): string {
  if (!adReviews || adReviews.length === 0) return "No ad review history available.";

  const lines: string[] = [];
  for (const r of adReviews.slice(0, 8)) {
    const summary = (r.summary || "No summary").substring(0, 500);
    const topInsights = (r.insights || [])
      .slice(0, 3)
      .map((i: any) =>
        typeof i === "string" ? i : i.description || i.title || i.text || JSON.stringify(i).substring(0, 200)
      )
      .map((s: string) => s.substring(0, 200));
    const topRecs = (r.recommendations || [])
      .slice(0, 3)
      .map((rec: any) =>
        typeof rec === "string" ? rec : rec.description || rec.title || rec.text || JSON.stringify(rec).substring(0, 200)
      )
      .map((s: string) => s.substring(0, 200));
    const actionCount = (r.action_items || []).length;
    const changesCount = (r.changes_made || []).length;

    lines.push(`[${r.review_date}] ${summary}`);
    if (topInsights.length > 0) lines.push(`  Insights: ${topInsights.join(" | ")}`);
    if (topRecs.length > 0) lines.push(`  Recommendations: ${topRecs.join(" | ")}`);
    if (actionCount > 0 || changesCount > 0) lines.push(`  Actions: ${actionCount} items, ${changesCount} changes made`);
    if (r.benchmark_comparison) {
      const bc = r.benchmark_comparison;
      const bcStr = typeof bc === "string" ? bc : JSON.stringify(bc).substring(0, 200);
      lines.push(`  Benchmarks: ${bcStr}`);
    }
  }

  return `AD REVIEW HISTORY (${adReviews.length} reviews):\n${lines.join("\n")}`;
}

function aggregateHealthHistory(healthHistory: any[]): string {
  if (!healthHistory || healthHistory.length === 0) return "No health history available.";

  // Sample weekly if lots of data
  const sampled =
    healthHistory.length <= 15
      ? healthHistory
      : healthHistory.filter(
          (_: any, i: number) => i % 7 === 0 || i === healthHistory.length - 1
        );

  const lines = sampled.map((h: any) => {
    const breakdown = h.score_breakdown || {};
    const parts = [];
    if (breakdown.cpaBenchmark != null) parts.push(`CPA-bench:${breakdown.cpaBenchmark}`);
    if (breakdown.conversionTrend != null) parts.push(`Conv-trend:${breakdown.conversionTrend}`);
    if (breakdown.cpaTrend != null) parts.push(`CPA-trend:${breakdown.cpaTrend}`);
    if (breakdown.aiReviewQuality != null) parts.push(`Review:${breakdown.aiReviewQuality}`);
    const breakdownStr = parts.length > 0 ? ` [${parts.join(", ")}]` : "";

    return `  ${h.recorded_date}: Score ${h.health_score ?? "?"}/100${breakdownStr} | SEO: ${h.seo_health || "?"} (${h.seo_errors ?? "?"} errors) | Ads: ${h.ad_health || "?"} | Config: ${h.config_completeness || 0}%`;
  });

  const first = healthHistory[0]?.health_score ?? 0;
  const last = healthHistory[healthHistory.length - 1]?.health_score ?? 0;
  const trend = last > first + 5 ? "IMPROVING" : last < first - 5 ? "DECLINING" : "STABLE";

  return `HEALTH SCORE TRAJECTORY (${healthHistory.length} data points, trend: ${trend}):\nFirst: ${first}/100, Latest: ${last}/100\n${lines.join("\n")}`;
}

function aggregateSessions(sessions: any[]): string {
  if (!sessions || sessions.length === 0) return "No optimization sessions recorded.";

  const lines = sessions.slice(0, 20).map((s: any) => {
    const date = new Date(s.created_at).toISOString().split("T")[0];
    const summary = (s.ai_summary || "No summary").substring(0, 300);
    const mode = s.auto_mode ? "AUTO" : "MANUAL";
    return `  [${date}] ${s.platform} (${mode}, ${s.status}): ${summary}`;
  });

  return `OPTIMIZATION SESSIONS (${sessions.length} total, showing ${Math.min(sessions.length, 20)}):\n${lines.join("\n")}`;
}

function aggregateCampaignData(campaigns: any[]): string {
  if (!campaigns || campaigns.length === 0) return "No campaign data available (no Supermetrics accounts configured).";

  const byPlatform: Record<string, any[]> = {};
  for (const c of campaigns) {
    const p = c.platform || "unknown";
    if (!byPlatform[p]) byPlatform[p] = [];
    byPlatform[p].push(c);
  }

  const sections: string[] = [];
  for (const [platform, camps] of Object.entries(byPlatform)) {
    const totalSpend = camps.reduce((s: number, c: any) => s + c.cost, 0);
    const totalConv = camps.reduce((s: number, c: any) => s + c.conversions, 0);
    const avgCPA = totalConv > 0 ? `$${(totalSpend / totalConv).toFixed(2)}` : "N/A";

    const top15 = camps.slice(0, 15);
    const lines = top15.map((c: any, i: number) => {
      const cpa = c.conversions > 0 ? `$${(c.cost / c.conversions).toFixed(2)}` : "N/A";
      return `  ${i + 1}. "${c.name}" - $${c.cost.toFixed(0)} spend, ${c.conversions} conv, CPA ${cpa}, CTR ${c.ctr.toFixed(2)}%, CPC $${c.cpc.toFixed(2)}, ${c.impressions} imp, ${c.clicks} clicks`;
    });

    // Find zero-conversion campaigns with significant spend
    const zeroCvCamps = camps.filter((c: any) => c.conversions === 0 && c.cost > 50);
    if (zeroCvCamps.length > 0) {
      lines.push(`  WASTED SPEND (0 conversions, $50+ spend):`);
      for (const z of zeroCvCamps.slice(0, 5)) {
        lines.push(`    - "${z.name}": $${z.cost.toFixed(0)} wasted, ${z.clicks} clicks, CTR ${z.ctr.toFixed(2)}%`);
      }
    }

    sections.push(`CAMPAIGNS - ${platform.toUpperCase()} (${camps.length} campaigns, $${totalSpend.toFixed(0)} total, ${totalConv} conv, avg CPA ${avgCPA}):\n${lines.join("\n")}`);
  }

  return sections.join("\n\n");
}

function aggregateKeywordData(keywords: any[]): string {
  if (!keywords || keywords.length === 0) return "No keyword data available.";

  const totalSpend = keywords.reduce((s: number, k: any) => s + k.cost, 0);
  const totalConv = keywords.reduce((s: number, k: any) => s + k.conversions, 0);
  const top25 = keywords.slice(0, 25);

  const lines = top25.map((k: any, i: number) => {
    const cpa = k.conversions > 0 ? `$${(k.cost / k.conversions).toFixed(2)}` : "N/A";
    return `  ${i + 1}. "${k.keyword}" [${k.matchType}] in "${k.campaign}" - $${k.cost.toFixed(2)} spend, ${k.conversions} conv, CPA ${cpa}, CTR ${k.ctr.toFixed(2)}%, CPC $${k.cpc.toFixed(2)}`;
  });

  // Zero-conversion keywords with significant spend
  const zeroConvKws = keywords.filter((k: any) => k.conversions === 0 && k.cost > 25);
  if (zeroConvKws.length > 0) {
    lines.push(`  WASTED KEYWORD SPEND (0 conversions, $25+ spend):`);
    for (const z of zeroConvKws.slice(0, 10)) {
      lines.push(`    - "${z.keyword}" [${z.matchType}] in "${z.campaign}": $${z.cost.toFixed(2)} wasted, ${z.clicks} clicks`);
    }
  }

  return `KEYWORDS - GOOGLE ADS (${keywords.length} keywords, $${totalSpend.toFixed(0)} total, ${totalConv} conv):\n${lines.join("\n")}`;
}

// ─── Prompt Construction ─────────────────────────────────────────────────────

function buildPrompts(bundle: ClientDataBundle): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = `You are a senior digital marketing intelligence analyst reviewing 3 months of advertising data for a single client. Your job is to synthesize all available performance data, optimization history, ad review insights, and health trends into structured learnings that will serve as the AI strategist's long-term memory for this client.

CONTEXT:
- Client: ${bundle.clientName}
- Industry: ${bundle.industry || "Unknown"}
- Tier: ${bundle.tier}
- Primary Goal: ${bundle.primaryConversionGoal}
- Tracked Conversions: ${bundle.trackedConversionTypes.join(", ")}
${bundle.domain ? `- Domain: ${bundle.domain}` : ""}

YOUR TASK:
Analyze all the data provided and produce 10-20 structured learnings. Each learning should be a discrete, actionable insight that future AI sessions can reference to make better decisions.

LEARNING CATEGORIES:
1. "strategist_learning" - Tactical PPC insights (bidding strategies that work, match type patterns, keyword insights, budget allocation)
2. "win" - Something that clearly worked well (a change that improved CPA, a campaign that scaled, a creative angle that resonated)
3. "concern" - Active problems or risks (rising CPA trend, underperforming campaigns, creative fatigue, declining health)
4. "observation" - Neutral patterns worth noting (seasonal trends, platform differences, audience behavior)
5. "metric_snapshot" - Key performance benchmarks (average CPA by platform, best/worst campaigns, monthly spend levels)

RULES:
- Each learning MUST be specific and cite real numbers from the data
- Do NOT generate generic insights like "optimize ad copy" without specific data backing
- If data is sparse, produce fewer but higher-quality learnings (minimum 3 if any data exists)
- Wins and concerns should reference specific campaigns, keywords, or time periods
- Metric snapshots should include actual dollar amounts and percentages
- Relevance scores: 1.0 for critical/actionable, 0.8 for important context, 0.6 for nice-to-know
- Each learning content: 1-3 sentences, max 500 characters

Also compute a Client Intelligence Score (0-100) based on:
- data_quality (0-25): Amount of data. 0 days=0, 30 days=15, 60+ days=25
- performance_trend (0-25): Is performance improving? CPA trending down + conversions growing = high score
- change_success_rate (0-25): % of executed changes with "improved" outcomes. No changes=12 (neutral)
- health_trajectory (0-25): Health score trending up=20-25, flat=12, declining=5-10

OUTPUT FORMAT (JSON only, no markdown code fences):
{
  "learnings": [
    {
      "content": "string with specific insight and numbers",
      "memory_type": "strategist_learning|win|concern|observation|metric_snapshot",
      "relevance_score": 0.6
    }
  ],
  "intelligence_score": {
    "total": 75,
    "data_quality": 20,
    "performance_trend": 18,
    "change_success_rate": 22,
    "health_trajectory": 15,
    "summary": "1-2 sentence summary of client intelligence profile"
  }
}`;

  const weeklySnapshots = aggregateSnapshotsToWeekly(bundle.snapshots);
  const campaignsText = aggregateCampaignData(bundle.campaignData);
  const keywordsText = aggregateKeywordData(bundle.keywordData);
  const sessionsText = aggregateSessions(bundle.sessions);
  const changesText = aggregateChangesAndResults(bundle.changes, bundle.changeResults);
  const reviewsText = aggregateAdReviews(bundle.adReviews);
  const healthText = aggregateHealthHistory(bundle.healthHistory);

  const userPrompt = `Analyze the following 3-month data package for ${bundle.clientName} (platforms: ${bundle.platforms.length > 0 ? bundle.platforms.join(", ") : "none configured"}):

═══════════════════════════════════════
DAILY PERFORMANCE TRENDS (weekly aggregates)
═══════════════════════════════════════
${weeklySnapshots}

═══════════════════════════════════════
CAMPAIGN PERFORMANCE (90-day totals)
═══════════════════════════════════════
${campaignsText}

═══════════════════════════════════════
KEYWORD PERFORMANCE (90-day totals)
═══════════════════════════════════════
${keywordsText}

═══════════════════════════════════════
AI OPTIMIZATION SESSIONS
═══════════════════════════════════════
${sessionsText}

═══════════════════════════════════════
CHANGES AND OUTCOMES
═══════════════════════════════════════
${changesText}

═══════════════════════════════════════
AD REVIEW HISTORY
═══════════════════════════════════════
${reviewsText}

═══════════════════════════════════════
HEALTH SCORE TRAJECTORY
═══════════════════════════════════════
${healthText}

Generate your structured learnings and intelligence score based on ALL the data above. Return JSON only.`;

  return { systemPrompt, userPrompt };
}

// ─── Response Parsing ────────────────────────────────────────────────────────

function parseClaudeResponse(rawText: string): {
  learnings: Array<{ content: string; memory_type: string; relevance_score: number }>;
  intelligence_score: {
    total: number;
    data_quality: number;
    performance_trend: number;
    change_success_rate: number;
    health_trajectory: number;
    summary: string;
  };
} | null {
  try {
    let cleaned = rawText.trim();
    // Strip markdown code fences if present
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const parsed = JSON.parse(cleaned);

    if (!parsed.learnings || !Array.isArray(parsed.learnings)) return null;
    if (!parsed.intelligence_score || typeof parsed.intelligence_score.total !== "number") return null;

    // Clamp and validate
    parsed.intelligence_score.total = Math.max(0, Math.min(100, Math.round(parsed.intelligence_score.total)));
    parsed.intelligence_score.data_quality = Math.max(0, Math.min(25, parsed.intelligence_score.data_quality || 0));
    parsed.intelligence_score.performance_trend = Math.max(0, Math.min(25, parsed.intelligence_score.performance_trend || 0));
    parsed.intelligence_score.change_success_rate = Math.max(0, Math.min(25, parsed.intelligence_score.change_success_rate || 0));
    parsed.intelligence_score.health_trajectory = Math.max(0, Math.min(25, parsed.intelligence_score.health_trajectory || 0));

    const validTypes = ["strategist_learning", "win", "concern", "observation", "metric_snapshot"];
    parsed.learnings = parsed.learnings
      .filter((l: any) => l && typeof l.content === "string" && l.content.length > 5)
      .map((l: any) => ({
        content: l.content.substring(0, 500),
        memory_type: validTypes.includes(l.memory_type) ? l.memory_type : "observation",
        relevance_score: Math.max(0.1, Math.min(1.0, Number(l.relevance_score) || 0.8)),
      }));

    return parsed;
  } catch (e) {
    console.error("[BACKFILL] Failed to parse Claude response:", e);
    return null;
  }
}

// ─── Storage ─────────────────────────────────────────────────────────────────

async function storeMemories(
  supabase: any,
  clientName: string,
  learnings: Array<{ content: string; memory_type: string; relevance_score: number }>
): Promise<number> {
  // Delete previous backfill memories (idempotent re-runs)
  await supabase
    .from("client_ai_memory")
    .delete()
    .eq("client_name", clientName)
    .eq("source", "backfill");

  if (learnings.length === 0) return 0;

  const rows = learnings.map((l) => ({
    client_name: clientName,
    memory_type: l.memory_type,
    content: l.content,
    source: "backfill",
    context: { backfill_date: new Date().toISOString().split("T")[0] },
    relevance_score: l.relevance_score,
  }));

  const { error } = await supabase.from("client_ai_memory").insert(rows);
  if (error) {
    console.error(`[BACKFILL] Memory insert error for ${clientName}:`, error);
    return 0;
  }
  return rows.length;
}

async function storeIntelligenceScore(
  supabase: any,
  clientName: string,
  score: {
    total: number;
    data_quality: number;
    performance_trend: number;
    change_success_rate: number;
    health_trajectory: number;
    summary: string;
  }
): Promise<void> {
  // Store on managed_clients (columns added by migration)
  await supabase
    .from("managed_clients")
    .update({
      intelligence_score: score.total,
      intelligence_breakdown: score,
      last_backfill_at: new Date().toISOString(),
    })
    .eq("client_name", clientName);

  // Also store as a special memory row for the AI to read
  await supabase
    .from("client_ai_memory")
    .delete()
    .eq("client_name", clientName)
    .eq("memory_type", "intelligence_score")
    .eq("source", "backfill");

  await supabase.from("client_ai_memory").insert({
    client_name: clientName,
    memory_type: "intelligence_score",
    content: `Intelligence Score: ${score.total}/100 - Data Quality: ${score.data_quality}/25, Performance Trend: ${score.performance_trend}/25, Change Success: ${score.change_success_rate}/25, Health Trajectory: ${score.health_trajectory}/25. ${score.summary}`,
    source: "backfill",
    context: { ...score, computed_at: new Date().toISOString() },
    relevance_score: 1.0,
  });
}

// ─── Client Processing ───────────────────────────────────────────────────────

async function processOneClient(
  supabase: any,
  clientName: string
): Promise<BackfillResult> {
  const startTime = Date.now();
  const emptyDataPoints = { snapshots: 0, sessions: 0, changes: 0, adReviews: 0, healthDays: 0 };

  try {
    // 1. Fetch all data
    const bundle = await fetchClientData(supabase, clientName);
    const dataPoints = {
      snapshots: bundle.snapshots.length,
      sessions: bundle.sessions.length,
      changes: bundle.changes.length,
      adReviews: bundle.adReviews.length,
      healthDays: bundle.healthHistory.length,
    };

    // 2. Check if there's enough data (include campaign data from Supermetrics)
    const totalData = dataPoints.snapshots + dataPoints.sessions + dataPoints.adReviews + dataPoints.healthDays + bundle.campaignData.length;
    if (totalData === 0) {
      return {
        client: clientName,
        status: "skipped",
        memoriesCreated: 0,
        intelligenceScore: 0,
        message: "No data available for analysis",
        dataPoints: emptyDataPoints,
      };
    }

    // 3. Build prompt
    const { systemPrompt, userPrompt } = buildPrompts(bundle);

    // 4. Call Claude
    const rawResponse = await callClaude(userPrompt, {
      system: systemPrompt,
      maxTokens: 8192,
      temperature: 0.2,
    });

    // 5. Parse
    const parsed = parseClaudeResponse(rawResponse);
    if (!parsed) {
      return {
        client: clientName,
        status: "error",
        memoriesCreated: 0,
        intelligenceScore: 0,
        message: `Failed to parse Claude response (${rawResponse.substring(0, 100)}...)`,
        dataPoints,
      };
    }

    // 6. Store memories
    const memoriesCreated = await storeMemories(supabase, clientName, parsed.learnings);

    // 7. Store intelligence score
    await storeIntelligenceScore(supabase, clientName, parsed.intelligence_score);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    return {
      client: clientName,
      status: "success",
      memoriesCreated,
      intelligenceScore: parsed.intelligence_score.total,
      message: `${memoriesCreated} memories, score ${parsed.intelligence_score.total}/100 (${elapsed}s)`,
      dataPoints,
    };
  } catch (e: any) {
    return {
      client: clientName,
      status: "error",
      memoriesCreated: 0,
      intelligenceScore: 0,
      message: e.message || String(e),
      dataPoints: emptyDataPoints,
    };
  }
}

// ─── Main Handler ────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // No body = run all clients
  }

  const targetClient: string | null = body.clientName ?? null;

  try {
    let clientNames: string[] = [];

    if (targetClient) {
      const { data: client } = await supabase
        .from("managed_clients")
        .select("client_name")
        .eq("client_name", targetClient)
        .eq("is_active", true)
        .single();

      if (!client) {
        return new Response(
          JSON.stringify({ success: false, error: `Client "${targetClient}" not found or inactive` }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      clientNames = [client.client_name];
    } else {
      const { data: clients } = await supabase
        .from("managed_clients")
        .select("client_name")
        .eq("is_active", true)
        .order("client_name", { ascending: true });

      clientNames = (clients || []).map((c: any) => c.client_name);
    }

    if (clientNames.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No active clients found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(
      `[BACKFILL] Starting intelligence backfill for ${clientNames.length} client(s): ${clientNames.join(", ")}`
    );

    // Process sequentially with delay to avoid rate limits
    const results: BackfillResult[] = [];

    for (let i = 0; i < clientNames.length; i++) {
      const clientName = clientNames[i];
      console.log(`[BACKFILL] Processing ${i + 1}/${clientNames.length}: ${clientName}`);

      const result = await processOneClient(supabase, clientName);
      results.push(result);

      console.log(`[BACKFILL] ${result.status.toUpperCase()}: ${clientName} - ${result.message}`);

      if (i < clientNames.length - 1) {
        await sleep(2000);
      }
    }

    // Summary
    const successCount = results.filter((r) => r.status === "success").length;
    const errorCount = results.filter((r) => r.status === "error").length;
    const skippedCount = results.filter((r) => r.status === "skipped").length;
    const totalMemories = results.reduce((sum, r) => sum + r.memoriesCreated, 0);
    const successResults = results.filter((r) => r.status === "success");
    const avgScore =
      successResults.length > 0
        ? Math.round(
            successResults.reduce((s, r) => s + r.intelligenceScore, 0) / successResults.length
          )
        : 0;

    console.log(
      `[BACKFILL] COMPLETE: ${successCount} success, ${errorCount} errors, ${skippedCount} skipped. ${totalMemories} total memories. Avg score: ${avgScore}/100`
    );

    return new Response(
      JSON.stringify({
        success: true,
        totalClients: clientNames.length,
        successCount,
        errorCount,
        skippedCount,
        totalMemories,
        averageIntelligenceScore: avgScore,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[BACKFILL] Fatal error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
