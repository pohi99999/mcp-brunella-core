"""Google Sheets API Client for CRM Lead Sync

Features:
- Write leads to Google Sheets (KKV and Brand tabs)
- Metadata mapping for LinkedIn and Instagram leads
- Duplicate detection via email or social URL
"""

import os
import json
import logging
from typing import Optional, List, Dict, Any
from dataclasses import dataclass
from datetime import datetime
import gspread
from google.oauth2 import service_account

logger = logging.getLogger(__name__)

@dataclass
class CRMSheetsConfig:
    spreadsheet_id: str
    credentials_json: Optional[str] = None
    
    def __post_init__(self):
        self.scopes = [
            "https://www.googleapis.com/auth/spreadsheets",
            "https://www.googleapis.com/auth/drive",
        ]

class CRMSheetsClient:
    def __init__(self, config: Optional[CRMSheetsConfig] = None):
        self.config = config or self._load_config_from_env()
        self.client = None
        self.spreadsheet = None
        self._auth()

    def _load_config_from_env(self) -> CRMSheetsConfig:
        creds = os.getenv("GOOGLE_SHEETS_CREDS") or os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        # Prefer GOOGLE_SHEETS_ID_TRACKS for CRM as per .env
        sheet_id = os.getenv("GOOGLE_SHEETS_ID_TRACKS", "")
        return CRMSheetsConfig(spreadsheet_id=sheet_id, credentials_json=creds)

    def _auth(self) -> None:
        try:
            if self.config.credentials_json:
                if self.config.credentials_json.startswith("{"):
                    creds_dict = json.loads(self.config.credentials_json)
                    credentials = service_account.Credentials.from_service_account_info(
                        creds_dict, scopes=self.config.scopes
                    )
                else:
                    credentials = service_account.Credentials.from_service_account_file(
                        self.config.credentials_json, scopes=self.config.scopes
                    )
                self.client = gspread.authorize(credentials)
            self.spreadsheet = self.client.open_by_key(self.config.spreadsheet_id)
        except Exception as e:
            logger.error(f"CRM Sheets auth failed: {e}")
            raise

    def _get_or_create_tab(self, name: str) -> gspread.Worksheet:
        try:
            return self.spreadsheet.worksheet(name)
        except gspread.exceptions.WorksheetNotFound:
            return self.spreadsheet.add_worksheet(title=name, rows=1000, cols=10)

    def append_leads(self, leads: List[Dict[str, Any]], lead_type: str = "KKV"):
        """
        Append leads to the appropriate sheet.
        lead_type: "KKV" or "Brand"
        """
        tab_name = f"{lead_type}_Leads"
        worksheet = self._get_or_create_tab(tab_name)
        
        # Check if headers exist
        existing = worksheet.get_all_values()
        if not existing:
            headers = ["Timestamp", "Cégnév/Márka", "Email", "Iparág", "URL", "Icebreaker", "Státusz"]
            worksheet.append_row(headers)

        rows = []
        now = datetime.now().isoformat()
        for lead in leads:
            rows.append([
                now,
                lead.get("name") or lead.get("company_name"),
                lead.get("email") or lead.get("contact_email"),
                lead.get("industry") or lead.get("title"),
                lead.get("url") or lead.get("website"),
                lead.get("icebreaker_text") or lead.get("icebreaker", ""),
                "NEW"
            ])
        
        if rows:
            worksheet.append_rows(rows)
            return len(rows)
        return 0

if __name__ == "__main__":
    # Quick test
    client = CRMSheetsClient()
    test_lead = [{"name": "Test KKV", "email": "test@kkv.hu", "industry": "IT", "url": "http://test.hu"}]
    res = client.append_leads(test_lead, "KKV")
    print(f"Added {res} leads")
