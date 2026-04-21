import os
import json
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn
from openai import OpenAI

# =====================================================================
# TUDÁSBÁZISOK (MOCK ADATOK)
# =====================================================================

KNOWLEDGE_BASE_MAINTENANCE = """
1. Gép: Truxor T40 (Kétéltű nádvágó és kotrógép)
Jelenség: A motor nagyon füstöl, és eszi/fogy az olaj. Kategória: Motor/Olajrendszer. Sürgősség: Kritikus. Javaslat: AZONNAL leállítani! Ellenőrizni a hengerfejtömítést. Alkatrész: Hengerfejtömítés készlet (TRX-ENG-001), 5W-40 Motorolaj (O-5W40-10L).
Jelenség: A vágófej nem mozog. Kategória: Hidraulika. Sürgősség: Magas. Javaslat: Hidraulika folyadék szint ellenőrzés. Alkatrész: Hidraulika olaj HLP46 (O-HYD-46).
Jelenség: Eltört a T-alakú vágókés. Kategória: Vágószerkezet. Sürgősség: Normál. Javaslat: Kést cserélni. Alkatrész: T-vágókés (TRX-BLD-T01).

2. Gép: Honda WB30XT (vízszivattyú)
Jelenség: A szivattyú zörög, fémes hang. Kategória: Csapágy/Mechanika. Sürgősség: Magas. Javaslat: Leállítás. Csapágy kopott. Alkatrész: Csapágykészlet SKF-6204 (HND-BRG-6204).
Jelenség: Nehezen indul, dadog. Kategória: Üzemanyagrendszer. Sürgősség: Normál. Javaslat: Karburátor tisztítás. Alkatrész: NGK BPR6ES gyújtógyertya (NGK-BPR6ES).

3. Gép: Kotróhajó
Jelenség: Szívóteljesítmény lecsökken. Kategória: Szívórendszer. Sürgősség: Normál. Javaslat: Tisztítás. Nincs alkatrész.
Jelenség: Az úszótest szelepe ereszt. Kategória: Biztonság. Sürgősség: Kritikus. Javaslat: Partra vontatni! Alkatrész: Biztonsági légtelenítő szelep (PONT-VALVE-002).
"""

KNOWLEDGE_BASE_PRICING = """
1. Gép- és Eszközdíjak (Kezelővel, üzemanyaggal)
- Truxor T40 (kétéltű): Napidíj: 180 000 Ft/nap. Félnapos: 100 000 Ft.
- Honda vízszivattyú (kezelővel): 60 000 Ft/nap.
- Kotróhajó (2 fővel): 350 000 Ft/nap.

2. Kiszállási díjak (Érdről indulva)
- Truxor szállítás: 0-50 km: 40 000 Ft. 50 km felett: Alapdíj + 400 Ft/extra km (csak odaút fizetendő pluszban).
- Kotróhajó: 0-50 km: 120 000 Ft. 50 km felett: Alapdíj + 1000 Ft/extra km.

3. Teljesítménynormák
- Nádvágás (Truxor): 1500 m2/nap.
- Nádvágás és gyűjtés (Truxor): 800 m2/nap.
- Iszapkotrás (Truxorral): 30 m3/nap.
- Ipari kotrás (Kotróhajó): 200 m3/nap.

4. Felárak
- Veszélyes hulladék/szennyezett: +20% a gépdíjra.
- Sürgősségi (1 héten belüli): +15% a munkadíjra.
Minden ár Nettó.
"""

# =====================================================================
# ADATMODELLEK (PYDANTIC)
# =====================================================================

class DiagnosticRequest(BaseModel):
    message: str

class DiagnosticResponse(BaseModel):
    gep_id: str
    hiba_kategoria: str
    surgosseg: str
    javasolt_lepes: str
    szukseges_alkatreszek: list[str]

class QuoteRequest(BaseModel):
    nev: str
    email: str
    uzenet: str

class QuoteResponse(BaseModel):
    ugyfel_neve: str
    ugyfel_email: str
    kimeneti_ajanlat_markdown: str

# =====================================================================
# FASTAPI INICIALIZÁLÁS
# =====================================================================

app = FastAPI(title="Iszapfaló AI Mikroszolgáltatások")

def get_openai_client():
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY environment variable is not set.")
    return OpenAI(api_key=api_key)

# =====================================================================
# VÉGPONTOK (ENDPOINTS)
# =====================================================================

# 1. Modul: Prediktív Karbantartás
@app.post("/diagnose", response_model=DiagnosticResponse)
async def diagnose_machine(req: DiagnosticRequest):
    client = get_openai_client()
    system_prompt = f"""
    Te egy Prediktív Karbantartási AI Asszisztens vagy az Iszapfaló Kft-nél.
    Elemezd a munkatárstól kapott hibaüzenetet az alábbi Tudásbázis (Gépkönyv) alapján:
    {KNOWLEDGE_BASE_MAINTENANCE}
    Válaszolj szigorú JSON formátumban!
    """

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            response_format={ "type": "json_object" },
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"A várt JSON: {{"gep_id": "...", "hiba_kategoria": "...", "surgosseg": "...", "javasolt_lepes": "...", "szukseges_alkatreszek": ["..."]}}
Üzenet: {req.message}"}
            ],
            temperature=0.2
        )
        return DiagnosticResponse(**json.loads(response.choices[0].message.content))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 2. Modul: Okos Ajánlatadó
@app.post("/quote", response_model=QuoteResponse)
async def generate_quote(req: QuoteRequest):
    client = get_openai_client()
    system_prompt = f"""
    Te az Iszapfaló Kft. Okos Ajánlatadó AI Asszisztense vagy.
    A feladatod, hogy a bejövő ügyfélkérés alapján egy professzionális árajánlat-tervezetet írj Markdown formátumban.
    
    ÁRLISTA ÉS NORMÁK:
    {KNOWLEDGE_BASE_PRICING}
    
    LÉPÉSEK:
    1. Értelmezd az ügyfél kérését (m2, m3, távolság).
    2. Számold ki a gépigényt, a napokat és az árakat (kiszállással együtt). Ha nincs megadva távolság, kérdezz rá udvariasan a levélben, és ne számolj kiszállást.
    3. Fogalmazz meg egy udvarias válasz e-mailt Markdown formátumban.
    4. A válaszod KIZÁRÓLAG egy JSON legyen, amiben a 'markdown_text' mező tartalmazza magát a levelet.
    """

    try:
        # Itt GPT-4o-t használunk, mert jobban számol és jobban fogalmaz
        response = client.chat.completions.create(
            model="gpt-4o",
            response_format={ "type": "json_object" },
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Ügyfél neve: {req.nev}
Üzenet: {req.uzenet}

Várt JSON: {{"markdown_text": "...a teljes levél ide jön..."}}"}
            ],
            temperature=0.3
        )
        result_json = json.loads(response.choices[0].message.content)
        
        return QuoteResponse(
            ugyfel_neve=req.nev,
            ugyfel_email=req.email,
            kimeneti_ajanlat_markdown=result_json.get("markdown_text", "Hiba történt a generálás során.")
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    print("🚀 Iszapfaló API indul... (Port: 8050)")
    print("Végpontok: /diagnose (Karbantartás), /quote (Ajánlatadó)")
    uvicorn.run(app, host="0.0.0.0", port=8050)
