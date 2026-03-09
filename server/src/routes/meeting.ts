import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import Anthropic from "@anthropic-ai/sdk";

const router = Router();

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";
const DEFAULT_DB_ID = process.env.NOTION_TASK_DATABASE_ID || "9e7cd72f-e62c-4514-9456-5f51cbcfe981";

function notionHeaders() {
  return {
    Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };
}

// ── POST /api/meeting/analyze — extract tasks from meeting transcript ──────
router.post("/analyze", requireAuth, async (req, res) => {
  try {
    const { transcript, clients, teamMembers } = req.body as {
      transcript: string;
      clients: string[];
      teamMembers: string[];
    };

    if (!transcript || transcript.trim().length < 10) {
      res.status(400).json({ error: "Transcript is too short to analyze" });
      return;
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });
      return;
    }

    const claude = new Anthropic({ apiKey });

    const response = await claude.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: `You are a meeting analyst for a marketing agency. Your job is to extract actionable tasks from meeting transcripts.

Known clients: ${clients.join(", ")}
Known team members: ${teamMembers.join(", ")}

Extract every task mentioned in the meeting. For each task, identify:
1. client_name — which client the task is for (must match one of the known clients above, use fuzzy matching if needed)
2. task_name — a clear, actionable description of what needs to be done
3. assignee — who is responsible for DOING the task (must match one of the known team members above, use fuzzy matching if needed). Pay close attention to phrases like "assigned to", "can you handle", "you're on this", "[name] will do", "[name] take care of", or when someone is directly told to do something.
4. manager — who is OVERSEEING or MANAGING the task (the person checking on it, approving it, or delegating it). This is often the person who assigns the task to someone else, or is described as "managing", "overseeing", "in charge of", or "lead on" the task. The manager and assignee should be DIFFERENT people.

IMPORTANT: The assignee is the person DOING the work. The manager is the person OVERSEEING the work. Do not confuse these roles. If someone says "Anthony, can you have Sarah do X" — Anthony is the manager, Sarah is the assignee.

If you cannot determine the client, use "General" as the client name.
If you cannot determine the assignee, use "Unassigned".
If you cannot determine the manager, use an empty string "".

Also provide a brief meeting summary (2-3 sentences) covering the main topics discussed.

Respond ONLY with valid JSON in this exact format:
{
  "summary": "Brief meeting summary here...",
  "tasks": [
    { "client_name": "Client Name", "task_name": "Task description", "assignee": "Team Member Name", "manager": "Manager Name" }
  ]
}

If no tasks were found, return an empty tasks array. Do NOT include any text outside the JSON.`,
      messages: [
        {
          role: "user",
          content: `Here is the full meeting transcript to analyze:\n\n${transcript}`,
        },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";

    // Parse the JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      res.status(500).json({ error: "Failed to parse AI response" });
      return;
    }

    const result = JSON.parse(jsonMatch[0]);
    res.json(result);
  } catch (err: any) {
    console.error("[meeting] analyze error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/meeting/push-to-notion — create tasks in Notion ──────────────
router.post("/push-to-notion", requireAuth, async (req, res) => {
  try {
    const { tasks } = req.body as {
      tasks: Array<{
        client_name: string;
        task_name: string;
        assignee: string;
        manager?: string;
      }>;
    };

    if (!tasks || tasks.length === 0) {
      res.status(400).json({ error: "No tasks to push" });
      return;
    }

    if (!process.env.NOTION_API_KEY) {
      res.status(500).json({ error: "NOTION_API_KEY not configured" });
      return;
    }

    // Fetch Notion workspace users to resolve names to IDs for people properties
    let notionUsers: Array<{ id: string; name: string }> = [];
    const needsUserLookup = tasks.some(t => t.assignee || t.manager);
    if (needsUserLookup) {
      try {
        const usersResp = await fetch(`${NOTION_API}/users`, { headers: notionHeaders() });
        if (usersResp.ok) {
          const usersData = await usersResp.json();
          notionUsers = (usersData.results || [])
            .filter((u: any) => u.type === "person")
            .map((u: any) => ({ id: u.id, name: u.name || "" }));
        }
      } catch { /* proceed without user resolution */ }
    }

    const resolveUserId = (name: string): string | null => {
      if (!name) return null;
      const lower = name.toLowerCase().trim();
      const exact = notionUsers.find(u => u.name.toLowerCase() === lower);
      if (exact) return exact.id;
      const partial = notionUsers.find(u =>
        u.name.toLowerCase().includes(lower) || lower.includes(u.name.toLowerCase())
      );
      if (partial) return partial.id;
      const firstName = lower.split(/\s+/)[0];
      const firstMatch = notionUsers.find(u => u.name.toLowerCase().startsWith(firstName));
      return firstMatch?.id || null;
    };

    const results: Array<{ task_name: string; success: boolean; error?: string; notionId?: string }> = [];

    for (const task of tasks) {
      try {
        const properties: Record<string, any> = {
          "Task name": {
            title: [{ text: { content: task.task_name } }],
          },
          STATUS: {
            status: { name: "👋 NEW 👋" },
          },
          CLIENTS: {
            rich_text: [{ text: { content: task.client_name } }],
          },
        };

        // Set Teammate (select) and Assign (people) for assignee
        if (task.assignee && task.assignee !== "Unassigned") {
          properties["Teammate"] = {
            select: { name: task.assignee },
          };
          const assigneeId = resolveUserId(task.assignee);
          if (assigneeId) {
            properties["Assign"] = {
              people: [{ id: assigneeId }],
            };
          }
        }

        // Set Managers (people) for manager
        if (task.manager) {
          const managerId = resolveUserId(task.manager);
          if (managerId) {
            properties["Managers"] = {
              people: [{ id: managerId }],
            };
          }
        }

        const resp = await fetch(`${NOTION_API}/pages`, {
          method: "POST",
          headers: notionHeaders(),
          body: JSON.stringify({
            parent: { database_id: DEFAULT_DB_ID },
            properties,
          }),
        });

        if (!resp.ok) {
          const err = await resp.json();
          results.push({
            task_name: task.task_name,
            success: false,
            error: err.message || JSON.stringify(err),
          });
        } else {
          const data = await resp.json();
          results.push({
            task_name: task.task_name,
            success: true,
            notionId: data.id,
          });
        }

        // Small delay to avoid Notion rate limits
        await new Promise((r) => setTimeout(r, 350));
      } catch (err: any) {
        results.push({
          task_name: task.task_name,
          success: false,
          error: err.message,
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    res.json({
      total: tasks.length,
      success: successCount,
      failed: tasks.length - successCount,
      results,
    });
  } catch (err: any) {
    console.error("[meeting] push-to-notion error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
