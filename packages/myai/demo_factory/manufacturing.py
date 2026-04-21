import os
import cv2
import numpy as np
from fastapi import APIRouter, UploadFile, File
from pydantic import BaseModel
from myai.workers.vision_worker import vision_worker
import base64

router = APIRouter(prefix="/demo/manufacturing", tags=["demos"])

class QualityControlResult(BaseModel):
    defects_found: int
    confidence: float
    recommendation: str
    annotated_image_url: str

@router.post("/analyze-quality", response_model=QualityControlResult)
async def analyze_quality(file: UploadFile = File(...)):
    """
    Simulates a vision-based quality control check for the manufacturing demo.
    In a real scenario, this would use Robotkez Pro Vision API + OpenCV.
    """
    # 1. Read image
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    # 2. Simulate defect detection (Robotkez Pro Vision style)
    # For the demo, we randomly find 0-3 defects
    defects = np.random.randint(0, 4)
    confidence = round(np.random.uniform(0.85, 0.99), 2)
    
    # 3. Add visual annotations (rectangles)
    if defects > 0:
        for _ in range(defects):
            x, y = np.random.randint(50, 400), np.random.randint(50, 400)
            cv2.rectangle(img, (x, y), (x+100, y+100), (0, 0, 255), 3)
            cv2.putText(img, "Defect", (x, y-10), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)

    # 4. Save and return (mock URL for now)
    # In production, this would go to R2 or S3
    
    return QualityControlResult(
        defects_found=defects,
        confidence=confidence,
        recommendation="Selejtmentés javasolt." if defects > 0 else "Minőség megfelelő.",
        annotated_image_url="https://demo.brunella.ai/storage/latest_qc_result.png"
    )
