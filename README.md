# Prospecta

AI-powered lead discovery platform for law firms. Prospecta scans the web for individuals and businesses showing **legal intent signals** — injury reports, legal inquiries, employment disputes, and other case triggers — then filters, qualifies, and enriches each lead so firms know exactly who to contact and why.

**Goal:** Build a predictable intake pipeline that continuously surfaces high-intent legal prospects, reducing acquisition cost and replacing reliance on ads or referrals.

---

## How It Works

Prospecta is built on the **WAT framework** (Workflows, Agents, Tools):

- **Workflows** — Markdown SOPs in `workflows/` define what to do and how
- **Agents** — Claude (AI) reads workflows and orchestrates execution
- **Tools** — Python scripts in `tools/` do the actual deterministic work

The pipeline runs in a continuous loop:

```
Search Web → Scrape Pages → Qualify Leads → Enrich Contacts → Export to Sheets / ClickUp
```

Background tasks are automated via **Trigger.dev**, which runs the full pipeline on a schedule without manual intervention.

---

## Project Structure

```
prospecta/
├── tools/                      # Python scripts (deterministic execution)
│   ├── search_web.py           # Search for intent signals via SerpAPI
│   ├── scrape_single_site.py   # Scrape a URL for lead content
│   ├── qualify_lead.py         # Score leads by relevance, urgency, and value
│   ├── enrich_lead.py          # Add contact info via Hunter.io
│   ├── export_to_sheets.py     # Write qualified leads to Google Sheets
│   └── create_clickup_task.py  # Create tasks in ClickUp for each lead
│
├── trigger/                    # Trigger.dev background tasks (TypeScript)
│   ├── pipeline.ts             # Scheduled full pipeline (search → qualify → export)
│   ├── scrape-url.ts           # Scrape a single URL on demand
│   └── export-lead.ts          # Export a single lead to Sheets + ClickUp
│
├── workflows/                  # Markdown SOPs for agent instructions
│   ├── discover_leads.md       # How to find new leads
│   ├── enrich_lead.md          # How to add context and contact info
│   ├── qualify_lead.md         # How to score and filter leads
│   ├── export_leads.md         # How to push to Google Sheets
│   └── export_to_clickup.md    # How to push to ClickUp
│
├── .env                        # API keys (never committed)
├── trigger.config.ts           # Trigger.dev project configuration
├── requirements.txt            # Python dependencies
└── package.json                # Node.js dependencies
```

---

## Lead Output Format

Every qualified lead contains:

| Field | Description |
|---|---|
| `name` | Individual or business name |
| `source_url` | Where the signal was found |
| `signal_type` | `injury`, `dispute`, `criminal`, `employment`, `other` |
| `summary` | 2–3 sentence description of the situation |
| `practice_area` | Matched legal practice area |
| `urgency_score` | 1–10 (10 = statute of limitations imminent) |
| `case_value_estimate` | `low`, `medium`, or `high` |
| `contact_info` | Email, phone, LinkedIn if available |
| `recommended_approach` | How the firm should reach out |

---

## Setup

### Prerequisites

- Python 3.10+
- Node.js 18+
- A [Trigger.dev](https://trigger.dev) account
- API keys (see below)

---

### 1. Clone the repo

```bash
git clone https://github.com/Jerryseazia/prospecta.git
cd prospecta
```

---

### 2. Set up Python environment

```bash
python3 -m venv .venv
source .venv/bin/activate       # Mac/Linux
# .venv\Scripts\activate        # Windows

pip install -r requirements.txt
```

---

### 3. Install Node dependencies

```bash
npm install
```

---

### 4. Configure environment variables

Create a `.env` file in the project root:

```bash
cp .env.example .env   # if available, otherwise create manually
```

Then fill in your keys:

```env
# SerpAPI — used by search_web.py to find leads
# Get your key at: https://serpapi.com
SERPAPI_KEY=your_key_here

# Google Gemini — used for AI-powered lead summarization
# Get your key at: https://aistudio.google.com/app/apikey
GEMINI_API_KEY=your_key_here

# Hunter.io — used by enrich_lead.py for contact info lookup
# Get your key at: https://hunter.io/api-keys
HUNTER_API_KEY=your_key_here

# ClickUp — used by create_clickup_task.py
# Get your key at: https://app.clickup.com/settings/apps
CLICKUP_API_KEY=your_key_here
CLICKUP_LIST_ID=your_list_id_here
```

---

### 5. Set up Google Sheets access

Prospecta writes leads to a Google Sheet. You need a service account or OAuth credentials:

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project and enable the **Google Sheets API** and **Google Drive API**
3. Create an **OAuth 2.0 Client ID** (Desktop app) and download `credentials.json`
4. Place `credentials.json` in the project root
5. Run any export script once to authorize and generate `token.json`:

```bash
python tools/export_to_sheets.py --help
```

Both `credentials.json` and `token.json` are gitignored and never committed.

---

### 6. Set up Trigger.dev

Trigger.dev runs the pipeline automatically in the background.

1. Sign up at [trigger.dev](https://trigger.dev) and create a project
2. Copy your **Project Ref** from Project Settings and update `trigger.config.ts`:

```ts
project: "proj_your_project_ref_here",
```

3. Add your environment variables to Trigger.dev (Dashboard → Environment Variables):
   - `SERPAPI_KEY`
   - `GEMINI_API_KEY`
   - `HUNTER_API_KEY`
   - `CLICKUP_API_KEY`
   - `CLICKUP_LIST_ID`
   - Your Google credentials (encode as base64 if needed)

4. Start the local dev server:

```bash
npm run dev
```

5. Deploy to production:

```bash
npm run deploy
```

---

## Running Tools Manually

Each tool can be run directly from the command line for testing:

```bash
# Search for leads
python tools/search_web.py --query "need a personal injury lawyer" --num 10 --output .tmp/results.json

# Scrape a specific URL
python tools/scrape_single_site.py --url "https://reddit.com/r/legaladvice/..." --output .tmp/scraped.json

# Qualify raw leads
python tools/qualify_lead.py --input .tmp/results.json --output .tmp/qualified.json

# Enrich with contact info
python tools/enrich_lead.py --input .tmp/qualified.json --output .tmp/enriched.json

# Export to Google Sheets
python tools/export_to_sheets.py --input .tmp/enriched.json --sheet-id "your_sheet_id"

# Create ClickUp tasks
python tools/create_clickup_task.py --input .tmp/enriched.json
```

Intermediate files are written to `.tmp/` and are disposable — they can be regenerated at any time.

---

## Automated Pipeline (Trigger.dev)

The `trigger/pipeline.ts` task runs on a schedule and executes the full pipeline end-to-end:

1. Runs multiple search queries targeting legal intent signals on Reddit and other sources
2. Scrapes each result page for lead content
3. Qualifies leads against practice area keywords and scoring criteria
4. Exports qualified leads directly to Google Sheets and ClickUp

The pipeline targets these practice areas by default:
- Personal injury (accidents, slip & fall, malpractice, product liability)
- Employment law (wrongful termination, wage theft, harassment, discrimination)

To modify search queries or practice areas, edit the constants at the top of [trigger/pipeline.ts](trigger/pipeline.ts).

---

## Legal Intent Signals

Prospecta monitors for these categories of legal need:

| Signal Type | Examples |
|---|---|
| Personal injury | Car accidents, slip & fall, medical malpractice, product liability |
| Employment disputes | Wrongful termination, wage theft, harassment, discrimination |
| Business disputes | Contract breaches, fraud, IP issues, partnership conflicts |
| Criminal / DUI | Arrests, charges, DUI mentions |
| Insurance issues | Claim denials, bad faith insurance practices |
| Landlord / tenant | Evictions, habitability issues, security deposit disputes |
| Immigration | Visa issues, deportation concerns, asylum |

---

## Contributing

This project follows the WAT framework. When making changes:

- **New data sources** → add a tool in `tools/` and update the relevant workflow in `workflows/`
- **New practice areas** → update keyword mappings in `tools/qualify_lead.py` and `trigger/pipeline.ts`
- **New export destinations** → add a tool and a workflow, then wire it into `trigger/pipeline.ts`
- **Workflow improvements** → update the relevant `.md` file in `workflows/`
