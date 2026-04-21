import os
import json
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn
from openai import OpenAI

# Ezt a részt fogja a "Gyár" automatikusan kitölteni minden cégnél
BUSINESS_PROFILE = {
    "company_name": "MINTA Ingatlaniroda",
    "services": "Eladás, bérbeadás, értékbecslés",
    "location": "Budapest és környéke",
    "specialty": "Új építésű lakások",
    "pricing_logic": "Eladási ár 2.5%-a + ÁFA"
}

# Ingatlan adatok (szintén dinamikusan betölthető)
PROPERTIES_DATABASE = """
1. Ingatlan: Modern lakás a Corvin-negyedben
Ár: 65.000.000 Ft. Alapterület: 45 m2. Szobák: 2. Extrák: Erkély, okosotthon rendszer.
2. Ingatlan: Családi ház Érden
Ár: 120.000.000 Ft. Alapterület: 120 m2. Telek: 600 m2. Szobák: 4. Extrák: Medence, hőszivattyú.
"""

class InquiryRequest(BaseModel):
    customer_message: str

class InquiryResponse(BaseModel):
    response_draft: str
    suggested_properties: list[str]
    next_steps: str

app = FastAPI(title=f"{BUSINESS_PROFILE['company_name']} - AI Asszisztens")

@app.post("/handle_inquiry", response_model=InquiryResponse)
async def handle_inquiry(req: InquiryRequest):
    api_key = os.getenv("OPENAI_API_KEY")
    client = OpenAI(api_key=api_key)

    system_prompt = f"""
    Te vagy a {BUSINESS_PROFILE['company_name']} AI értékesítési asszisztense. 
    Profilunk: {BUSINESS_PROFILE['services']}. Szakterületünk: {BUSINESS_PROFILE['specialty']}.
    
    ADATBÁZISUNK:
    {PROPERTIES_DATABASE}
    
    A feladatod: Válaszolj az érdeklődő üzenetére udvariasan, ajánlj neki a listából 1-2 ingatlant, ami passzolhat hozzá, és javasolj egy következő lépést (pl. megtekintés).
    Válaszolj JSON formátumban!
    """

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            response_format={ "type": "json_object" },
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": req.customer_message}
            ]
        )
        data = json.loads(response.choices[0].message.content)
        return InquiryResponse(
            response_draft=data.get("response_draft", ""),
            suggested_properties=data.get("suggested_properties", []),
            next_steps=data.get("next_steps", "Személyes konzultáció egyeztetése.")
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8060)
