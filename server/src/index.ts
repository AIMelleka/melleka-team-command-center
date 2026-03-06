import "dotenv/config";
import express from "express";
import authRouter from "./routes/auth.js";
import chatRouter from "./routes/chat.js";
import conversationsRouter from "./routes/conversations.js";
import memoryRouter from "./routes/memory.js";
import { startScheduler, getActiveCronCount } from "./services/scheduler.js";
import notificationsRouter from "./routes/notifications.js";
import tasksRouter from "./routes/tasks.js";
import canvaRouter from "./routes/canva.js";
import ttsRouter from "./routes/tts.js";
import { getActiveSseConnections } from "./routes/chat.js";

const app = express();
const PORT = process.env.PORT ?? 3001;

// CORS — manual middleware (replaces cors package for reliable origin reflection)
const allowedOrigins = new Set(
  (process.env.CLIENT_ORIGIN ?? "*").split(",").map((o) => o.trim())
);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && (allowedOrigins.has("*") || allowedOrigins.has(origin))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
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

// API routes
app.use("/api/auth", authRouter);
app.use("/api/chat", chatRouter);
app.use("/api/conversations", conversationsRouter);
app.use("/api/memory", memoryRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/tasks", tasksRouter);
app.use("/api/canva", canvaRouter);
app.use("/api/tts", ttsRouter);

const server = app.listen(PORT, () => {
  console.log(`Melleka Teams server running on http://localhost:${PORT}`);
  startScheduler().catch(console.error);
});

// Disable server timeout for SSE connections (agentic loops can take 10+ minutes)
server.timeout = 0;
server.keepAliveTimeout = 0;
