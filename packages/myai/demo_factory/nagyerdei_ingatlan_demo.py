import os
import json
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn
from openai import OpenAI

# SZEMÉLYRE SZABOTT PROFIL: Nagyerdei Ingatlaniroda (Greatforest Real Estate)
OFFICE_PROFILE = {
    "name": "Nagyerdei Ingatlaniroda",
    "location": "4032 Debrecen, Komlóssy út 47. fszt.",
    "contact_email": "iroda@nagyerdeiingatlan.hu",
    "phone": "+36 70 616 1534",
    "services": [
        "Ingatlan értékesítés (1500+ eladó ingatlan)",
        "Bérbeadás (magyar és külföldi keresőknek)",
        "Ingatlankezelés (stresszmentes bérbeadás)"
    ],
    "featured_properties": [
        {"type": "Családi ház", "location": "Debrecen, Kismacs", "size": "100 m2", "price": "250 000 HUF (Kiadó)"},
        {"type": "Tégla lakás", "location": "Debrecen, Belváros", "size": "56 m2", "price": "280 000 HUF (Kiadó)"},
        {"type": "Panel lakás", "location": "Debrecen, Belváros", "size": "71 m2", "price": "220 000 HUF (Kiadó)"}
    ]
}

class InquiryRequest(BaseModel):
    customer_message: str

class InquiryResponse(BaseModel):
    response_draft: str
    suggested_properties: list[str]
    next_steps: str

app = FastAPI(title=f"{OFFICE_PROFILE['name']} - AI Asszisztens")

@app.post("/handle_inquiry", response_model=InquiryResponse)
async def handle_inquiry(req: InquiryRequest):
    api_key = os.getenv("OPENAI_API_KEY")
    client = OpenAI(api_key=api_key)

    system_prompt = f"""
    Te a {OFFICE_PROFILE['name']} (Greatforest Real Estate) AI asszisztense vagy. 
    Irodánk címe: {OFFICE_PROFILE['location']}. Szolgáltatásaink: {', '.join(OFFICE_PROFILE['services'])}.
    
    KIEMELT INGATLANJAINK:
    {json.dumps(OFFICE_PROFILE['featured_properties'], ensure_ascii=False)}
    
    FELADATOD: 
    1. Válaszolj az érdeklődő kérdésére udvariasan, professzionális, "nagyvárosi" stílusban.
    2. Ha konkrét ingatlant keres, ajánld fel a listából a legközelebb állót.
    3. Mindig említsd meg, hogy több mint 1500 ingatlan van a kínálatunkban.
    4. Javasold a Komlóssy úti irodánk meglátogatását vagy a telefonos egyeztetést ({OFFICE_PROFILE['phone']}).
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
            response_draft=data.get("response_draft", "Hamarosan küldjük a részletes tájékoztatót."),
            suggested_properties=data.get("suggested_properties", []),
            next_steps=data.get("next_steps", f"Hívjon minket a {OFFICE_PROFILE['phone']} számon!")
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    print(f"🚀 {OFFICE_PROFILE['name']} AI Demo API indul... (Port: 8061)")
    uvicorn.run(app, host="0.0.0.0", port=8061)
