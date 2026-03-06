import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const startTime = Date.now();

  let action = "unknown";
  let userId: string | undefined;
  let userEmail: string | undefined;

  async function logUsage(statusCode: number, errorMessage?: string, responseSummary?: string) {
    try {
      const svc = createClient(url, serviceKey);
      await svc.from("api_usage_logs").insert({
        action,
        user_id: userId ?? null,
        user_email: userEmail ?? null,
        status_code: statusCode,
        error_message: errorMessage ?? null,
        response_summary: responseSummary ?? null,
        duration_ms: Date.now() - startTime,
        ip_address: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || null,
      });
    } catch (_) { /* best-effort logging */ }
  }

  try {
    const body = await req.json();
    const params = (body as any).params as Record<string, unknown> | undefined;
    action = (body as any).action as string;

    // ── LOGIN ──────────────────────────────────────────────
    if (action === "login") {
      const { email, password } = (params ?? {}) as { email: string; password: string };
      const anonClient = createClient(url, anonKey);
      const { data, error } = await anonClient.auth.signInWithPassword({ email, password });
      if (error) { await logUsage(401, error.message); return json({ error: error.message }, 401); }
      userId = data.user?.id;
      userEmail = email;
      await logUsage(200, undefined, "login_success");
      return json({
        access_token: data.session?.access_token,
        refresh_token: data.session?.refresh_token,
        expires_at: data.session?.expires_at,
        user_id: data.user?.id,
      });
    }

    // ── REFRESH ────────────────────────────────────────────
    if (action === "refresh") {
      const { refresh_token } = (params ?? {}) as { refresh_token: string };
      const anonClient = createClient(url, anonKey);
      const { data, error } = await anonClient.auth.refreshSession({ refresh_token });
      if (error) { await logUsage(401, error.message); return json({ error: error.message }, 401); }
      await logUsage(200, undefined, "token_refreshed");
      return json({
        access_token: data.session?.access_token,
        refresh_token: data.session?.refresh_token,
        expires_at: data.session?.expires_at,
      });
    }

    // ── ALL OTHER ACTIONS REQUIRE AUTH ─────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      await logUsage(401, "Missing Authorization header");
      return json({ error: "Missing Authorization header. Login first." }, 401);
    }

    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify token
    const { data: userData, error: authError } = await userClient.auth.getUser();
    if (authError || !userData.user) { await logUsage(401, "Invalid or expired token"); return json({ error: "Invalid or expired token" }, 401); }
    userId = userData.user.id;
    userEmail = userData.user.email ?? undefined;

    // Verify admin role
    const serviceClient = createClient(url, serviceKey);
    const { data: isAdmin } = await serviceClient.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (!isAdmin) { await logUsage(403, "Admin access required"); return json({ error: "Admin access required" }, 403); }

    // ── ACTIONS ────────────────────────────────────────────
    switch (action) {
      // --- Clients ---
      case "list_clients": {
        const { data, error } = await userClient.from("managed_clients").select("*").order("client_name");
        if (error) return json({ error: error.message }, 400);
        return json({ clients: data });
      }
      case "get_client": {
        const { client_name } = params as { client_name: string };
        const { data, error } = await userClient.from("managed_clients").select("*").eq("client_name", client_name).single();
        if (error) return json({ error: error.message }, 400);
        return json({ client: data });
      }
      case "create_client": {
        const { data, error } = await userClient.from("managed_clients").insert(params as any).select().single();
        if (error) return json({ error: error.message }, 400);
        return json({ client: data });
      }
      case "update_client": {
        const { client_name, ...updates } = params as any;
        const { data, error } = await userClient.from("managed_clients").update(updates).eq("client_name", client_name).select().single();
        if (error) return json({ error: error.message }, 400);
        return json({ client: data });
      }

      // --- Decks ---
      case "list_decks": {
        const { data, error } = await userClient.from("decks").select("id, slug, client_name, status, date_range_start, date_range_end, created_at").order("created_at", { ascending: false });
        if (error) return json({ error: error.message }, 400);
        return json({ decks: data });
      }
      case "get_deck": {
        const { slug } = params as { slug: string };
        const { data, error } = await userClient.from("decks").select("*").eq("slug", slug).single();
        if (error) return json({ error: error.message }, 400);
        return json({ deck: data });
      }
      case "update_deck": {
        const { slug, ...updates } = params as any;
        const { data, error } = await userClient.from("decks").update(updates).eq("slug", slug).select().single();
        if (error) return json({ error: error.message }, 400);
        return json({ deck: data });
      }

      // --- Proposals ---
      case "list_proposals": {
        const { data, error } = await userClient.from("proposals").select("id, slug, title, client_name, status, created_at").order("created_at", { ascending: false });
        if (error) return json({ error: error.message }, 400);
        return json({ proposals: data });
      }
      case "get_proposal": {
        const { slug } = params as { slug: string };
        const { data, error } = await userClient.from("proposals").select("*").eq("slug", slug).single();
        if (error) return json({ error: error.message }, 400);
        return json({ proposal: data });
      }

      // --- Ad Review History ---
      case "list_ad_reviews": {
        const { client_name, limit: lim } = (params ?? {}) as any;
        let q = userClient.from("ad_review_history").select("*").order("review_date", { ascending: false }).limit(lim ?? 20);
        if (client_name) q = q.eq("client_name", client_name);
        const { data, error } = await q;
        if (error) return json({ error: error.message }, 400);
        return json({ reviews: data });
      }

      // --- SEO History ---
      case "list_seo_history": {
        const { client_name, limit: lim } = (params ?? {}) as any;
        let q = userClient.from("seo_history").select("*").order("analysis_date", { ascending: false }).limit(lim ?? 20);
        if (client_name) q = q.eq("client_name", client_name);
        const { data, error } = await q;
        if (error) return json({ error: error.message }, 400);
        return json({ history: data });
      }

      // --- PPC Sessions ---
      case "list_ppc_sessions": {
        const { client_name, limit: lim } = (params ?? {}) as any;
        let q = userClient.from("ppc_optimization_sessions").select("*").order("created_at", { ascending: false }).limit(lim ?? 20);
        if (client_name) q = q.eq("client_name", client_name);
        const { data, error } = await q;
        if (error) return json({ error: error.message }, 400);
        return json({ sessions: data });
      }

      // --- Client Health ---
      case "list_client_health": {
        const { data, error } = await userClient.from("client_health_history").select("*").order("recorded_date", { ascending: false }).limit(50);
        if (error) return json({ error: error.message }, 400);
        return json({ health: data });
      }

      // --- PPC Snapshots ---
      case "list_ppc_snapshots": {
        const { client_name, days } = (params ?? {}) as any;
        let q = userClient.from("ppc_daily_snapshots").select("*").order("snapshot_date", { ascending: false }).limit(days ?? 30);
        if (client_name) q = q.eq("client_name", client_name);
        const { data, error } = await q;
        if (error) return json({ error: error.message }, 400);
        return json({ snapshots: data });
      }

      // --- Invoke edge function ---
      case "invoke_function": {
        const { function_name, payload } = params as { function_name: string; payload?: unknown };
        const { data, error } = await userClient.functions.invoke(function_name, { body: payload });
        if (error) return json({ error: error.message }, 500);
        return json({ result: data });
      }

      // --- Users ---
      case "list_users": {
        const { data, error } = await userClient.rpc("get_users_for_admin");
        if (error) return json({ error: error.message }, 400);
        return json({ users: data });
      }

      // --- Generic query (any table) ---
      case "query": {
        const { table, select: sel, filters, order_by, limit: lim } = params as any;
        let q = userClient.from(table).select(sel ?? "*");
        if (filters) {
          for (const [col, val] of Object.entries(filters)) {
            q = q.eq(col, val);
          }
        }
        if (order_by) q = q.order(order_by, { ascending: false });
        q = q.limit(lim ?? 50);
        const { data, error } = await q;
        if (error) return json({ error: error.message }, 400);
        return json({ data });
      }

      // --- Generic insert ---
      case "insert": {
        const { table, record } = params as any;
        const { data, error } = await userClient.from(table).insert(record).select().single();
        if (error) return json({ error: error.message }, 400);
        return json({ data });
      }

      // --- Generic update ---
      case "update": {
        const { table, match, updates } = params as any;
        let q = userClient.from(table).update(updates);
        for (const [col, val] of Object.entries(match)) {
          q = q.eq(col, val as any);
        }
        const { data, error } = await q.select();
        if (error) return json({ error: error.message }, 400);
        return json({ data });
      }

      // --- Generic delete ---
      case "delete": {
        const { table, match } = params as any;
        let q = userClient.from(table).delete();
        for (const [col, val] of Object.entries(match)) {
          q = q.eq(col, val as any);
        }
        const { data, error } = await q.select();
        if (error) return json({ error: error.message }, 400);
        return json({ data });
      }

      default:
        return json({ error: `Unknown action: ${action}`, available_actions: [
          "login", "refresh",
          "list_clients", "get_client", "create_client", "update_client",
          "list_decks", "get_deck", "update_deck",
          "list_proposals", "get_proposal",
          "list_ad_reviews", "list_seo_history",
          "list_ppc_sessions", "list_ppc_snapshots",
          "list_client_health", "list_users",
          "invoke_function",
          "query", "insert", "update", "delete",
        ] }, 400);
    }
  } catch (err) {
    await logUsage(500, err.message ?? "Internal error");
    return json({ error: err.message ?? "Internal error" }, 500);
  }
});
