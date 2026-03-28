"""
Knowledge Integrator - Refine & Integrate Harvested Data

This tool processes raw harvest results:
1. Validate data (Pydantic)
2. LLM-based summarization (Ollama)
3. Deduplication (embeddings + cosine similarity)
4. LanceDB vector storage (RAG)
5. Golden Dataset update (instruction tuning JSONL)

Author: Claude Code (Anthropic)
Created: 2026-02-13
Track: TR-20260212-TECH-HAR
"""

import json
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from pydantic import BaseModel, Field, validator

# LanceDB imports (optional)
try:
    import lancedb
    import pyarrow as pa
    HAS_LANCEDB = True
except ImportError:
    lancedb = None
    pa = None
    HAS_LANCEDB = False
    print("[!] WARNING: lancedb not installed. Run: pip install lancedb pyarrow")

# Ollama imports
try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False
    print("[!] WARNING: requests not installed. Run: pip install requests")


# ════════════════════════════════════════════════════════════════════════════
# PYDANTIC MODELS (Validation)
# ════════════════════════════════════════════════════════════════════════════

class HarvestItem(BaseModel):
    """Validated harvest item schema."""
    source: str = Field(..., description="Source name (e.g., 'GitHub Trending AI')")
    url: Optional[str] = Field(None, description="Source URL")
    content: str = Field(..., description="Extracted content (text)")
    timestamp: str = Field(..., description="ISO 8601 timestamp")
    type: str = Field(default="article", description="Content type (article, list, docs)")

    # Optional metadata
    title: Optional[str] = None
    description: Optional[str] = None
    stars: Optional[int] = None
    author: Optional[str] = None

    @validator('content')
    def content_not_empty(cls, v):
        if not v or len(v.strip()) < 10:
            raise ValueError("Content must be at least 10 characters")
        return v.strip()


class RefinedItem(BaseModel):
    """Refined item with summary and embeddings."""
    id: str = Field(..., description="Unique ID (hash of content)")
    source: str
    url: Optional[str]
    original_content: str = Field(..., description="Original raw content")
    summary: str = Field(..., description="LLM-generated summary")
    keywords: List[str] = Field(default_factory=list, description="Extracted keywords")
    relevance_score: float = Field(default=1.0, ge=0.0, le=1.0, description="Relevance score (0-1)")
    timestamp: str

    # Vector embedding (for LanceDB)
    embedding: Optional[List[float]] = None
    embedding_legacy: Optional[List[float]] = None

    class Config:
        arbitrary_types_allowed = True


# ════════════════════════════════════════════════════════════════════════════
# OLLAMA LLM CLIENT
# ════════════════════════════════════════════════════════════════════════════

class OllamaClient:
    """Simple Ollama API client for summarization."""

    def __init__(
        self,
        base_url: str = "http://localhost:11434",
        model: str = "llama3.1:8b",
        embedding_model: str = "mxbai-embed-large",
        embedding_dimension: int = 1024,
    ):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.embedding_model = embedding_model
        self.embedding_dimension = embedding_dimension
        self.logger = logging.getLogger("OllamaClient")

    def generate(self, prompt: str, system: Optional[str] = None, max_tokens: int = 500) -> str:
        """Generate response from Ollama."""
        if not HAS_REQUESTS:
            raise ImportError("requests library required. Run: pip install requests")

        url = f"{self.base_url}/api/generate"

        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "num_predict": max_tokens,
                "temperature": 0.3,
            }
        }

        if system:
            payload["system"] = system

        try:
            response = requests.post(url, json=payload, timeout=120)
            response.raise_for_status()

            result = response.json()
            return result.get("response", "").strip()

        except Exception as e:
            self.logger.error(f"Ollama API error: {str(e)}")
            raise

    def get_embeddings(self, text: str) -> List[float]:
        """Get embeddings from Ollama."""
        url = f"{self.base_url}/api/embeddings"

        payload = {
            "model": self.embedding_model,
            "prompt": text,
        }

        try:
            response = requests.post(url, json=payload, timeout=60)
            response.raise_for_status()

            result = response.json()
            return result.get("embedding", [])

        except Exception as e:
            self.logger.error(f"Embedding error: {str(e)}")
            # Return zero vector as fallback
            return [0.0] * self.embedding_dimension


# ════════════════════════════════════════════════════════════════════════════
# KNOWLEDGE INTEGRATOR CLASS
# ════════════════════════════════════════════════════════════════════════════

class KnowledgeIntegrator:
    """
    Main class for refining and integrating harvested data.

    Pipeline:
    1. Load harvest results (JSON)
    2. Validate with Pydantic
    3. LLM summarization (Ollama)
    4. Generate embeddings
    5. Deduplication (cosine similarity)
    6. LanceDB storage (RAG)
    7. Golden Dataset update (JSONL)
    """

    def __init__(
        self,
        ollama_url: str = "http://localhost:11434",
        ollama_model: str = "llama3.1:8b",
        embedding_model: str = "mxbai-embed-large",
        embedding_dim_primary: int = 1024,
        embedding_model_legacy: str = "nomic-embed-text",
        embedding_dim_legacy: int = 768,
        dual_index_write: bool = True,
        lancedb_path: str = "data/brunella_lancedb",
        lancedb_table_primary: str = "tech_trends_v2_mxbai",
        lancedb_table_legacy: str = "tech_trends",
        golden_dataset_path: str = "data/training/golden_dataset.jsonl",
        dedup_threshold: float = 0.85,
        logger: Optional[logging.Logger] = None
    ):
        self.ollama_client = OllamaClient(
            base_url=ollama_url,
            model=ollama_model,
            embedding_model=embedding_model,
            embedding_dimension=embedding_dim_primary,
        )
        self.embedding_dim_primary = embedding_dim_primary
        self.embedding_model_primary = embedding_model
        self.embedding_dim_legacy = embedding_dim_legacy
        self.embedding_model_legacy = embedding_model_legacy
        self.dual_index_write = dual_index_write
        self.lancedb_path = Path(lancedb_path)
        self.lancedb_table_primary = lancedb_table_primary
        self.lancedb_table_legacy = lancedb_table_legacy
        self.golden_dataset_path = Path(golden_dataset_path)
        self.dedup_threshold = dedup_threshold
        self.logger = logger or logging.getLogger("KnowledgeIntegrator")

        # Stats
        self.stats = {
            "total_items": 0,
            "validated_items": 0,
            "summarized_items": 0,
            "duplicates_removed": 0,
            "lancedb_inserted": 0,
            "lancedb_inserted_primary": 0,
            "lancedb_inserted_legacy": 0,
            "golden_dataset_appended": 0,
        }

    def _normalize_embedding(self, vector: List[float], dimension: int) -> List[float]:
        if not vector:
            return [0.0] * dimension

        if len(vector) == dimension:
            return vector

        if len(vector) > dimension:
            return vector[:dimension]

        return vector + ([0.0] * (dimension - len(vector)))

    def load_harvest_results(self, filepath: str) -> List[Dict[str, Any]]:
        """Load harvest results from JSON file."""
        self.logger.info(f"Loading harvest results: {filepath}")

        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)

        items = data.get("items", [])
        self.stats["total_items"] = len(items)

        self.logger.info(f"Loaded {len(items)} items from harvest results")

        return items

    def validate_items(self, items: List[Dict[str, Any]]) -> List[HarvestItem]:
        """Validate items with Pydantic."""
        self.logger.info("Validating items with Pydantic...")

        validated = []

        for idx, item in enumerate(items):
            try:
                validated_item = HarvestItem(**item)
                validated.append(validated_item)
            except Exception as e:
                self.logger.warning(f"Validation failed for item {idx}: {str(e)}")
                continue

        self.stats["validated_items"] = len(validated)
        self.logger.info(f"Validated {len(validated)}/{len(items)} items")

        return validated

    def summarize_item(self, item: HarvestItem) -> Tuple[str, List[str]]:
        """
        Generate LLM summary and extract keywords.

        Returns:
            (summary, keywords)
        """
        prompt = f"""
Summarize the following technical content in 2-3 sentences. Extract 3-5 relevant keywords.

Content:
{item.content[:1000]}

Output format:
SUMMARY: [2-3 sentence summary]
KEYWORDS: [keyword1, keyword2, keyword3]
""".strip()

        try:
            response = self.ollama_client.generate(
                prompt=prompt,
                system="You are a technical content summarizer. Be concise and extract key information.",
                max_tokens=300
            )

            # Parse response
            lines = response.split("\n")
            summary = ""
            keywords = []

            for line in lines:
                if line.startswith("SUMMARY:"):
                    summary = line.replace("SUMMARY:", "").strip()
                elif line.startswith("KEYWORDS:"):
                    keywords_str = line.replace("KEYWORDS:", "").strip()
                    keywords = [k.strip() for k in keywords_str.strip("[]").split(",")]

            # Fallback if parsing failed
            if not summary:
                summary = response[:300]
            if not keywords:
                keywords = ["AI", "Tech", "Development"]

            return summary, keywords

        except Exception as e:
            self.logger.error(f"Summarization failed: {str(e)}")
            # Fallback: truncate content
            return item.content[:300], ["AI", "Tech"]

    def refine_items(self, validated_items: List[HarvestItem]) -> List[RefinedItem]:
        """Refine items with LLM summarization and embeddings."""
        self.logger.info("Refining items (LLM summary + embeddings)...")

        refined = []

        legacy_client = None
        if self.dual_index_write:
            legacy_client = OllamaClient(
                base_url=self.ollama_client.base_url,
                model=self.ollama_client.model,
                embedding_model=self.embedding_model_legacy,
                embedding_dimension=self.embedding_dim_legacy,
            )

        for idx, item in enumerate(validated_items):
            try:
                # Generate summary and keywords
                summary, keywords = self.summarize_item(item)

                # Generate embeddings
                embedding = self._normalize_embedding(
                    self.ollama_client.get_embeddings(summary),
                    self.embedding_dim_primary,
                )

                embedding_legacy = None
                if self.dual_index_write and legacy_client is not None:
                    embedding_legacy = self._normalize_embedding(
                        legacy_client.get_embeddings(summary),
                        self.embedding_dim_legacy,
                    )

                # Create refined item
                refined_item = RefinedItem(
                    id=self._generate_id(item.content),
                    source=item.source,
                    url=item.url,
                    original_content=item.content,
                    summary=summary,
                    keywords=keywords,
                    relevance_score=1.0,  # TODO: Calculate based on keyword match
                    timestamp=item.timestamp,
                    embedding=embedding
                )

                if embedding_legacy is not None:
                    refined_item.embedding_legacy = embedding_legacy

                refined.append(refined_item)

                if (idx + 1) % 5 == 0:
                    self.logger.info(f"Refined {idx + 1}/{len(validated_items)} items")

            except Exception as e:
                self.logger.error(f"Refinement failed for item {idx}: {str(e)}")
                continue

        self.stats["summarized_items"] = len(refined)
        self.logger.info(f"Refined {len(refined)} items")

        return refined

    def deduplicate_items(self, refined_items: List[RefinedItem]) -> List[RefinedItem]:
        """Remove duplicates using cosine similarity on embeddings."""
        self.logger.info(f"Deduplicating items (threshold: {self.dedup_threshold})...")

        if not refined_items:
            return []

        # Convert embeddings to numpy array
        embeddings_matrix = np.array([item.embedding for item in refined_items if item.embedding])

        if embeddings_matrix.size == 0:
            self.logger.warning("No embeddings available for deduplication")
            return refined_items

        # Compute cosine similarity matrix
        norms = np.linalg.norm(embeddings_matrix, axis=1, keepdims=True)
        normalized = embeddings_matrix / (norms + 1e-8)
        similarity_matrix = normalized @ normalized.T

        # Mark duplicates
        unique_indices = []
        seen = set()

        for i in range(len(refined_items)):
            if i in seen:
                continue

            unique_indices.append(i)

            # Find duplicates
            for j in range(i + 1, len(refined_items)):
                if similarity_matrix[i, j] > self.dedup_threshold:
                    seen.add(j)

        deduplicated = [refined_items[i] for i in unique_indices]

        self.stats["duplicates_removed"] = len(refined_items) - len(deduplicated)
        self.logger.info(f"Removed {self.stats['duplicates_removed']} duplicates. {len(deduplicated)} unique items.")

        return deduplicated

    def store_in_lancedb(self, refined_items: List[RefinedItem]) -> int:
        """Store refined items in LanceDB for RAG."""
        if not HAS_LANCEDB:
            self.logger.warning("LanceDB not available, skipping storage")
            return 0

        self.logger.info(f"Storing {len(refined_items)} items in LanceDB...")

        try:
            # Create LanceDB connection
            db = lancedb.connect(str(self.lancedb_path))

            # Prepare primary index data for LanceDB
            data_primary = []
            for item in refined_items:
                data_primary.append({
                    "id": item.id,
                    "source": item.source,
                    "url": item.url or "",
                    "summary": item.summary,
                    "keywords": ", ".join(item.keywords),
                    "timestamp": item.timestamp,
                    "vector": item.embedding or [0.0] * self.embedding_dim_primary,
                    "embedding_model": self.embedding_model_primary,
                    "embedding_dim": self.embedding_dim_primary,
                })

            # Create or update primary table
            try:
                table = db.open_table(self.lancedb_table_primary)
                table.add(data_primary)
                self.logger.info(f"Added {len(data_primary)} items to existing table '{self.lancedb_table_primary}'")
            except:
                # Table doesn't exist, create it
                db.create_table(self.lancedb_table_primary, data=data_primary)
                self.logger.info(f"Created new table '{self.lancedb_table_primary}' with {len(data_primary)} items")

            self.stats["lancedb_inserted_primary"] = len(data_primary)

            inserted_legacy = 0
            if self.dual_index_write:
                data_legacy = []
                for item in refined_items:
                    legacy_embedding = getattr(item, "embedding_legacy", None)
                    data_legacy.append({
                        "id": item.id,
                        "source": item.source,
                        "url": item.url or "",
                        "summary": item.summary,
                        "keywords": ", ".join(item.keywords),
                        "timestamp": item.timestamp,
                        "vector": legacy_embedding or [0.0] * self.embedding_dim_legacy,
                        "embedding_model": self.embedding_model_legacy,
                        "embedding_dim": self.embedding_dim_legacy,
                    })

                try:
                    legacy_table = db.open_table(self.lancedb_table_legacy)
                    legacy_table.add(data_legacy)
                    self.logger.info(f"Added {len(data_legacy)} items to existing table '{self.lancedb_table_legacy}'")
                except:
                    db.create_table(self.lancedb_table_legacy, data=data_legacy)
                    self.logger.info(f"Created new table '{self.lancedb_table_legacy}' with {len(data_legacy)} items")

                inserted_legacy = len(data_legacy)

            self.stats["lancedb_inserted_legacy"] = inserted_legacy
            self.stats["lancedb_inserted"] = self.stats["lancedb_inserted_primary"] + inserted_legacy

            return self.stats["lancedb_inserted"]

        except Exception as e:
            self.logger.error(f"LanceDB storage failed: {str(e)}")
            return 0

    def append_to_golden_dataset(self, refined_items: List[RefinedItem]) -> int:
        """Append items to Golden Dataset (instruction tuning JSONL)."""
        self.logger.info(f"Appending {len(refined_items)} items to Golden Dataset...")

        # Create directory if needed
        self.golden_dataset_path.parent.mkdir(parents=True, exist_ok=True)

        appended = 0

        with open(self.golden_dataset_path, "a", encoding="utf-8") as f:
            for item in refined_items:
                # Create instruction tuning format
                instruction = "What are the latest developments in AI and technology?"
                response = f"Based on recent findings from {item.source}:\n\n{item.summary}\n\nKeywords: {', '.join(item.keywords)}"

                jsonl_entry = {
                    "instruction": instruction,
                    "input": "",
                    "output": response,
                    "metadata": {
                        "source": item.source,
                        "url": item.url,
                        "timestamp": item.timestamp,
                        "id": item.id,
                    }
                }

                f.write(json.dumps(jsonl_entry, ensure_ascii=False) + "\n")
                appended += 1

        self.stats["golden_dataset_appended"] = appended
        self.logger.info(f"Appended {appended} items to {self.golden_dataset_path}")

        return appended

    def _generate_id(self, content: str) -> str:
        """Generate unique ID from content hash."""
        import hashlib
        return hashlib.sha256(content.encode()).hexdigest()[:16]

    def process_harvest_file(self, filepath: str) -> Dict[str, Any]:
        """
        Complete pipeline: Load → Validate → Refine → Deduplicate → Store

        Returns:
            Summary statistics
        """
        self.logger.info("=" * 80)
        self.logger.info("KNOWLEDGE INTEGRATOR STARTING")
        self.logger.info(f"Input: {filepath}")
        self.logger.info("=" * 80)

        start_time = datetime.utcnow()

        # Step 1: Load harvest results
        raw_items = self.load_harvest_results(filepath)

        # Step 2: Validate
        validated_items = self.validate_items(raw_items)

        # Step 3: Refine (summarize + embeddings)
        refined_items = self.refine_items(validated_items)

        # Step 4: Deduplicate
        unique_items = self.deduplicate_items(refined_items)

        # Step 5: Store in LanceDB
        self.store_in_lancedb(unique_items)

        # Step 6: Append to Golden Dataset
        self.append_to_golden_dataset(unique_items)

        end_time = datetime.utcnow()
        duration = (end_time - start_time).total_seconds()

        summary = {
            "status": "completed",
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "duration_seconds": duration,
            "stats": self.stats,
        }

        self.logger.info("")
        self.logger.info("=" * 80)
        self.logger.info("KNOWLEDGE INTEGRATOR COMPLETED")
        self.logger.info(f"Total items: {self.stats['total_items']}")
        self.logger.info(f"Validated: {self.stats['validated_items']}")
        self.logger.info(f"Refined: {self.stats['summarized_items']}")
        self.logger.info(f"Duplicates removed: {self.stats['duplicates_removed']}")
        self.logger.info(f"LanceDB inserted: {self.stats['lancedb_inserted']}")
        self.logger.info(f"Golden Dataset appended: {self.stats['golden_dataset_appended']}")
        self.logger.info(f"Duration: {duration:.2f} seconds")
        self.logger.info("=" * 80)

        return summary


# ════════════════════════════════════════════════════════════════════════════
# CLI ENTRY POINT
# ════════════════════════════════════════════════════════════════════════════

def main():
    """CLI entry point."""
    import argparse

    parser = argparse.ArgumentParser(description="Knowledge Integrator - Refine & Integrate Harvest Data")
    parser.add_argument("input_file", help="Path to harvest results JSON file")
    parser.add_argument("--ollama-url", default="http://localhost:11434", help="Ollama API URL")
    parser.add_argument("--ollama-model", default="llama3.1:8b", help="Ollama model name")
    parser.add_argument("--embedding-model", default="mxbai-embed-large", help="Primary embedding model")
    parser.add_argument("--embedding-dim-primary", type=int, default=1024, help="Primary embedding vector size")
    parser.add_argument("--embedding-model-legacy", default="nomic-embed-text", help="Legacy embedding model")
    parser.add_argument("--embedding-dim-legacy", type=int, default=768, help="Legacy embedding vector size")
    parser.add_argument("--dual-index-write", action="store_true", default=True, help="Write to both primary and legacy LanceDB tables")
    parser.add_argument("--no-dual-index-write", action="store_false", dest="dual_index_write", help="Write only to primary LanceDB table")
    parser.add_argument("--lancedb-path", default="data/brunella_lancedb", help="LanceDB database path")
    parser.add_argument("--lancedb-table-primary", default="tech_trends_v2_mxbai", help="Primary LanceDB table name")
    parser.add_argument("--lancedb-table-legacy", default="tech_trends", help="Legacy LanceDB table name")
    parser.add_argument("--golden-dataset", default="data/training/golden_dataset.jsonl", help="Golden Dataset path")
    parser.add_argument("--dedup-threshold", type=float, default=0.85, help="Deduplication threshold (0-1)")
    parser.add_argument("--log-level", default="INFO", choices=["DEBUG", "INFO", "WARNING", "ERROR"])

    args = parser.parse_args()

    # Setup logging
    logging.basicConfig(
        level=getattr(logging, args.log_level),
        format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
        handlers=[
            logging.FileHandler("logs/knowledge_integrator.log", encoding="utf-8"),
            logging.StreamHandler()
        ]
    )

    logger = logging.getLogger("KnowledgeIntegrator")

    # Check input file
    if not Path(args.input_file).exists():
        logger.error(f"Input file not found: {args.input_file}")
        return 1

    # Create integrator
    integrator = KnowledgeIntegrator(
        ollama_url=args.ollama_url,
        ollama_model=args.ollama_model,
        embedding_model=args.embedding_model,
        embedding_dim_primary=args.embedding_dim_primary,
        embedding_model_legacy=args.embedding_model_legacy,
        embedding_dim_legacy=args.embedding_dim_legacy,
        dual_index_write=args.dual_index_write,
        lancedb_path=args.lancedb_path,
        lancedb_table_primary=args.lancedb_table_primary,
        lancedb_table_legacy=args.lancedb_table_legacy,
        golden_dataset_path=args.golden_dataset,
        dedup_threshold=args.dedup_threshold,
        logger=logger
    )

    # Process
    try:
        summary = integrator.process_harvest_file(args.input_file)

        print("\n" + "=" * 80)
        print("INTEGRATION SUMMARY")
        print("=" * 80)
        print(f"Status: {summary['status']}")
        print(f"Duration: {summary['duration_seconds']:.2f} seconds")
        print(f"Total items: {summary['stats']['total_items']}")
        print(f"Validated: {summary['stats']['validated_items']}")
        print(f"Refined: {summary['stats']['summarized_items']}")
        print(f"Duplicates removed: {summary['stats']['duplicates_removed']}")
        print(f"LanceDB inserted: {summary['stats']['lancedb_inserted']}")
        print(f"Golden Dataset appended: {summary['stats']['golden_dataset_appended']}")
        print("=" * 80)

        return 0

    except Exception as e:
        logger.exception(f"Fatal error: {str(e)}")
        return 1


if __name__ == "__main__":
    exit(main())
