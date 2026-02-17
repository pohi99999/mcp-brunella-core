"""
Enhanced Számlázz.hu kliens - Caching, fallback, és robusztus error handling.
"""

import os
import json
import logging
from datetime import datetime, date, timedelta
from typing import List, Dict, Any, Optional
from pathlib import Path
import hashlib

from myai.clients.szamlazz_hu_client import SzamlazzHuClient, SzamlazzHuError
from myai.clients.gmail_invoice_client import GmailInvoiceClient, GmailInvoiceError
from myai.schemas.invoice import InvoiceData

logger = logging.getLogger(__name__)


class InvoiceCache:
    """Egyszerű file-based cache az invoice adatokhoz."""

    def __init__(self, cache_dir: str = ".cache/invoices"):
        """
        Inicializálás.
        
        Args:
            cache_dir: Cache könyvtár (default: .cache/invoices)
        """
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.ttl = 24 * 3600  # 24 óra

    def _get_cache_key(self, params: Dict[str, Any]) -> str:
        """Param-ből cache key generálása."""
        param_str = json.dumps(params, sort_keys=True)
        return hashlib.md5(param_str.encode()).hexdigest()

    def _get_cache_file(self, cache_key: str) -> Path:
        """Cache file path."""
        return self.cache_dir / f"{cache_key}.json"

    def get(self, params: Dict[str, Any]) -> Optional[List[Dict[str, Any]]]:
        """
        Cache-ből data lekérése.
        
        Args:
            params: Query paraméterek
            
        Returns:
            Cached data vagy None ha expired
        """
        cache_key = self._get_cache_key(params)
        cache_file = self._get_cache_file(cache_key)

        if not cache_file.exists():
            return None

        try:
            with open(cache_file, 'r', encoding='utf-8') as f:
                data = json.load(f)

            # TTL ellenőrzés
            cached_at = datetime.fromisoformat(data['cached_at'])
            if (datetime.now() - cached_at).total_seconds() > self.ttl:
                cache_file.unlink()  # Töröld el az expired cache-t
                return None

            logger.info(f"Cache hit: {cache_key}")
            return data['invoices']

        except Exception as e:
            logger.error(f"Cache read error: {e}")
            return None

    def set(self, params: Dict[str, Any], invoices: List[Dict[str, Any]]) -> None:
        """
        Data mentése cache-be.
        
        Args:
            params: Query paraméterek
            invoices: Számla adatok
        """
        cache_key = self._get_cache_key(params)
        cache_file = self._get_cache_file(cache_key)

        try:
            data = {
                'cached_at': datetime.now().isoformat(),
                'params': params,
                'invoices': invoices,
            }

            with open(cache_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2, default=str)

            logger.info(f"Cache write: {cache_key}")

        except Exception as e:
            logger.error(f"Cache write error: {e}")

    def clear(self) -> None:
        """Összes cache törlése."""
        try:
            for cache_file in self.cache_dir.glob('*.json'):
                cache_file.unlink()
            logger.info("Cache cleared")
        except Exception as e:
            logger.error(f"Cache clear error: {e}")


class EnhancedInvoiceClient:
    """
    Enhanced invoice kliens - Szamlazz.hu + Gmail fallback + caching.
    
    Features:
    - Szamlazz.hu API primary source
    - Gmail fallback ha API down
    - File-based caching (24h TTL)
    - Robust error handling
    - Deduplikáció
    """

    def __init__(
        self,
        cache_dir: str = ".cache/invoices",
        api_key: Optional[str] = None,
        account_id: Optional[str] = None,
        gmail_email: Optional[str] = None,
        gmail_password: Optional[str] = None,
    ):
        """
        Inicializálás.
        
        Args:
            cache_dir: Cache könyvtár
            api_key: Szamlazz.hu API key
            account_id: Szamlazz.hu account ID
            gmail_email: Gmail cím (env: GMAIL_EMAIL)
            gmail_password: Gmail jelszó (env: GMAIL_APP_PASSWORD)
        """
        self.cache = InvoiceCache(cache_dir)
        self.szamlazz_client = SzamlazzHuClient(api_key=api_key, account_id=account_id)
        self.gmail_client = None
        
        # Gmail fallback inicializálása (csak ha credentials elérhető)
        if gmail_email or os.getenv("GMAIL_EMAIL"):
            try:
                self.gmail_client = GmailInvoiceClient(
                    gmail_email=gmail_email,
                    gmail_password=gmail_password,
                )
                logger.info("Gmail fallback inicializálva")
            except Exception as e:
                logger.warning(f"Gmail fallback init failed: {e}")

    def _deduplicate_invoices(self, invoices: List[InvoiceData]) -> List[InvoiceData]:
        """Duplikátumok eltávolítása invoice_no alapján."""
        seen = set()
        result = []

        for invoice in invoices:
            key = (invoice.invoice_no, invoice.partner, invoice.amount)
            if key not in seen:
                seen.add(key)
                result.append(invoice)

        if len(invoices) != len(result):
            logger.info(f"Deduplicated: {len(invoices)} -> {len(result)}")

        return result

    def get_invoices(
        self,
        since_date: Optional[date] = None,
        limit: int = 100,
        force_refresh: bool = False,
    ) -> List[InvoiceData]:
        """
        Számlák lekérése - Szamlazz.hu (primary) + Gmail fallback.
        
        Args:
            since_date: Szűrés start dátumtól (optional)
            limit: Maximum számlák száma
            force_refresh: Cache bypass flag
            
        Returns:
            InvoiceData objektumok listája
        """
        # Cache check
        cache_params = {
            'since_date': since_date.isoformat() if since_date else None,
            'limit': limit,
        }

        if not force_refresh:
            cached = self.cache.get(cache_params)
            if cached:
                return [InvoiceData(**inv) for inv in cached]

        invoices = []

        # 1. Try Szamlazz.hu API
        try:
            logger.info("Fetching from Szamlazz.hu API...")
            if since_date:
                szamlazz_invoices = self.szamlazz_client.get_invoices_since(since_date)
            else:
                szamlazz_invoices = self.szamlazz_client.get_invoices(limit=limit)

            invoices.extend(szamlazz_invoices)
            logger.info(f"✅ Szamlazz.hu: {len(szamlazz_invoices)} számlá")

        except SzamlazzHuError as e:
            logger.warning(f"Szamlazz.hu API failed: {e}")
            # Continue to fallback

        # 2. Try Gmail fallback
        if self.gmail_client:
            try:
                logger.info("Falling back to Gmail...")
                
                # Async Gmail fallback - run in sync context
                import asyncio
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                
                try:
                    days_back = (date.today() - (since_date or (date.today() - timedelta(days=30)))).days
                    gmail_pdfs = loop.run_until_complete(
                        self.gmail_client.fetch_invoice_pdfs(days_back=days_back, max_emails=limit)
                    )
                    
                    logger.info(f"✅ Gmail fallback: {len(gmail_pdfs)} PDF downloaded")
                    
                    # Note: Phase 3-ban ezt majd parse-oljuk InvoiceData-vá (OCR + extraction)
                    # Egyelőre csak a metadata-t log-oljuk
                    for pdf in gmail_pdfs:
                        logger.info(f"  - {pdf.get('filename')} from {pdf.get('email_from', 'unknown')}")
                    
                finally:
                    loop.close()

            except GmailInvoiceError as e:
                logger.warning(f"Gmail fallback failed: {e}")
            except Exception as e:
                logger.warning(f"Gmail fallback error: {e}")

        # 3. Deduplicate + sort
        invoices = self._deduplicate_invoices(invoices)
        invoices.sort(key=lambda x: x.invoice_date, reverse=True)

        # 4. Cache result
        if invoices:
            cached_data = [inv.dict() for inv in invoices]
            self.cache.set(cache_params, cached_data)

        logger.info(f"📊 Total invoices: {len(invoices)}")
        return invoices

    def get_recent_invoices(self, days: int = 30) -> List[InvoiceData]:
        """
        Legutóbbi N napi számlák.
        
        Args:
            days: Napok száma (default: 30)
            
        Returns:
            InvoiceData lista
        """
        since_date = date.today() - timedelta(days=days)
        return self.get_invoices(since_date=since_date)

    def get_overdue_invoices(self) -> List[InvoiceData]:
        """Lejárt határidejű számlák."""
        invoices = self.get_invoices()
        today = date.today()
        return [
            inv for inv in invoices
            if inv.due_date < today and inv.payment_status != 'paid'
        ]

    def get_unpaid_invoices(self) -> List[InvoiceData]:
        """Nem fizetett számlák."""
        invoices = self.get_invoices()
        return [
            inv for inv in invoices
            if inv.payment_status in ('pending', 'partial', 'overdue')
        ]

    def clear_cache(self) -> None:
        """Cache törlése."""
        self.cache.clear()

    def health_check(self) -> Dict[str, Any]:
        """Rendszerstátusz ellenőrzés."""
        return {
            'szamlazz_api': self.szamlazz_client.test_connection(),
            'gmail_fallback': self.gmail_client is not None,
            'cache_dir': str(self.cache.cache_dir),
            'cache_ttl': f"{self.cache.ttl // 3600}h",
            'timestamp': datetime.now().isoformat(),
        }
