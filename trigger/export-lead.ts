import { task } from "@trigger.dev/sdk";

interface Lead {
  name: string;
  source_url: string;
  signal_type: string;
  summary: string;
  practice_area: string;
  urgency_score: number;
  case_value_estimate: string;
  total_score: number;
  location: string;
  recommended_approach: string;
}

function urgencyToPriority(score: number): number {
  if (score >= 9) return 1; // Urgent
  if (score >= 6) return 2; // High
  if (score >= 3) return 3; // Normal
  return 4;                 // Low
}

export const exportLead = task({
  id: "export-lead",
  retry: { maxAttempts: 3, minTimeoutInMs: 2_000 },

  run: async (payload: Lead) => {
    const apiKey = process.env.CLICKUP_API_KEY;
    const listId = process.env.CLICKUP_LIST_ID || "901710628457"; // Prospecta list

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
      `**Source:** ${payload.source_url}`,
    ].join("\n");

    const body = {
      name: `${payload.name} — ${payload.practice_area}`,
      description,
      priority: urgencyToPriority(payload.urgency_score),
      status: "to do",
      tags: [payload.practice_area, payload.signal_type],
    };

    const res = await fetch(`https://api.clickup.com/api/v2/list/${listId}/task`, {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`ClickUp API error ${res.status}: ${err}`);
    }

    const data = (await res.json()) as { id: string; url: string };
    return { taskId: data.id, taskUrl: data.url, leadName: payload.name };
  },
});
