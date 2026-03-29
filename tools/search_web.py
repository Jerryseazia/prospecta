#!/usr/bin/env python3
"""
Tool: search_web.py
Purpose: Search for legal intent signals using SerpAPI.

Usage:
    python tools/search_web.py --query "looking for injury lawyer reddit" --num 10 --output .tmp/results.json
"""

import argparse
import json
import os
import sys
from datetime import datetime

import requests
from dotenv import load_dotenv

load_dotenv()

SERPAPI_KEY = os.getenv("SERPAPI_KEY")


def search(query: str, num_results: int = 10, location: str = None) -> list[dict]:
    if not SERPAPI_KEY:
        print("ERROR: SERPAPI_KEY not set in .env", file=sys.stderr)
        sys.exit(1)

    params = {
        "api_key": SERPAPI_KEY,
        "engine": "google",
        "q": query,
        "num": num_results,
        "hl": "en",
        "gl": "us",
    }

    if location:
        params["location"] = location

    response = requests.get("https://serpapi.com/search", params=params, timeout=15)
    response.raise_for_status()

    data = response.json()

    results = []
    for r in data.get("organic_results", []):
        results.append({
            "title": r.get("title", ""),
            "url": r.get("link", ""),
            "snippet": r.get("snippet", ""),
            "source": r.get("source", ""),
            "date": r.get("date", ""),
        })

    return results


def main():
    parser = argparse.ArgumentParser(description="Search web for legal intent signals")
    parser.add_argument("--query", required=True, help="Search query")
    parser.add_argument("--num", type=int, default=10, help="Number of results")
    parser.add_argument("--location", default=None, help="Location filter (e.g. 'Austin, Texas')")
    parser.add_argument("--output", default=".tmp/search_results.json", help="Output file path")
    args = parser.parse_args()

    os.makedirs(os.path.dirname(args.output), exist_ok=True)

    print(f"Searching: {args.query}")
    results = search(args.query, args.num, args.location)

    output = {
        "query": args.query,
        "location": args.location,
        "timestamp": datetime.utcnow().isoformat(),
        "count": len(results),
        "results": results,
    }

    with open(args.output, "w") as f:
        json.dump(output, f, indent=2)

    print(f"Found {len(results)} results → {args.output}")


if __name__ == "__main__":
    main()
