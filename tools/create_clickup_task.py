#!/usr/bin/env python3
"""
Tool: create_clickup_task.py
Purpose: Create ClickUp tasks from qualified leads. One task per lead.

Usage:
    python tools/create_clickup_task.py --input .tmp/qualified_leads.json
    python tools/create_clickup_task.py --input .tmp/qualified_leads.json --list-id 123456789
"""

import argparse
import json
import os
import sys
from datetime import datetime

import requests
from dotenv import load_dotenv

load_dotenv()

CLICKUP_API_KEY = os.getenv("CLICKUP_API_KEY")
CLICKUP_LIST_ID = os.getenv("CLICKUP_LIST_ID")
CLICKUP_BASE = "https://api.clickup.com/api/v2"

# Map urgency score → ClickUp priority
# ClickUp: 1=urgent, 2=high, 3=normal, 4=low
URGENCY_TO_PRIORITY = {
    range(9, 11): 1,  # urgent
    range(6, 9):  2,  # high
    range(3, 6):  3,  # normal
    range(0, 3):  4,  # low
}


def get_headers() -> dict:
    if not CLICKUP_API_KEY:
        print("ERROR: CLICKUP_API_KEY not set in .env", file=sys.stderr)
        sys.exit(1)
    return {"Authorization": CLICKUP_API_KEY, "Content-Type": "application/json"}


def urgency_to_priority(score: int) -> int:
    for r, priority in URGENCY_TO_PRIORITY.items():
        if score in r:
            return priority
    return 3


def build_task_description(lead: dict) -> str:
    contact = lead.get("contact_info", {})
    lines = []

    # Situation summary
    if lead.get("summary"):
        lines.append(f"**Situation**\n{lead['summary']}\n")

    # Signal details
    lines.append("**Lead Details**")
    if lead.get("signal_type"):
        lines.append(f"- Signal type: {lead['signal_type']}")
    if lead.get("practice_area"):
        lines.append(f"- Practice area: {lead['practice_area']}")
    if lead.get("case_value_estimate"):
        lines.append(f"- Case value: {lead['case_value_estimate']}")
    if lead.get("urgency_score"):
        lines.append(f"- Urgency score: {lead['urgency_score']}/10")
    if lead.get("total_score"):
        lines.append(f"- Total score: {lead['total_score']}/10")
    if lead.get("location"):
        lines.append(f"- Location: {lead['location']}")
    lines.append("")

    # Contact info
    lines.append("**Contact Info**")
    if contact.get("email"):
        lines.append(f"- Email: {contact['email']}")
    if contact.get("phone"):
        lines.append(f"- Phone: {contact['phone']}")
    if contact.get("linkedin"):
        lines.append(f"- LinkedIn: {contact['linkedin']}")
    if not any([contact.get("email"), contact.get("phone"), contact.get("linkedin")]):
        lines.append("- No contact info found")
    lines.append("")

    # Source
    if lead.get("source_url"):
        lines.append(f"**Source**\n{lead['source_url']}\n")

    # Recommended approach
    if lead.get("recommended_approach"):
        lines.append(f"**Recommended Approach**\n{lead['recommended_approach']}\n")

    lines.append(f"*Lead discovered: {datetime.utcnow().strftime('%Y-%m-%d')}*")

    return "\n".join(lines)


def get_existing_task_names(list_id: str) -> set:
    """Fetch existing task names to avoid duplicates."""
    try:
        r = requests.get(
            f"{CLICKUP_BASE}/list/{list_id}/task",
            headers=get_headers(),
            params={"page": 0},
            timeout=15,
        )
        r.raise_for_status()
        tasks = r.json().get("tasks", [])
        return {t["name"] for t in tasks}
    except requests.RequestException:
        return set()


def create_task(lead: dict, list_id: str) -> dict:
    name = lead.get("name") or "Unknown Lead"
    signal = lead.get("signal_type", "")
    area = lead.get("practice_area", "")

    task_name = f"{name} — {area or signal}".strip(" —")

    payload = {
        "name": task_name,
        "description": build_task_description(lead),
        "priority": urgency_to_priority(lead.get("urgency_score", 5)),
        "status": "Open",
        "tags": [t for t in [area.lower(), signal.lower()] if t],
    }

    r = requests.post(
        f"{CLICKUP_BASE}/list/{list_id}/task",
        headers=get_headers(),
        json=payload,
        timeout=15,
    )
    r.raise_for_status()
    return r.json()


def main():
    parser = argparse.ArgumentParser(description="Create ClickUp tasks from qualified leads")
    parser.add_argument("--input", required=True, help="Qualified leads JSON file")
    parser.add_argument("--list-id", default=CLICKUP_LIST_ID, help="ClickUp List ID")
    parser.add_argument("--skip-duplicates", action="store_true", default=True,
                        help="Skip leads with matching task names already in the list")
    args = parser.parse_args()

    if not args.list_id:
        print("ERROR: CLICKUP_LIST_ID not set in .env or --list-id", file=sys.stderr)
        sys.exit(1)

    with open(args.input) as f:
        leads = json.load(f)

    existing = get_existing_task_names(args.list_id) if args.skip_duplicates else set()

    created, skipped, failed = 0, 0, 0
    results = []

    for lead in leads:
        name = lead.get("name") or "Unknown Lead"
        area = lead.get("practice_area", "")
        task_name = f"{name} — {area}".strip(" —")

        if task_name in existing:
            print(f"  SKIP (duplicate): {task_name}")
            skipped += 1
            continue

        try:
            task = create_task(lead, args.list_id)
            task_url = task.get("url", "")
            print(f"  CREATED: {task_name} → {task_url}")
            results.append({"lead_name": name, "task_id": task.get("id"), "task_url": task_url})
            created += 1
        except requests.HTTPError as e:
            print(f"  FAILED: {task_name} — {e}", file=sys.stderr)
            failed += 1

    # Save results log
    log_path = ".tmp/clickup_export_log.json"
    os.makedirs(".tmp", exist_ok=True)
    with open(log_path, "w") as f:
        json.dump({
            "timestamp": datetime.utcnow().isoformat(),
            "created": created,
            "skipped": skipped,
            "failed": failed,
            "tasks": results,
        }, f, indent=2)

    print(f"\nDone: {created} created, {skipped} skipped, {failed} failed → {log_path}")


if __name__ == "__main__":
    main()
