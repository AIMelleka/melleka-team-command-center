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

// ── POST /api/onboarding-bot/generate — AI-generate onboarding tasks ────────
router.post("/generate", requireAuth, async (req, res) => {
  try {
    const { clientName, packageName, prompt, teamMembers } = req.body as {
      clientName: string;
      packageName?: string;
      prompt: string;
      teamMembers: string[];
    };

    if (!clientName || !prompt || prompt.trim().length < 5) {
      res.status(400).json({ error: "Client name and a prompt are required" });
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
      max_tokens: 8192,
      system: `You are a marketing agency project manager. Your job is to generate onboarding tasks for a new client based on the user's playbook.

Client being onboarded: ${clientName}${packageName ? `\nPackage: ${packageName}` : ""}
Known team members: ${(teamMembers || []).join(", ")}

The user will provide their onboarding playbook which contains all the tasks, assignment rules, and logic for who does what. The playbook may define different tasks depending on which package the client signed up for. ONLY generate the tasks that apply to the specified package. Follow their instructions exactly.

For each task output:
1. task_name — Clear, actionable description (start with a verb)
2. client_name — Always "${clientName}"
3. assignee — The person doing the work, as specified in the playbook. Use "Unassigned" only if the playbook doesn't specify.
4. manager — The person overseeing, as specified in the playbook. Leave empty string if not specified.
5. status — Always "👋 NEW 👋"
6. priority — "High", "Medium", or "Low" as the playbook dictates, or use your judgment if not specified.

Follow the playbook's assignment logic, task grouping, and priorities exactly. Do not add extra tasks beyond what the playbook describes unless it clearly implies them.

Respond ONLY with valid JSON:
{
  "tasks": [
    { "task_name": "...", "client_name": "${clientName}", "assignee": "...", "manager": "...", "status": "👋 NEW 👋", "priority": "High" }
  ]
}`,
      messages: [
        {
          role: "user",
          content: `Here is our onboarding playbook. Generate the tasks for ${clientName}${packageName ? ` (${packageName} package)` : ""}:\n\n${prompt}`,
        },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      res.status(500).json({ error: "Failed to parse AI response" });
      return;
    }

    const result = JSON.parse(jsonMatch[0]);
    res.json(result);
  } catch (err: any) {
    console.error("[onboarding-bot] generate error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/onboarding-bot/push-to-notion — create tasks in Notion ────────
router.post("/push-to-notion", requireAuth, async (req, res) => {
  try {
    const { tasks } = req.body as {
      tasks: Array<{
        client_name: string;
        task_name: string;
        assignee: string;
        manager?: string;
        status?: string;
        priority?: string;
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
            status: { name: task.status || "👋 NEW 👋" },
          },
          CLIENTS: {
            rich_text: [{ text: { content: task.client_name } }],
          },
        };

        // Set Priority
        if (task.priority) {
          properties["Priority"] = {
            select: { name: task.priority },
          };
        }

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
    console.error("[onboarding-bot] push-to-notion error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
