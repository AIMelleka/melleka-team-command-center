import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import authRouter from "./routes/auth.js";
import chatRouter from "./routes/chat.js";
import conversationsRouter from "./routes/conversations.js";
import memoryRouter from "./routes/memory.js";
import { startScheduler } from "./services/scheduler.js";
import notificationsRouter from "./routes/notifications.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? "*" }));
app.use(express.json());

// Health check
app.get("/health", (_req, res) => res.json({ ok: true }));

// API routes
app.use("/api/auth", authRouter);
app.use("/api/chat", chatRouter);
app.use("/api/conversations", conversationsRouter);
app.use("/api/memory", memoryRouter);
app.use("/api/notifications", notificationsRouter);

// Serve built client in production
const clientDist = path.join(__dirname, "../../client/dist");
app.use(express.static(clientDist));
app.get("*", (_req, res) => {
  res.sendFile(path.join(clientDist, "index.html"));
});

const server = app.listen(PORT, () => {
  console.log(`Melleka Team Hub running on http://localhost:${PORT}`);
  // Start background cron scheduler
  startScheduler().catch(console.error);
});

// Disable server timeout for SSE connections (agentic loops can take 10+ minutes)
server.timeout = 0;
server.keepAliveTimeout = 0;
