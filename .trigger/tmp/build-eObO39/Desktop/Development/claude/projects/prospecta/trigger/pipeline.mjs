import {
  exportLead
} from "../../../../../../chunk-BGHG4HHY.mjs";
import {
  scrapeUrl
} from "../../../../../../chunk-DM6RRI53.mjs";
import {
  schedules_exports
} from "../../../../../../chunk-IAPM2DTR.mjs";
import "../../../../../../chunk-HCD45DYG.mjs";
import {
  __name,
  init_esm
} from "../../../../../../chunk-3R76H35D.mjs";

// trigger/pipeline.ts
init_esm();
var SEARCH_QUERIES = [
  '"need a personal injury lawyer" OR "looking for injury attorney" site:reddit.com',
  '"slip and fall" "medical bills" OR "surgery" "need a lawyer" site:reddit.com',
  `"car accident" "insurance denied" OR "insurance won't pay" "do I need a lawyer" site:reddit.com`,
  '"wrongful termination" "need a lawyer" OR "should I get an attorney" site:reddit.com',
  '"workers comp" "fired" OR "terminated" "retaliation" site:reddit.com'
];
var MIN_URGENCY = 4;
var MAX_LEADS = 5;
var PI_KEYWORDS = [
  "accident",
  "injury",
  "hurt",
  "hospital",
  "surgery",
  "slip and fall",
  "car accident",
  "malpractice",
  "settlement",
  "damages",
  "medical bills",
  "broken",
  "fracture",
  "spinal",
  "brain",
  "permanent",
  "rehab"
];
var EMPLOYMENT_KEYWORDS = [
  "fired",
  "terminated",
  "wrongful",
  "discrimination",
  "harassment",
  "wage",
  "overtime",
  "hostile",
  "retaliation",
  "workers comp",
  "eeoc",
  "layoff",
  "hr complaint"
];
var HIGH_VALUE_SIGNALS = [
  "surgery",
  "hospitalized",
  "permanent",
  "wrongful death",
  "spinal",
  "brain",
  "serious injury",
  "class action",
  "months of rehab"
];
var LOW_VALUE_SIGNALS = ["minor", "small", "fender bender", "scratches"];
var HIGH_URGENCY_SIGNALS = [
  "urgent",
  "asap",
  "just happened",
  "this week",
  "yesterday",
  "statute of limitations",
  "immediately"
];
var LOW_URGENCY_SIGNALS = ["years ago", "2020", "2021", "2022", "old case"];
function scoreRelevance(text) {
  const t = text.toLowerCase();
  const piMatches = PI_KEYWORDS.filter((kw) => t.includes(kw)).length;
  const empMatches = EMPLOYMENT_KEYWORDS.filter((kw) => t.includes(kw)).length;
  if (piMatches >= empMatches) {
    return { score: Math.min(10, piMatches * 2), area: "personal injury" };
  }
  return { score: Math.min(10, empMatches * 2), area: "employment law" };
}
__name(scoreRelevance, "scoreRelevance");
function scoreUrgency(text) {
  const t = text.toLowerCase();
  if (HIGH_URGENCY_SIGNALS.some((kw) => t.includes(kw))) return 8;
  if (LOW_URGENCY_SIGNALS.some((kw) => t.includes(kw))) return 2;
  return 5;
}
__name(scoreUrgency, "scoreUrgency");
function estimateCaseValue(text) {
  const t = text.toLowerCase();
  if (HIGH_VALUE_SIGNALS.some((kw) => t.includes(kw))) return "high";
  if (LOW_VALUE_SIGNALS.some((kw) => t.includes(kw))) return "low";
  return "medium";
}
__name(estimateCaseValue, "estimateCaseValue");
function buildSummary(text, url) {
  const stripped = text.replace(/^(Go to|r\/|u\/|Posted by|Share|Read more|Comments?)[\s\S]*?\n/gm, "").replace(/\n+/g, " ").trim();
  const sentences = stripped.match(/[^.!?]+[.!?]+/g) ?? [];
  return sentences.slice(0, 3).join(" ").trim() || stripped.slice(0, 300);
}
__name(buildSummary, "buildSummary");
function buildApproach(area, urgency, caseValue, text) {
  const t = text.toLowerCase();
  const channel = "Reply to their Reddit post or send a DM";
  if (area === "personal injury") {
    if (caseValue === "high") {
      return `${channel}. Lead with the severity of their injury — mention that serious/permanent injuries are typically undervalued without legal representation, and insurers know it. Offer a free consult with no pressure.`;
    }
    return `${channel}. Acknowledge their situation and explain that insurance companies handle hundreds of these claims — having an attorney levels the playing field. Keep it conversational.`;
  }
  return `${channel}. Reference the specific situation (termination timing, injury context). Explain anti-retaliation statutes clearly — they likely don't know their rights. Offer a free 15-minute call.`;
}
__name(buildApproach, "buildApproach");
async function searchSerpApi(query) {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) throw new Error("SERPAPI_KEY not set");
  const params = new URLSearchParams({
    api_key: apiKey,
    engine: "google",
    q: query,
    num: "10",
    hl: "en",
    gl: "us"
  });
  const res = await fetch(`https://serpapi.com/search?${params}`, {
    signal: AbortSignal.timeout(15e3)
  });
  if (!res.ok) throw new Error(`SerpAPI error: ${res.status}`);
  const data = await res.json();
  return (data.organic_results ?? []).map((r) => ({
    url: r.link ?? "",
    title: r.title ?? "",
    snippet: r.snippet ?? ""
  }));
}
__name(searchSerpApi, "searchSerpApi");
var leadPipeline = schedules_exports.task({
  id: "lead-pipeline",
  cron: "0 8 * * *",
  // 8am UTC daily
  run: /* @__PURE__ */ __name(async () => {
    console.log("Starting Prospecta lead pipeline...");
    const allResults = [];
    for (const query of SEARCH_QUERIES) {
      try {
        const results = await searchSerpApi(query);
        console.log(`Query "${query.slice(0, 50)}..." → ${results.length} results`);
        allResults.push(...results);
      } catch (err) {
        console.error(`Search failed: ${err.message}`);
      }
    }
    const seen = /* @__PURE__ */ new Set();
    const uniqueUrls = allResults.filter((r) => r.url && !seen.has(r.url) && seen.add(r.url)).slice(0, 30);
    console.log(`Unique URLs to scrape: ${uniqueUrls.length}`);
    const scrapeResults = await scrapeUrl.batchTriggerAndWait(
      uniqueUrls.map((r) => ({ payload: { url: r.url, query: r.title } }))
    );
    const qualified = [];
    for (const run of scrapeResults.runs) {
      if (!run.ok || run.output.skipped || !run.output.text) continue;
      const { url, text, title } = run.output;
      const { score: relevance, area } = scoreRelevance(text);
      const urgency = scoreUrgency(text);
      const caseValue = estimateCaseValue(text);
      const total = Math.round((relevance * 0.3 + urgency * 0.4 + 2 * 0.3) * 10) / 10;
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
        location: "Unknown",
        // enrichment step would resolve this
        recommended_approach: buildApproach(area, urgency, caseValue, text)
      });
    }
    qualified.sort((a, b) => b.total_score - a.total_score);
    const topLeads = qualified.slice(0, MAX_LEADS);
    console.log(`Qualified leads: ${qualified.length} → exporting top ${topLeads.length}`);
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
      clickup_tasks: exported.filter((r) => r.ok).map((r) => r.ok ? r.output.taskUrl : null).filter(Boolean)
    };
  }, "run")
});
export {
  leadPipeline
};
//# sourceMappingURL=pipeline.mjs.map
