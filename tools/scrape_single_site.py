#!/usr/bin/env python3
"""
Tool: scrape_single_site.py
Purpose: Scrape a single URL and extract readable text content.

Usage:
    python tools/scrape_single_site.py --url "https://..." --output .tmp/scraped/page.json
"""

import argparse
import json
import os
import re
import sys
from datetime import datetime
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup


HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}

# Tags to strip before extracting text
SKIP_TAGS = {"script", "style", "nav", "footer", "header", "aside", "form"}


def scrape(url: str) -> dict:
    try:
        response = requests.get(url, headers=HEADERS, timeout=15)
        response.raise_for_status()
    except requests.RequestException as e:
        return {"url": url, "error": str(e), "text": "", "title": ""}

    soup = BeautifulSoup(response.text, "lxml")

    for tag in soup(SKIP_TAGS):
        tag.decompose()

    title = soup.title.string.strip() if soup.title else ""

    # Get main content — prefer article, main, or post body elements
    content_tags = (
        soup.find("article")
        or soup.find("main")
        or soup.find(class_=re.compile(r"post|content|body|entry", re.I))
        or soup.body
    )

    text = content_tags.get_text(separator="\n", strip=True) if content_tags else ""

    # Collapse excessive whitespace
    text = re.sub(r"\n{3,}", "\n\n", text).strip()

    return {
        "url": url,
        "domain": urlparse(url).netloc,
        "title": title,
        "text": text[:10000],  # cap at 10k chars
        "text_length": len(text),
        "scraped_at": datetime.utcnow().isoformat(),
        "error": None,
    }


def main():
    parser = argparse.ArgumentParser(description="Scrape a single URL")
    parser.add_argument("--url", required=True, help="URL to scrape")
    parser.add_argument("--output", default=None, help="Output JSON file path")
    args = parser.parse_args()

    print(f"Scraping: {args.url}")
    result = scrape(args.url)

    if result.get("error"):
        print(f"ERROR: {result['error']}", file=sys.stderr)

    if args.output:
        os.makedirs(os.path.dirname(args.output), exist_ok=True)
        with open(args.output, "w") as f:
            json.dump(result, f, indent=2)
        print(f"Saved → {args.output}")
    else:
        print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
