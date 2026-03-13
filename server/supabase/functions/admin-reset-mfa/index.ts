import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify requesting user is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsError } = await supabaseAdmin.auth.getUser(token);
    if (claimsError || !claims.user) {
      return new Response(JSON.stringify({ success: false, error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
      _user_id: claims.user.id, _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ success: false, error: "Admin access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { userId } = await req.json();
    if (!userId) {
      return new Response(JSON.stringify({ success: false, error: "userId is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // List user's MFA factors
    const { data: factorsData, error: factorsError } =
      await supabaseAdmin.auth.admin.mfa.listFactors({ userId });

    if (factorsError) {
      return new Response(JSON.stringify({ success: false, error: factorsError.message }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const factors = factorsData?.factors ?? [];
    let deletedCount = 0;

    // Delete each MFA factor
    for (const factor of factors) {
      const { error: delError } = await supabaseAdmin.auth.admin.mfa.deleteFactor({
        userId,
        factorId: factor.id,
      });
      if (delError) {
        console.error(`Failed to delete factor ${factor.id}:`, delError.message);
      } else {
        deletedCount++;
      }
    }

    // Clear recovery codes if table exists
    try {
      await supabaseAdmin
        .from("mfa_recovery_codes")
        .delete()
        .eq("user_id", userId);
    } catch {
      // Table may not exist; ignore
    }

    return new Response(
      JSON.stringify({ success: true, deletedFactors: deletedCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
