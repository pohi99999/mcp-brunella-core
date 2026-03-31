"""
Gmail Invoice Fallback - Ha a Szamlazz.hu API nem elérhető
Számlák kinyerése Gmail-ből és email attachments feldolgozása.
"""

import os
import logging
import base64
import re
from datetime import date, datetime
from typing import List, Dict, Any, Optional
from email.mime.text import MIMEText

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google.oauth2.service_account import Credentials as ServiceAccountCredentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from myai.schemas.invoice import InvoiceData

logger = logging.getLogger(__name__)

# Gmail API scopes
GMAIL_SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']


class GmailInvoiceFallback:
    """
    Gmail fallback kliens számlák kinyeréséhez email-ből.
    
    Felhasználás:
    - Ha Szamlazz.hu API nem elérhető
    - Automatikus szám-kinyerés email body-ból
    - Attachment ParseR (PDF, CSV)
    """

    def __init__(self, credentials_file: Optional[str] = None, user_email: str = "me"):
        """
        Inicializálás.
        
        Args:
            credentials_file: Google Cloud service account JSON
            user_email: Gmail felhasználó (default: 'me' = authenticated user)
        """
        self.user_email = user_email
        self.token_file = os.getenv("GMAIL_TOKEN_FILE", "token.json")
        self.credentials_file = credentials_file or os.getenv("GOOGLE_CREDENTIALS_FILE")
        self.service = None
        self._authenticate()

    def _authenticate(self) -> None:
        """Google OAuth2 autentikáció."""
        try:
            if self.credentials_file and os.path.exists(self.credentials_file):
                # Service account flow
                self.service = build(
                    'gmail', 'v1',
                    credentials=ServiceAccountCredentials.from_service_account_file(
                        self.credentials_file,
                        scopes=GMAIL_SCOPES
                    )
                )
                logger.info("[OK] Gmail API autentifikacio: Service Account")
            else:
                # OAuth2 flow
                creds = None
                if os.path.exists(self.token_file):
                    creds = Credentials.from_authorized_user_file(self.token_file, GMAIL_SCOPES)
                
                if not creds or not creds.valid:
                    if creds and creds.expired and creds.refresh_token:
                        creds.refresh(Request())
                    else:
                        logger.warning("[WARN] Gmail OAuth2 credentials nem konfiguralva")
                        return

                self.service = build('gmail', 'v1', credentials=creds)
                logger.info("[OK] Gmail API autentifikacio: OAuth2")

        except Exception as e:
            logger.error(f"[ERROR] Gmail autentifikacio hiba: {e}")
            self.service = None

    def search_invoice_emails(self, query: str = "szamla") -> List[str]:
        """
        Email-ek keresése szám kulcsszavakkal.
        
        Args:
            query: Gmail search query (default: 'szamla' = invoice)
            
        Returns:
            Email ID lista
        """
        if not self.service:
            logger.error("[ERROR] Gmail service nem elerheto")
            return []

        try:
            results = self.service.users().messages().list(
                userId=self.user_email,
                q=query,
                maxResults=100
            ).execute()

            messages = results.get('messages', [])
            email_ids = [msg['id'] for msg in messages]
            
            logger.info(f"[OK] {len(email_ids)} szam-email talalva a Gmail-ben")
            return email_ids

        except HttpError as e:
            logger.error(f"[ERROR] Gmail search hiba: {e}")
            return []

    def extract_invoice_from_email(self, message_id: str) -> Optional[InvoiceData]:
        """
        Számla adatok kinyerése egy emailből.
        
        Args:
            message_id: Gmail message ID
            
        Returns:
            InvoiceData object vagy None
        """
        if not self.service:
            logger.error("[ERROR] Gmail service nem elerheto")
            return None

        try:
            message = self.service.users().messages().get(
                userId=self.user_email,
                id=message_id,
                format='full'
            ).execute()

            headers = message['payload']['headers']
            subject = next((h['value'] for h in headers if h['name'] == 'Subject'), '')
            from_email = next((h['value'] for h in headers if h['name'] == 'From'), '')
            date_str = next((h['value'] for h in headers if h['name'] == 'Date'), '')

            # Email body lekérése
            body = self._get_message_body(message)

            # Számlaszám kinyerése
            invoice_no = self._extract_invoice_number(subject + " " + body)
            if not invoice_no:
                logger.warning(f"[WARN] Nincs szam szam az emailben: {subject}")
                return None

            # Partner név kinyerése
            partner = self._extract_partner_name(from_email, body)

            # Összegek kinyerése
            amount, vat_amount, vat_rate = self._extract_amounts(body)
            
            if amount is None:
                logger.warning(f"[WARN] Nincs osszeg az emailben: {invoice_no}")
                return None

            # Dátumok kinyerése
            invoice_date = self._parse_email_date(date_str)
            if not invoice_date:
                invoice_date = date.today()

            due_date = self._extract_due_date(body) or invoice_date

            # InvoiceData objektum létrehozása
            invoice = InvoiceData(
                partner=partner,
                amount=amount,
                vat_amount=vat_amount,
                vat_rate=vat_rate,
                invoice_date=invoice_date,
                due_date=due_date,
                invoice_no=invoice_no,
                total_amount=amount + vat_amount,
                description=f"Gmail: {subject}",
                currency="HUF",
                payment_status="pending",
                source="gmail",
            )

            logger.info(f"[OK] Szamla kinyerve Gmail-bol: {invoice_no}")
            return invoice

        except HttpError as e:
            logger.error(f"[ERROR] Email feldolgozas hiba: {e}")
            return None

    def get_invoices_from_gmail(self, query: str = "szamla") -> List[InvoiceData]:
        """
        Összes számla lekérése Gmail-ből.
        
        Args:
            query: Email search query
            
        Returns:
            InvoiceData objektumok listája
        """
        email_ids = self.search_invoice_emails(query)
        invoices = []

        for email_id in email_ids:
            invoice = self.extract_invoice_from_email(email_id)
            if invoice:
                invoices.append(invoice)

        logger.info(f"[OK] {len(invoices)} szamla kinyerve Gmail-bol")
        return invoices

    @staticmethod
    def _get_message_body(message: Dict[str, Any]) -> str:
        """Email body szövegének kinyerése."""
        try:
            payload = message['payload']
            
            if 'parts' in payload:
                # Multipart message
                for part in payload['parts']:
                    if part['mimeType'] == 'text/plain':
                        if 'data' in part['body']:
                            return base64.urlsafe_b64decode(part['body']['data']).decode('utf-8')
            else:
                # Simple message
                if 'data' in payload['body']:
                    return base64.urlsafe_b64decode(payload['body']['data']).decode('utf-8')

            return ""
        except Exception as e:
            logger.error(f"[ERROR] Email body kinyeres hiba: {e}")
            return ""

    @staticmethod
    def _extract_invoice_number(text: str) -> Optional[str]:
        """Szám szám kinyerése szövegből."""
        # Minták: 2026-00123, 2026/00123, #2026-00123, stb.
        patterns = [
            r'(?:szám|invoice|#)?\s*(\d{4}[-/]\d{3,6})',  # 2026-00123
            r'szám\s*(?:szám)?:?\s*(\d{3,10})',           # szám: 000123
            r'(?:szám|invoice)\s*(\d{3,10})',             # szám 000123
            r'INV[-/]?(\d{3,10})',                        # INV-000123
        ]

        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(1)

        return None

    @staticmethod
    def _extract_partner_name(from_email: str, body: str) -> str:
        """Partner/felad ó név kinyerése."""
        # Email-ből vagy email display name-ből
        if '<' in from_email:
            name = from_email.split('<')[0].strip()
            if name:
                return name

        # Szövegből: "cég neve: " vagy "From: "
        match = re.search(r'(?:cég|partner|feladó):\s*([A-Z][^\n,]+)', body, re.IGNORECASE)
        if match:
            return match.group(1).strip()

        return from_email.replace('<', '').replace('>', '')

    @staticmethod
    def _extract_amounts(text: str) -> tuple[Optional[float], Optional[float], float]:
        """Összegek (nettó, áfa) kinyerése (HUF)."""
        # Nettó összeg
        netto_patterns = [
            r'nettó:?\s*([\d\s,.\-]+)',
            r'net:?\s*([\d\s,.\-]+)',
            r'összesen\s*nettó:?\s*([\d\s,.\-]+)',
        ]

        amount = None
        for pattern in netto_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                amount_str = match.group(1).replace(' ', '').replace(',', '.')
                try:
                    amount = float(amount_str)
                    break
                except ValueError:
                    pass

        # ÁFA összeg
        vat_patterns = [
            r'áfa:?\s*([\d\s,.\-]+)',
            r'vat:?\s*([\d\s,.\-]+)',
            r'megnevezés.*?áfa:?\s*([\d\s,.\-]+)',
        ]

        vat_amount = None
        for pattern in vat_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                vat_str = match.group(1).replace(' ', '').replace(',', '.')
                try:
                    vat_amount = float(vat_str)
                    break
                except ValueError:
                    pass

        # ÁFA ráta (default 27%)
        vat_rate = 27.0
        rate_match = re.search(r'áfa\s*(%|mérték)?:?\s*(\d{1,2}(?:[.,]\d+)?)', text, re.IGNORECASE)
        if rate_match:
            try:
                vat_rate = float(rate_match.group(2).replace(',', '.'))
            except ValueError:
                pass

        # Ha nincs vat_amount, számoljuk ki az amount-ból
        if amount and vat_amount is None:
            vat_amount = amount * (vat_rate / 100)

        return amount, vat_amount, vat_rate

    @staticmethod
    def _extract_due_date(text: str) -> Optional[date]:
        """Fizetési határidő kinyerése."""
        patterns = [
            r'határidő:?\s*(\d{1,2}[.\-/]\d{1,2}[.\-/]\d{4})',
            r'dátum:?\s*(\d{1,2}[.\-/]\d{1,2}[.\-/]\d{4})',
            r"(?:until|till|due)[\s:]*(\d{1,2}[.\-/]\d{1,2}[.\-/]\d{4})",
        ]

        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                try:
                    date_str = match.group(1)
                    # Próbálj több formátumot
                    for fmt in ['%d.%m.%Y', '%d-%m-%Y', '%d/%m/%Y', '%d.%m.%y']:
                        try:
                            return datetime.strptime(date_str, fmt).date()
                        except ValueError:
                            pass
                except Exception:
                    pass

        return None

    @staticmethod
    def _parse_email_date(date_str: str) -> Optional[date]:
        """Email dátum stringből date objektum."""
        try:
            # RFC 2822 formátum: Mon, 17 Feb 2026 10:30:00 +0100
            dt = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
            return dt.date()
        except Exception:
            pass

        # Alternative formats
        formats = [
            '%d.%m.%Y',
            '%Y-%m-%d',
            '%d/%m/%Y',
        ]

        for fmt in formats:
            try:
                return datetime.strptime(date_str[:10], fmt).date()
            except (ValueError, IndexError):
                pass

        return None
