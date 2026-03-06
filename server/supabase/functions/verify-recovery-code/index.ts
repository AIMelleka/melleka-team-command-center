import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { code, userId } = await req.json();

    if (!code || !userId) {
      return new Response(
        JSON.stringify({ error: "Missing code or userId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch all unused recovery codes for this user
    const { data: codes, error: fetchError } = await supabaseAdmin
      .from("mfa_recovery_codes")
      .select("id, code_hash")
      .eq("user_id", userId)
      .is("used_at", null);

    if (fetchError || !codes?.length) {
      return new Response(
        JSON.stringify({ error: "No recovery codes available" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Simple hash comparison (codes are stored as hex-encoded SHA-256)
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(code.trim().toUpperCase()));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const inputHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    const matchedCode = codes.find((c) => c.code_hash === inputHash);

    if (!matchedCode) {
      return new Response(
        JSON.stringify({ error: "Invalid recovery code" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark code as used
    await supabaseAdmin
      .from("mfa_recovery_codes")
      .update({ used_at: new Date().toISOString() })
      .eq("id", matchedCode.id);

    // Unenroll all TOTP factors so user can re-enroll
    const { data: factors } = await supabaseAdmin.auth.admin.mfa.listFactors({ userId });

    if (factors?.factors) {
      for (const factor of factors.factors) {
        if (factor.factor_type === "totp") {
          await supabaseAdmin.auth.admin.mfa.deleteFactor({ userId, factorId: factor.id });
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Recovery code accepted. MFA has been reset. Please set up 2FA again.",
        remainingCodes: codes.length - 1,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
