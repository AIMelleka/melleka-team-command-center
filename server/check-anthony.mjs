import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data: convs } = await supabase
  .from("team_conversations")
  .select("id, title, updated_at")
  .eq("member_name", "anthony")
  .order("updated_at", { ascending: false })
  .limit(5);

if (!convs || convs.length === 0) { console.log("No convs"); process.exit(); }
convs.forEach(c => console.log(c.id, "|", c.title, "|", c.updated_at));

for (const conv of convs.slice(0, 3)) {
  console.log("\n========================================");
  console.log("Conversation:", conv.title, "| Updated:", conv.updated_at);
  console.log("========================================");

  const { data: msgs } = await supabase
    .from("team_messages")
    .select("role, content, created_at")
    .eq("conversation_id", conv.id)
    .order("created_at", { ascending: false })
    .limit(10);

  if (msgs) {
    msgs.reverse().forEach(m => {
      const preview = (m.content || "(empty)").substring(0, 600);
      console.log("\n[" + m.created_at.substring(0, 19) + "] " + m.role.toUpperCase() + ":");
      console.log(preview);
      if (m.content && m.content.length > 600) console.log("... (" + m.content.length + " chars total)");
    });
  }
}
