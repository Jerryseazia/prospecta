#!/usr/bin/env python3
"""
Tool: qualify_lead.py
Purpose: Score enriched leads by relevance, urgency, case value, and reachability.

Usage:
    python tools/qualify_lead.py --input .tmp/enriched_leads.json --output .tmp/qualified_leads.json
    python tools/qualify_lead.py --input .tmp/enriched_leads.json --practice-areas "personal injury,employment law"
"""

import argparse
import json
import os
import sys
from datetime import datetime


# Practice area → signal keywords mapping
PRACTICE_AREA_SIGNALS = {
    "personal injury": [
        "accident", "injury", "hurt", "pain", "hospital", "surgery",
        "slip and fall", "car accident", "malpractice", "wrongful death",
        "insurance", "settlement", "damages", "medical bills",
    ],
    "employment law": [
        "fired", "terminated", "wrongful", "discrimination", "harassment",
        "wage", "overtime", "hostile workplace", "retaliation", "layoff",
        "hr complaint", "eeoc", "hostile work environment",
    ],
    "business litigation": [
        "fraud", "breach of contract", "partnership dispute", "lawsuit",
        "intellectual property", "trademark", "stolen", "embezzlement",
        "breach", "contract dispute", "business partner",
    ],
    "criminal defense": [
        "arrested", "charged", "dui", "dwi", "criminal", "felony",
        "misdemeanor", "bail", "warrant", "indicted",
    ],
    "immigration": [
        "visa", "deportation", "immigration", "green card", "asylum",
        "undocumented", "work permit", "uscis",
    ],
    "family law": [
        "divorce", "custody", "child support", "alimony", "domestic",
        "restraining order", "separation", "adoption",
    ],
}

URGENCY_KEYWORDS = {
    "high": ["urgent", "asap", "immediately", "statute of limitations", "deadline",
             "just happened", "this week", "yesterday", "today"],
    "medium": ["recently", "last month", "few weeks", "need help soon"],
    "low": ["years ago", "2020", "2021", "2022", "old case"],
}

CASE_VALUE_SIGNALS = {
    "high": ["surgery", "hospitalized", "permanent", "wrongful death", "class action",
             "millions", "serious injury", "brain", "spinal", "business loss"],
    "medium": ["medical treatment", "missed work", "wage theft", "settlement"],
    "low": ["minor", "small", "fender bender", "scratches"],
}


def score_relevance(lead: dict, practice_areas: list[str]) -> tuple[int, str]:
    text = (lead.get("raw_text", "") + " " + lead.get("summary", "")).lower()
    best_score = 0
    best_area = ""

    for area in practice_areas:
        area_lower = area.lower()
        keywords = PRACTICE_AREA_SIGNALS.get(area_lower, [])
        matches = sum(1 for kw in keywords if kw in text)
        score = min(10, matches * 2)
        if score > best_score:
            best_score = score
            best_area = area

    return max(1, best_score), best_area


def score_urgency(lead: dict) -> int:
    text = (lead.get("raw_text", "") + " " + lead.get("summary", "")).lower()
    posted = lead.get("posted_date", "")

    for kw in URGENCY_KEYWORDS["high"]:
        if kw in text:
            return 8

    for kw in URGENCY_KEYWORDS["low"]:
        if kw in text:
            return 2

    for kw in URGENCY_KEYWORDS["medium"]:
        if kw in text:
            return 5

    # Estimate from posted date recency
    if posted:
        try:
            from datetime import date
            posted_dt = date.fromisoformat(posted[:10])
            days_ago = (date.today() - posted_dt).days
            if days_ago <= 7:
                return 8
            elif days_ago <= 30:
                return 6
            elif days_ago <= 90:
                return 4
        except ValueError:
            pass

    return 5  # default


def estimate_case_value(lead: dict) -> str:
    text = (lead.get("raw_text", "") + " " + lead.get("summary", "")).lower()

    for kw in CASE_VALUE_SIGNALS["high"]:
        if kw in text:
            return "high"

    for kw in CASE_VALUE_SIGNALS["low"]:
        if kw in text:
            return "low"

    return "medium"


def score_reachability(lead: dict) -> int:
    contact = lead.get("contact_info", {})
    score = 1

    if contact.get("email"):
        score += 5
    if contact.get("phone"):
        score += 3
    if contact.get("linkedin"):
        score += 2
    if lead.get("name") and lead["name"] not in ("", "Unknown"):
        score += 1

    return min(10, score)


def qualify(lead: dict, practice_areas: list[str], min_urgency: int) -> dict:
    relevance, matched_area = score_relevance(lead, practice_areas)
    urgency = score_urgency(lead)
    case_value = estimate_case_value(lead)
    reachability = score_reachability(lead)

    total = round((relevance * 0.3) + (urgency * 0.4) + (reachability * 0.3), 2)

    disqualification_reason = None
    if relevance < 4:
        disqualification_reason = f"Low relevance ({relevance}/10) — practice area mismatch"
    elif urgency < min_urgency:
        disqualification_reason = f"Low urgency ({urgency}/10) — below threshold of {min_urgency}"

    return {
        **lead,
        "practice_area": matched_area or lead.get("practice_area", ""),
        "relevance_score": relevance,
        "urgency_score": urgency,
        "case_value_estimate": case_value,
        "reachability_score": reachability,
        "total_score": total,
        "disqualification_reason": disqualification_reason,
        "qualified": disqualification_reason is None,
        "qualified_at": datetime.utcnow().isoformat(),
    }


def main():
    parser = argparse.ArgumentParser(description="Score and qualify leads")
    parser.add_argument("--input", required=True, help="Enriched leads JSON file")
    parser.add_argument("--output", default=".tmp/qualified_leads.json", help="Output file")
    parser.add_argument("--practice-areas", default="personal injury,employment law",
                        help="Comma-separated practice areas")
    parser.add_argument("--min-urgency", type=int, default=4, help="Minimum urgency score")
    args = parser.parse_args()

    practice_areas = [a.strip() for a in args.practice_areas.split(",")]

    with open(args.input) as f:
        leads = json.load(f)

    scored = [qualify(lead, practice_areas, args.min_urgency) for lead in leads]
    qualified = [l for l in scored if l["qualified"]]
    qualified.sort(key=lambda x: x["total_score"], reverse=True)

    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    with open(args.output, "w") as f:
        json.dump(qualified, f, indent=2)

    print(f"Scored {len(scored)} leads → {len(qualified)} qualified → {args.output}")
    for lead in qualified[:5]:
        print(f"  [{lead['total_score']}] {lead.get('name', 'Unknown')} — {lead.get('practice_area', '')}")


if __name__ == "__main__":
    main()
