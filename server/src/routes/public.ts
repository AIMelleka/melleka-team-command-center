import { Router } from "express";
import { supabase } from "../services/supabase.js";

const router = Router();

// ── Data endpoints ─────────────────────────────────────────────────────

/**
 * GET /api/public/proposals/:slug
 * Public endpoint — no auth required.
 */
router.get("/proposals/:slug", async (req, res) => {
  const { slug } = req.params;
  if (!slug || typeof slug !== "string") {
    res.status(400).json({ error: "slug is required" });
    return;
  }

  const { data, error } = await supabase
    .from("proposals")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("[public/proposals] Error fetching proposal:", error.message);
    res.status(500).json({ error: "Failed to load proposal" });
    return;
  }
  if (!data) {
    res.status(404).json({ error: "Proposal not found" });
    return;
  }

  res.json({ proposal: data });
});

/**
 * GET /api/public/decks/:slug
 * Public endpoint — no auth required.
 */
router.get("/decks/:slug", async (req, res) => {
  const { slug } = req.params;
  if (!slug || typeof slug !== "string") {
    res.status(400).json({ error: "slug is required" });
    return;
  }

  const { data, error } = await supabase
    .from("decks")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("[public/decks] Error fetching deck:", error.message);
    res.status(500).json({ error: "Failed to load deck" });
    return;
  }
  if (!data) {
    res.status(404).json({ error: "Deck not found" });
    return;
  }

  res.json({ deck: data });
});

// ── SEO / OG meta tags for social sharing ──────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * GET /api/public/og/proposals/:slug
 * Returns HTML with dynamic OG meta tags for social crawlers.
 */
router.get("/og/proposals/:slug", async (req, res) => {
  const { slug } = req.params;
  const { data } = await supabase
    .from("proposals")
    .select("title, client_name, content")
    .eq("slug", slug)
    .maybeSingle();

  const clientName = data?.client_name || "Client";
  const title = data?.title || `${clientName} — Marketing Proposal`;
  const content = (data?.content || {}) as Record<string, any>;
  const summary = content.executiveSummary?.overview || "";
  const description = summary
    ? summary.slice(0, 200)
    : `Custom marketing strategy prepared for ${clientName} by Melleka Marketing.`;

  const origin = req.query.origin as string || "https://teams.melleka.com";
  const pageUrl = `${origin}/proposal/${slug}`;
  const ogImageUrl = `${req.protocol}://${req.get("host")}/api/public/og-image/proposals/${slug}`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400");
  res.send(`<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/>
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}"/>
<meta property="og:type" content="website"/>
<meta property="og:title" content="${esc(title)}"/>
<meta property="og:description" content="${esc(description)}"/>
<meta property="og:image" content="${esc(ogImageUrl)}"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>
<meta property="og:url" content="${esc(pageUrl)}"/>
<meta property="og:site_name" content="Melleka Marketing"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${esc(title)}"/>
<meta name="twitter:description" content="${esc(description)}"/>
<meta name="twitter:image" content="${esc(ogImageUrl)}"/>
</head><body></body></html>`);
});

/**
 * GET /api/public/og/decks/:slug
 * Returns HTML with dynamic OG meta tags for deck sharing.
 */
router.get("/og/decks/:slug", async (req, res) => {
  const { slug } = req.params;
  const { data } = await supabase
    .from("decks")
    .select("title, client_name, content")
    .eq("slug", slug)
    .maybeSingle();

  const clientName = data?.client_name || "Client";
  const title = data?.title || `${clientName} — Performance Report`;
  const description = `Performance report for ${clientName} by Melleka Marketing.`;

  const origin = req.query.origin as string || "https://teams.melleka.com";
  const pageUrl = `${origin}/deck/${slug}`;
  const ogImageUrl = `${req.protocol}://${req.get("host")}/api/public/og-image/decks/${slug}`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400");
  res.send(`<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/>
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}"/>
<meta property="og:type" content="website"/>
<meta property="og:title" content="${esc(title)}"/>
<meta property="og:description" content="${esc(description)}"/>
<meta property="og:image" content="${esc(ogImageUrl)}"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>
<meta property="og:url" content="${esc(pageUrl)}"/>
<meta property="og:site_name" content="Melleka Marketing"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${esc(title)}"/>
<meta name="twitter:description" content="${esc(description)}"/>
<meta name="twitter:image" content="${esc(ogImageUrl)}"/>
</head><body></body></html>`);
});

// ── OG Image generation (SVG → served as image) ───────────────────────

/**
 * GET /api/public/og-image/proposals/:slug
 * Generates a branded OG image as SVG for the proposal.
 * Most social platforms accept SVG for og:image.
 */
router.get("/og-image/proposals/:slug", async (req, res) => {
  const { slug } = req.params;
  const { data } = await supabase
    .from("proposals")
    .select("client_name, content")
    .eq("slug", slug)
    .maybeSingle();

  const clientName = data?.client_name || "Client";
  const content = (data?.content || {}) as Record<string, any>;
  const brand = content.brandStyles || content.proposalColors || {};
  const rawColor = brand.primaryColor || brand.primary || "#8B5CF6";
  const color = rawColor.replace("#", "");
  const pType = content.proposalType || "marketing";
  const subtitle =
    pType === "website"
      ? "Website Design Proposal"
      : pType === "combined"
        ? "Marketing &amp; Website Proposal"
        : "Marketing Growth Strategy";
  const fontSize = clientName.length > 25 ? 48 : 60;
  const clientLogo = content.hero?.clientLogo;
  const logoY = clientLogo ? 100 : -999;
  const labelY = clientLogo ? 310 : 220;
  const nameY = clientLogo ? 380 : 300;
  const dividerY = clientLogo ? 405 : 325;
  const subtitleY = clientLogo ? 450 : 370;

  const logoBlock = clientLogo
    ? `<image href="${esc(clientLogo)}" x="520" y="${logoY}" width="160" height="160" preserveAspectRatio="xMidYMid meet"/>`
    : "";

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f0f14"/>
      <stop offset="50%" stop-color="#1a1a2e"/>
      <stop offset="100%" stop-color="#1a1a2e"/>
    </linearGradient>
    <radialGradient id="g1" cx="85%" cy="15%" r="35%">
      <stop offset="0%" stop-color="#${esc(color)}" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#${esc(color)}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="g2" cx="15%" cy="85%" r="30%">
      <stop offset="0%" stop-color="#${esc(color)}" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="#${esc(color)}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#g1)"/>
  <rect width="1200" height="630" fill="url(#g2)"/>
  <rect x="0" y="0" width="1200" height="4" fill="#${esc(color)}" opacity="0.7"/>
  ${logoBlock}
  <text x="600" y="${labelY}" text-anchor="middle" fill="#${esc(color)}" font-family="system-ui,-apple-system,Segoe UI,sans-serif" font-size="18" font-weight="600" letter-spacing="4">PREPARED FOR</text>
  <text x="600" y="${nameY}" text-anchor="middle" fill="#ffffff" font-family="system-ui,-apple-system,Segoe UI,sans-serif" font-size="${fontSize}" font-weight="800">${esc(clientName)}</text>
  <rect x="560" y="${dividerY}" width="80" height="4" rx="2" fill="#${esc(color)}" opacity="0.7"/>
  <text x="600" y="${subtitleY}" text-anchor="middle" fill="#a0a0b8" font-family="system-ui,-apple-system,Segoe UI,sans-serif" font-size="26" font-weight="500">${subtitle}</text>
  <text x="600" y="590" text-anchor="middle" fill="#555570" font-family="system-ui,-apple-system,Segoe UI,sans-serif" font-size="16" font-weight="500">Melleka Marketing</text>
</svg>`;

  res.setHeader("Content-Type", "image/svg+xml");
  res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=604800");
  res.send(svg);
});

export default router;
