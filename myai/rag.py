import os
import logging
import json
import asyncio
import io
from typing import List, Optional, Dict, Any

try:
    import lancedb
    import pyarrow as pa
except ImportError:
    lancedb = None
    pa = None

from myai.utils.pdfparser import LocalPdfParser
from myai.utils.textsplitter import SentenceTextSplitter
from myai.utils.page import Page

# Setup logging
logger = logging.getLogger(__name__)

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LANCEDB_PATH = os.path.join(PROJECT_ROOT, 'data', 'brunella_lancedb_python')

class RAGService:
    def __init__(self):
        self.db_path = LANCEDB_PATH
        self.table_name = "knowledge_base"
        self.pdf_parser = LocalPdfParser()
        self.text_splitter = SentenceTextSplitter(max_tokens_per_section=500)
        self.embedding_dim = 1536 # Default to OpenAI text-embedding-ada-002 size

    async def _get_db(self):
        if not lancedb:
            raise ImportError("lancedb is not installed")
        os.makedirs(self.db_path, exist_ok=True)
        return await lancedb.connect_async(self.db_path)

    async def _ensure_table(self, db):
        table_names = await db.table_names()
        if self.table_name not in table_names:
            # Define schema
            schema = pa.schema([
                pa.Field("vector", pa.list_(pa.float32(), self.embedding_dim)),
                pa.Field("text", pa.string()),
                pa.Field("source", pa.string()),
                pa.Field("page_num", pa.int32()),
                pa.Field("metadata", pa.string()) # JSON string
            ])
            await db.create_table(self.table_name, schema=schema)
        return await db.open_table(self.table_name)

    async def _generate_embedding(self, text: str) -> List[float]:
        # TODO: Integrate with OpenAI or Ollama for real embeddings
        # For now, return a random or zero vector to allow the pipeline to run
        # Ideally check os.environ.get("OPENAI_API_KEY") and use it
        return [0.0] * self.embedding_dim

    async def ingest_document(self, file_content: bytes, filename: str) -> Dict[str, Any]:
        """
        Ingest a document (PDF) into the Knowledge Base.
        1. Parse PDF
        2. Split into chunks
        3. Generate embeddings
        4. Save to LanceDB
        """
        logger.info(f"Ingesting document: {filename}")
        
        # 1. Parse
        pages: List[Page] = []
        file_stream = io.BytesIO(file_content)
        file_stream.name = filename # For logging
        
        async for page in self.pdf_parser.parse(file_stream):
            pages.append(page)
            
        logger.info(f"Parsed {len(pages)} pages from {filename}")

        # 2. Split
        chunks = list(self.text_splitter.split_pages(pages))
        logger.info(f"Created {len(chunks)} chunks from {filename}")

        # 3. Embed & 4. Save
        db = await self._get_db()
        table = await self._ensure_table(db)

        records = []
        for chunk in chunks:
            vector = await self._generate_embedding(chunk.text)
            records.append({
                "vector": vector,
                "text": chunk.text,
                "source": filename,
                "page_num": chunk.page_num,
                "metadata": json.dumps({"source": filename, "page": chunk.page_num})
            })
        
        if records:
            await table.add(records)
            
        return {
            "status": "success",
            "filename": filename,
            "pages": len(pages),
            "chunks": len(chunks)
        }

    async def search(self, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        """
        Search the Knowledge Base for relevant context.
        """
        db = await self._get_db()
        if self.table_name not in await db.table_names():
            return []
            
        table = await db.open_table(self.table_name)
        
        query_vector = await self._generate_embedding(query)
        
        # LanceDB async search
        # Note: API might vary slightly by version, generally table.search(vec).limit(k).to_list()
        # For async, we assume standard usage pattern or wrapped executon
        
        # Using vector search
        results = await table.vector_search(query_vector).limit(limit).to_list()
        
        # Format results
        formatted_results = []
        for r in results:
            formatted_results.append({
                "text": r["text"],
                "source": r["source"],
                "page_num": r["page_num"],
                "score": r.get("_distance", 0.0) # Lower is better usually for L2/Cosine distance in some libs, but typically score/distance
            })
            
        return formatted_results

# Singleton instance
rag_service = RAGService()
