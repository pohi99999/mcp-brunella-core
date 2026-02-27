import os
import json
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn
from openai import OpenAI

# SZEMÉLYRE SZABOTT PROFIL: Aktív-A Könyvelőiroda Debrecen
OFFICE_PROFILE = {
    "name": "Aktív-A Könyvelőiroda",
    "leader": "Nagy Attila (adótanácsadó, mérlegképes könyvelő)",
    "location": "4029 Debrecen, Dienes János utca 9.",
    "specialty": "Egyéni vállalkozók (KATA, átalányadó), Társas vállalkozások, Társasházak és Őstermelők teljes körű könyvelése.",
    "contact_email": "aktivakonyveles@gmail.com",
    "deadlines": "Könyvelési anyagok leadása: tárgyhót követő 12. napig.",
    "pricing_highlights": {
        "egyeni_kata_mentes": "10 900 Ft-tól",
        "egyeni_atalany_mentes": "15 900 Ft-tól",
        "tarsas_afa_mentes": "52 900 Ft-tól",
        "vallalkozas_inditas": "25 000 Ft (tanácsadás ingyenes)"
    }
}

class QueryRequest(BaseModel):
    user_query: str

class QueryResponse(BaseModel):
    answer: str
    personalized_quote_hint: str
    contact_info: str

app = FastAPI(title=f"{OFFICE_PROFILE['name']} - Egyedi AI Demo")

@app.post("/ask", response_model=QueryResponse)
async def ask_active_a(req: QueryRequest):
    api_key = os.getenv("OPENAI_API_KEY")
    client = OpenAI(api_key=api_key)

    system_prompt = f"""
    Te az {OFFICE_PROFILE['name']} digitális asszisztense vagy. Vezetőnk {OFFICE_PROFILE['leader']}.
    Használd az iroda adatait a válaszhoz:
    - Szolgáltatások: {OFFICE_PROFILE['specialty']}
    - Árak: {json.dumps(OFFICE_PROFILE['pricing_highlights'])}
    - Határidő: {OFFICE_PROFILE['deadlines']}
    
    FELADAT: Válaszolj az érdeklődőnek udvariasan, debreceni lokálpatrióta stílusban. 
    Ha az árakról kérdez, említsd meg a konkrét 'tól' árakat a listából.
    Mindig ajánld fel a személyes találkozót az irodában ({OFFICE_PROFILE['location']}).
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
            answer=data.get("answer", "Hamarosan jelentkezünk."),
            personalized_quote_hint=data.get("personalized_quote_hint", "Kérjen egyedi ajánlatot!"),
            contact_info=f"Email: {OFFICE_PROFILE['contact_email']} | Cím: {OFFICE_PROFILE['location']}"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    print(f"🚀 {OFFICE_PROFILE['name']} Demo API indul... (Port: 8071)")
    uvicorn.run(app, host="0.0.0.0", port=8071)
