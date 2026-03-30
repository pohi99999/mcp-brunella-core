"""
Unit tests for OCR Worker
Tests: Tesseract, PaddleOCR, EasyOCR integration
"""

import pytest
from pathlib import Path
import sys

# Add workers to path
sys.path.insert(0, str(Path(__file__).parent.parent / "workers"))

from ocr_worker import (
    OCRRequest,
    OCRResponse,
    process_ocr,
    select_best_engine,
    HAS_TESSERACT,
    HAS_PADDLEOCR,
    HAS_EASYOCR,
)


class TestOCRWorker:
    """Test OCR Worker functionality"""

    def test_ocr_request_model(self):
        """Test OCRRequest Pydantic model"""
        request = OCRRequest(
            file_path="test_image.png",
            engine="auto",
            language="eng",
        )
        
        assert request.file_path == "test_image.png"
        assert request.engine == "auto"
        assert request.language == "eng"
        assert request.preprocessing is True
        assert request.extract_tables is False

    def test_ocr_response_model(self):
        """Test OCRResponse Pydantic model"""
        response = OCRResponse(
            success=True,
            text="Extracted text",
            confidence=95.5,
            engine_used="tesseract",
            file_path="test.png",
            duration_seconds=1.23,
        )
        
        assert response.success is True
        assert response.text == "Extracted text"
        assert response.confidence == 95.5
        assert response.engine_used == "tesseract"
        assert response.error is None

    def test_select_best_engine_auto(self):
        """Test automatic engine selection"""
        if not (HAS_TESSERACT or HAS_PADDLEOCR or HAS_EASYOCR):
            pytest.skip("No OCR engines installed (expected in CI/dev without OCR extras)")

        engine = select_best_engine("auto")
        
        # Should return any available engine
        assert engine in ["tesseract", "paddleocr", "easyocr"]
        
        # Verify at least one engine is available
        assert HAS_TESSERACT or HAS_PADDLEOCR or HAS_EASYOCR

    def test_select_best_engine_specific(self):
        """Test specific engine selection"""
        assert select_best_engine("tesseract") == "tesseract"
        assert select_best_engine("paddleocr") == "paddleocr"
        assert select_best_engine("easyocr") == "easyocr"

    def test_process_ocr_file_not_found(self):
        """Test OCR with non-existent file"""
        request = OCRRequest(
            file_path="nonexistent_file.png",
            engine="auto",
        )
        
        response = process_ocr(request)
        
        assert response.success is False
        assert "not found" in response.error.lower()
        assert response.duration_seconds > 0

    def test_ocr_request_validation(self):
        """Test OCR request validation"""
        # Valid request
        request = OCRRequest(file_path="test.png")
        assert request.file_path == "test.png"
        
        # Invalid engine should fail validation
        with pytest.raises(ValueError):
            OCRRequest(file_path="test.png", engine="invalid_engine")

    def test_engine_availability_flags(self):
        """Test that at least one OCR engine is available"""
        # At least one should be True for tests to work
        available_engines = [HAS_TESSERACT, HAS_PADDLEOCR, HAS_EASYOCR]
        
        # Skip if no engines available (CI environment)
        if not any(available_engines):
            pytest.skip("No OCR engines installed (expected in CI)")
        
        assert any(available_engines), "At least one OCR engine should be available"

    def test_language_codes(self):
        """Test different language code formats"""
        request_eng = OCRRequest(file_path="test.png", language="eng")
        request_hun = OCRRequest(file_path="test.png", language="hun")
        request_deu = OCRRequest(file_path="test.png", language="deu")
        
        assert request_eng.language == "eng"
        assert request_hun.language == "hun"
        assert request_deu.language == "deu"

    def test_preprocessing_flag(self):
        """Test preprocessing flag"""
        request = OCRRequest(file_path="test.png", preprocessing=False)
        assert request.preprocessing is False
        
        request_default = OCRRequest(file_path="test.png")
        assert request_default.preprocessing is True

    def test_extract_tables_flag(self):
        """Test extract_tables flag"""
        request = OCRRequest(file_path="test.png", extract_tables=True)
        assert request.extract_tables is True
        
        request_default = OCRRequest(file_path="test.png")
        assert request_default.extract_tables is False


@pytest.mark.skipif(
    not (HAS_TESSERACT or HAS_PADDLEOCR or HAS_EASYOCR),
    reason="No OCR engine installed"
)
class TestOCRIntegration:
    """Integration tests requiring OCR engines (skip in CI)"""

    def test_ocr_with_sample_image(self, tmp_path):
        """Test OCR with actual image (requires OCR engine)"""
        # This test would require a sample image
        # Skipping for now unless we have test fixtures
        pytest.skip("Requires sample image fixture")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
