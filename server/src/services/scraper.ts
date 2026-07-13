import * as cheerio from "cheerio";

const MAX_CONTENT_LENGTH = 50_000; // 50K chars max per scraped page

/**
 * Scrape a URL and extract readable text content.
 * Removes scripts, styles, nav, footer, and other non-content elements.
 */
export async function scrapeUrl(url: string): Promise<{ title: string; content: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000); // 15s timeout

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "MellekaBot/1.0 (team context scraper)",
        "Accept": "text/html,application/xhtml+xml,*/*",
      },
      signal: controller.signal,
      redirect: "follow",
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
      // For non-HTML, just return raw text
      const text = await res.text();
      return { title: url, content: text.slice(0, MAX_CONTENT_LENGTH) };
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    // Remove non-content elements
    $("script, style, nav, footer, header, aside, iframe, noscript, svg, [role='navigation'], [role='banner'], [role='contentinfo']").remove();

    const title = $("title").text().trim() || $("h1").first().text().trim() || url;

    // Extract main content area if available, otherwise use body
    const mainContent = $("main, article, [role='main'], .content, #content").first();
    const contentEl = mainContent.length ? mainContent : $("body");

    // Get text, clean up whitespace
    let content = contentEl.text()
      .replace(/\s+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    if (content.length > MAX_CONTENT_LENGTH) {
      content = content.slice(0, MAX_CONTENT_LENGTH) + "\n[...truncated]";
    }

    return { title, content };
  } finally {
    clearTimeout(timeout);
  }
}
