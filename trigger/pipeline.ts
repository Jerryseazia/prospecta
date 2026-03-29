import { schedules } from "@trigger.dev/sdk";
import { scrapeUrl } from "./scrape-url.js";
import { exportLead } from "./export-lead.js";

// ─── Search Queries ────────────────────────────────────────────────────────────

const SEARCH_QUERIES = [
  // Reddit — forum discussions (high-intent, people openly asking for help)
  '"need a personal injury lawyer" OR "looking for injury attorney" site:reddit.com',
  '"slip and fall" "medical bills" OR "surgery" "need a lawyer" site:reddit.com',
  '"car accident" "insurance denied" OR "insurance won\'t pay" "do I need a lawyer" site:reddit.com',
  '"wrongful termination" "need a lawyer" OR "should I get an attorney" site:reddit.com',
  '"workers comp" "fired" OR "terminated" "retaliation" site:reddit.com',
  '"landlord" "won\'t return deposit" OR "uninhabitable" "do I have a case" site:reddit.com',
  '"product liability" OR "defective product" "injured" "lawyer" site:reddit.com',

  // Quora — question & answer (people publicly describing their situation)
  '"do I need a lawyer" "car accident" OR "injury" OR "accident" site:quora.com',
  '"should I sue" "employer" OR "landlord" OR "contractor" site:quora.com',
  '"personal injury" "insurance company" "settlement" site:quora.com',
  '"wrongful termination" "what can I do" OR "my rights" site:quora.com',
  '"slip and fall" "liable" OR "sue" OR "compensation" site:quora.com',

  // LinkedIn — employment disputes (professionals posting about workplace issues)
  '"wrongful termination" OR "fired unfairly" "lawyer" OR "attorney" OR "sue" site:linkedin.com',
  '"workplace discrimination" OR "hostile work environment" "legal" OR "HR" site:linkedin.com',
  '"wage theft" OR "unpaid overtime" "employer" site:linkedin.com',

  // Glassdoor — employees describing workplace legal violations
  '"wrongful termination" OR "fired illegally" OR "discriminated" site:glassdoor.com',
  '"harassment" OR "discrimination" "HR ignored" OR "no action taken" site:glassdoor.com',

  // Indeed — employer reviews with employment law red flags
  '"retaliation" OR "discrimination" OR "hostile workplace" "fired" site:indeed.com',

  // BBB complaints — business disputes and consumer fraud
  '"breach of contract" OR "fraud" OR "deceptive" "complaint" site:bbb.org',
  '"contractor" OR "home repair" "didn\'t complete" OR "took money" "complaint" site:bbb.org',

  // General web — broad signals not tied to a single platform
  '"injured in accident" "lawsuit" OR "attorney" OR "suing"',
  '"medical malpractice" "lawsuit" OR "settlement" "need a lawyer"',
  '"car accident" "serious injuries" "attorney" OR "lawsuit" -site:reddit.com -site:quora.com',
  '"looking for a lawyer" "accident" OR "injury" OR "employment" -site:lawyers.com -site:avvo.com',
  '"need legal advice" "accident" OR "injury" OR "wrongful" -site:reddit.com -site:quora.com',
];

const PRACTICE_AREAS = ["personal injury", "employment law"];
const MIN_URGENCY = 4;
const MAX_LEADS = 10;

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

function getSourcePlatform(url: string): string {
  if (url.includes("reddit.com")) return "reddit";
  if (url.includes("quora.com")) return "quora";
  if (url.includes("linkedin.com")) return "linkedin";
  if (url.includes("facebook.com")) return "facebook";
  if (url.includes("glassdoor.com")) return "glassdoor";
  if (url.includes("indeed.com")) return "indeed";
  if (url.includes("bbb.org")) return "bbb";
  return "web";
}

function getOutreachChannel(url: string): string {
  const platform = getSourcePlatform(url);
  const channels: Record<string, string> = {
    reddit: "Reply to their post or send a Reddit DM",
    quora: "Comment on their Quora question or reach out via their profile",
    linkedin: "Send a LinkedIn connection request with a brief personal note",
    facebook: "Comment on their public post or send a Facebook message",
    glassdoor: "Find their LinkedIn profile via their job title/employer and reach out",
    indeed: "Search LinkedIn for their profile based on the employer and role mentioned",
    bbb: "Reach out through the BBB complaint thread or locate their contact info",
    web: "Find their contact info on the page or search for their profile online",
  };
  return channels[platform] ?? channels["web"];
}

function buildSummary(text: string, url: string): string {
  const platform = getSourcePlatform(url);
  let stripped = text.replace(/\n+/g, " ").trim();

  // Strip platform-specific boilerplate UI text
  if (platform === "reddit") {
    stripped = stripped.replace(/(Go to|r\/|u\/|Posted by|Share|Read more|Comments?)\s+\S+\s*/g, "");
  } else if (platform === "quora") {
    stripped = stripped.replace(/(Related Questions|All related|Upvote|Downvote|Share|Answer)\s+/g, "");
  } else if (platform === "linkedin") {
    stripped = stripped.replace(/(Like|Comment|Repost|Send|Connect|Follow)\s+/g, "");
  } else if (platform === "glassdoor" || platform === "indeed") {
    stripped = stripped.replace(/(Helpful|Report|Flag|Share|See more reviews)\s+/g, "");
  }

  const sentences = stripped.match(/[^.!?]+[.!?]+/g) ?? [];
  return sentences.slice(0, 3).join(" ").trim() || stripped.slice(0, 300);
}

function buildApproach(area: string, urgency: number, caseValue: string, text: string, url: string): string {
  const channel = getOutreachChannel(url);
  if (area === "personal injury") {
    if (caseValue === "high") {
      return `${channel}. Lead with the severity of their injury — serious/permanent injuries are typically undervalued without legal representation, and insurers know it. Offer a free consult with no pressure.`;
    }
    return `${channel}. Acknowledge their situation and explain that insurance companies handle hundreds of these claims — having an attorney levels the playing field. Keep it conversational.`;
  }
  // employment law
  return `${channel}. Reference their specific situation. Explain anti-retaliation statutes clearly — they likely don't know their rights. Offer a free 15-minute call.`;
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
      .slice(0, 50); // cap at 50 across all sources

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
        name: title
          .replace(/ : r\/\w+/, "")
          .replace(/ - Reddit$/, "")
          .replace(/ - Quora$/, "")
          .replace(/ \| LinkedIn$/, "")
          .replace(/ - Glassdoor$/, "")
          .replace(/ - Indeed$/, "")
          .replace(/ \| Better Business Bureau.*$/, "")
          .trim(),
        source_url: url,
        source_platform: getSourcePlatform(url),
        signal_type: area === "employment law" ? "employment" : "injury",
        summary: buildSummary(text, url),
        practice_area: area,
        urgency_score: urgency,
        case_value_estimate: caseValue,
        total_score: total,
        location: "Unknown",
        recommended_approach: buildApproach(area, urgency, caseValue, text, url),
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
