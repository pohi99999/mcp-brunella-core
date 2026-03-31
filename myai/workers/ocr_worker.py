"""
OCR Worker - Offline Text Extraction
Supports: Tesseract OCR, PaddleOCR, EasyOCR
Uses: Invoice processing, document scanning, image-to-text

Author: Brunella Agent System
Version: 1.0.0
"""

import os
import logging
from pathlib import Path
from typing import Optional, Literal
from pydantic import BaseModel, Field
import base64

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# OCR Engine availability flags
HAS_TESSERACT = False
HAS_PADDLEOCR = False
HAS_EASYOCR = False

try:
    import pytesseract
    from PIL import Image
    HAS_TESSERACT = True
    logger.info("[OK] Tesseract OCR available")
except ImportError:
    logger.warning("[WARN] Tesseract OCR not available (pip install pytesseract pillow)")

try:
    from paddleocr import PaddleOCR
    HAS_PADDLEOCR = True
    logger.info("[OK] PaddleOCR available")
except ImportError:
    logger.warning("[WARN] PaddleOCR not available (pip install paddleocr)")

try:
    import easyocr
    HAS_EASYOCR = True
    logger.info("[OK] EasyOCR available")
except ImportError:
    logger.warning("[WARN] EasyOCR not available (pip install easyocr)")


# ============================================================================
# Pydantic Models
# ============================================================================

class OCRRequest(BaseModel):
    """OCR processing request"""
    file_path: str = Field(..., description="Path to image/PDF file")
    engine: Literal["tesseract", "paddleocr", "easyocr", "auto"] = Field(
        "auto", description="OCR engine to use"
    )
    language: str = Field("eng", description="Language code (eng, hun, deu, etc.)")
    preprocessing: bool = Field(True, description="Apply image preprocessing")
    extract_tables: bool = Field(False, description="Attempt table extraction")


class OCRResponse(BaseModel):
    """OCR processing response"""
    success: bool = Field(..., description="Processing success")
    text: str = Field("", description="Extracted text")
    confidence: float = Field(0.0, description="OCR confidence (0-100)")
    engine_used: str = Field("", description="OCR engine used")
    file_path: str = Field("", description="Processed file path")
    error: Optional[str] = Field(None, description="Error message if failed")
    duration_seconds: float = Field(0.0, description="Processing time")


# ============================================================================
# OCR Engines
# ============================================================================

def tesseract_ocr(image_path: str, language: str = "eng") -> tuple[str, float]:
    """
    Tesseract OCR extraction
    Returns: (text, confidence)
    """
    if not HAS_TESSERACT:
        raise ImportError("Tesseract not available. Install: pip install pytesseract pillow")
    
    try:
        # Open image
        img = Image.open(image_path)
        
        # Extract text with confidence
        data = pytesseract.image_to_data(img, lang=language, output_type=pytesseract.Output.DICT)
        
        # Combine text
        text = " ".join([word for word in data['text'] if word.strip()])
        
        # Calculate average confidence
        confidences = [float(conf) for conf in data['conf'] if conf != '-1']
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0
        
        logger.info(f"Tesseract extracted {len(text)} chars with {avg_confidence:.1f}% confidence")
        return text, avg_confidence
    
    except Exception as e:
        logger.error(f"Tesseract OCR failed: {e}")
        raise


def paddleocr_ocr(image_path: str, language: str = "en") -> tuple[str, float]:
    """
    PaddleOCR extraction (supports Chinese, English, multi-language)
    Returns: (text, confidence)
    """
    if not HAS_PADDLEOCR:
        raise ImportError("PaddleOCR not available. Install: pip install paddleocr")
    
    try:
        # Language mapping
        lang_map = {"eng": "en", "hun": "latin", "deu": "german"}
        paddle_lang = lang_map.get(language, "en")
        
        # Initialize PaddleOCR (use_gpu=False for CPU)
        ocr = PaddleOCR(use_angle_cls=True, lang=paddle_lang, use_gpu=False)
        
        # Perform OCR
        result = ocr.ocr(image_path, cls=True)
        
        # Extract text and confidence
        texts = []
        confidences = []
        
        if result and result[0]:
            for line in result[0]:
                if len(line) >= 2:
                    text_info = line[1]
                    if len(text_info) >= 2:
                        texts.append(text_info[0])
                        confidences.append(float(text_info[1]) * 100)
        
        combined_text = "\n".join(texts)
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0
        
        logger.info(f"PaddleOCR extracted {len(combined_text)} chars with {avg_confidence:.1f}% confidence")
        return combined_text, avg_confidence
    
    except Exception as e:
        logger.error(f"PaddleOCR failed: {e}")
        raise


def easyocr_ocr(image_path: str, language: str = "en") -> tuple[str, float]:
    """
    EasyOCR extraction (supports 80+ languages)
    Returns: (text, confidence)
    """
    if not HAS_EASYOCR:
        raise ImportError("EasyOCR not available. Install: pip install easyocr")
    
    try:
        # Language mapping
        lang_map = {"eng": "en", "hun": "hu", "deu": "de", "fra": "fr"}
        easy_lang = lang_map.get(language, "en")
        
        # Initialize reader
        reader = easyocr.Reader([easy_lang], gpu=False)
        
        # Perform OCR
        result = reader.readtext(image_path)
        
        # Extract text and confidence
        texts = []
        confidences = []
        
        for detection in result:
            if len(detection) >= 3:
                texts.append(detection[1])  # text
                confidences.append(float(detection[2]) * 100)  # confidence
        
        combined_text = "\n".join(texts)
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0
        
        logger.info(f"EasyOCR extracted {len(combined_text)} chars with {avg_confidence:.1f}% confidence")
        return combined_text, avg_confidence
    
    except Exception as e:
        logger.error(f"EasyOCR failed: {e}")
        raise


# ============================================================================
# Main OCR Worker
# ============================================================================

def select_best_engine(preferred: str) -> str:
    """Select best available OCR engine"""
    if preferred != "auto":
        return preferred
    
    # Priority: PaddleOCR > EasyOCR > Tesseract
    if HAS_PADDLEOCR:
        return "paddleocr"
    elif HAS_EASYOCR:
        return "easyocr"
    elif HAS_TESSERACT:
        return "tesseract"
    else:
        raise RuntimeError("No OCR engine available. Install at least one: pytesseract, paddleocr, or easyocr")


def process_ocr(request: OCRRequest) -> OCRResponse:
    """
    Main OCR processing function
    
    Example:
        request = OCRRequest(file_path="invoice.png", engine="auto", language="eng")
        response = process_ocr(request)
        print(response.text)
    """
    import time
    start_time = time.time()
    
    # Validate file exists
    if not Path(request.file_path).exists():
        return OCRResponse(
            success=False,
            error=f"File not found: {request.file_path}",
            file_path=request.file_path,
            duration_seconds=time.time() - start_time
        )
    
    # Select engine
    try:
        engine = select_best_engine(request.engine)
    except RuntimeError as e:
        return OCRResponse(
            success=False,
            error=str(e),
            file_path=request.file_path,
            duration_seconds=time.time() - start_time
        )
    
    # Process OCR
    try:
        logger.info(f"Processing {request.file_path} with {engine} (lang: {request.language})")
        
        if engine == "tesseract":
            text, confidence = tesseract_ocr(request.file_path, request.language)
        elif engine == "paddleocr":
            text, confidence = paddleocr_ocr(request.file_path, request.language)
        elif engine == "easyocr":
            text, confidence = easyocr_ocr(request.file_path, request.language)
        else:
            raise ValueError(f"Unknown engine: {engine}")
        
        duration = time.time() - start_time
        
        logger.info(f"[OK] OCR completed in {duration:.2f}s ({len(text)} chars)")
        
        return OCRResponse(
            success=True,
            text=text,
            confidence=confidence,
            engine_used=engine,
            file_path=request.file_path,
            duration_seconds=duration
        )
    
    except Exception as e:
        logger.error(f"OCR processing failed: {e}")
        return OCRResponse(
            success=False,
            error=str(e),
            file_path=request.file_path,
            engine_used=engine,
            duration_seconds=time.time() - start_time
        )


# ============================================================================
# CLI Interface
# ============================================================================

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python ocr_worker.py <image_path> [engine] [language]")
        print("  engine: auto (default), tesseract, paddleocr, easyocr")
        print("  language: eng (default), hun, deu, fra, etc.")
        sys.exit(1)
    
    file_path = sys.argv[1]
    engine = sys.argv[2] if len(sys.argv) > 2 else "auto"
    language = sys.argv[3] if len(sys.argv) > 3 else "eng"
    
    request = OCRRequest(
        file_path=file_path,
        engine=engine,
        language=language
    )
    
    response = process_ocr(request)
    
    if response.success:
        print(f"\n[OK] OCR Success ({response.engine_used})")
        print(f"Confidence: {response.confidence:.1f}%")
        print(f"Duration: {response.duration_seconds:.2f}s")
        print(f"\nExtracted Text:\n{'-' * 80}")
        print(response.text)
    else:
        print(f"\n[ERROR] OCR Failed: {response.error}")
        sys.exit(1)
