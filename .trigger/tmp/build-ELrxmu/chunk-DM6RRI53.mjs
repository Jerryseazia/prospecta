import {
  task
} from "./chunk-IAPM2DTR.mjs";
import {
  __name,
  init_esm
} from "./chunk-3R76H35D.mjs";

// trigger/scrape-url.ts
init_esm();
var SKIP_DOMAINS = [
  "avvo.com",
  "findlaw.com",
  "justia.com",
  "lawyers.com",
  "martindale.com",
  "legalmatch.com",
  "nolo.com",
  "law.com"
];
var scrapeUrl = task({
  id: "scrape-url",
  retry: { maxAttempts: 2, minTimeoutInMs: 3e3 },
  run: /* @__PURE__ */ __name(async (payload) => {
    const { url, query } = payload;
    if (SKIP_DOMAINS.some((d) => url.includes(d))) {
      return { url, skipped: true, reason: "blocked domain", text: "", title: "" };
    }
    let html;
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"
        },
        signal: AbortSignal.timeout(12e3)
      });
      if (!res.ok) return { url, skipped: true, reason: `HTTP ${res.status}`, text: "", title: "" };
      html = await res.text();
    } catch (err) {
      return { url, skipped: true, reason: err.message, text: "", title: "" };
    }
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace(/&amp;/g, "&").trim() : "";
    const cleaned = html.replace(/<(script|style|nav|footer|header|aside|form)[^>]*>[\s\S]*?<\/\1>/gi, "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, 6e3);
    return { url, skipped: false, title, text: cleaned, reason: null };
  }, "run")
});

export {
  scrapeUrl
};
//# sourceMappingURL=chunk-DM6RRI53.mjs.map
