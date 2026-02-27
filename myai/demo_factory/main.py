from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn
import os
import json
from typing import Optional

app = FastAPI(title="Brunella Demo Factory")

class DemoRequest(BaseModel):
    domain: str
    company_name: Optional[str] = None
    industry: str

class DemoResponse(BaseModel):
    demo_id: str
    demo_url: str
    value_proposition: str

@app.post("/generate-demo")
async def generate_demo(request: DemoRequest):
    try:
        # 1. Analyze the industry and company (Simulated logic)
        # In a real scenario, we would use an LLM here to tailor the value prop
        value_props = {
            "clinic": f"Automatizált páciens-kommunikáció a {request.domain} számára.",
            "real-estate": f"AI ingatlan-értékelő és hirdetés-generáló a {request.domain} számára.",
            "accounting": f"Automata számlafeldolgozás és adótanácsadó asszisztens.",
            "ecommerce": f"Dinamikus árazás és készlet-optimalizáló rendszer.",
            "other": f"Személyre szabott AI folyamat-optimalizálás."
        }
        
        v_prop = value_props.get(request.industry, "Általános AI hatékonyság-növelés.")
        
        # 2. Generate a unique ID for the demo
        import uuid
        demo_id = str(uuid.uuid4())[:8]
        
        # 3. Simulate creating a demo landing page or API
        # We just return the metadata for now
        
        return DemoResponse(
            demo_id=demo_id,
            demo_url=f"https://demo.brunella.ai/preview/{demo_id}",
            value_proposition=v_prop
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
