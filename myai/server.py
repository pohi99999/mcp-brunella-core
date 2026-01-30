import sys
import os
import json
import traceback
import io
from contextlib import redirect_stdout
from typing import Any, Dict, Optional
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn

# Add project root to sys.path so imports work
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.append(PROJECT_ROOT)

from myai.refiner_logic import refiner

app = FastAPI(title="Brunella Python Subsystem")

class ExecuteRequest(BaseModel):
    code: str
    context: Optional[Dict[str, Any]] = {}

class RefineRequest(BaseModel):
    content: str
    source: Optional[str] = "unknown"

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

def start():
    """Entry point for script execution"""
    uvicorn.run("myai.server:app", host="127.0.0.1", port=8000, reload=False)

if __name__ == "__main__":
    start()
