# Workflow: Export Leads to ClickUp

## Objective
Create one ClickUp task per qualified lead in the designated list. Each task contains the full lead context so the firm can review, assign, and track outreach without leaving ClickUp.

## Required Inputs
- `qualified_leads` — array from `qualify_lead.md` (`.tmp/qualified_leads.json`)
- `CLICKUP_API_KEY` — from `.env`
- `CLICKUP_LIST_ID` — from `.env` (the List where leads should land)

## How to Find Your List ID
1. Open ClickUp and navigate to the list where leads should go
2. Click the `...` menu on the list → **Copy link**
3. The URL looks like: `https://app.clickup.com/123456/v/li/901234567`
4. The last number segment is your List ID

## ClickUp Task Structure

Each task is created with:

| Field | Value |
|---|---|
| **Name** | `{Lead Name} — {Practice Area}` |
| **Description** | Situation summary, lead details, contact info, source URL, recommended approach |
| **Priority** | Urgency 9–10 → Urgent · 6–8 → High · 3–5 → Normal · 0–2 → Low |
| **Status** | Open (default) |
| **Tags** | Practice area + signal type |

## Steps

### 1. Confirm Leads Are Ready
Check `.tmp/qualified_leads.json` exists and contains at least one lead. If not, run `qualify_lead.md` first.

### 2. Confirm ClickUp Credentials
Verify `CLICKUP_API_KEY` and `CLICKUP_LIST_ID` are set in `.env`.

To test your API key:
```bash
curl -H "Authorization: $CLICKUP_API_KEY" https://api.clickup.com/api/v2/user
```
Should return your ClickUp user info.

### 3. Run the Export
```bash
python tools/create_clickup_task.py --input .tmp/qualified_leads.json
```

The tool will:
- Pull existing task names from the list to avoid duplicates
- Create one task per lead
- Log results to `.tmp/clickup_export_log.json`

### 4. Verify in ClickUp
Open the list and confirm tasks appear with the correct priority, description, and tags.

## Full Pipeline (End to End)

```bash
# 1. Find signals
python tools/search_web.py --query "need injury lawyer reddit" --num 10 --output .tmp/raw_search.json

# 2. Scrape pages (run for each promising URL)
python tools/scrape_single_site.py --url "https://..." --output .tmp/scraped/page1.json

# 3. Enrich leads (after manually building .tmp/raw_leads.json from scrape output)
python tools/enrich_lead.py --input .tmp/raw_leads.json --output .tmp/enriched_leads.json

# 4. Qualify and score
python tools/qualify_lead.py --input .tmp/enriched_leads.json --output .tmp/qualified_leads.json \
  --practice-areas "personal injury,employment law" --min-urgency 4

# 5. Push to ClickUp
python tools/create_clickup_task.py --input .tmp/qualified_leads.json
```

## Edge Cases
- **Auth failure (401)**: API key is wrong or expired. Regenerate in ClickUp → Settings → Apps.
- **List not found (404)**: Double-check `CLICKUP_LIST_ID`. Make sure you're using the list ID, not the space or folder ID.
- **Rate limit (429)**: ClickUp allows 100 requests/minute. For large batches (>80 leads), add a short delay. The tool will log the failure — rerun after a minute.
- **Duplicate leads**: The tool checks existing task names before creating. If a lead with the same name already exists in the list, it's skipped.

## Notes
- ClickUp free tier supports task creation via API.
- Tags are set on the task but ClickUp may require tags to be pre-created in the workspace — if tag creation fails, tasks are still created without tags.
- Custom fields (case value, scores as numbers) can be added later once the ClickUp list has custom fields configured. The tool can be extended to populate them.
