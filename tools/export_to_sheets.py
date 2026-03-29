#!/usr/bin/env python3
"""
Tool: export_to_sheets.py
Purpose: Append qualified leads to a Google Sheet.

Setup:
    1. Create a Google Cloud project and enable Sheets API
    2. Download credentials.json (OAuth2 Desktop App) to project root
    3. On first run, browser will open for auth → token.json saved automatically

Usage:
    python tools/export_to_sheets.py --input .tmp/qualified_leads.json
"""

import argparse
import json
import os
import sys
from datetime import datetime

from dotenv import load_dotenv
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

load_dotenv()

SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]
CREDENTIALS_FILE = "credentials.json"
TOKEN_FILE = "token.json"

SHEET_HEADERS = [
    "Date Added", "Name", "Practice Area", "Signal Type", "Summary",
    "Urgency Score", "Case Value", "Total Score",
    "Email", "Phone", "LinkedIn", "Source URL",
    "Recommended Approach", "Status", "Assigned To", "Notes",
]


def get_sheets_service():
    creds = None

    if os.path.exists(TOKEN_FILE):
        creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not os.path.exists(CREDENTIALS_FILE):
                print(f"ERROR: {CREDENTIALS_FILE} not found. Download from Google Cloud Console.", file=sys.stderr)
                sys.exit(1)
            flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_FILE, SCOPES)
            creds = flow.run_local_server(port=0)

        with open(TOKEN_FILE, "w") as token:
            token.write(creds.to_json())

    return build("sheets", "v4", credentials=creds)


def get_existing_urls(service, spreadsheet_id: str, tab: str) -> set:
    """Fetch source URLs already in the sheet to avoid duplicates."""
    try:
        result = service.spreadsheets().values().get(
            spreadsheetId=spreadsheet_id,
            range=f"{tab}!L:L",
        ).execute()
        values = result.get("values", [])
        return {row[0] for row in values if row}
    except HttpError:
        return set()


def ensure_headers(service, spreadsheet_id: str, tab: str):
    """Write headers if the sheet is empty."""
    result = service.spreadsheets().values().get(
        spreadsheetId=spreadsheet_id,
        range=f"{tab}!A1:P1",
    ).execute()
    if not result.get("values"):
        service.spreadsheets().values().update(
            spreadsheetId=spreadsheet_id,
            range=f"{tab}!A1",
            valueInputOption="RAW",
            body={"values": [SHEET_HEADERS]},
        ).execute()


def lead_to_row(lead: dict) -> list:
    contact = lead.get("contact_info", {})
    return [
        datetime.utcnow().strftime("%Y-%m-%d"),
        lead.get("name", ""),
        lead.get("practice_area", ""),
        lead.get("signal_type", ""),
        lead.get("summary", ""),
        lead.get("urgency_score", ""),
        lead.get("case_value_estimate", ""),
        lead.get("total_score", ""),
        contact.get("email", ""),
        contact.get("phone", ""),
        contact.get("linkedin", ""),
        lead.get("source_url", ""),
        lead.get("recommended_approach", ""),
        "New",  # Status
        "",     # Assigned To
        "",     # Notes
    ]


def main():
    parser = argparse.ArgumentParser(description="Export qualified leads to Google Sheets")
    parser.add_argument("--input", required=True, help="Qualified leads JSON file")
    parser.add_argument("--spreadsheet-id", default=os.getenv("GOOGLE_SHEETS_ID"), help="Google Sheet ID")
    parser.add_argument("--tab", default=os.getenv("GOOGLE_SHEETS_TAB", "Leads"), help="Sheet tab name")
    args = parser.parse_args()

    if not args.spreadsheet_id:
        print("ERROR: GOOGLE_SHEETS_ID not set in .env or --spreadsheet-id", file=sys.stderr)
        sys.exit(1)

    with open(args.input) as f:
        leads = json.load(f)

    service = get_sheets_service()

    ensure_headers(service, args.spreadsheet_id, args.tab)
    existing_urls = get_existing_urls(service, args.spreadsheet_id, args.tab)

    rows = []
    skipped = 0
    for lead in leads:
        url = lead.get("source_url", "")
        if url and url in existing_urls:
            skipped += 1
            continue
        rows.append(lead_to_row(lead))

    if rows:
        service.spreadsheets().values().append(
            spreadsheetId=args.spreadsheet_id,
            range=f"{args.tab}!A1",
            valueInputOption="USER_ENTERED",
            insertDataOption="INSERT_ROWS",
            body={"values": rows},
        ).execute()

    print(f"Exported {len(rows)} leads to Google Sheets (skipped {skipped} duplicates)")
    print(f"Sheet: https://docs.google.com/spreadsheets/d/{args.spreadsheet_id}")


if __name__ == "__main__":
    main()
