import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// 1. Check for error messages in Anthony's recent conversations
const { data: convs } = await supabase
  .from("team_conversations")
  .select("id, title, updated_at")
  .eq("member_name", "anthony")
  .order("updated_at", { ascending: false })
  .limit(10);

console.log("=== CHECKING FOR ERRORS IN ANTHONY'S CHATS ===\n");

for (const conv of convs) {
  const { data: msgs } = await supabase
    .from("team_messages")
    .select("role, content, created_at")
    .eq("conversation_id", conv.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const errorMsgs = (msgs || []).filter(m =>
    m.content && (
      m.content.includes("Error:") ||
      m.content.includes("failed") ||
      m.content.includes("timed out") ||
      m.content.includes("ALL") ||
      m.content.includes("providers") ||
      m.content.includes("400") ||
      m.content.includes("timeout") ||
      m.content.includes("interrupted")
    )
  );

  if (errorMsgs.length > 0) {
    console.log("CONV:", conv.title?.substring(0, 60), "| Updated:", conv.updated_at);
    errorMsgs.forEach(m => {
      console.log("  [" + m.created_at.substring(0, 19) + "] " + m.role + ":");
      console.log("  " + m.content.substring(0, 400));
      console.log("");
    });
  }
}

// 2. Check super_agent_tasks for errors
console.log("\n=== RECENT SUPER AGENT TASK ERRORS ===\n");
const { data: tasks } = await supabase
  .from("super_agent_tasks")
  .select("id, title, status, error_details, created_at, updated_at")
  .in("status", ["error", "working_on_it"])
  .order("created_at", { ascending: false })
  .limit(10);

(tasks || []).forEach(t => {
  console.log(t.status.toUpperCase(), "|", t.title?.substring(0, 60), "|", t.created_at.substring(0, 19));
  if (t.error_details) console.log("  Error:", t.error_details.substring(0, 300));
  console.log("");
});

// 3. Check recent tool execution errors
console.log("\n=== RECENT TOOL EXECUTION ERRORS ===\n");
const { data: toolErrs } = await supabase
  .from("agent_tool_executions")
  .select("tool_name, error_message, execution_ms, member_name, created_at")
  .eq("status", "error")
  .eq("member_name", "anthony")
  .order("created_at", { ascending: false })
  .limit(15);

(toolErrs || []).forEach(t => {
  console.log("[" + t.created_at.substring(0, 19) + "] " + t.tool_name + " (" + t.execution_ms + "ms)");
  console.log("  Error:", t.error_message?.substring(0, 300));
  console.log("");
});
