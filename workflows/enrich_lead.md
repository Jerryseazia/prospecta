# Workflow: Enrich Lead

## Objective
Take a raw lead and enrich it with contact information, background context, and enough detail for a law firm to make a confident outreach decision.

## Required Inputs
- `raw_lead` — a lead object from `discover_leads.md` output

## Steps

### 1. Identify the Person or Business
From the raw text, extract:
- Full name (if available, otherwise note as "anonymous/partial")
- Company name (for business disputes)
- Location (city + state preferred)
- Platform/source context (Reddit user, news article subject, etc.)

If the name is partial or anonymous, note this and continue — contact info lookup may still be possible if enough detail exists.

### 2. Find Contact Information
Run `tools/enrich_lead.py` with available name + company/location.

**Inputs:**
```json
{
  "name": "<full name>",
  "company": "<company if applicable>",
  "domain": "<company domain if known>",
  "location": "<city, state>"
}
```

**Outputs:** email, phone, LinkedIn URL (where available)

If Hunter.io returns no results, note "contact info not found" — do not fabricate.

### 3. Research Background Context
Using the source URL and any names found, look for additional context:
- Is there a news article about the incident?
- Are there court records or public filings? (PACER, state court portals)
- LinkedIn profile for professional context?
- Any other public mentions of this person + incident?

Run `tools/search_web.py` with: `"<name>" "<incident keywords>" site:news OR court`

Add any additional URLs to `supporting_sources`.

### 4. Summarize the Situation
Write a 2–3 sentence summary of the situation that a lawyer can read in 10 seconds:
- What happened
- What legal issue it suggests
- Any urgency or time-sensitivity indicators

### 5. Identify Practice Area Match
Map the signal to the most relevant practice area:
- Personal injury (accidents, malpractice, product liability)
- Employment law (termination, discrimination, wage theft)
- Business litigation (fraud, breach of contract, IP)
- Criminal defense (DUI, arrests)
- Immigration
- Family law
- Other (note what it is)

## Output
Enriched lead object:
```json
{
  "name": "...",
  "source_url": "...",
  "supporting_sources": ["..."],
  "signal_type": "...",
  "summary": "...",
  "practice_area": "...",
  "location": "...",
  "contact_info": {
    "email": "...",
    "phone": "...",
    "linkedin": "..."
  },
  "enrichment_confidence": "high | medium | low"
}
```

## Edge Cases
- **Anonymous post**: Proceed with enrichment if enough context exists to identify the person. If truly anonymous (no name, no company, no uniquely identifying detail), mark as `enrichment_confidence: low` and pass to qualify anyway — the signal may still be worth tracking.
- **Multiple people in one source**: Create separate lead objects for each individual.
- **Hunter.io rate limit**: Stop and check with user before continuing.

## Notes
- Hunter.io free tier: 25 searches/month. Track usage carefully.
- LinkedIn scraping is against ToS — only use publicly visible profile URLs from search results, do not scrape profile content.
