import sys
import os
import json
import traceback
import io
from contextlib import redirect_stdout
from typing import Any, Dict, Optional
from fastapi import FastAPI, HTTPException, UploadFile, File
from pydantic import BaseModel
import uvicorn
import shutil
try:
    from faster_whisper import WhisperModel
    HAS_WHISPER = True
except ImportError:
    WhisperModel = None
    HAS_WHISPER = False

from myai.rag import rag_service

# Add project root to sys.path so imports work
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.append(PROJECT_ROOT)

from myai.refiner_logic import refiner
from myai.browser_worker import run_scenario, run_structured_extraction, check_setup

app = FastAPI(title="Brunella Python Subsystem")

class ExecuteRequest(BaseModel):
    code: str
    context: Optional[Dict[str, Any]] = {}

class RefineRequest(BaseModel):
    content: str
    source: Optional[str] = "unknown"

class HarvestRequest(BaseModel):
    scenario_path: str
    force_mode: Optional[str] = None  # 'api' | 'ui' | None (auto)

class ExtractionRequest(BaseModel):
    target_url: str
    schema_source: str  # JSON schema file path or raw JSON string
    extraction_prompt: Optional[str] = "Gyűjtsd ki a szükséges adatokat a megadott JSON séma szerint."
    model: Optional[str] = "gemini-2.0-flash"

@app.get("/health")
def health_check():
    return {"status": "ok", "component": "python_subsystem"}

@app.post("/execute")
def execute_code(req: ExecuteRequest):
    """
    Executes arbitrary Python code.
    Context variables are available as a 'context' dictionary.
    Captures stdout and returns it.
    """
    try:
        # Prepare execution environment
        # We include common imports usually expected by the snippets
        local_scope = {
            "context": req.context, 
            "json": json, 
            "os": os, 
            "sys": sys
        }
        
        f = io.StringIO()
        with redirect_stdout(f):
            exec(req.code, {}, local_scope)
        
        output = f.getvalue().strip()
        return {"stdout": output}

    except Exception as e:
        traceback.print_exc()
        # Return error structure compatible with PythonShell expectations if possible,
        # or HTTP 500
        return {"stdout": "", "error": str(e)}

@app.post("/refine")
def refine_data(req: RefineRequest):
    """
    Direct endpoint for DataRefiner logic.
    """
    try:
        result = refiner.process_data(req.model_dump())
        if result is None:
            return {"status": "REJECTED"}
        return result
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/harvest")
async def harvest_scenario(req: HarvestRequest):
    """
    Run a browser_worker scenario (API or UI mode).
    Returns the scenario execution result.
    """
    try:
        if not os.path.exists(req.scenario_path):
            raise HTTPException(status_code=404, detail=f"Scenario not found: {req.scenario_path}")
        result = await run_scenario(req.scenario_path, force_mode=req.force_mode)
        return {"status": "ok", "result": result}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/harvest/extract")
async def harvest_extract(req: ExtractionRequest):
    """
    Structured data extraction from a URL using a JSON schema.
    """
    try:
        config = {
            "target_url": req.target_url,
            "extraction_prompt": req.extraction_prompt,
            "model": req.model,
        }
        result = await run_structured_extraction(config, req.schema_source)
        if "error" in result:
            return {"status": "error", "error": result["error"], "raw_output": result.get("raw_output")}
        return {"status": "ok", "data": result["data"], "raw_output": result.get("raw_output")}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# Initialize Whisper model (lazy loading or startup)
# Using 'tiny' or 'base' for speed, 'small' for better accuracy.
# Run on CPU for compatibility since we might not have CUDA.
# For better multilingual support, consider 'large-v3' if resources allow.
WHISPER_MODEL_SIZE = "base"
whisper_model = None

def get_whisper_model():
    global whisper_model
    if not HAS_WHISPER:
        raise ImportError("faster-whisper is not installed. Install with: pip install faster-whisper")
    if whisper_model is None:
        print(f"Loading Whisper model: {WHISPER_MODEL_SIZE}...")
        whisper_model = WhisperModel(WHISPER_MODEL_SIZE, device="cpu", compute_type="int8")
        print("Whisper model loaded.")
    return whisper_model

@app.post("/voice/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    """
    Transcribe uploaded audio file to text using faster-whisper.
    Expects wav/mp3/m4a/webm.
    """
    try:
        # 1. Save uploaded file temporarily
        temp_filename = f"temp_{file.filename}"
        with open(temp_filename, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # 2. Transcribe
        model = get_whisper_model()
        segments, info = model.transcribe(temp_filename, beam_size=5)
        
        full_text = ""
        for segment in segments:
            full_text += segment.text + " "
            
        full_text = full_text.strip()
        print(f"Transcription detected language '{info.language}' with probability {info.language_probability}")
        print(f"Transcribed text: {full_text}")

        # 3. Cleanup
        os.remove(temp_filename)
        
        return {
            "status": "success",
            "text": full_text,
            "language": info.language,
            "probability": info.language_probability
        }

    except Exception as e:
        traceback.print_exc()
        # Ensure cleanup on error
        if os.path.exists(temp_filename):
            os.remove(temp_filename)
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")

@app.get("/harvest/check")
def harvest_check(scenario_path: str = "myai/scenarios/n8n_training.json"):
    """
    Pre-flight check for a scenario (env vars, dependencies).
    """
    ok = check_setup(scenario_path)
    return {"status": "ok" if ok else "missing_deps", "scenario_path": scenario_path}

def start():
    """Entry point for script execution"""
    uvicorn.run("myai.server:app", host="127.0.0.1", port=8000, reload=False)

if __name__ == "__main__":
    start()
