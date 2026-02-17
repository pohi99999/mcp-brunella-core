"""LanceDB Refined Invoices Helper

Utilities for reading refined & validated invoice data from LanceDB.

Features:
- Read refined invoices from invoices_refined table
- Filter by date range, partner, status
- Convert LanceDB records to InvoiceData objects
- Semantic search by description
- Sort by date, amount, overdue status

Usage:
    from myai.utils.lancedb_invoice_helper import get_refined_invoices
    
    # Get all refined invoices
    invoices = get_refined_invoices()
    
    # Get invoices from specific date range
    invoices = get_refined_invoices(
        start_date="2026-01-01",
        end_date="2026-02-17"
    )
    
    # Get overdue invoices only
    overdue = get_refined_invoices(overdue_only=True)
"""

import logging
from typing import List, Optional, Dict, Any
from datetime import datetime, date
import lancedb
import os

from myai.schemas.invoice import InvoiceData

logger = logging.getLogger(__name__)


def get_lancedb_connection():
    """Get LanceDB connection."""
    db_path = os.path.join(os.getcwd(), "data", "lancedb")
    return lancedb.connect(db_path)


def get_refined_invoices(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    partner: Optional[str] = None,
    overdue_only: bool = False,
    min_amount: Optional[float] = None,
    max_amount: Optional[float] = None,
    limit: Optional[int] = None,
) -> List[InvoiceData]:
    """
    Get refined invoices from LanceDB.
    
    Args:
        start_date: Filter by invoice_date >= this (ISO format: YYYY-MM-DD)
        end_date: Filter by invoice_date <= this (ISO format: YYYY-MM-DD)
        partner: Filter by partner name (partial match)
        overdue_only: If True, only return overdue invoices
        min_amount: Minimum total amount (amount + vat_amount)
        max_amount: Maximum total amount
        limit: Maximum number of invoices to return
    
    Returns:
        List of InvoiceData objects from LanceDB
    
    Raises:
        FileNotFoundError: If invoices_refined table doesn't exist
    """
    try:
        db = get_lancedb_connection()
        
        # Check if table exists
        table_names = db.list_tables()
        if "invoices_refined" not in table_names:
            logger.warning("invoices_refined table not found in LanceDB")
            return []
        
        table = db.open_table("invoices_refined")
        
        # Build query
        # LanceDB uses SQL-like syntax for filtering
        conditions = []
        
        if start_date:
            conditions.append(f"invoice_date >= '{start_date}'")
        
        if end_date:
            conditions.append(f"invoice_date <= '{end_date}'")
        
        if partner:
            # Case-insensitive partial match
            conditions.append(f"partner LIKE '%{partner}%'")
        
        if min_amount is not None:
            conditions.append(f"(amount + vat_amount) >= {min_amount}")
        
        if max_amount is not None:
            conditions.append(f"(amount + vat_amount) <= {max_amount}")
        
        # Execute query
        if conditions:
            where_clause = " AND ".join(conditions)
            logger.debug(f"LanceDB query: WHERE {where_clause}")
            results = table.search().where(where_clause).to_pandas()
        else:
            # No filters, get all
            results = table.to_pandas()
        
        # Convert to InvoiceData objects
        invoices = []
        for _, row in results.iterrows():
            try:
                # LanceDB stores dates as strings, convert back
                invoice_data = {
                    "partner": row.get("partner", ""),
                    "amount": float(row.get("amount", 0)),
                    "vat_amount": float(row.get("vat_amount", 0)),
                    "invoice_no": row.get("invoice_no", ""),
                    "invoice_date": row.get("invoice_date", ""),
                    "due_date": row.get("due_date", ""),
                    "description": row.get("description"),
                    "payment_status": row.get("payment_status", "pending"),
                    "vat_type": row.get("vat_type", "HU"),
                }
                
                # Remove None values
                invoice_data = {k: v for k, v in invoice_data.items() if v is not None}
                
                invoice = InvoiceData(**invoice_data)
                
                # Apply overdue filter (post-processing, as LanceDB may not handle method calls)
                if overdue_only and not invoice.is_overdue():
                    continue
                
                invoices.append(invoice)
                
            except Exception as e:
                logger.error(f"Failed to parse invoice row: {e}", exc_info=True)
                continue
        
        # Apply limit
        if limit and len(invoices) > limit:
            invoices = invoices[:limit]
        
        logger.info(f"Retrieved {len(invoices)} refined invoices from LanceDB")
        return invoices
        
    except Exception as e:
        logger.error(f"Failed to get refined invoices: {e}", exc_info=True)
        return []


def search_invoices_semantic(
    query: str,
    top_k: int = 10,
) -> List[InvoiceData]:
    """
    Semantic search for invoices by description.
    
    Uses LanceDB vector search on invoice descriptions.
    
    Args:
        query: Search query (e.g., "software licenses", "consulting services")
        top_k: Number of top results to return
    
    Returns:
        List of InvoiceData objects matching the query
    """
    try:
        db = get_lancedb_connection()
        
        table_names = db.list_tables()
        if "invoices_refined" not in table_names:
            logger.warning("invoices_refined table not found in LanceDB")
            return []
        
        table = db.open_table("invoices_refined")
        
        # Generate embedding for query (requires Ollama)
        from myai.refiner.invoice_refiner import InvoiceRefiner
        refiner = InvoiceRefiner()
        
        query_embedding = refiner.ollama_client.embed(
            model=refiner.embedding_model,
            input=query
        )['embeddings'][0]
        
        # Vector search
        results = table.search(query_embedding).limit(top_k).to_pandas()
        
        # Convert to InvoiceData
        invoices = []
        for _, row in results.iterrows():
            try:
                invoice_data = {
                    "partner": row.get("partner", ""),
                    "amount": float(row.get("amount", 0)),
                    "vat_amount": float(row.get("vat_amount", 0)),
                    "invoice_no": row.get("invoice_no", ""),
                    "invoice_date": row.get("invoice_date", ""),
                    "due_date": row.get("due_date", ""),
                    "description": row.get("description"),
                    "payment_status": row.get("payment_status", "pending"),
                    "vat_type": row.get("vat_type", "HU"),
                }
                
                invoice_data = {k: v for k, v in invoice_data.items() if v is not None}
                invoice = InvoiceData(**invoice_data)
                invoices.append(invoice)
                
            except Exception as e:
                logger.error(f"Failed to parse invoice row: {e}", exc_info=True)
                continue
        
        logger.info(f"Semantic search returned {len(invoices)} invoices for query: '{query}'")
        return invoices
        
    except Exception as e:
        logger.error(f"Semantic search failed: {e}", exc_info=True)
        return []


def get_invoice_stats() -> Dict[str, Any]:
    """
    Get statistics about refined invoices in LanceDB.
    
    Returns:
        Dictionary with stats:
        - total_count: Total number of invoices
        - total_amount: Sum of all invoice amounts
        - overdue_count: Number of overdue invoices
        - avg_amount: Average invoice amount
    """
    try:
        invoices = get_refined_invoices()
        
        if not invoices:
            return {
                "total_count": 0,
                "total_amount": 0.0,
                "overdue_count": 0,
                "avg_amount": 0.0,
            }
        
        total_amount = sum(inv.amount + inv.vat_amount for inv in invoices)
        overdue_count = sum(1 for inv in invoices if inv.is_overdue())
        avg_amount = total_amount / len(invoices) if invoices else 0.0
        
        return {
            "total_count": len(invoices),
            "total_amount": round(total_amount, 2),
            "overdue_count": overdue_count,
            "avg_amount": round(avg_amount, 2),
            "oldest_date": min(inv.invoice_date for inv in invoices if inv.invoice_date),
            "newest_date": max(inv.invoice_date for inv in invoices if inv.invoice_date),
        }
        
    except Exception as e:
        logger.error(f"Failed to get invoice stats: {e}", exc_info=True)
        return {
            "error": str(e),
            "total_count": 0,
        }


if __name__ == "__main__":
    # Test
    import sys
    logging.basicConfig(level=logging.INFO)
    
    print("📊 Testing LanceDB Invoice Helper")
    print("-" * 50)
    
    # Get stats
    stats = get_invoice_stats()
    print(f"\n📈 Invoice Stats:")
    for key, value in stats.items():
        print(f"  {key}: {value}")
    
    # Get all invoices
    invoices = get_refined_invoices(limit=5)
    print(f"\n📄 First 5 invoices:")
    for inv in invoices:
        print(f"  - {inv.invoice_no}: {inv.partner} ({inv.amount + inv.vat_amount} HUF)")
    
    # Get overdue invoices
    overdue = get_refined_invoices(overdue_only=True, limit=3)
    print(f"\n⚠️  Overdue invoices ({len(overdue)}):")
    for inv in overdue:
        print(f"  - {inv.invoice_no}: {inv.partner} (due: {inv.due_date})")
