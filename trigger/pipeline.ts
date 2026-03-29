import { schedules } from "@trigger.dev/sdk";
import { scrapeUrl } from "./scrape-url.js";
import { exportLead } from "./export-lead.js";

// ─── Search Queries ────────────────────────────────────────────────────────────

const SEARCH_QUERIES = [
  '"need a personal injury lawyer" OR "looking for injury attorney" site:reddit.com',
  '"slip and fall" "medical bills" OR "surgery" "need a lawyer" site:reddit.com',
  '"car accident" "insurance denied" OR "insurance won\'t pay" "do I need a lawyer" site:reddit.com',
  '"wrongful termination" "need a lawyer" OR "should I get an attorney" site:reddit.com',
  '"workers comp" "fired" OR "terminated" "retaliation" site:reddit.com',
];

const PRACTICE_AREAS = ["personal injury", "employment law"];
const MIN_URGENCY = 4;
const MAX_LEADS = 5;

// ─── Qualification Logic ───────────────────────────────────────────────────────

const PI_KEYWORDS = [
  "accident", "injury", "hurt", "hospital", "surgery", "slip and fall",
  "car accident", "malpractice", "settlement", "damages", "medical bills",
  "broken", "fracture", "spinal", "brain", "permanent", "rehab",
];

const EMPLOYMENT_KEYWORDS = [
  "fired", "terminated", "wrongful", "discrimination", "harassment",
  "wage", "overtime", "hostile", "retaliation", "workers comp",
  "eeoc", "layoff", "hr complaint",
];

const HIGH_VALUE_SIGNALS = [
  "surgery", "hospitalized", "permanent", "wrongful death", "spinal",
  "brain", "serious injury", "class action", "months of rehab",
];

const LOW_VALUE_SIGNALS = ["minor", "small", "fender bender", "scratches"];

const HIGH_URGENCY_SIGNALS = [
  "urgent", "asap", "just happened", "this week", "yesterday",
  "statute of limitations", "immediately",
];

const LOW_URGENCY_SIGNALS = ["years ago", "2020", "2021", "2022", "old case"];

function scoreRelevance(text: string): { score: number; area: string } {
  const t = text.toLowerCase();
  const piMatches = PI_KEYWORDS.filter((kw) => t.includes(kw)).length;
  const empMatches = EMPLOYMENT_KEYWORDS.filter((kw) => t.includes(kw)).length;

  if (piMatches >= empMatches) {
    return { score: Math.min(10, piMatches * 2), area: "personal injury" };
  }
  return { score: Math.min(10, empMatches * 2), area: "employment law" };
}

function scoreUrgency(text: string): number {
  const t = text.toLowerCase();
  if (HIGH_URGENCY_SIGNALS.some((kw) => t.includes(kw))) return 8;
  if (LOW_URGENCY_SIGNALS.some((kw) => t.includes(kw))) return 2;
  return 5; // default — recent post, exploring options
}

function estimateCaseValue(text: string): "high" | "medium" | "low" {
  const t = text.toLowerCase();
  if (HIGH_VALUE_SIGNALS.some((kw) => t.includes(kw))) return "high";
  if (LOW_VALUE_SIGNALS.some((kw) => t.includes(kw))) return "low";
  return "medium";
}

function buildSummary(text: string, url: string): string {
  // Take first 3 sentences of meaningful content after stripping common Reddit UI text
  const stripped = text
    .replace(/^(Go to|r\/|u\/|Posted by|Share|Read more|Comments?)[\s\S]*?\n/gm, "")
    .replace(/\n+/g, " ")
    .trim();
  const sentences = stripped.match(/[^.!?]+[.!?]+/g) ?? [];
  return sentences.slice(0, 3).join(" ").trim() || stripped.slice(0, 300);
}

function buildApproach(area: string, urgency: number, caseValue: string, text: string): string {
  const t = text.toLowerCase();
  const channel = "Reply to their Reddit post or send a DM";
  if (area === "personal injury") {
    if (caseValue === "high") {
      return `${channel}. Lead with the severity of their injury — mention that serious/permanent injuries are typically undervalued without legal representation, and insurers know it. Offer a free consult with no pressure.`;
    }
    return `${channel}. Acknowledge their situation and explain that insurance companies handle hundreds of these claims — having an attorney levels the playing field. Keep it conversational.`;
  }
  // employment law
  return `${channel}. Reference the specific situation (termination timing, injury context). Explain anti-retaliation statutes clearly — they likely don't know their rights. Offer a free 15-minute call.`;
}

// ─── SerpAPI Search ────────────────────────────────────────────────────────────

async function searchSerpApi(query: string): Promise<Array<{ url: string; title: string; snippet: string }>> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) throw new Error("SERPAPI_KEY not set");

  const params = new URLSearchParams({
    api_key: apiKey,
    engine: "google",
    q: query,
    num: "10",
    hl: "en",
    gl: "us",
  });

  const res = await fetch(`https://serpapi.com/search?${params}`, {
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) throw new Error(`SerpAPI error: ${res.status}`);
  const data = (await res.json()) as { organic_results?: any[] };

  return (data.organic_results ?? []).map((r: any) => ({
    url: r.link ?? "",
    title: r.title ?? "",
    snippet: r.snippet ?? "",
  }));
}

// ─── Main Pipeline ─────────────────────────────────────────────────────────────

export const leadPipeline = schedules.task({
  id: "lead-pipeline",
  cron: "0 8 * * *", // 8am UTC daily

  run: async () => {
    console.log("Starting Prospecta lead pipeline...");

    // 1. Search all queries
    const allResults: Array<{ url: string; title: string; snippet: string }> = [];
    for (const query of SEARCH_QUERIES) {
      try {
        const results = await searchSerpApi(query);
        console.log(`Query "${query.slice(0, 50)}..." → ${results.length} results`);
        allResults.push(...results);
      } catch (err: any) {
        console.error(`Search failed: ${err.message}`);
      }
    }

    // 2. Deduplicate URLs
    const seen = new Set<string>();
    const uniqueUrls = allResults
      .filter((r) => r.url && !seen.has(r.url) && seen.add(r.url))
      .slice(0, 30); // cap at 30 to stay within SerpAPI limits

    console.log(`Unique URLs to scrape: ${uniqueUrls.length}`);

    // 3. Scrape all URLs in parallel (batchTriggerAndWait)
    const scrapeResults = await scrapeUrl.batchTriggerAndWait(
      uniqueUrls.map((r) => ({ payload: { url: r.url, query: r.title } }))
    );

    // 4. Qualify each scraped result
    const qualified = [];
    for (const run of scrapeResults.runs) {
      if (!run.ok || run.output.skipped || !run.output.text) continue;

      const { url, text, title } = run.output;
      const { score: relevance, area } = scoreRelevance(text);
      const urgency = scoreUrgency(text);
      const caseValue = estimateCaseValue(text);
      const total = Math.round(((relevance * 0.3) + (urgency * 0.4) + (2 * 0.3)) * 10) / 10;

      if (relevance < 4 || urgency < MIN_URGENCY) continue;

      qualified.push({
        name: title.replace(" : r/legaladvice", "").replace(" - Reddit", "").trim(),
        source_url: url,
        signal_type: area === "employment law" ? "employment" : "injury",
        summary: buildSummary(text, url),
        practice_area: area,
        urgency_score: urgency,
        case_value_estimate: caseValue,
        total_score: total,
        location: "Unknown", // enrichment step would resolve this
        recommended_approach: buildApproach(area, urgency, caseValue, text),
      });
    }

    // Sort by total score descending, cap at MAX_LEADS
    qualified.sort((a, b) => b.total_score - a.total_score);
    const topLeads = qualified.slice(0, MAX_LEADS);
    console.log(`Qualified leads: ${qualified.length} → exporting top ${topLeads.length}`);

    // 5. Export each qualified lead to ClickUp
    if (topLeads.length === 0) {
      console.log("No qualified leads to export.");
      return { searched: uniqueUrls.length, qualified: 0, exported: 0 };
    }

    const exportResults = await exportLead.batchTriggerAndWait(
      topLeads.map((lead) => ({ payload: lead }))
    );

    const exported = exportResults.runs.filter((r) => r.ok);
    const failed = exportResults.runs.filter((r) => !r.ok);

    if (failed.length > 0) {
      console.error(`${failed.length} export(s) failed`);
    }

    console.log(`Pipeline complete: ${exported.length} leads pushed to ClickUp`);

    return {
      searched: uniqueUrls.length,
      qualified: qualified.length,
      exported: exported.length,
      clickup_tasks: exported
        .filter((r) => r.ok)
        .map((r) => (r.ok ? r.output.taskUrl : null))
        .filter(Boolean),
    };
  },
});
