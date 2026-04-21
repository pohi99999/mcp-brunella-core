"""
Gmail Invoice Fallback Client - Számla letöltés Gmailből Robotkéz segítségével.

Amikor a Számlázz.hu API nem elérhető, ez a kliens automatikusan:
1. Bejelentkezik Gmailbe (Robotkéz/Browser-Use)
2. Keres számla emaileket megadott szűrőkkel
3. Letölti a PDF mellékleteket
4. Visszaadja a metadata-t későbbi feldolgozáshoz (Phase 3: OCR + parsing)

Használat:
    client = GmailInvoiceClient()
    invoices = await client.fetch_invoice_pdfs(days_back=30)
"""

import os
import logging
import asyncio
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from pathlib import Path
import re

# Robotkéz integráció
try:
    from myai.agents.robotkez_v2_hybrid import RobotkezV2, RobotkezResult
    HAS_ROBOTKEZ = True
except ImportError:
    HAS_ROBOTKEZ = False
    logging.warning("RobotkezV2 not available - Gmail fallback disabled")

logger = logging.getLogger(__name__)


class GmailInvoiceError(Exception):
    """Gmail Invoice kliens hiba."""
    pass


class GmailInvoiceClient:
    """
    Gmail Invoice Fallback Client - PDF letöltés Robotkéz-zel.
    
    Attributes:
        gmail_email (str): Gmail email cím
        gmail_password (str): Gmail jelszó (vagy App Password)
        download_dir (str): PDF letöltési mappa
        search_from (str): Email feladó szűrő (pl: "szamlazz.hu")
        search_subject (str): Tárgy szűrő (pl: "számla")
    """

    def __init__(
        self,
        gmail_email: Optional[str] = None,
        gmail_password: Optional[str] = None,
        download_dir: str = "./data/invoices/gmail",
        search_from: str = "szamlazz.hu",
        search_subject: str = "számla",
        headless: bool = True,
    ):
        """
        Inicializálás.
        
        Args:
            gmail_email: Gmail cím (env: GMAIL_EMAIL)
            gmail_password: Gmail jelszó (env: GMAIL_PASSWORD vagy GMAIL_APP_PASSWORD)
            download_dir: PDF letöltési mappa
            search_from: Email feladó szűrő
            search_subject: Tárgy szűrő
            headless: Headless browser mode (True = háttérben fut)
        """
        self.gmail_email = gmail_email or os.getenv("GMAIL_EMAIL", "")
        self.gmail_password = gmail_password or os.getenv("GMAIL_APP_PASSWORD", "") or os.getenv("GMAIL_PASSWORD", "")
        self.download_dir = Path(download_dir)
        self.search_from = search_from
        self.search_subject = search_subject
        self.headless = headless

        if not self.gmail_email or not self.gmail_password:
            logger.warning("Gmail credentials not configured - Gmail fallback disabled")

        if not HAS_ROBOTKEZ:
            raise GmailInvoiceError("RobotkezV2 not installed - cannot use Gmail fallback")

        # Robotkéz inicializálása
        self.robot = RobotkezV2(default_mode="browser-use", headless=self.headless)

        # Download mappa létrehozása
        self.download_dir.mkdir(parents=True, exist_ok=True)

        logger.info(f"[GmailInvoiceClient] Initialized (email={self.gmail_email[:10]}...)")


    async def fetch_invoice_pdfs(
        self,
        days_back: int = 30,
        max_emails: int = 50,
    ) -> List[Dict[str, Any]]:
        """
        Számla PDF-ek letöltése Gmailből.
        
        Args:
            days_back: Hány napra visszamenőleg keressen emaileket
            max_emails: Maximum emailek száma
            
        Returns:
            Lista a letöltött PDF-ek metadata-jával:
            [
                {
                    "filename": "invoice_2026_02_17_123.pdf",
                    "path": "/full/path/to/file.pdf",
                    "email_subject": "Új számla - XYZ Kft",
                    "email_from": "szamlazz.hu",
                    "email_date": "2026-02-17",
                    "source": "gmail",
                    "downloaded_at": "2026-02-17T15:30:00Z"
                }
            ]
        """
        if not self.gmail_email or not self.gmail_password:
            raise GmailInvoiceError("Gmail credentials not configured")

        logger.info(f"[GmailInvoiceClient] Fetching invoices from last {days_back} days...")

        try:
            # Gmail bejelentkezés + számla keresés + PDF letöltés
            instruction = self._build_gmail_instruction(days_back, max_emails)
            
            result: RobotkezResult = await self.robot.execute(
                instruction,
                mode="browser-use",
                timeout=300,  # 5 perc timeout (bejelentkezés + keresés + letöltés)
            )

            if not result.success:
                raise GmailInvoiceError(f"Robotkéz execution failed: {result.error}")

            # Parse result and map to invoice metadata
            downloaded_files = self._parse_robotkez_result(result)

            logger.info(f"[GmailInvoiceClient] Successfully downloaded {len(downloaded_files)} invoice PDFs")
            return downloaded_files

        except Exception as e:
            logger.error(f"[GmailInvoiceClient] Error fetching invoices: {e}")
            raise GmailInvoiceError(f"Failed to fetch invoices from Gmail: {e}")


    def _build_gmail_instruction(self, days_back: int, max_emails: int) -> str:
        """
        Gmail automation instruction építése a Robotkéz számára.
        
        Returns:
            Natural language instruction string
        """
        start_date = (datetime.now() - timedelta(days=days_back)).strftime("%Y/%m/%d")
        
        instruction = f"""
Go to Gmail and log in with email: {self.gmail_email} and password: {self.gmail_password}.

After logging in successfully:
1. Search for emails with these filters:
   - From: {self.search_from}
   - Subject contains: {self.search_subject}
   - Date: after {start_date}
   - Maximum: {max_emails} emails

2. For each email found:
   - Open the email
   - Find and download PDF attachments (invoice files)
   - Save them to: {self.download_dir}
   - Extract email metadata (subject, from, date)

3. Return a JSON array with all downloaded files and their metadata.

Download directory: {self.download_dir}
Expected output: JSON array of downloaded invoice PDFs with metadata.
"""
        return instruction.strip()


    def _parse_robotkez_result(self, result: RobotkezResult) -> List[Dict[str, Any]]:
        """
        Robotkéz eredmény parse-olása invoice metadata listára.
        
        Args:
            result: RobotkezResult objektum
            
        Returns:
            Lista a letöltött fájlok metadata-jával
        """
        downloaded_files = []

        # Ha a Robotkéz visszaad strukturált JSON-t, parse-oljuk
        if isinstance(result.result, list):
            downloaded_files = result.result
        elif isinstance(result.result, dict) and "files" in result.result:
            downloaded_files = result.result["files"]
        else:
            # Fallback: Scan download directory for new files
            logger.warning("[GmailInvoiceClient] No structured result, scanning download directory...")
            downloaded_files = self._scan_download_directory()

        # Normalize metadata
        normalized = []
        for file_info in downloaded_files:
            if isinstance(file_info, str):
                # Simple filename string
                normalized.append({
                    "filename": Path(file_info).name,
                    "path": str(Path(file_info).resolve()),
                    "source": "gmail",
                    "downloaded_at": datetime.now().isoformat(),
                })
            elif isinstance(file_info, dict):
                # Already has metadata
                normalized.append({
                    "filename": file_info.get("filename", "unknown.pdf"),
                    "path": file_info.get("path", ""),
                    "email_subject": file_info.get("email_subject", ""),
                    "email_from": file_info.get("email_from", self.search_from),
                    "email_date": file_info.get("email_date", ""),
                    "source": "gmail",
                    "downloaded_at": file_info.get("downloaded_at", datetime.now().isoformat()),
                })

        return normalized


    def _scan_download_directory(self) -> List[Dict[str, Any]]:
        """
        Scan download directory for recently downloaded PDFs.
        
        Returns:
            Lista a talált fájlokról
        """
        files = []
        
        if not self.download_dir.exists():
            return files

        # Keresés PDF fájlokra (utolsó 1 órában módosított)
        one_hour_ago = datetime.now().timestamp() - 3600

        for pdf_file in self.download_dir.glob("*.pdf"):
            if pdf_file.stat().st_mtime > one_hour_ago:
                files.append({
                    "filename": pdf_file.name,
                    "path": str(pdf_file.resolve()),
                    "source": "gmail",
                    "downloaded_at": datetime.now().isoformat(),
                })

        logger.info(f"[GmailInvoiceClient] Found {len(files)} recent PDF files in {self.download_dir}")
        return files


    async def test_connection(self) -> bool:
        """
        Teszt: Gmail login és inbox elérés.
        
        Returns:
            True ha sikeres a bejelentkezés
        """
        if not self.gmail_email or not self.gmail_password:
            return False

        try:
            instruction = f"""
Go to Gmail and log in with email: {self.gmail_email} and password: {self.gmail_password}.
After successful login, verify that the inbox is accessible and return 'SUCCESS'.
"""
            result: RobotkezResult = await self.robot.execute(
                instruction,
                mode="browser-use",
                timeout=60,
            )

            return result.success

        except Exception as e:
            logger.error(f"[GmailInvoiceClient] Connection test failed: {e}")
            return False


# Factory function for easy import
def create_gmail_client(
    gmail_email: Optional[str] = None,
    gmail_password: Optional[str] = None,
    **kwargs
) -> GmailInvoiceClient:
    """
    Factory function - Gmail kliens létrehozása.
    
    Args:
        gmail_email: Gmail cím (opcionális, .env-ből olvassa)
        gmail_password: Gmail jelszó (opcionális, .env-ből olvassa)
        **kwargs: További paraméterek
        
    Returns:
        GmailInvoiceClient instance
    """
    return GmailInvoiceClient(
        gmail_email=gmail_email,
        gmail_password=gmail_password,
        **kwargs
    )
