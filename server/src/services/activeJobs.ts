// In-memory registry of active agent chat jobs.
// Enables clients to reconnect to in-progress agent loops and see live events.

export interface BufferedEvent {
  type: string;
  [key: string]: unknown;
}

export interface ActiveJob {
  conversationId: string;
  memberName: string;
  startedAt: number;
  status: "running" | "done" | "error";
  events: BufferedEvent[];
  listeners: Set<(event: BufferedEvent) => void>;
  finalResponse?: string;
}

const MAX_BUFFER = 500;
const CLEANUP_DELAY = 60_000; // 60s after completion
const MAX_AGE = 30 * 60_000; // 30 min safety limit

const jobs = new Map<string, ActiveJob>();

export function registerJob(conversationId: string, memberName: string): ActiveJob {
  // If a stale job exists, clean it up
  const existing = jobs.get(conversationId);
  if (existing && existing.status === "running") {
    // Already running — caller should check first
    existing.status = "error";
    existing.listeners.clear();
  }
  const job: ActiveJob = {
    conversationId,
    memberName,
    startedAt: Date.now(),
    status: "running",
    events: [],
    listeners: new Set(),
  };
  jobs.set(conversationId, job);
  return job;
}

export function pushEvent(conversationId: string, event: BufferedEvent): void {
  const job = jobs.get(conversationId);
  if (!job || job.status !== "running") return;
  if (job.events.length >= MAX_BUFFER) job.events.shift();
  job.events.push(event);
  for (const listener of job.listeners) {
    try { listener(event); } catch { /* dead listener */ }
  }
}

export function completeJob(conversationId: string, response?: string): void {
  const job = jobs.get(conversationId);
  if (!job) return;
  job.status = "done";
  job.finalResponse = response;
  // Notify listeners of done
  for (const listener of job.listeners) {
    try { listener({ type: "done", conversationId }); } catch { /* */ }
  }
  job.listeners.clear();
  setTimeout(() => jobs.delete(conversationId), CLEANUP_DELAY);
}

export function failJob(conversationId: string, error: string): void {
  const job = jobs.get(conversationId);
  if (!job) return;
  job.status = "error";
  for (const listener of job.listeners) {
    try { listener({ type: "error", message: error }); } catch { /* */ }
  }
  job.listeners.clear();
  setTimeout(() => jobs.delete(conversationId), CLEANUP_DELAY);
}

export function getJob(conversationId: string): ActiveJob | undefined {
  const job = jobs.get(conversationId);
  if (!job) return undefined;
  // Safety: auto-expire stuck jobs
  if (job.status === "running" && Date.now() - job.startedAt > MAX_AGE) {
    job.status = "error";
    job.listeners.clear();
    setTimeout(() => jobs.delete(conversationId), CLEANUP_DELAY);
  }
  return job;
}

export function getActiveJobs(): Map<string, ActiveJob> {
  return jobs;
}

export function isConversationRunning(conversationId: string): boolean {
  const job = jobs.get(conversationId);
  return !!job && job.status === "running";
}

export function addListener(
  conversationId: string,
  listener: (event: BufferedEvent) => void,
): () => void {
  const job = jobs.get(conversationId);
  if (!job) return () => {};
  job.listeners.add(listener);
  return () => job.listeners.delete(listener);
}
