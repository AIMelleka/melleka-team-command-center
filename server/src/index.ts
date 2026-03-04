import "dotenv/config";
import express from "express";
import cors from "cors";
import authRouter from "./routes/auth.js";
import chatRouter from "./routes/chat.js";
import conversationsRouter from "./routes/conversations.js";
import memoryRouter from "./routes/memory.js";
import { startScheduler } from "./services/scheduler.js";
import notificationsRouter from "./routes/notifications.js";

const app = express();
const PORT = process.env.PORT ?? 3001;

// CORS — allow comma-separated origins from env
const allowedOrigins = (process.env.CLIENT_ORIGIN ?? "*")
  .split(",")
  .map((o) => o.trim());

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
        cb(null, true);
      } else {
        cb(new Error("CORS blocked"));
      }
    },
    credentials: true,
  })
);
app.use(express.json());

// Health check
app.get("/health", (_req, res) => res.json({ ok: true }));

// API routes
app.use("/api/auth", authRouter);
app.use("/api/chat", chatRouter);
app.use("/api/conversations", conversationsRouter);
app.use("/api/memory", memoryRouter);
app.use("/api/notifications", notificationsRouter);

const server = app.listen(PORT, () => {
  console.log(`Melleka Teams server running on http://localhost:${PORT}`);
  startScheduler().catch(console.error);
});

// Disable server timeout for SSE connections (agentic loops can take 10+ minutes)
server.timeout = 0;
server.keepAliveTimeout = 0;
