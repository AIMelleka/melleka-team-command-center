const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SLACK_API_BASE = "https://slack.com/api";

const REQUIRED_SCOPES = [
  "channels:read",
  "channels:history",
  "groups:read",
  "groups:history",
];

interface SlackRequest {
  clientName: string;
  channelName?: string;
  startDate?: string;
  endDate?: string;
}

interface SlackChannel {
  id: string;
  name: string;
}

interface SlackMessage {
  ts: string;
  text: string;
  user?: string;
  thread_ts?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawToken = Deno.env.get("SLACK_BOT_TOKEN");
    if (!rawToken) {
      return json(
        { success: false, error: "SLACK_BOT_TOKEN is not configured" },
        200,
      );
    }

    // Common copy/paste issue: token wrapped in quotes
    const SLACK_BOT_TOKEN = rawToken.trim().replace(/^"|"$/g, "");

    // Basic token shape hint (do not log token)
    if (!SLACK_BOT_TOKEN.startsWith("xoxb-") && !SLACK_BOT_TOKEN.startsWith("xoxp-") && !SLACK_BOT_TOKEN.startsWith("xapp-")) {
      return json(
        {
          success: false,
          error:
            'Slack token format looks wrong. Please use a Slack token that starts with "xoxb-" (Bot User OAuth Token).',
        },
        200,
      );
    }

    const body: SlackRequest = await req.json();
    const { clientName, channelName, startDate, endDate } = body;

    if (!clientName) {
      return new Response(
        JSON.stringify({ error: "Client name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Fetching Slack messages for client: ${clientName}`);

    // Step 0: Validate token works (gives clearer errors than failing later)
    const authTest = await slackGet("auth.test", SLACK_BOT_TOKEN);
    if (!authTest.ok) {
      const slackErr = authTest.data?.error || "unknown_error";
      const baseMsg =
        slackErr === "invalid_auth"
          ? "Slack returned invalid_auth. The token is invalid, revoked, or for a different workspace/app."
          : slackErr === "not_authed"
            ? "Slack returned not_authed. No token was received by Slack."
            : `Slack auth failed: ${slackErr}`;

      return json(
        {
          success: false,
          error: `${baseMsg} Please paste a valid Bot User OAuth Token (xoxb-...) and ensure the Slack app is installed to the workspace.`,
          requiredScopes: REQUIRED_SCOPES,
          slackError: slackErr,
        },
        200,
      );
    }

    // Step 1: Get list of channels
    const channelsResult = await slackGet(
      "conversations.list",
      SLACK_BOT_TOKEN,
      {
        types: "public_channel,private_channel",
        limit: "200",
        exclude_archived: "true",
      },
    );

    if (!channelsResult.ok) {
      const slackErr = channelsResult.data?.error || "unknown_error";
      return json(
        {
          success: false,
          error: `Slack channels lookup failed: ${slackErr}`,
          requiredScopes: REQUIRED_SCOPES,
          slackError: slackErr,
        },
        200,
      );
    }

    const channelsData = channelsResult.data;

    // Step 2: Find channels matching client name (fuzzy match)
    const clientNameLower = clientName.toLowerCase();
    const clientAliases = generateClientAliases(clientName);
    
    const matchingChannels: SlackChannel[] = (channelsData.channels || []).filter((channel: SlackChannel) => {
      const channelNameLower = channel.name.toLowerCase();
      return clientAliases.some(alias => 
        channelNameLower.includes(alias) || alias.includes(channelNameLower)
      );
    });

    if (matchingChannels.length === 0) {
      console.log(`No Slack channels found for client: ${clientName}`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          messages: [],
          channelsSearched: 0,
          note: `No Slack channels found matching "${clientName}"`
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${matchingChannels.length} matching channels: ${matchingChannels.map(c => c.name).join(', ')}`);

    // Step 3: Fetch messages from matching channels
    const allMessages: Array<{ channel: string; message: string; timestamp: string; user?: string }> = [];
    
    // Calculate date range timestamps
    const oldest = startDate ? Math.floor(new Date(startDate).getTime() / 1000).toString() : undefined;
    const latest = endDate ? Math.floor(new Date(endDate + 'T23:59:59').getTime() / 1000).toString() : undefined;

    for (const channel of matchingChannels.slice(0, 5)) { // Limit to 5 channels
      try {
        const historyResult = await slackGet(
          "conversations.history",
          SLACK_BOT_TOKEN,
          {
            channel: channel.id,
            limit: "50",
            ...(oldest ? { oldest } : {}),
            ...(latest ? { latest } : {}),
          },
        );

        if (historyResult.ok && historyResult.data?.messages) {
          const messagesData = historyResult.data;
          for (const msg of messagesData.messages) {
            if (msg.text && !msg.subtype) { // Skip system messages
              allMessages.push({
                channel: channel.name,
                message: msg.text,
                timestamp: new Date(parseFloat(msg.ts) * 1000).toISOString(),
                user: msg.user,
              });
            }
          }
        } else if (!historyResult.ok) {
          console.error(
            `Slack history error for #${channel.name}: ${historyResult.data?.error || "unknown_error"}`,
          );
        }
      } catch (channelError) {
        console.error(`Error fetching messages from channel ${channel.name}:`, channelError);
      }
    }

    // Sort by timestamp descending
    allMessages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    console.log(`Successfully fetched ${allMessages.length} messages from ${matchingChannels.length} channels`);

    return json(
      {
        success: true,
        messages: allMessages,
        channelsSearched: matchingChannels.length,
        channelNames: matchingChannels.map((c) => c.name),
        requiredScopes: REQUIRED_SCOPES,
      },
      200,
    );
  } catch (error) {
    console.error("Error in fetch-slack-messages:", error);
    return json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      200,
    );
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function slackGet(
  method: string,
  token: string,
  query?: Record<string, string>,
): Promise<{ ok: boolean; data: any }>
{
  const url = new URL(`${SLACK_API_BASE}/${method}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = { ok: false, error: `non_json_response_${res.status}` };
  }

  return { ok: Boolean(data?.ok), data };
}

// Generate client name aliases for fuzzy matching
function generateClientAliases(clientName: string): string[] {
  const name = clientName.toLowerCase();
  const aliases = [name];
  
  // Add common abbreviations
  const words = name.split(/\s+/);
  if (words.length > 1) {
    // Initials
    aliases.push(words.map(w => w[0]).join(''));
    // First word
    aliases.push(words[0]);
    // Without common suffixes
    const withoutSuffixes = name.replace(/\s+(inc|llc|ltd|corp|company|co|foundation|group|services)\.?$/i, '');
    if (withoutSuffixes !== name) {
      aliases.push(withoutSuffixes);
    }
  }
  
  // Add hyphenated version
  aliases.push(name.replace(/\s+/g, '-'));
  // Add underscore version
  aliases.push(name.replace(/\s+/g, '_'));
  // Add no-space version
  aliases.push(name.replace(/\s+/g, ''));
  
  return [...new Set(aliases)];
}
