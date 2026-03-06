import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callClaude, callClaudeVision } from "../_shared/claude.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SocialAccount { platform: string; handle: string; url: string; igBusinessId?: string; fbPageId?: string; }
interface ScrapeRequest { action: "scrape-posts" | "save-accounts" | "get-accounts" | "extract-from-screenshot" | "fetch-meta-posts" | "list-meta-pages"; clientName: string; socialAccounts?: SocialAccount[]; clientProfileId?: string; screenshotUrl?: string; platform?: string; handle?: string; }

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const json = (d: any, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const body: ScrapeRequest = await req.json();
    const { action, clientName } = body;

    if (action === "get-accounts") {
      const { data: profile } = await supabase.from("client_profiles").select("id, social_accounts").ilike("client_name", clientName).single();
      return json({ success: true, profileId: profile?.id || null, socialAccounts: profile?.social_accounts || [] });
    }

    if (action === "save-accounts") {
      const { socialAccounts } = body;
      if (!socialAccounts?.length) return json({ success: false, error: "No accounts provided" }, 400);
      const { data: existing } = await supabase.from("client_profiles").select("id").ilike("client_name", clientName).single();
      let profileId: string;
      if (existing) {
        await supabase.from("client_profiles").update({ social_accounts: socialAccounts }).eq("id", existing.id);
        profileId = existing.id;
      } else {
        const { data: n, error } = await supabase.from("client_profiles").insert({ client_name: clientName, social_accounts: socialAccounts }).select("id").single();
        if (error) throw error;
        profileId = n!.id;
      }
      return json({ success: true, profileId });
    }

    // NEW: Extract posts from a user-uploaded screenshot using Claude Vision
    if (action === "extract-from-screenshot") {
      const { screenshotUrl, platform, handle } = body;
      if (!screenshotUrl) return json({ success: false, error: "No screenshot URL" }, 400);
      const posts = await extractPostsFromScreenshot(screenshotUrl, platform || "unknown", handle || "unknown");
      return json({ success: true, posts, totalPosts: posts.length });
    }

    // Meta Graph API: List connected pages/IG accounts
    if (action === "list-meta-pages") {
      const token = Deno.env.get("META_ACCESS_TOKEN");
      if (!token) return json({ success: false, error: "META_ACCESS_TOKEN not configured" }, 500);
      // Debug: check token info
      let tokenDebug: any = null;
      try {
        const debugRes = await fetch(`https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${token}`);
        const debugData = await debugRes.json();
        const permRes = await fetch(`https://graph.facebook.com/v21.0/me/permissions?access_token=${token}`);
        const permData = await permRes.json();
        tokenDebug = { user: debugData, permissions: permData.data };
      } catch (e) { tokenDebug = { error: String(e) }; }
      const pages = await listMetaPages(token);
      return json({ success: true, pages, tokenDebug });
    }

    // Meta Graph API: Fetch posts for Instagram/Facebook
    if (action === "fetch-meta-posts") {
      const token = Deno.env.get("META_ACCESS_TOKEN");
      if (!token) return json({ success: false, error: "META_ACCESS_TOKEN not configured" }, 500);
      const { socialAccounts, clientProfileId } = body;
      if (!socialAccounts?.length) return json({ success: false, error: "No accounts" }, 400);

      const allPosts: any[] = [];
      const accountResults: any[] = [];

      for (const account of socialAccounts) {
        try {
          let posts: any[] = [];
          if (account.platform === "instagram" && account.igBusinessId) {
            posts = await fetchInstagramPosts(token, account.igBusinessId, account.handle);
          } else if (account.platform === "facebook" && account.fbPageId) {
            posts = await fetchFacebookPosts(token, account.fbPageId, account.handle);
          }
          allPosts.push(...posts);
          accountResults.push({ platform: account.platform, handle: account.handle, status: posts.length > 0 ? "success" : "no_posts", postCount: posts.length });
        } catch (err) {
          console.error(`Meta API error for ${account.handle}:`, err);
          accountResults.push({ platform: account.platform, handle: account.handle, status: "failed", postCount: 0, error: err instanceof Error ? err.message : "Unknown error" });
        }
      }

      if (clientProfileId && allPosts.length > 0) {
        const platforms = [...new Set(allPosts.map(p => p.platform))];
        for (const plat of platforms) {
          await supabase.from("social_media_posts").delete().eq("client_profile_id", clientProfileId).eq("platform", plat);
        }
        const rows = allPosts.map(p => ({ client_profile_id: clientProfileId, platform: p.platform, post_url: p.postUrl || null, post_date: p.postDate || null, content_type: p.contentType || "image", caption: p.caption || null, thumbnail_url: p.thumbnailUrl || null, image_url: p.imageUrl || null, likes: p.likes || 0, comments: p.comments || 0, shares: p.shares || 0, saves: p.saves || 0, reach: p.reach || 0, impressions: p.impressions || 0, engagement_rate: p.engagementRate || 0, video_views: p.videoViews || 0, raw_data: p }));
        await supabase.from("social_media_posts").insert(rows);
      }

      return json({ success: true, posts: allPosts, totalPosts: allPosts.length, accountResults });
    }

    if (action === "scrape-posts") {
      const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
      if (!firecrawlKey) return json({ success: false, error: "FIRECRAWL_API_KEY not configured" }, 500);
      const { socialAccounts, clientProfileId } = body;
      if (!socialAccounts?.length) return json({ success: false, error: "No social accounts to scrape" }, 400);

      const allPosts: any[] = [];
      const accountResults: any[] = [];

      for (const account of socialAccounts) {
        if (!account.url) { accountResults.push({ platform: account.platform, handle: account.handle, status: "failed", postCount: 0, error: "No URL" }); continue; }
        try {
          console.log(`Scraping ${account.platform}: ${account.url}`);
          let posts: any[] = [];

          // Strategy 1: Firecrawl with screenshot priority
          const r = await callFirecrawl(firecrawlKey, account.url, account.platform);
          
          // Strategy 2: Parse markdown if available
          if (!r.blocked && r.markdown) {
            posts = await parsePostsWithAI(r.markdown, account.platform, account.handle, r.screenshot || "");
          }

          // Strategy 3: If markdown parsing failed but we have a screenshot, use Vision
          if (posts.length === 0 && r.screenshot) {
            console.log(`Markdown parse failed for ${account.platform}, trying Vision extraction from screenshot`);
            posts = await extractPostsFromScreenshot(r.screenshot, account.platform, account.handle);
          }

          // Strategy 4: Try mobile URL variant
          if (posts.length === 0 && account.platform === "instagram") {
            const mobileUrl = account.url.replace("www.instagram.com", "m.instagram.com");
            const r2 = await callFirecrawl(firecrawlKey, mobileUrl, account.platform);
            if (!r2.blocked && r2.markdown) {
              posts = await parsePostsWithAI(r2.markdown, account.platform, account.handle, r2.screenshot || "");
            }
            if (posts.length === 0 && r2.screenshot) {
              posts = await extractPostsFromScreenshot(r2.screenshot, account.platform, account.handle);
            }
          }

          // Strategy 5: If everything failed but we have a screenshot, return it as visual reference
          const screenshot = r.screenshot || "";
          if (posts.length === 0 && screenshot) {
            posts = [{ platform: account.platform, handle: account.handle, caption: `${account.platform} profile screenshot captured`, thumbnailUrl: screenshot, imageUrl: screenshot, likes: 0, comments: 0, shares: 0, saves: 0, reach: 0, impressions: 0, engagementRate: 0, videoViews: 0, contentType: "screenshot" }];
          }

          allPosts.push(...posts);
          accountResults.push({ platform: account.platform, handle: account.handle, status: posts.length > 0 ? (posts[0]?.contentType === "screenshot" ? "partial" : "success") : "failed", postCount: posts.length, error: posts.length === 0 ? `${account.platform} blocked access — try uploading a screenshot instead` : undefined });
        } catch (err) {
          console.error(`Error scraping ${account.platform}:`, err);
          accountResults.push({ platform: account.platform, handle: account.handle, status: "failed", postCount: 0, error: "Failed — try uploading a screenshot instead" });
        }
      }

      if (clientProfileId && allPosts.length > 0) {
        await supabase.from("social_media_posts").delete().eq("client_profile_id", clientProfileId);
        const rows = allPosts.map(p => ({ client_profile_id: clientProfileId, platform: p.platform, post_url: p.postUrl || null, post_date: p.postDate || null, content_type: p.contentType || "image", caption: p.caption || null, thumbnail_url: p.thumbnailUrl || null, image_url: p.imageUrl || null, likes: p.likes || 0, comments: p.comments || 0, shares: p.shares || 0, saves: p.saves || 0, reach: p.reach || 0, impressions: p.impressions || 0, engagement_rate: p.engagementRate || 0, video_views: p.videoViews || 0, raw_data: p }));
        const { error } = await supabase.from("social_media_posts").insert(rows);
        if (error) console.error("Insert error:", error);
      }

      return json({ success: true, posts: allPosts, totalPosts: allPosts.length, accountResults });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("Social media scrape error:", err);
    return json({ success: false, error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});

async function callFirecrawl(apiKey: string, url: string, platform: string): Promise<{ markdown?: string; screenshot?: string; blocked: boolean }> {
  const body: any = { url, formats: ["markdown", "screenshot"], waitFor: 8000, timeout: 45000 };
  if (["instagram", "tiktok", "facebook"].includes(platform)) {
    body.actions = [
      { type: "wait", milliseconds: 4000 },
      { type: "scroll", direction: "down", amount: 1500 },
      { type: "wait", milliseconds: 2000 },
      { type: "scroll", direction: "down", amount: 1500 },
      { type: "wait", milliseconds: 2000 },
      { type: "screenshot" },
    ];
    // Use stealth headers
    body.headers = {
      "Accept-Language": "en-US,en;q=0.9",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 50000);

    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const errText = await res.text().catch(() => "unknown");
      console.error(`[FIRECRAWL] ${platform} ${res.status}: ${errText.slice(0, 300)}`);
      // 402 = credits exhausted, 429 = rate limit — worth distinguishing
      if (res.status === 402) return { blocked: true, markdown: undefined, screenshot: undefined };
      if (res.status === 429) {
        console.warn(`[FIRECRAWL] Rate limited on ${platform}, waiting 5s...`);
        await new Promise(r => setTimeout(r, 5000));
      }
      return { blocked: true };
    }

    const data = await res.json();
    const md = data?.data?.markdown;
    const ss = data?.data?.screenshot || data?.data?.actions?.screenshots?.[0];
    console.log(`[FIRECRAWL] ${platform}: markdown=${md ? md.length + ' chars' : 'none'}, screenshot=${ss ? 'yes' : 'no'}`);

    // Check if we got a login/block page instead of real content
    const isLoginPage = md && (
      md.includes("Log in") && md.includes("Sign up") && md.length < 2000 ||
      md.includes("Create an account") && md.length < 1500
    );
    if (isLoginPage) {
      console.warn(`[FIRECRAWL] ${platform}: got login/block page instead of profile`);
      return { markdown: undefined, screenshot: ss || undefined, blocked: true };
    }

    return { markdown: md || undefined, screenshot: ss || undefined, blocked: false };
  } catch (err) {
    console.error(`[FIRECRAWL] ${platform} fetch error:`, err instanceof Error ? err.message : err);
    return { blocked: true };
  }
}

async function extractPostsFromScreenshot(screenshotUrl: string, platform: string, handle: string): Promise<any[]> {
  const prompt = `You are analyzing a screenshot of a ${platform} social media profile for @${handle}.
Extract every visible post from this screenshot. For each post provide:
- postDate (if visible, else null)
- contentType: "image", "video", "carousel", or "reel"
- caption (first 200 chars if visible)
- likes, comments, shares, saves, videoViews (numbers, use 0 if not visible)
- engagementRate (decimal, 0 if unknown)
- imageUrl: null (since we can't extract from screenshot)
Return a JSON array. Return [] only if you truly cannot identify any posts.
Be generous - even grid thumbnails with like counts are posts.`;

  try {
    // Convert image to base64 for Claude vision API (handles both URL and base64 input)
    const { urlToBase64ImageBlock } = await import('../_shared/claude.ts');
    const imageBlock = await urlToBase64ImageBlock(screenshotUrl);

    const text = await callClaude('', {
      temperature: 0.1,
      messages: [{ role: 'user', content: [imageBlock, { type: 'text', text: prompt }] }],
    });

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    const posts = JSON.parse(jsonMatch[0]);
    return (Array.isArray(posts) ? posts : []).map((p: any) => ({ ...p, platform, handle, thumbnailUrl: screenshotUrl.startsWith("http") ? screenshotUrl : null }));
  } catch (err) { console.error("Vision extraction error:", err); return []; }
}

async function fallbackVisionExtraction(screenshotUrl: string, platform: string, handle: string): Promise<any[]> {
  if (!screenshotUrl.startsWith("http")) return [];

  try {
    // Download image and convert to base64
    const imgRes = await fetch(screenshotUrl);
    if (!imgRes.ok) return [];
    const imgBuf = await imgRes.arrayBuffer();
    const uint8 = new Uint8Array(imgBuf).slice(0, 500000);
    let binary = "";
    for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
    const base64 = btoa(binary);

    const text = await callClaudeVision(
      `Extract social media posts from this ${platform} screenshot for @${handle}. Return JSON array with: postDate, contentType, caption (200 chars), likes, comments, shares, saves, videoViews, engagementRate. Use 0 for unknowns. Return [] if no posts visible.`,
      base64,
      'image/png',
      { temperature: 0.1 }
    );

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    const posts = JSON.parse(jsonMatch[0]);
    return (Array.isArray(posts) ? posts : []).map((p: any) => ({ ...p, platform, handle }));
  } catch (err) { console.error("Vision fallback error:", err); return []; }
}

async function parsePostsWithAI(markdown: string, platform: string, handle: string, screenshotUrl: string): Promise<any[]> {
  const prompt = `Parse this scraped ${platform} page for @${handle}. Extract up to 10 recent posts as JSON array.
Each post: { postDate, contentType, caption (200 chars max), imageUrl, likes, comments, shares, saves, reach, impressions, videoViews, engagementRate, postUrl }. Use 0 for unknowns, null for missing strings. Return [] if no posts found.
CONTENT:
${markdown.slice(0, 8000)}`;
  try {
    const text = await callClaude(prompt, { temperature: 0.1 });
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    const posts = JSON.parse(jsonMatch[0]);
    return (Array.isArray(posts) ? posts : []).map((p: any) => ({ ...p, platform, handle, thumbnailUrl: p.imageUrl || screenshotUrl || null }));
  } catch (err) { console.error("AI parse error:", err); return []; }
}

// ============ META GRAPH API ============

async function listMetaPages(token: string): Promise<any[]> {
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,profile_picture_url,followers_count,media_count}&access_token=${token}`);
    if (!res.ok) { const e = await res.text(); console.error("Meta pages error:", e); return []; }
    const data = await res.json();
    return (data.data || []).map((page: any) => ({
      pageId: page.id, pageName: page.name, pageAccessToken: page.access_token,
      instagram: page.instagram_business_account ? {
        igBusinessId: page.instagram_business_account.id, username: page.instagram_business_account.username,
        profilePicture: page.instagram_business_account.profile_picture_url, followers: page.instagram_business_account.followers_count, mediaCount: page.instagram_business_account.media_count,
      } : null,
    }));
  } catch (err) { console.error("listMetaPages error:", err); return []; }
}

async function fetchInstagramPosts(token: string, igBusinessId: string, handle: string): Promise<any[]> {
  try {
    const fields = "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count";
    const res = await fetch(`https://graph.facebook.com/v21.0/${igBusinessId}/media?fields=${fields}&limit=25&access_token=${token}`);
    if (!res.ok) { const e = await res.text(); console.error(`IG posts error: ${e}`); return []; }
    const data = await res.json();
    const posts: any[] = [];
    for (const post of (data.data || [])) {
      let reach = 0, impressions = 0, saves = 0;
      try {
        const metrics = post.media_type === "VIDEO" || post.media_type === "REEL" ? "reach,impressions,saved,video_views" : "reach,impressions,saved";
        const iRes = await fetch(`https://graph.facebook.com/v21.0/${post.id}/insights?metric=${metrics}&access_token=${token}`);
        if (iRes.ok) { const iData = await iRes.json(); for (const m of (iData.data || [])) { if (m.name === "reach") reach = m.values?.[0]?.value || 0; if (m.name === "impressions") impressions = m.values?.[0]?.value || 0; if (m.name === "saved") saves = m.values?.[0]?.value || 0; } }
      } catch (_) {}
      posts.push({ platform: "instagram", handle, postUrl: post.permalink, postDate: post.timestamp, contentType: post.media_type === "VIDEO" ? "video" : post.media_type === "CAROUSEL_ALBUM" ? "carousel" : "image", caption: (post.caption || "").slice(0, 500), imageUrl: post.media_url || null, thumbnailUrl: post.thumbnail_url || post.media_url || null, likes: post.like_count || 0, comments: post.comments_count || 0, shares: 0, saves, reach, impressions, engagementRate: reach > 0 ? ((post.like_count + post.comments_count + saves) / reach) * 100 : 0, videoViews: 0 });
    }
    console.log(`[META] Instagram @${handle}: ${posts.length} posts`);
    return posts;
  } catch (err) { console.error("fetchInstagramPosts error:", err); return []; }
}

async function fetchFacebookPosts(token: string, pageId: string, handle: string): Promise<any[]> {
  try {
    const pRes = await fetch(`https://graph.facebook.com/v21.0/${pageId}?fields=access_token&access_token=${token}`);
    if (!pRes.ok) return [];
    const pageToken = (await pRes.json()).access_token || token;
    const res = await fetch(`https://graph.facebook.com/v21.0/${pageId}/posts?fields=id,message,full_picture,permalink_url,created_time,shares,type&limit=25&access_token=${pageToken}`);
    if (!res.ok) { const e = await res.text(); console.error(`FB posts error: ${e}`); return []; }
    const data = await res.json();
    const posts: any[] = [];
    for (const post of (data.data || [])) {
      let likes = 0, comments = 0;
      try { const eRes = await fetch(`https://graph.facebook.com/v21.0/${post.id}?fields=reactions.summary(true),comments.summary(true)&access_token=${pageToken}`); if (eRes.ok) { const eData = await eRes.json(); likes = eData.reactions?.summary?.total_count || 0; comments = eData.comments?.summary?.total_count || 0; } } catch (_) {}
      posts.push({ platform: "facebook", handle, postUrl: post.permalink_url, postDate: post.created_time, contentType: post.type === "video" ? "video" : "image", caption: (post.message || "").slice(0, 500), imageUrl: post.full_picture || null, thumbnailUrl: post.full_picture || null, likes, comments, shares: post.shares?.count || 0, saves: 0, reach: 0, impressions: 0, engagementRate: 0, videoViews: 0 });
    }
    console.log(`[META] Facebook ${handle}: ${posts.length} posts`);
    return posts;
  } catch (err) { console.error("fetchFacebookPosts error:", err); return []; }
}
