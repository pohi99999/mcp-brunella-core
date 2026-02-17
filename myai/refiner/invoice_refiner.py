"""
Invoice Data Refiner - Phase 3: Refine & Index

Felelősség:
- Invoice adatok validálása Pydantic schema szerint
- Adat normalizálás (dátumok, összegek, devizák)
- Szemantikus embedding generálás
- LanceDB indexelés RAG lekérdezésekhez
"""

import logging
import os
import json
from datetime import datetime
from typing import List, Dict, Any, Optional
from pathlib import Path

# Pydantic schema import
try:
    from myai.schemas.invoice import InvoiceData
except ImportError:
    from schemas.invoice import InvoiceData

# LanceDB support
try:
    import lancedb
    import pyarrow as pa
    HAS_LANCEDB = True
except ImportError:
    lancedb = None
    pa = None
    HAS_LANCEDB = False

# Ollama embedding support
try:
    import ollama
    HAS_OLLAMA = True
except ImportError:
    ollama = None
    HAS_OLLAMA = False

# Project root
PROJECT_ROOT = Path(__file__).parent.parent.parent
LOG_DIR = PROJECT_ROOT / 'logs'
LOG_FILE = LOG_DIR / 'invoice_refiner.log'

LOG_DIR.mkdir(parents=True, exist_ok=True)

logging.basicConfig(
    filename=str(LOG_FILE),
    level=logging.INFO,
    format='{"time": "%(asctime)s", "level": "%(levelname)s", "message": %(message)s}'
)

logger = logging.getLogger(__name__)


class InvoiceRefiner:
    """Invoice adatok tisztítása, validálása és indexelése."""
    
    def __init__(
        self,
        lancedb_path: Optional[str] = None,
        embedding_model: str = "mxbai-embed-large",
        embedding_dim: int = 1024
    ):
        """
        Args:
            lancedb_path: LanceDB adatbázis elérési útja
            embedding_model: Ollama embedding model neve
            embedding_dim: Embedding dimenzió
        """
        self.lancedb_path = lancedb_path or str(PROJECT_ROOT / 'data' / 'brunella_lancedb_python')
        self.embedding_model = embedding_model
        self.embedding_dim = embedding_dim
        
        logger.info(json.dumps({
            "status": "INIT",
            "lancedb_path": self.lancedb_path,
            "embedding_model": embedding_model,
            "embedding_dim": embedding_dim
        }))
    
    def validate_invoice(self, invoice_data: Dict[str, Any]) -> Optional[InvoiceData]:
        """
        Számla adat validálása Pydantic schema szerint.
        
        Args:
            invoice_data: Nyers számla adat dict
            
        Returns:
            InvoiceData objektum vagy None (ha validálás sikertelen)
        """
        try:
            validated = InvoiceData.model_validate(invoice_data)
            logger.info(json.dumps({
                "status": "VALIDATED",
                "invoice_no": validated.invoice_no
            }))
            return validated
        except Exception as e:
            # JSON-safe serialization for error log
            safe_invoice_data = str(invoice_data)  # Convert to string to avoid date serialization issues
            logger.error(json.dumps({
                "status": "VALIDATION_FAILED",
                "error": str(e),
                "invoice_data_summary": safe_invoice_data[:200]  # First 200 chars only
            }))
            return None
    
    def normalize_invoice(self, invoice: InvoiceData) -> Dict[str, Any]:
        """
        Számla adat normalizálása (dátumok, összegek, devizák).
        
        Args:
            invoice: Validált InvoiceData objektum
            
        Returns:
            Normalizált dict
        """
        # model_dump() használva Pydantic v2+ miatt
        normalized = invoice.model_dump(mode='json')  # JSON-compatible serialization
        
        # Összegek normalizálása (None check, 0 is valid value)
        if invoice.total_amount is not None:
            normalized['total_amount_normalized'] = float(invoice.total_amount)
        
        # Deviza uppercase
        if invoice.currency:
            normalized['currency_normalized'] = invoice.currency.upper()
        
        # Metadata hozzáadása
        normalized['refined_at'] = datetime.now().isoformat()
        normalized['source'] = invoice.source or "unknown"
        
        logger.info(json.dumps({
            "status": "NORMALIZED",
            "invoice_no": invoice.invoice_no
        }))
        
        return normalized
    
    def _generate_embedding(self, text: str) -> List[float]:
        """
        Szöveg embedding generálása Ollama modellel.
        
        Args:
            text: Input szöveg
            
        Returns:
            Embedding vektor (1024 dimenzió)
        """
        if not HAS_OLLAMA:
            logger.warning(json.dumps({
                "status": "OLLAMA_MISSING",
                "fallback": "zero_vector"
            }))
            return [0.0] * self.embedding_dim
        
        try:
            response = ollama.embeddings(
                model=self.embedding_model,
                prompt=text
            )
            embedding = response.get("embedding", [0.0] * self.embedding_dim)
            
            if len(embedding) != self.embedding_dim:
                logger.warning(json.dumps({
                    "status": "EMBEDDING_DIM_MISMATCH",
                    "expected": self.embedding_dim,
                    "actual": len(embedding)
                }))
                # Pad or truncate
                if len(embedding) < self.embedding_dim:
                    embedding.extend([0.0] * (self.embedding_dim - len(embedding)))
                else:
                    embedding = embedding[:self.embedding_dim]
            
            return embedding
        except Exception as e:
            logger.error(json.dumps({
                "status": "EMBEDDING_FAILED",
                "error": str(e)
            }))
            return [0.0] * self.embedding_dim
    
    def _build_search_text(self, invoice: InvoiceData) -> str:
        """
        Szemantikus kereséshez szükséges szöveg összeállítása.
        
        Args:
            invoice: InvoiceData objektum
            
        Returns:
            Kereshető szöveg
        """
        parts = [
            f"Invoice {invoice.invoice_no}",
            f"Partner: {invoice.partner}",
            f"Amount: {invoice.total_amount} {invoice.currency}",
            f"Issue Date: {invoice.invoice_date}",
        ]
        
        if invoice.due_date:
            parts.append(f"Payment Deadline: {invoice.due_date}")
        
        if invoice.description:
            parts.append(f"Description: {invoice.description}")
        
        return " | ".join(parts)
    
    async def save_to_lancedb(self, invoices: List[InvoiceData]) -> bool:
        """
        Számlák indexelése LanceDB-be szemantikus kereséssel.
        
        Args:
            invoices: Validált InvoiceData objektumok listája
            
        Returns:
            True ha sikeres, False egyébként
        """
        if not HAS_LANCEDB:
            logger.error(json.dumps({
                "status": "LANCEDB_MISSING",
                "action": "SKIP_INDEX"
            }))
            return False
        
        try:
            # LanceDB mappa létrehozás
            os.makedirs(self.lancedb_path, exist_ok=True)
            
            # Kapcsolódás LanceDB-hez
            db = await lancedb.connect_async(self.lancedb_path)
            table_list = await db.list_tables()  # Updated from deprecated table_names()
            # list_tables() returns paged result with .tables attribute, or simple list
            table_names = table_list.tables if hasattr(table_list, 'tables') else list(table_list)
            
            # Tábla létrehozás vagy megnyitás
            table = None
            if "invoices_refined" in table_names:
                table = await db.open_table("invoices_refined")
            else:
                # LanceDB séma definiálása
                schema = pa.schema([
                    pa.Field("vector", pa.list_(pa.float32(), self.embedding_dim)),
                    pa.Field("invoice_no", pa.string()),
                    pa.Field("partner", pa.string()),
                    pa.Field("amount", pa.float64()),
                    pa.Field("vat_amount", pa.float64()),
                    pa.Field("total_amount", pa.float64()),
                    pa.Field("currency", pa.string()),
                    pa.Field("invoice_date", pa.string()),
                    pa.Field("due_date", pa.string()),
                    pa.Field("payment_status", pa.string()),
                    pa.Field("source", pa.string()),
                    pa.Field("description", pa.string()),
                    pa.Field("search_text", pa.string()),
                    pa.Field("metadata", pa.string()),
                    pa.Field("refined_at", pa.string())
                ])
                table = await db.create_table("invoices_refined", schema=schema)
            
            # Batch insert
            records = []
            for invoice in invoices:
                search_text = self._build_search_text(invoice)
                embedding = self._generate_embedding(search_text)
                normalized = self.normalize_invoice(invoice)
                
                record = {
                    "vector": embedding,
                    "invoice_no": invoice.invoice_no or "",
                    "partner": invoice.partner or "",
                    "amount": float(invoice.amount) if invoice.amount else 0.0,
                    "vat_amount": float(invoice.vat_amount) if invoice.vat_amount else 0.0,
                    "total_amount": float(invoice.total_amount) if invoice.total_amount else 0.0,
                    "currency": invoice.currency or "HUF",
                    "invoice_date": str(invoice.invoice_date) if invoice.invoice_date else "",
                    "due_date": str(invoice.due_date) if invoice.due_date else "",
                    "payment_status": invoice.payment_status or "unknown",
                    "source": invoice.source or "unknown",
                    "description": invoice.description or "",
                    "search_text": search_text,
                    "metadata": json.dumps(normalized),
                    "refined_at": datetime.now().isoformat()
                }
                records.append(record)
            
            # Batch write
            await table.add(records)
            
            logger.info(json.dumps({
                "status": "LANCEDB_INDEXED",
                "count": len(invoices),
                "table": "invoices_refined"
            }))
            
            return True
        
        except Exception as e:
            logger.error(json.dumps({
                "status": "LANCEDB_INDEX_FAILED",
                "error": str(e)
            }))
            return False
    
    async def refine_and_index(self, raw_invoices: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Teljes refine & index pipeline futtatása.
        
        Args:
            raw_invoices: Nyers számla adatok listája
            
        Returns:
            Pipeline eredmény dict
        """
        logger.info(json.dumps({
            "status": "REFINE_PIPELINE_START",
            "count": len(raw_invoices)
        }))
        
        # 1. Validálás
        validated_invoices = []
        validation_errors = []
        
        for raw_invoice in raw_invoices:
            validated = self.validate_invoice(raw_invoice)
            if validated:
                validated_invoices.append(validated)
            else:
                validation_errors.append(raw_invoice)
        
        # 2. Indexelés
        index_success = False
        if validated_invoices:
            index_success = await self.save_to_lancedb(validated_invoices)
        
        result = {
            "status": "COMPLETE" if index_success else "PARTIAL",
            "total_input": len(raw_invoices),
            "validated": len(validated_invoices),
            "validation_errors": len(validation_errors),
            "indexed": len(validated_invoices) if index_success else 0,
            "error_details": validation_errors[:5]  # Max 5 példa
        }
        
        logger.info(json.dumps({
            "status": "REFINE_PIPELINE_COMPLETE",
            "result": result
        }))
        
        return result


# CLI teszt használat
if __name__ == "__main__":
    import asyncio
    from datetime import date
    
    async def test():
        refiner = InvoiceRefiner()
        
        # Teszt adat
        test_invoice = {
            "partner": "Test Customer Ltd.",
            "amount": 150000.0,
            "vat_amount": 40500.0,
            "vat_rate": 27.0,
            "invoice_date": date(2024, 1, 15),
            "due_date": date(2024, 2, 15),
            "invoice_no": "TEST-2024-001",
            "total_amount": 190500.0,
            "currency": "HUF",
            "payment_status": "paid",
            "source": "szamlazz_api",
            "description": "Test invoice for Phase 3 validation"
        }
        
        result = await refiner.refine_and_index([test_invoice])
        print(json.dumps(result, indent=2))
    
    asyncio.run(test())
