import {
  task
} from "./chunk-IAPM2DTR.mjs";
import {
  __name,
  init_esm
} from "./chunk-3R76H35D.mjs";

// trigger/export-lead.ts
init_esm();
function urgencyToPriority(score) {
  if (score >= 9) return 1;
  if (score >= 6) return 2;
  if (score >= 3) return 3;
  return 4;
}
__name(urgencyToPriority, "urgencyToPriority");
var exportLead = task({
  id: "export-lead",
  retry: { maxAttempts: 3, minTimeoutInMs: 2e3 },
  run: /* @__PURE__ */ __name(async (payload) => {
    const apiKey = process.env.CLICKUP_API_KEY;
    const listId = process.env.CLICKUP_LIST_ID || "901710628457";
    if (!apiKey) {
      throw new Error("CLICKUP_API_KEY not set");
    }
    const description = [
      `**Signal Type:** ${payload.signal_type}`,
      `**Practice Area:** ${payload.practice_area}`,
      `**Location:** ${payload.location}`,
      `**Case Value:** ${payload.case_value_estimate}`,
      `**Urgency Score:** ${payload.urgency_score}/10`,
      `**Total Score:** ${payload.total_score}`,
      ``,
      `**Summary:**`,
      payload.summary,
      ``,
      `**Recommended Approach:**`,
      payload.recommended_approach,
      ``,
      `**Source:** ${payload.source_url}`
    ].join("\n");
    const body = {
      name: `${payload.name} — ${payload.practice_area}`,
      description,
      priority: urgencyToPriority(payload.urgency_score),
      status: "Open",
      tags: [payload.practice_area, payload.signal_type]
    };
    const res = await fetch(`https://api.clickup.com/api/v2/list/${listId}/task`, {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`ClickUp API error ${res.status}: ${err}`);
    }
    const data = await res.json();
    return { taskId: data.id, taskUrl: data.url, leadName: payload.name };
  }, "run")
});

export {
  exportLead
};
//# sourceMappingURL=chunk-3WW5PQLK.mjs.map
