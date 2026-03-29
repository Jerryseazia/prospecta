#!/usr/bin/env python3
"""
Tool: enrich_lead.py
Purpose: Look up contact info for a lead using Hunter.io.

Usage:
    python tools/enrich_lead.py --name "John Smith" --company "Acme Corp" --domain "acme.com"
    python tools/enrich_lead.py --input .tmp/raw_leads.json --output .tmp/enriched_leads.json
"""

import argparse
import json
import os
import sys
from datetime import datetime

import requests
from dotenv import load_dotenv

load_dotenv()

HUNTER_API_KEY = os.getenv("HUNTER_API_KEY")
HUNTER_BASE = "https://api.hunter.io/v2"


def find_email(first_name: str, last_name: str, domain: str) -> dict:
    """Find a verified email via Hunter.io email finder."""
    if not HUNTER_API_KEY:
        return {"error": "HUNTER_API_KEY not set"}

    params = {
        "first_name": first_name,
        "last_name": last_name,
        "domain": domain,
        "api_key": HUNTER_API_KEY,
    }

    try:
        r = requests.get(f"{HUNTER_BASE}/email-finder", params=params, timeout=10)
        r.raise_for_status()
        data = r.json().get("data", {})
        return {
            "email": data.get("email"),
            "confidence": data.get("score"),
            "source": "hunter.io",
        }
    except requests.RequestException as e:
        return {"error": str(e)}


def domain_search(domain: str) -> list[dict]:
    """Get all known emails for a domain."""
    if not HUNTER_API_KEY:
        return []

    params = {
        "domain": domain,
        "api_key": HUNTER_API_KEY,
        "limit": 5,
    }

    try:
        r = requests.get(f"{HUNTER_BASE}/domain-search", params=params, timeout=10)
        r.raise_for_status()
        emails = r.json().get("data", {}).get("emails", [])
        return [
            {
                "email": e.get("value"),
                "first_name": e.get("first_name"),
                "last_name": e.get("last_name"),
                "type": e.get("type"),
                "confidence": e.get("confidence"),
            }
            for e in emails
        ]
    except requests.RequestException:
        return []


def enrich_lead(lead: dict) -> dict:
    """Enrich a single lead with contact info."""
    name = lead.get("name", "")
    parts = name.strip().split()
    first = parts[0] if parts else ""
    last = parts[-1] if len(parts) > 1 else ""

    company = lead.get("company", "")
    domain = lead.get("domain", "")

    contact_info = {"email": None, "phone": None, "linkedin": None}

    if domain and first and last:
        result = find_email(first, last, domain)
        if not result.get("error"):
            contact_info["email"] = result.get("email")
            contact_info["email_confidence"] = result.get("confidence")

    return {
        **lead,
        "contact_info": contact_info,
        "enriched_at": datetime.utcnow().isoformat(),
        "enrichment_confidence": (
            "high" if contact_info["email"] else
            "medium" if name else
            "low"
        ),
    }


def main():
    parser = argparse.ArgumentParser(description="Enrich leads with contact info")
    parser.add_argument("--name", help="Full name of the person")
    parser.add_argument("--company", help="Company name")
    parser.add_argument("--domain", help="Email domain (e.g. acme.com)")
    parser.add_argument("--input", help="Input JSON file with array of leads")
    parser.add_argument("--output", default=".tmp/enriched_leads.json", help="Output file")
    args = parser.parse_args()

    if args.input:
        with open(args.input) as f:
            leads = json.load(f)

        enriched = [enrich_lead(lead) for lead in leads]

        os.makedirs(os.path.dirname(args.output), exist_ok=True)
        with open(args.output, "w") as f:
            json.dump(enriched, f, indent=2)

        print(f"Enriched {len(enriched)} leads → {args.output}")

    elif args.name:
        lead = {"name": args.name, "company": args.company or "", "domain": args.domain or ""}
        result = enrich_lead(lead)
        print(json.dumps(result, indent=2))

    else:
        print("ERROR: Provide --input or --name", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
