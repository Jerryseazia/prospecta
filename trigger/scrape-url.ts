import { task } from "@trigger.dev/sdk";
import { z } from "zod";

const SKIP_DOMAINS = [
  "avvo.com", "findlaw.com", "justia.com", "lawyers.com",
  "martindale.com", "legalmatch.com", "nolo.com", "law.com",
];

export const scrapeUrl = task({
  id: "scrape-url",
  retry: { maxAttempts: 2, minTimeoutInMs: 3_000 },

  run: async (payload: { url: string; query: string }) => {
    const { url, query } = payload;

    // Skip directories and law firm listing sites
    if (SKIP_DOMAINS.some((d) => url.includes(d))) {
      return { url, skipped: true, reason: "blocked domain", text: "", title: "" };
    }

    let html: string;
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        },
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) return { url, skipped: true, reason: `HTTP ${res.status}`, text: "", title: "" };
      html = await res.text();
    } catch (err: any) {
      return { url, skipped: true, reason: err.message, text: "", title: "" };
    }

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace(/&amp;/g, "&").trim() : "";

    // Strip scripts, styles, nav, footer
    const cleaned = html
      .replace(/<(script|style|nav|footer|header|aside|form)[^>]*>[\s\S]*?<\/\1>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&nbsp;/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim()
      .slice(0, 6000);

    return { url, skipped: false, title, text: cleaned, reason: null };
  },
});
