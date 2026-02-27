import os
import json
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn
from openai import OpenAI

# Ezt a részt tölti ki a "Gyár" az iroda adatai alapján
OFFICE_PROFILE = {
    "name": "MINTA Könyvelőiroda",
    "specialty": "KATA, KFT könyvelés, Adóoptimalizálás",
    "contact_email": "info@mintakonyveles.hu",
    "deadlines": "ÁFA: tárgyhót követő 20., Bérjárulékok: tárgyhót követő 12.",
    "onboarding_docs": {
        "egyeni_vallalkozo": ["Személyi igazolvány", "Lakcímkártya", "Ügyfélkapu hozzáférés"],
        "kft": ["Társasági szerződés", "Aláírási címpéldány", "Banki felhatalmazás"]
    }
}

class QueryRequest(BaseModel):
    user_query: str
    context_type: str  # "advisor" vagy "onboarding"

class QueryResponse(BaseModel):
    answer: str
    required_action: str
    useful_links: list[str]

app = FastAPI(title=f"{OFFICE_PROFILE['name']} - AI Ügyfélasszisztens")

@app.post("/ask", response_model=QueryResponse)
async def ask_accountant(req: QueryRequest):
    api_key = os.getenv("OPENAI_API_KEY")
    client = OpenAI(api_key=api_key)

    system_prompt = f"""
    Te a {OFFICE_PROFILE['name']} AI asszisztense vagy. 
    Munkamód: {req.context_type.upper()}
    
    IRODAI INFÓK:
    - Szakterület: {OFFICE_PROFILE['specialty']}
    - Határidők: {OFFICE_PROFILE['deadlines']}
    - Szükséges dokumentumok: {json.dumps(OFFICE_PROFILE['onboarding_docs'])}
    
    FELADAT: 
    Ha 'advisor' módban vagy: Válaszolj szakmai kérdésekre a megadott infók alapján.
    Ha 'onboarding' módban vagy: Segíts az új ügyfélnek, hogy pontosan mit kell beküldenie.
    Válaszolj JSON formátumban!
    """

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            response_format={ "type": "json_object" },
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": req.user_query}
            ]
        )
        data = json.loads(response.choices[0].message.content)
        return QueryResponse(
            answer=data.get("answer", "Kérjük, vegye fel velünk a kapcsolatot telefonon."),
            required_action=data.get("required_action", "Nincs azonnali teendő."),
            useful_links=data.get("useful_links", [])
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8070)
