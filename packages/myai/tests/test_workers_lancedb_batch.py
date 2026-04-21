"""
Unit tests for LanceDB Batch Ingestion Worker
Tests: Data loading, embeddings, batch ingestion
"""

import pytest
from pathlib import Path
import sys
import tempfile
import json
import csv

# Add workers to path
sys.path.insert(0, str(Path(__file__).parent.parent / "workers"))

from lancedb_batch import (
    IngestionRequest,
    IngestionResponse,
    load_csv,
    load_json,
    load_jsonl,
    load_data_file,
    HAS_LANCEDB,
    HAS_SENTENCE_TRANSFORMERS,
)


class TestLanceDBModels:
    """Test LanceDB Batch Pydantic models"""

    def test_ingestion_request_model(self):
        """Test IngestionRequest model"""
        request = IngestionRequest(
            file_path="data/articles.csv",
            table_name="knowledge_base",
            text_field="content",
            metadata_fields=["title", "author"],
            batch_size=100,
        )
        
        assert request.file_path == "data/articles.csv"
        assert request.table_name == "knowledge_base"
        assert request.text_field == "content"
        assert request.metadata_fields == ["title", "author"]
        assert request.batch_size == 100
        assert request.embedding_model == "all-MiniLM-L6-v2"  # default
        assert request.overwrite is False

    def test_ingestion_request_defaults(self):
        """Test IngestionRequest default values"""
        request = IngestionRequest(
            file_path="test.csv",
            table_name="test_table",
        )
        
        assert request.text_field == "text"
        assert request.metadata_fields == []
        assert request.embedding_model == "all-MiniLM-L6-v2"
        assert request.batch_size == 100
        assert request.max_records is None
        assert request.db_path == "data/brunella_lancedb"
        assert request.overwrite is False

    def test_ingestion_response_model(self):
        """Test IngestionResponse model"""
        response = IngestionResponse(
            success=True,
            table_name="knowledge_base",
            records_processed=1000,
            records_failed=5,
            db_path="data/brunella_lancedb",
            duration_seconds=45.2,
        )
        
        assert response.success is True
        assert response.table_name == "knowledge_base"
        assert response.records_processed == 1000
        assert response.records_failed == 5
        assert response.duration_seconds == 45.2
        assert response.error is None


class TestDataLoaders:
    """Test data loading functions"""

    def test_load_csv(self, tmp_path):
        """Test CSV loading"""
        csv_file = tmp_path / "test.csv"
        
        # Create test CSV
        with open(csv_file, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=["id", "text", "category"])
            writer.writeheader()
            writer.writerow({"id": "1", "text": "First document", "category": "tech"})
            writer.writerow({"id": "2", "text": "Second document", "category": "science"})
        
        # Load CSV
        records = load_csv(str(csv_file))
        
        assert len(records) == 2
        assert records[0]["id"] == "1"
        assert records[0]["text"] == "First document"
        assert records[1]["category"] == "science"

    def test_load_csv_with_max_records(self, tmp_path):
        """Test CSV loading with max_records limit"""
        csv_file = tmp_path / "test.csv"
        
        with open(csv_file, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=["id", "text"])
            writer.writeheader()
            for i in range(10):
                writer.writerow({"id": str(i), "text": f"Document {i}"})
        
        records = load_csv(str(csv_file), max_records=5)
        
        assert len(records) == 5
        assert records[0]["id"] == "0"
        assert records[4]["id"] == "4"

    def test_load_json(self, tmp_path):
        """Test JSON loading"""
        json_file = tmp_path / "test.json"
        
        test_data = [
            {"id": 1, "text": "First doc"},
            {"id": 2, "text": "Second doc"},
        ]
        
        with open(json_file, 'w', encoding='utf-8') as f:
            json.dump(test_data, f)
        
        records = load_json(str(json_file))
        
        assert len(records) == 2
        assert records[0]["id"] == 1
        assert records[1]["text"] == "Second doc"

    def test_load_json_single_object(self, tmp_path):
        """Test JSON loading with single object (not array)"""
        json_file = tmp_path / "test.json"
        
        test_data = {"id": 1, "text": "Single doc"}
        
        with open(json_file, 'w', encoding='utf-8') as f:
            json.dump(test_data, f)
        
        records = load_json(str(json_file))
        
        assert len(records) == 1
        assert records[0]["id"] == 1

    def test_load_jsonl(self, tmp_path):
        """Test JSONL (JSON Lines) loading"""
        jsonl_file = tmp_path / "test.jsonl"
        
        with open(jsonl_file, 'w', encoding='utf-8') as f:
            f.write('{"id": 1, "text": "First doc"}\n')
            f.write('{"id": 2, "text": "Second doc"}\n')
            f.write('\n')  # empty line
            f.write('{"id": 3, "text": "Third doc"}\n')
        
        records = load_jsonl(str(jsonl_file))
        
        assert len(records) == 3
        assert records[0]["id"] == 1
        assert records[2]["text"] == "Third doc"

    def test_load_data_file_auto_detect_csv(self, tmp_path):
        """Test auto-detection of CSV format"""
        csv_file = tmp_path / "data.csv"
        
        with open(csv_file, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=["text"])
            writer.writeheader()
            writer.writerow({"text": "Test"})
        
        records = load_data_file(str(csv_file))
        
        assert len(records) == 1
        assert records[0]["text"] == "Test"

    def test_load_data_file_auto_detect_json(self, tmp_path):
        """Test auto-detection of JSON format"""
        json_file = tmp_path / "data.json"
        
        with open(json_file, 'w', encoding='utf-8') as f:
            json.dump([{"text": "Test"}], f)
        
        records = load_data_file(str(json_file))
        
        assert len(records) == 1

    def test_load_data_file_auto_detect_jsonl(self, tmp_path):
        """Test auto-detection of JSONL format"""
        jsonl_file = tmp_path / "data.jsonl"
        
        with open(jsonl_file, 'w', encoding='utf-8') as f:
            f.write('{"text": "Test"}\n')
        
        records = load_data_file(str(jsonl_file))
        
        assert len(records) == 1

    def test_load_data_file_unsupported_format(self, tmp_path):
        """Test error handling for unsupported format"""
        txt_file = tmp_path / "data.txt"
        txt_file.write_text("Some text")
        
        with pytest.raises(ValueError, match="Unsupported file format"):
            load_data_file(str(txt_file))

    def test_load_data_file_not_found(self):
        """Test error handling for missing file"""
        with pytest.raises(FileNotFoundError):
            load_data_file("nonexistent_file.csv")


class TestDependencyFlags:
    """Test dependency availability flags"""

    def test_lancedb_availability(self):
        """Test LanceDB availability flag"""
        assert isinstance(HAS_LANCEDB, bool)

    def test_sentence_transformers_availability(self):
        """Test Sentence Transformers availability flag"""
        assert isinstance(HAS_SENTENCE_TRANSFORMERS, bool)


@pytest.mark.skipif(
    not (HAS_LANCEDB and HAS_SENTENCE_TRANSFORMERS),
    reason="LanceDB or Sentence Transformers not installed"
)
class TestLanceDBIntegration:
    """Integration tests requiring LanceDB (skip in CI)"""

    def test_embedding_generation(self):
        """Test embedding generation (requires sentence-transformers)"""
        # This test would require model download
        pytest.skip("Requires model download and network access")

    def test_batch_ingestion(self, tmp_path, isolated_lancedb_path):
        """
        Test full batch ingestion pipeline.

        Uses isolated_lancedb_path to ensure database files are properly
        scoped to tmp_path and cleaned up after test completion.
        """
        # Create test data file
        data_file = tmp_path / "test_data.csv"
        with open(data_file, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=["id", "text", "category"])
            writer.writeheader()
            writer.writerow({"id": "1", "text": "Test document for ingestion", "category": "test"})

        # Create ingestion request with isolated database path
        request = IngestionRequest(
            file_path=str(data_file),
            table_name="test_table",
            db_path=isolated_lancedb_path,  # Use isolated path from fixture
            overwrite=True,
            text_field="text",
            metadata_fields=["id", "category"],
            batch_size=10,
        )

        # Import here to avoid import errors when dependencies not installed
        from lancedb_batch import ingest_batch

        # Run ingestion
        response = ingest_batch(request)

        # Verify response
        assert response.success
        assert response.records_processed >= 1
        assert response.table_name == "test_table"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
