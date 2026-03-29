# Workflow: Discover Leads

## Objective
Search the web for individuals or businesses displaying legal intent signals across specified practice areas. Output a list of raw leads for downstream enrichment and qualification.

## Required Inputs
- `practice_areas` — list of legal practice areas to target (e.g. "personal injury", "employment law")
- `location` — geographic focus (city, state, or "national")
- `max_results` — how many raw leads to return (default: 20)

## Steps

### 1. Build Search Queries
For each practice area, generate 3–5 search queries targeting intent signals. Examples:
- `"looking for personal injury lawyer" site:reddit.com OR site:twitter.com`
- `"wrongful termination" "need attorney" -job -hiring`
- `"slip and fall" "anyone recommend lawyer" location`
- `"car accident" "what should I do" "insurance won't pay"`

Focus on:
- Forum posts (Reddit, Avvo, Justia forums)
- Social posts (Twitter/X, Facebook public groups)
- News articles mentioning individuals involved in incidents
- Court filing announcement aggregators
- Local news injury/accident reports

### 2. Execute Searches
Run `tools/search_web.py` for each query.

**Inputs:**
```json
{
  "query": "<search query string>",
  "num_results": 10,
  "location": "<location filter>"
}
```

**Outputs:** List of URLs with titles and snippets saved to `.tmp/raw_search_results.json`

### 3. Scrape Promising Results
For each URL that looks like it contains a real person describing a legal situation, run `tools/scrape_single_site.py`.

Skip:
- Law firm websites (they're not leads)
- Legal directories (Avvo, FindLaw listings)
- News articles without named individuals
- Results behind hard paywalls

**Inputs:**
```json
{
  "url": "<url>",
  "output_file": ".tmp/scraped/<domain>_<timestamp>.json"
}
```

### 4. Extract Raw Lead Data
From each scraped page, extract:
- Person's name (if identifiable)
- Description of their legal situation
- Location if mentioned
- Source URL
- Date posted/published (if available)
- Any contact info visible on page

Save to `.tmp/raw_leads.json`

### 5. Deduplicate
Remove duplicates by source URL and by name+situation similarity. Keep the most information-rich version of each lead.

## Output
`.tmp/raw_leads.json` — array of raw lead objects ready for `enrich_lead.md`

```json
[
  {
    "name": "Jane D.",
    "source_url": "https://...",
    "signal_type": "injury",
    "raw_text": "...",
    "location": "Austin, TX",
    "posted_date": "2026-03-15"
  }
]
```

## Edge Cases
- **No results for a query**: Try alternative phrasings. Log the query as low-yield in this workflow.
- **Scraping blocked**: Note the domain and skip. Do not retry without checking with user.
- **Ambiguous signal**: Include it with a note — let `qualify_lead.md` make the call.
- **Paid API rate limits**: Stop immediately, do not retry. Check with user before resuming.

## Notes
- SerpAPI has 100 free searches/month on the free tier. Track usage.
- Reddit posts are high yield for employment and personal injury signals.
- Local news sites (patch.com, local TV news) are good for injury/accident leads.
