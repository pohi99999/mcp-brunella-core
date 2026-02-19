"""
LanceDB Batch Ingestion Worker - Large Dataset Vector Embedding
Supports: CSV, JSON, JSONL, Parquet batch ingestion with embeddings
Uses: Knowledge base building, RAG system, semantic search

Author: Brunella Agent System
Version: 1.0.0
"""

import os
import logging
import json
import csv
from pathlib import Path
from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, Field
from datetime import datetime

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Check LanceDB availability
HAS_LANCEDB = False
try:
    import lancedb
    import pyarrow as pa
    HAS_LANCEDB = True
    logger.info("✅ LanceDB available")
except ImportError:
    logger.warning("⚠️ LanceDB not available (pip install lancedb pyarrow)")

# Check embedding models
HAS_SENTENCE_TRANSFORMERS = False
try:
    from sentence_transformers import SentenceTransformer
    HAS_SENTENCE_TRANSFORMERS = True
    logger.info("✅ Sentence Transformers available")
except ImportError:
    logger.warning("⚠️ Sentence Transformers not available (pip install sentence-transformers)")


# ============================================================================
# Pydantic Models
# ============================================================================

class IngestionRequest(BaseModel):
    """Batch ingestion request"""
    file_path: str = Field(..., description="Path to data file (CSV, JSON, JSONL, Parquet)")
    table_name: str = Field(..., description="LanceDB table name")
    text_field: str = Field("text", description="Field name containing text to embed")
    metadata_fields: List[str] = Field(default_factory=list, description="Additional fields to store")
    embedding_model: str = Field("all-MiniLM-L6-v2", description="Sentence transformer model")
    batch_size: int = Field(100, description="Ingestion batch size")
    max_records: Optional[int] = Field(None, description="Maximum records to process")
    db_path: str = Field("data/brunella_lancedb", description="LanceDB database path")
    overwrite: bool = Field(False, description="Overwrite existing table")


class IngestionResponse(BaseModel):
    """Batch ingestion response"""
    success: bool = Field(..., description="Ingestion success")
    table_name: str = Field("", description="Table name")
    records_processed: int = Field(0, description="Number of records processed")
    records_failed: int = Field(0, description="Number of records failed")
    db_path: str = Field("", description="Database path")
    error: Optional[str] = Field(None, description="Error message if failed")
    duration_seconds: float = Field(0.0, description="Total ingestion time")


# ============================================================================
# Data Loaders
# ============================================================================

def load_csv(file_path: str, max_records: Optional[int] = None) -> List[Dict[str, Any]]:
    """Load CSV file into list of dicts"""
    records = []
    with open(file_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader):
            if max_records and i >= max_records:
                break
            records.append(dict(row))
    logger.info(f"Loaded {len(records)} records from CSV")
    return records


def load_json(file_path: str, max_records: Optional[int] = None) -> List[Dict[str, Any]]:
    """Load JSON file (array of objects)"""
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    if not isinstance(data, list):
        data = [data]
    
    if max_records:
        data = data[:max_records]
    
    logger.info(f"Loaded {len(data)} records from JSON")
    return data


def load_jsonl(file_path: str, max_records: Optional[int] = None) -> List[Dict[str, Any]]:
    """Load JSONL file (JSON Lines)"""
    records = []
    with open(file_path, 'r', encoding='utf-8') as f:
        for i, line in enumerate(f):
            if max_records and i >= max_records:
                break
            if line.strip():
                records.append(json.loads(line))
    logger.info(f"Loaded {len(records)} records from JSONL")
    return records


def load_parquet(file_path: str, max_records: Optional[int] = None) -> List[Dict[str, Any]]:
    """Load Parquet file"""
    if not HAS_LANCEDB:
        raise ImportError("PyArrow required for Parquet. Install: pip install pyarrow")
    
    import pyarrow.parquet as pq
    table = pq.read_table(file_path)
    
    # Convert to list of dicts
    records = table.to_pylist()
    
    if max_records:
        records = records[:max_records]
    
    logger.info(f"Loaded {len(records)} records from Parquet")
    return records


def load_data_file(file_path: str, max_records: Optional[int] = None) -> List[Dict[str, Any]]:
    """Auto-detect file format and load data"""
    path = Path(file_path)
    
    if not path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")
    
    suffix = path.suffix.lower()
    
    if suffix == '.csv':
        return load_csv(file_path, max_records)
    elif suffix == '.json':
        return load_json(file_path, max_records)
    elif suffix == '.jsonl':
        return load_jsonl(file_path, max_records)
    elif suffix == '.parquet':
        return load_parquet(file_path, max_records)
    else:
        raise ValueError(f"Unsupported file format: {suffix}. Supported: .csv, .json, .jsonl, .parquet")


# ============================================================================
# Embedding Generation
# ============================================================================

class EmbeddingGenerator:
    """Generate embeddings for text using Sentence Transformers"""
    
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        if not HAS_SENTENCE_TRANSFORMERS:
            raise ImportError("sentence-transformers required. Install: pip install sentence-transformers")
        
        logger.info(f"Loading embedding model: {model_name}")
        self.model = SentenceTransformer(model_name)
        logger.info(f"✅ Model loaded ({self.model.get_sentence_embedding_dimension()}D embeddings)")
    
    def embed(self, texts: List[str], batch_size: int = 32) -> List[List[float]]:
        """Generate embeddings for list of texts"""
        logger.info(f"Generating embeddings for {len(texts)} texts...")
        embeddings = self.model.encode(texts, batch_size=batch_size, show_progress_bar=True)
        return embeddings.tolist()
    
    def embed_single(self, text: str) -> List[float]:
        """Generate embedding for single text"""
        return self.model.encode([text])[0].tolist()


# ============================================================================
# LanceDB Ingestion
# ============================================================================

def ingest_batch(request: IngestionRequest) -> IngestionResponse:
    """
    Main batch ingestion function
    
    Example:
        request = IngestionRequest(
            file_path="data/articles.csv",
            table_name="knowledge_base",
            text_field="content",
            metadata_fields=["title", "author", "date"],
            batch_size=100
        )
        response = ingest_batch(request)
        print(f"Ingested {response.records_processed} records")
    """
    import time
    start_time = time.time()
    
    if not HAS_LANCEDB:
        return IngestionResponse(
            success=False,
            error="LanceDB not installed. Run: pip install lancedb pyarrow",
            duration_seconds=time.time() - start_time
        )
    
    try:
        # Load data
        logger.info(f"Loading data from {request.file_path}")
        records = load_data_file(request.file_path, request.max_records)
        
        if not records:
            return IngestionResponse(
                success=False,
                error="No records found in file",
                table_name=request.table_name,
                duration_seconds=time.time() - start_time
            )
        
        # Initialize embedding generator
        embedder = EmbeddingGenerator(request.embedding_model)
        
        # Connect to LanceDB
        db_path = Path(request.db_path)
        db_path.mkdir(parents=True, exist_ok=True)
        
        logger.info(f"Connecting to LanceDB: {db_path}")
        db = lancedb.connect(str(db_path))
        
        # Check if table exists
        if request.overwrite and request.table_name in db.table_names():
            logger.warning(f"Dropping existing table: {request.table_name}")
            db.drop_table(request.table_name)
        
        # Process in batches
        all_batch_data = []
        records_processed = 0
        records_failed = 0
        
        for i in range(0, len(records), request.batch_size):
            batch = records[i:i + request.batch_size]
            logger.info(f"Processing batch {i // request.batch_size + 1} ({len(batch)} records)")
            
            batch_data = []
            
            for record in batch:
                try:
                    # Extract text field
                    if request.text_field not in record:
                        logger.warning(f"Text field '{request.text_field}' not found in record, skipping")
                        records_failed += 1
                        continue
                    
                    text = str(record[request.text_field])
                    
                    if not text.strip():
                        logger.warning("Empty text field, skipping record")
                        records_failed += 1
                        continue
                    
                    # Generate embedding
                    embedding = embedder.embed_single(text)
                    
                    # Build record
                    lance_record = {
                        "text": text,
                        "vector": embedding,
                        "timestamp": datetime.now().isoformat(),
                    }
                    
                    # Add metadata fields
                    for field in request.metadata_fields:
                        if field in record:
                            lance_record[field] = record[field]
                    
                    batch_data.append(lance_record)
                    records_processed += 1
                
                except Exception as e:
                    logger.error(f"Failed to process record: {e}")
                    records_failed += 1
            
            all_batch_data.extend(batch_data)
        
        # Create/append to table
        if all_batch_data:
            logger.info(f"Writing {len(all_batch_data)} records to table '{request.table_name}'")
            
            if request.table_name in db.table_names() and not request.overwrite:
                table = db.open_table(request.table_name)
                table.add(all_batch_data)
            else:
                db.create_table(request.table_name, all_batch_data)
            
            logger.info(f"✅ Ingestion complete: {records_processed} records")
        
        duration = time.time() - start_time
        
        return IngestionResponse(
            success=True,
            table_name=request.table_name,
            records_processed=records_processed,
            records_failed=records_failed,
            db_path=str(db_path),
            duration_seconds=duration
        )
    
    except Exception as e:
        logger.error(f"Batch ingestion failed: {e}")
        return IngestionResponse(
            success=False,
            table_name=request.table_name,
            error=str(e),
            duration_seconds=time.time() - start_time
        )


# ============================================================================
# Query Helper
# ============================================================================

def query_lancedb(
    table_name: str,
    query_text: str,
    limit: int = 5,
    db_path: str = "data/brunella_lancedb",
    embedding_model: str = "all-MiniLM-L6-v2"
) -> List[Dict[str, Any]]:
    """
    Query LanceDB table with semantic search
    
    Example:
        results = query_lancedb(
            table_name="knowledge_base",
            query_text="How to use LanceDB for vector search?",
            limit=5
        )
        for result in results:
            print(result["text"])
    """
    if not HAS_LANCEDB:
        raise ImportError("LanceDB not installed")
    
    # Connect to database
    db = lancedb.connect(db_path)
    
    if table_name not in db.table_names():
        raise ValueError(f"Table '{table_name}' does not exist")
    
    table = db.open_table(table_name)
    
    # Generate query embedding
    embedder = EmbeddingGenerator(embedding_model)
    query_embedding = embedder.embed_single(query_text)
    
    # Search
    results = table.search(query_embedding).limit(limit).to_pandas()
    
    return results.to_dict('records')


# ============================================================================
# CLI Interface
# ============================================================================

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 3:
        print("Usage: python lancedb_batch.py <command> <args>")
        print("\nCommands:")
        print("  ingest <file> <table_name> [text_field] [batch_size]")
        print("    - Ingest data from file into LanceDB")
        print("  query <table_name> <query_text> [limit]")
        print("    - Query table with semantic search")
        print("\nExamples:")
        print('  python lancedb_batch.py ingest data/articles.csv knowledge_base content 100')
        print('  python lancedb_batch.py query knowledge_base "artificial intelligence" 5')
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == "ingest":
        if len(sys.argv) < 4:
            print("Usage: lancedb_batch.py ingest <file> <table_name> [text_field] [batch_size]")
            sys.exit(1)
        
        file_path = sys.argv[2]
        table_name = sys.argv[3]
        text_field = sys.argv[4] if len(sys.argv) > 4 else "text"
        batch_size = int(sys.argv[5]) if len(sys.argv) > 5 else 100
        
        request = IngestionRequest(
            file_path=file_path,
            table_name=table_name,
            text_field=text_field,
            batch_size=batch_size
        )
        
        response = ingest_batch(request)
        
        if response.success:
            print(f"\n✅ Ingestion Success")
            print(f"Table: {response.table_name}")
            print(f"Records processed: {response.records_processed}")
            print(f"Records failed: {response.records_failed}")
            print(f"Duration: {response.duration_seconds:.2f}s")
            print(f"Database: {response.db_path}")
        else:
            print(f"\n❌ Ingestion Failed: {response.error}")
            sys.exit(1)
    
    elif command == "query":
        if len(sys.argv) < 4:
            print("Usage: lancedb_batch.py query <table_name> <query_text> [limit]")
            sys.exit(1)
        
        table_name = sys.argv[2]
        query_text = sys.argv[3]
        limit = int(sys.argv[4]) if len(sys.argv) > 4 else 5
        
        try:
            results = query_lancedb(table_name, query_text, limit)
            
            print(f"\n✅ Query Results ({len(results)} matches)")
            print(f"Query: {query_text}\n")
            
            for i, result in enumerate(results, 1):
                print(f"{i}. {result.get('text', '')[:200]}...")
                if 'timestamp' in result:
                    print(f"   Timestamp: {result['timestamp']}")
                print()
        
        except Exception as e:
            print(f"\n❌ Query Failed: {e}")
            sys.exit(1)
    
    else:
        print(f"Unknown command: {command}")
        print("Available commands: ingest, query")
        sys.exit(1)
