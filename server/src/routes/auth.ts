import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { supabase } from "../services/supabase.js";

const router = Router();

// Session check — returns the authenticated member name
router.get("/me", requireAuth, (req: AuthRequest, res) => {
  res.json({ name: req.memberName });
});

async function getResendConfig(): Promise<{ resendKey: string; fromEmail: string } | { error: string }> {
  const [{ data: resendSecret }, { data: fromEmailSecret }] = await Promise.all([
    supabase.from("team_secrets").select("value").eq("key", "RESEND_API_KEY").maybeSingle(),
    supabase.from("team_secrets").select("value").eq("key", "FROM_EMAIL").maybeSingle(),
  ]);
  const resendKey = resendSecret?.value as string | undefined;
  if (!resendKey) return { error: "Email service not configured" };
  const fromEmail = (fromEmailSecret?.value as string | undefined) || "Melleka Team <team@melleka.io>";
  return { resendKey, fromEmail };
}

async function sendViaResend(resendKey: string, fromEmail: string, to: string, subject: string, html: string): Promise<{ error?: string }> {
  const emailRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: fromEmail, to, subject, html }),
  });
  if (!emailRes.ok) {
    const err = await emailRes.json().catch(() => ({})) as { message?: string };
    console.error("Resend error:", err);
    return { error: err.message || "Failed to send email" };
  }
  return {};
}

function otpEmailHtml(otp: string, title: string, subtitle: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 420px; margin: 0 auto; padding: 40px 24px; background: #ffffff;">
      <h2 style="margin: 0 0 8px; font-size: 22px; color: #111;">${title}</h2>
      <p style="margin: 0 0 32px; color: #666; font-size: 15px;">${subtitle}</p>
      <div style="background: #f4f4f5; border-radius: 12px; padding: 28px; text-align: center; letter-spacing: 14px; font-size: 38px; font-weight: 700; font-family: 'Courier New', monospace; color: #111;">
        ${otp}
      </div>
      <p style="margin: 24px 0 0; color: #999; font-size: 13px;">If you did not request this, you can safely ignore this email.</p>
    </div>
  `;
}

async function sendOtpEmail(email: string): Promise<{ error?: string }> {
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkError || !linkData?.properties?.email_otp) {
    console.error("generateLink error:", linkError);
    return { error: "Failed to generate verification code" };
  }
  const config = await getResendConfig();
  if ("error" in config) return config;
  return sendViaResend(
    config.resendKey, config.fromEmail, email,
    "Your Melleka Genie sign-in code",
    otpEmailHtml(linkData.properties.email_otp, "Sign in to Melleka Genie", "Enter this 6-digit code to complete your sign in. It expires in 1 hour.")
  );
}

async function sendResetEmail(email: string): Promise<{ error?: string }> {
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: "recovery",
    email,
  });
  if (linkError || !linkData?.properties?.email_otp) {
    console.error("generateLink (recovery) error:", linkError);
    return { error: "Failed to generate reset code" };
  }
  const config = await getResendConfig();
  if ("error" in config) return config;
  return sendViaResend(
    config.resendKey, config.fromEmail, email,
    "Reset your Melleka Genie password",
    otpEmailHtml(linkData.properties.email_otp, "Reset your password", "Enter this 6-digit code to reset your password. It expires in 1 hour.")
  );
}

// Validate password then send 6-digit OTP via Resend
router.post("/send-otp", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  // Validate credentials
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  // Sign out the server-side session — we only needed to validate
  await supabase.auth.signOut();

  const { error } = await sendOtpEmail(email);
  if (error) {
    res.status(500).json({ error });
    return;
  }

  res.json({ success: true });
});

// Resend OTP without re-validating password (user already passed the password step)
router.post("/resend-otp", async (req, res) => {
  const { email } = req.body as { email?: string };

  if (!email) {
    res.status(400).json({ error: "Email is required" });
    return;
  }

  const { error } = await sendOtpEmail(email);
  if (error) {
    res.status(500).json({ error });
    return;
  }

  res.json({ success: true });
});

// Send password reset code via Resend (bypasses Supabase email rate limits)
router.post("/send-reset", async (req, res) => {
  const { email } = req.body as { email?: string };
  if (!email) {
    res.status(400).json({ error: "Email is required" });
    return;
  }
  const { error } = await sendResetEmail(email);
  if (error) {
    res.status(500).json({ error });
    return;
  }
  res.json({ success: true });
});

export default router;
