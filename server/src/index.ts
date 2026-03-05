import "dotenv/config";
import express from "express";
import cors from "cors";
import authRouter from "./routes/auth.js";
import chatRouter from "./routes/chat.js";
import conversationsRouter from "./routes/conversations.js";
import memoryRouter from "./routes/memory.js";
import { startScheduler, getActiveCronCount } from "./services/scheduler.js";
import notificationsRouter from "./routes/notifications.js";
import tasksRouter from "./routes/tasks.js";
import { getActiveSseConnections } from "./routes/chat.js";

const app = express();
const PORT = process.env.PORT ?? 3001;

// CORS — allow comma-separated origins from env
const allowedOrigins = (process.env.CLIENT_ORIGIN ?? "*")
  .split(",")
  .map((o) => o.trim());

app.use(
  cors({
    origin: (origin, cb) => {
      // No origin = server-to-server or same-origin — allow
      if (!origin || allowedOrigins.includes("*")) {
        cb(null, origin || "*");
        return;
      }
      if (allowedOrigins.includes(origin)) {
        // Reflect back the EXACT requesting origin (not all of them)
        cb(null, origin);
      } else {
        cb(new Error("CORS blocked"));
      }
    },
    credentials: true,
  })
);
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

const server = app.listen(PORT, () => {
  console.log(`Melleka Teams server running on http://localhost:${PORT}`);
  startScheduler().catch(console.error);
});

// Disable server timeout for SSE connections (agentic loops can take 10+ minutes)
server.timeout = 0;
server.keepAliveTimeout = 0;
