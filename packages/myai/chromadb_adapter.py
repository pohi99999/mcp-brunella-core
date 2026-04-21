from __future__ import annotations

import os
from typing import Dict

from .vector_db_interface import VectorDbInterface


class ChromaDbAdapter(VectorDbInterface):
    """ChromaDB adapter for structured documents."""

    def __init__(self, collection_name: str = "brunella_harvest"):
        self.collection_name = collection_name
        self.persist_directory = os.getenv("CHROMADB_PATH", "./data/chromadb_data")
        self._client = None
        self._collection = None

    def _init_client(self):
        if self._client and self._collection:
            return
        try:
            import chromadb
            from chromadb.config import Settings
        except ImportError as exc:
            raise RuntimeError("chromadb not installed") from exc

        self._client = chromadb.Client(
            Settings(chroma_db_impl="duckdb+parquet", persist_directory=self.persist_directory)
        )
        self._collection = self._client.get_or_create_collection(
            name=self.collection_name,
            metadata={"description": "Brunella structured harvest"}
        )

    async def add_document(self, text: str, metadata: Dict) -> None:
        self._init_client()
        doc_id = metadata.get("id") or metadata.get("source") or f"doc_{hash(text)}"
        self._collection.add(
            ids=[str(doc_id)],
            documents=[text],
            metadatas=[metadata],
        )
