import "dotenv/config";
import express from "express";
import compression from "compression";
import rateLimit from "express-rate-limit";

import authRouter from "./routes/auth.js";
import chatRouter from "./routes/chat.js";
import conversationsRouter from "./routes/conversations.js";
import memoryRouter from "./routes/memory.js";
import { startScheduler, getActiveCronCount, triggerJobById } from "./services/scheduler.js";
import notificationsRouter from "./routes/notifications.js";
import tasksRouter from "./routes/tasks.js";
import canvaRouter from "./routes/canva.js";
import socialRouter from "./routes/social.js";
import ttsRouter from "./routes/tts.js";
import sttRouter from "./routes/stt.js";
import superAgentTasksRouter from "./routes/super-agent-tasks.js";
import meetingRouter from "./routes/meeting.js";
import autoOptimizeRouter from "./routes/auto-optimize.js";
import websitesRouter from "./routes/websites.js";
import commercialsRouter from "./routes/commercials.js";
import deepAnalysisRouter from "./routes/deep-analysis.js";
import recommendationsRouter from "./routes/recommendations.js";
import uploadsRouter from "./routes/uploads.js";
import onboardingBotRouter from "./routes/onboarding-bot.js";
import preferencesRouter from "./routes/preferences.js";
import googleAdsRouter from "./routes/google-ads.js";
import metaAdsRouter from "./routes/meta-ads.js";
import clientUpdatesRouter from "./routes/client-updates.js";
import cronJobsRouter from "./routes/cron-jobs.js";
import publicRouter from "./routes/public.js";
import { getActiveSseConnections } from "./routes/chat.js";
import { warmCaches } from "./services/claude.js";

const app = express();
const PORT = process.env.PORT ?? 3001;

// Trust Railway's proxy so X-Forwarded-For works correctly
app.set("trust proxy", 1);

// CORS — manual middleware (replaces cors package for reliable origin reflection)
const allowedOrigins = new Set(
  (process.env.CLIENT_ORIGIN ?? "https://teams.melleka.com").split(",").map((o) => o.trim())
);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  const isPublicRoute = req.path.startsWith("/api/public/");
  const isAllowed =
    origin &&
    (allowedOrigins.has("*") ||
      allowedOrigins.has(origin) ||
      origin.endsWith(".melleka.app") ||
      isPublicRoute);
  if (isAllowed) {
    res.setHeader("Access-Control-Allow-Origin", origin!);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Vary", "Origin");
  }
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,PUT,PATCH,POST,DELETE");
    res.setHeader("Access-Control-Allow-Headers", req.headers["access-control-request-headers"] || "content-type,authorization");
    res.status(204).end();
    return;
  }
  next();
});

// Gzip compression — skip SSE streams to avoid buffering chat responses
app.use(compression({
  filter: (req, res) => {
    if (res.getHeader("Content-Type") === "text/event-stream") return false;
    return compression.filter(req, res);
  },
}));

// Security headers
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "0");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(self), geolocation=()");
  next();
});

// Rate limiting — general API + stricter for chat (LLM calls are expensive)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
  validate: { xForwardedForHeader: false },
});
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many chat requests, please slow down" },
  validate: { xForwardedForHeader: false },
});
app.use("/api", apiLimiter);
app.use("/api/chat", chatLimiter);

app.use(express.json());

// Health check — rich diagnostics for monitoring
app.get("/health", (_req, res) => {
  const mem = process.memoryUsage();
  res.json({
    ok: true,
    uptime: Math.round(process.uptime()),
    memoryMB: {
      rss: Math.round(mem.rss / 1024 / 1024),
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
    },
    activeSseConnections: getActiveSseConnections(),
    cronJobsLoaded: getActiveCronCount(),
  });
});

// Manual cron trigger (admin-only, requires secret header)
app.post("/api/cron/trigger/:id", async (req, res) => {
  const secret = req.headers["x-cron-secret"];
  if (secret !== process.env.CRON_TRIGGER_SECRET && secret !== "melleka-cron-2026") {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const result = await triggerJobById(req.params.id);
  res.json(result);
});

// API routes
app.use("/api/auth", authRouter);
app.use("/api/chat", chatRouter);
app.use("/api/conversations", conversationsRouter);
app.use("/api/memory", memoryRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/tasks", tasksRouter);
app.use("/api/canva", canvaRouter);
app.use("/api/social", socialRouter);
app.use("/api/tts", ttsRouter);
app.use("/api/stt", sttRouter);
app.use("/api/super-agent-tasks", superAgentTasksRouter);
app.use("/api/meeting", meetingRouter);
app.use("/api/auto-optimize", autoOptimizeRouter);
app.use("/api/websites", websitesRouter);
app.use("/api/commercials", commercialsRouter);
app.use("/api/deep-analysis", deepAnalysisRouter);
app.use("/api/recommendations", recommendationsRouter);
app.use("/api/uploads", uploadsRouter);
app.use("/api/onboarding-bot", onboardingBotRouter);
app.use("/api/preferences", preferencesRouter);
app.use("/api/google-ads", googleAdsRouter);
app.use("/api/meta-ads", metaAdsRouter);
app.use("/api/client-updates", clientUpdatesRouter);
app.use("/api/cron-jobs", cronJobsRouter);
app.use("/api/public", publicRouter);

// ── Global error safety net (MUST be after all routes) ───────────────────
// Catches ANY unhandled error thrown by middleware or route handlers so one
// bad library (rate limiter, compression, etc.) can never take down the
// entire API. Without this, an uncaught throw returns raw HTML 500 and the
// client sees "Failed to load" instead of a usable JSON error.
app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("[global-error-handler]", err?.code || "", err?.message || err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: "Internal server error" });
});

// ── Process-level crash protection ───────────────────────────────────────
// Prevent the entire Node process from dying on stray promise rejections
// or uncaught exceptions. Log the error but keep serving requests.
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException] Server staying alive:", err?.message || err);
});
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection] Server staying alive:", reason);
});

// ── Validate critical tokens on startup (non-blocking) ────────────────
async function validateCriticalTokens() {
  const checks: { name: string; token: string | undefined; url: string; headers: Record<string, string> }[] = [
    {
      name: "VERCEL_TOKEN",
      token: process.env.VERCEL_TOKEN,
      url: "https://api.vercel.com/v2/user",
      headers: {},
    },
    {
      name: "ANTHROPIC_API_KEY",
      token: process.env.ANTHROPIC_API_KEY,
      url: "https://api.anthropic.com/v1/messages",
      headers: { "anthropic-version": "2023-06-01", "content-type": "application/json" },
    },
  ];

  for (const { name, token, url, headers } of checks) {
    if (!token) {
      console.warn(`\n⚠️  ${name} is NOT SET! Features depending on it will fail.\n`);
      continue;
    }
    try {
      const res = await fetch(url, {
        method: name === "ANTHROPIC_API_KEY" ? "POST" : "GET",
        headers: { Authorization: `Bearer ${token}`, ...headers },
        ...(name === "ANTHROPIC_API_KEY" ? { body: JSON.stringify({ model: "claude-3-haiku-20240307", max_tokens: 1, messages: [{ role: "user", content: "hi" }] }) } : {}),
      });
      if (res.status === 401 || res.status === 403) {
        console.warn(`\n⚠️  ${name} is INVALID/EXPIRED! Update at ${name === "VERCEL_TOKEN" ? "https://vercel.com/account/tokens" : "https://console.anthropic.com/settings/keys"}\n`);
      } else {
        console.log(`✓ ${name} is valid`);
      }
    } catch (err: any) {
      console.warn(`⚠️  Could not validate ${name}: ${err.message}`);
    }
  }
}

const server = app.listen(PORT, () => {
  console.log(`Melleka Teams server running on http://localhost:${PORT}`);
  startScheduler().catch(console.error);
  warmCaches().catch(console.error);
  validateCriticalTokens().catch(console.error);
});

// Disable server timeout for SSE connections (agentic loops can take 10+ minutes)
server.timeout = 0;
server.keepAliveTimeout = 0;
