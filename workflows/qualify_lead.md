# Workflow: Qualify Lead

## Objective
Score and filter enriched leads to surface the highest-value opportunities. Discard leads that don't meet minimum thresholds. Output a ranked list ready for firm review.

## Required Inputs
- `enriched_leads` — array of lead objects from `enrich_lead.md`
- `practice_areas` — list of practice areas the firm handles (filter out non-matching leads)
- `min_urgency_score` — minimum urgency to include (default: 4)

## Scoring Criteria

### Relevance Score (1–10)
Does this lead match a practice area the firm handles?
- 10: Exact match, clear legal issue, firm specializes in this
- 7–9: Strong match, minor ambiguity about case type
- 4–6: Possible match, needs more information
- 1–3: Tangential or unclear connection
- 0: No match — discard

### Urgency Score (1–10)
How time-sensitive is this lead?
- 9–10: Statute of limitations imminent (e.g. 1-year injury SOL approaching), active crisis
- 7–8: Recent incident (within 30 days), person actively seeking help now
- 5–6: Incident within 90 days, person exploring options
- 3–4: Older incident, still within SOL window
- 1–2: Historical, unclear timeline
- 0: Outside SOL — discard

### Case Value Estimate
Rough estimate of potential case value:
- **High**: Serious injury, major business dispute, class-action potential ($100K+)
- **Medium**: Moderate damages, clear liability ($10K–$100K)
- **Low**: Small claims territory, unclear damages (<$10K)

### Reachability Score (1–10)
How actionable is the contact information?
- 9–10: Direct email + phone confirmed
- 7–8: Email found, no phone
- 5–6: LinkedIn only, no direct contact
- 3–4: No contact info but publicly identifiable person
- 1–2: Anonymous, no identifying info

## Steps

### 1. Score Each Lead
Run `tools/qualify_lead.py` for each enriched lead.

**Inputs:**
```json
{
  "lead": { ...enriched_lead_object... },
  "practice_areas": ["personal injury", "employment law"],
  "min_urgency_score": 4
}
```

**Outputs:** Scored lead with `relevance_score`, `urgency_score`, `case_value_estimate`, `reachability_score`, `total_score`, `disqualification_reason` (if any)

### 2. Filter Out Disqualified Leads
Remove leads where:
- `relevance_score` < 4 (practice area mismatch)
- `urgency_score` < `min_urgency_score`
- `case_value_estimate` = low AND `reachability_score` < 3

### 3. Rank Remaining Leads
Sort by `total_score` descending. Total score = `(relevance * 0.3) + (urgency * 0.4) + (reachability * 0.3)`

### 4. Add Recommended Approach
For each qualified lead, write a 1–2 sentence outreach recommendation:
- How to contact them (channel + tone)
- What to lead with (their specific situation, not a generic pitch)

Example: "Reach out via email with a brief note referencing their accident on March 10th. Lead with empathy — they mentioned they're frustrated with their insurance company and unsure of their rights."

## Output
`.tmp/qualified_leads.json` — ranked array ready for export

```json
[
  {
    ...enriched_lead_fields...,
    "relevance_score": 8,
    "urgency_score": 9,
    "case_value_estimate": "high",
    "reachability_score": 7,
    "total_score": 8.2,
    "recommended_approach": "..."
  }
]
```

## Edge Cases
- **Tie scores**: Prefer higher urgency (SOL risk) over other factors.
- **No contact info**: Keep if score is high enough (≥7 total) — firm may be able to reach via social platform.
- **Ambiguous practice area**: Score against all matching areas and use the highest.

## Notes
- Adjust scoring weights based on firm feedback after first batch.
- If a firm only does personal injury, set `min_relevance_score` to 7 to reduce noise.
