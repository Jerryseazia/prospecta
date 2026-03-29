# Workflow: Export Leads

## Objective
Push qualified leads to a Google Sheet where the law firm can review, assign, and track outreach.

## Required Inputs
- `qualified_leads` — array from `qualify_lead.md` output (`.tmp/qualified_leads.json`)
- `GOOGLE_SHEETS_ID` — from `.env`
- `GOOGLE_SHEETS_TAB` — sheet tab name (default: "Leads")

## Google Sheet Column Structure

| Column | Field |
|---|---|
| A | Date Added |
| B | Name |
| C | Practice Area |
| D | Signal Type |
| E | Summary |
| F | Urgency Score |
| G | Case Value |
| H | Total Score |
| I | Email |
| J | Phone |
| K | LinkedIn |
| L | Source URL |
| M | Recommended Approach |
| N | Status (default: "New") |
| O | Assigned To |
| P | Notes |

Columns N–P are left for the firm to fill in manually.

## Steps

### 1. Load Qualified Leads
Read `.tmp/qualified_leads.json`.

### 2. Check for Duplicates
Before appending, check if `source_url` already exists in the sheet. Skip any leads already present.

### 3. Export
Run `tools/export_to_sheets.py`.

**Inputs:**
```json
{
  "leads_file": ".tmp/qualified_leads.json",
  "spreadsheet_id": "<from .env>",
  "tab_name": "<from .env>"
}
```

**Output:** Confirmation of rows appended, any skipped duplicates noted.

### 4. Log Run
Append a summary to `.tmp/run_log.jsonl`:
```json
{"timestamp": "...", "leads_found": 12, "leads_qualified": 7, "leads_exported": 6, "duplicates_skipped": 1}
```

## Edge Cases
- **Auth failure**: Re-run Google OAuth flow. Check that `credentials.json` and `token.json` are present.
- **Sheet not found**: Verify `GOOGLE_SHEETS_ID` in `.env`. Check that the service account or OAuth user has edit access.
- **Duplicate detected**: Log the skip, don't abort the whole export.

## Notes
- Google Sheets API has a 300 write requests/minute limit. For batches over 100 leads, add a short delay between requests.
- The sheet should be shared with the firm directly — do not share the spreadsheet ID publicly.
