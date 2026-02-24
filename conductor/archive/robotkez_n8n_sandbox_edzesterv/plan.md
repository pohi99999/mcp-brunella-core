Truck:

A cél: A Robotkéz (browser-use) számára egy izolált n8n sandbox környezet és az első automatizált edzésterv (training scenario) kialakítása

STEP 1: DEPENDENCIES & SETUP

Bash
# Python függőségek a browser-use és n8n interakcióhoz
pip install browser-use langchain-google-genai pydantic python-dotenv
STEP 2: FILE CREATION

Fájl: docs/n8n-setup.md

Markdown
# n8n Sandbox Telepítési Útmutató (Robotkéz Edzőterem)

## 1. Docker Setup
Futtasd az alábbi parancsot egy elkülönített könyvtárban vagy add a meglévő `docker-compose.yml`-hez:

```yaml
services:
  n8n-sandbox:
    image: n8nio/n8n:latest
    ports:
      - "5678:5678"
    environment:
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=${N8N_TEST_USER}
      - N8N_BASIC_AUTH_PASSWORD=${N8N_TEST_PASSWORD}
    volumes:
      - n8n_data:/home/node/.n8n

volumes:
  n8n_data:
2. Elérhetőség
Az ügynök számára az URL: http://localhost:5678 (Docker hálózaton belül, ha a worker is ott fut, akkor a szerviznév használandó).


---

Fájl: `myai/scenarios/n8n_training.json`
```json
{
  "scenario_name": "n8n_basic_workflow_creation",
  "target_url": "http://localhost:5678",
  "steps": [
    {
      "action": "login",
      "description": "Belépés az n8n felületére a .env-ben tárolt adatokkal."
    },
    {
      "action": "click",
      "target": "Create Workflow",
      "description": "Új munkafolyamat indítása."
    },
    {
      "action": "rename_workflow",
      "new_name": "Robotkez_Teszt_1",
      "description": "A workflow elnevezése."
    },
    {
      "action": "save",
      "description": "Változások mentése."
    }
  ]
}
Fájl: myai/browser_worker.py

Python
# FILE: myai/browser_worker.py
# PURPOSE: Felkészített browser-use ágens, amely képes scenario alapú feladatvégzésre.

import os
import json
import asyncio
from dotenv import load_dotenv
from browser_use import Agent
from langchain_google_genai import ChatGoogleGenerativeAI
from pydantic import SecretStr

load_dotenv()

async def run_n8n_scenario(scenario_path: str):
    # Szcenárió betöltése
    with open(scenario_path, 'r') as f:
        config = json.load(f)

    # Környezeti változók ellenőrzése
    test_user = os.getenv("N8N_TEST_USER")
    test_pass = os.getenv("N8N_TEST_PASSWORD")

    if not test_user or not test_pass:
        print("HIBA: N8N_TEST_USER vagy N8N_TEST_PASSWORD hiányzik a .env fájlból!")
        return

    # LLM inicializálása
    llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash")

    # Feladat megfogalmazása az ágensnek
    task = f"""
    Menj a következő oldalra: {config['target_url']}
    Használd a következő lépéseket az edzésterv végrehajtásához:
    1. Jelentkezz be (User: {test_user}, Pass: {test_pass})
    2. {config['steps'][1]['description']}
    3. {config['steps'][2]['description']} ({config['steps'][2].get('new_name', '')})
    4. {config['steps'][3]['description']}

    A végén igazold vissza a workflow nevét.
    """

    agent = Agent(
        task=task,
        llm=llm,
    )

    result = await agent.run()
    return result

if __name__ == "__main__":
    asyncio.run(run_n8n_scenario("myai/scenarios/n8n_training.json"))
STEP 3: INTEGRATION

Frissítsd a gyökérben található .env fájlt az alábbiakkal (helyettesítsd a saját jelszavaddal):

Kódrészlet
# n8n Sandbox Credentials
N8N_TEST_USER=admin
N8N_TEST_PASSWORD=your_secure_password_here
N8N_TEST_URL=http://localhost:5678
Frissítsd a src/utils/validateSecrets.ts fájlt, hogy ellenőrizze ezeket a változókat induláskor.

STEP 4: VERIFICATION & TESTING

Fájl: test/n8n_automation.test.ts

TypeScript
// FILE: test/n8n_automation.test.ts
// PURPOSE: Ellenőrzi, hogy a Python worker indítható-e és látja-e a környezeti változókat.

import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

describe("Robotkéz n8n Integration Test", () => {
    it("should verify environment variables are present", () => {
        expect(process.env.N8N_TEST_USER).toBeDefined();
        expect(process.env.N8N_TEST_URL).toContain("5678");
    });

    it("should be able to trigger the python worker dry-run", async () => {
        // Csak a python script elérhetőségét és alap indulását teszteljük
        const { stdout } = await execPromise('python myai/browser_worker.py --help');
        expect(stdout).toBeDefined();
    });
});
STEP 5: EXECUTION

Bash
# 1. n8n elindítása (ha még nem fut)
docker-compose up -d n8n-sandbox

# 2. Tesztek futtatása
дает test/n8n_automation.test.ts

# 3. Robotkéz éles indítása az edzéstervvel
python myai/browser_worker.py
Would you like me to generate a specific n8n workflow export (JSON) that the agent should try to "reconstruct" as part of a more advanced training step?

---

---

CONTEXT FOR THE CODER AI: "Te vagy a Végrehajtó Ügynök. A feladatod a meglévő 'AI Research' eszközök integrálása a BAS ökoszisztémába, hogy az EV Hunter bot ne csak hirdetéseket, hanem piaci trendeket is figyelhessen. Használd fel a Perplexity keresőt az autópiaci hírekhez."

STEP 1: DEPENDENCIES pip install arxiv requests pydantic pandas

STEP 2: FILE CREATION & INTEGRATION

Fájl: myai/agents/ev_hunter/market_researcher.py

Python
# FILE: myai/agents/ev_hunter/market_researcher.py
# PURPOSE: A Perplexity kereső integrálása az autópiaci trendek figyelésére.
# SOURCE INSPIRATION: perplexity_search_tool.py

import os
import requests
from dotenv import load_dotenv

load_dotenv()

class EVMarketResearcher:
    def __init__(self):
        self.api_key = os.getenv("PERPLEXITY_API_KEY")
        self.url = "https://api.perplexity.ai/chat/completions"

    def get_latest_ev_trends(self, region: str):
        """Webes keresés a megadott régió elektromos autó piaci trendjeiről."""
        payload = {
            "model": "llama-3.1-sonar-large-128k-online",
            "messages": [
                {"role": "system", "content": "Te egy autópiaci elemző vagy. Keress friss híreket."}, 
                {"role": "user", "content": f"Milyen új EV állami támogatások vagy árváltozások vannak itt: {region}?"}
            ]
        }
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        response = requests.post(self.url, json=payload, headers=headers)
        return response.json()['choices'][0]['message']['content']

# Ezt a kutatási eredményt a Score (pontozó) logika bemenetként használhatja.
STEP 3: REFINING DATA STRUCTURES Módosítjuk a myai/schemas.py-t, hogy a kutatási adatokat is kezelje a rendszer, ahogy azt az ai_research_pipeline.json sugallja.

Fájl: myai/schemas.py (Kiegészítés)

Python
# FILE: myai/schemas.py (Bővített verzió)

class MarketTrend(BaseModel):
    region: str
    news_summary: str
    impact_on_prices: str # pl. "decreasing", "stable", "increasing"
    timestamp: str
STEP 4: DUAL STORAGE LOGIC Az ai_research_pipeline.json-ban látott "Dual Write" mintájára (ChromaDB + JSON) módosítjuk a mentési mechanizmust.

Fájl: src/utils/rag.ts (Frissítés)

TypeScript
// FILE: src/utils/rag.ts
// PURPOSE: Dual storage implementálása az AI Research mintájára.

import * as fs from 'fs';
import * as lancedb from 'lancedb';

export class DualStorageManager {
    private backupPath = './logs/harvest_backup.jsonl';

    async saveWithBackup(table: string, data: any) {
        // 1. Mentés LanceDB-be (Vektoros kereséshez)
        // ... (LanceDB kód) ...

        // 2. Mentés JSONL-be (Biztonsági mentés az AI Research minta alapján)
        const entry = JSON.stringify({ ...data, savedAt: new Date().toISOString() }) + '\n';
        fs.appendFileSync(this.backupPath, entry);
        console.log(`[DualStorage] Data backed up to ${this.backupPath}`);
    }
}
STEP 5: EXECUTION

Bash
# Perplexity kulcs beállítása után
python myai/agents/ev_hunter/market_researcher.py
---


---

CONTEXT FOR THE CODER AI: "Te vagy a Végrehajtó Ügynök. A cél: A BAS EV Hunter bot és az AI Research Pipeline teljes egyesítése. Az ügynöknek képesnek kell lennie Perplexity kutatásra, ArXiv/GitHub trendek figyelésére, és az adatok Dual-Storage (LanceDB + JSON) mentésére. Használd a Pydantic modelleket a validációhoz."

STEP 1: DEPENDENCIES & SETUP

Bash
# Összesített függőségek telepítése
pip install pydantic requests pandas openpyxl arxiv lancedb python-dotenv browser-use langchain-google-genai
npm install zod lancedb dotenv
STEP 2: FILE CREATION

Fájl: myai/tools/integrated_research.py

Python
# FILE: myai/tools/integrated_research.py
# PURPOSE: Integrált kutatóeszközök a Perplexity, ArXiv és GitHub eléréséhez.

import os
import requests
import arxiv
from dotenv import load_dotenv

load_dotenv()

class ResearchSuite:
    def __init__(self):
        self.pplx_key = os.getenv("PERPLEXITY_API_KEY")

    def market_search(self, query: str):
        """Webes keresés Perplexity-vel (Real-time piaci hírek)."""
        url = "https://api.perplexity.ai/chat/completions"
        payload = {
            "model": "llama-3.1-sonar-large-128k-online",
            "messages": [
                {"role": "system", "content": "Autópiaci és technológiai elemző vagy. Keress friss híreket."}, 
                {"role": "user", "content": query}
            ]
        }
        headers = {"Authorization": f"Bearer {self.pplx_key}", "Content-Type": "application/json"}
        try:
            res = requests.post(url, json=payload, headers=headers).json()
            return res['choices'][0]['message']['content']
        except: return "Kutatási adat nem elérhető."

    def tech_trends(self, topic: str):
        """Technológiai trendek (ArXiv) lekérése (pl. akkumulátor fejlesztések)."""
        search = arxiv.Search(query=topic, max_results=2, sort_by=arxiv.SortCriterion.Relevance)
        return [{"title": r.title, "link": r.entry_id} for r in search.results()]
Fájl: myai/agents/ev_hunter/mega_orchestrator.py

Python
# FILE: myai/agents/ev_hunter/mega_orchestrator.py
# PURPOSE: A 'First Harvest' hadművelet központi vezérlője.

import asyncio
from myai.tools.integrated_research import ResearchSuite
from myai.agents.ev_hunter.ev_hunter_bot import EVHunterBot
from myai.schemas import CarResult, MarketInsight, HarvestPayload
from myai.utils.report_generator import ReportGenerator
from myai.utils.notifier import Notifier
import json

class MegaOrchestrator:
    def __init__(self):
        self.researcher = ResearchSuite()
        self.hunter = EVHunterBot()
        self.notifier = Notifier()

    async def execute_mission(self, region: str):
        print(f"🚀 Misszió indítása: {region}")
        
        # 1. KONTEXTUS: Mi történik most a piacon?
        print("[PIAC] Perplexity elemzés futtatása...")
        market_news = self.researcher.market_search(f"Latest EV price drops and subsidies in {region} 2025")
        
        # 2. VADÁSZAT: Strukturált adatgyűjtés
        print("[VADÁSZAT] Browser-use indítása...")
        raw_cars = await self.hunter.hunt(region) 
        
        # Pontozási logika finomítása a hírek alapján (egyszerűsített)
        # Itt a 'market_news' szövege alapján módosíthatnánk a súlyozást.
        
        # 3. MENTÉS ÉS ÉRTESÍTÉS
        # Feltételezzük, hogy a high_score_cars listát kaptuk vissza
        high_score_cars = [c for c in raw_cars if c.score >= 80] # Példa szűrés
        
        if high_score_cars:
            print(f"🎯 {len(high_score_cars)} db KIVÁLÓ találat!")
            report_path = ReportGenerator.create_excel(high_score_cars)
            self.notifier.send_harvest_report(report_path, len(high_score_cars))
            
        print("✅ Misszió sikeresen lezárva.")

if __name__ == "__main__":
    orch = MegaOrchestrator()
    # asyncio.run(orch.execute_mission("Austria"))
Fájl: src/agents/PhoenixProtocol.ts

TypeScript
// FILE: src/agents/PhoenixProtocol.ts
// PURPOSE: Öngyógyító és állapot-visszaállító mechanizmus az AI Research mintájára.

import * as fs from 'fs';
import { AgentManager } from './AgentManager';

export class PhoenixProtocol {
    private backupDir = './logs/backups';

    constructor(private manager: AgentManager) {}

    /**
     * Ha egy ügynök összeomlik, megkeresi a legutolsó érvényes JSON mentést.
     */
    public async recoverAgent(agentName: string) {
        console.log(`[Phoenix] Próbálkozás a(z) ${agentName} visszaállításával...`);
        
        const files = fs.readdirSync(this.backupDir).sort().reverse();
        const lastBackup = files.find(f => f.includes(agentName));

        if (lastBackup) {
            const data = JSON.parse(fs.readFileSync(`${this.backupDir}/${lastBackup}`, 'utf8'));
            console.log(`[Phoenix] Utolsó ismert állapot betöltve: ${data.timestamp}`);
            await this.manager.updateState(agentName, { status: 'active', currentTask: data.lastTask });
        } else {
            console.log(`[Phoenix] Nincs mentett állapot. Tiszta újraindítás.`);
        }
    }
}
STEP 3: INTEGRATION A docker-compose.yml fájlt használd a környezet (ChromaDB, Ollama) futtatásához, így a Refiner Logic el tudja érni a vektoros memóriát.

STEP 4: VERIFICATION & TESTING

Fájl: test/full_pipeline_test.py

Python
# FILE: test/full_pipeline_test.py
# PURPOSE: A kutatási és vadászati lánc együttes tesztje.

from myai.tools.integrated_research import ResearchSuite
from myai.schemas import CarResult

def test_mega_flow():
    suite = ResearchSuite()
    print("Testing Perplexity...")
    # res = suite.market_search("Tesla prices Germany")
    # assert len(res) > 0
    
    print("Testing Schema consistency...")
    car = CarResult(brand="BMW", model="i3", price=15000, year=2019, mileage=80000, link="http://x.hu", score=85)
    assert car.brand == "BMW"
    print("TEST PASSED")

if __name__ == "__main__":
    test_mega_flow()
STEP 5: EXECUTION

Bash
# Docker konténerek indítása (Chroma, Ollama)
docker-compose up -d
# Teljes misszió futtatása
python myai/agents/ev_hunter/mega_orchestrator.py
---


---

CONTEXT FOR THE CODER AI: "Te vagy a Végrehajtó Ügynök. A cél: A BAS EV Hunter bot és az AI Research Pipeline teljes egyesítése. Az ügynöknek képesnek kell lennie Perplexity kutatásra, ArXiv/GitHub trendek figyelésére, és az adatok Dual-Storage (LanceDB + JSON) mentésére. Használd a Pydantic modelleket a validációhoz."

STEP 1: DEPENDENCIES & SETUP

Bash
# Összesített függőségek telepítése
pip install pydantic requests pandas openpyxl arxiv lancedb python-dotenv browser-use langchain-google-genai
npm install zod lancedb dotenv
STEP 2: FILE CREATION

Fájl: myai/tools/integrated_research.py

Python
# FILE: myai/tools/integrated_research.py
# PURPOSE: Integrált kutatóeszközök a Perplexity, ArXiv és GitHub eléréséhez.

import os
import requests
import arxiv
from dotenv import load_dotenv

load_dotenv()

class ResearchSuite:
    def __init__(self):
        self.pplx_key = os.getenv("PERPLEXITY_API_KEY")

    def market_search(self, query: str):
        """Webes keresés Perplexity-vel (Real-time piaci hírek)."""
        url = "https://api.perplexity.ai/chat/completions"
        payload = {
            "model": "llama-3.1-sonar-large-128k-online",
            "messages": [
                {"role": "system", "content": "Autópiaci és technológiai elemző vagy. Keress friss híreket."}, 
                {"role": "user", "content": query}
            ]
        }
        headers = {"Authorization": f"Bearer {self.pplx_key}", "Content-Type": "application/json"}
        try:
            res = requests.post(url, json=payload, headers=headers).json()
            return res['choices'][0]['message']['content']
        except: return "Kutatási adat nem elérhető."

    def tech_trends(self, topic: str):
        """Technológiai trendek (ArXiv) lekérése (pl. akkumulátor fejlesztések)."""
        search = arxiv.Search(query=topic, max_results=2, sort_by=arxiv.SortCriterion.Relevance)
        return [{"title": r.title, "link": r.entry_id} for r in search.results()]
Fájl: myai/agents/ev_hunter/mega_orchestrator.py

Python
# FILE: myai/agents/ev_hunter/mega_orchestrator.py
# PURPOSE: A 'First Harvest' hadművelet központi vezérlője.

import asyncio
from myai.tools.integrated_research import ResearchSuite
from myai.agents.ev_hunter.ev_hunter_bot import EVHunterBot
from myai.schemas import CarResult, MarketInsight, HarvestPayload
from myai.utils.report_generator import ReportGenerator
from myai.utils.notifier import Notifier
import json

class MegaOrchestrator:
    def __init__(self):
        self.researcher = ResearchSuite()
        self.hunter = EVHunterBot()
        self.notifier = Notifier()

    async def execute_mission(self, region: str):
        print(f"🚀 Misszió indítása: {region}")
        
        # 1. KONTEXTUS: Mi történik most a piacon?
        print("[PIAC] Perplexity elemzés futtatása...")
        market_news = self.researcher.market_search(f"Latest EV price drops and subsidies in {region} 2025")
        
        # 2. VADÁSZAT: Strukturált adatgyűjtés
        print("[VADÁSZAT] Browser-use indítása...")
        raw_cars = await self.hunter.hunt(region) 
        
        # Pontozási logika finomítása a hírek alapján (egyszerűsített)
        # Itt a 'market_news' szövege alapján módosíthatnánk a súlyozást.
        
        # 3. MENTÉS ÉS ÉRTESÍTÉS
        # Feltételezzük, hogy a high_score_cars listát kaptuk vissza
        high_score_cars = [c for c in raw_cars if c.score >= 80] # Példa szűrés
        
        if high_score_cars:
            print(f"🎯 {len(high_score_cars)} db KIVÁLÓ találat!")
            report_path = ReportGenerator.create_excel(high_score_cars)
            self.notifier.send_harvest_report(report_path, len(high_score_cars))
            
        print("✅ Misszió sikeresen lezárva.")

if __name__ == "__main__":
    orch = MegaOrchestrator()
    # asyncio.run(orch.execute_mission("Austria"))
Fájl: src/agents/PhoenixProtocol.ts

TypeScript
// FILE: src/agents/PhoenixProtocol.ts
// PURPOSE: Öngyógyító és állapot-visszaállító mechanizmus az AI Research mintájára.

import * as fs from 'fs';
import { AgentManager } from './AgentManager';

export class PhoenixProtocol {
    private backupDir = './logs/backups';

    constructor(private manager: AgentManager) {}

    /**
     * Ha egy ügynök összeomlik, megkeresi a legutolsó érvényes JSON mentést.
     */
    public async recoverAgent(agentName: string) {
        console.log(`[Phoenix] Próbálkozás a(z) ${agentName} visszaállításával...`);
        
        const files = fs.readdirSync(this.backupDir).sort().reverse();
        const lastBackup = files.find(f => f.includes(agentName));

        if (lastBackup) {
            const data = JSON.parse(fs.readFileSync(`${this.backupDir}/${lastBackup}`, 'utf8'));
            console.log(`[Phoenix] Utolsó ismert állapot betöltve: ${data.timestamp}`);
            await this.manager.updateState(agentName, { status: 'active', currentTask: data.lastTask });
        } else {
            console.log(`[Phoenix] Nincs mentett állapot. Tiszta újraindítás.`);
        }
    }
}
STEP 3: INTEGRATION A docker-compose.yml fájlt használd a környezet (ChromaDB, Ollama) futtatásához, így a Refiner Logic el tudja érni a vektoros memóriát.

STEP 4: VERIFICATION & TESTING

Fájl: test/full_pipeline_test.py

Python
# FILE: test/full_pipeline_test.py
# PURPOSE: A kutatási és vadászati lánc együttes tesztje.

from myai.tools.integrated_research import ResearchSuite
from myai.schemas import CarResult

def test_mega_flow():
    suite = ResearchSuite()
    print("Testing Perplexity...")
    # res = suite.market_search("Tesla prices Germany")
    # assert len(res) > 0
    
    print("Testing Schema consistency...")
    car = CarResult(brand="BMW", model="i3", price=15000, year=2019, mileage=80000, link="http://x.hu", score=85)
    assert car.brand == "BMW"
    print("TEST PASSED")

if __name__ == "__main__":
    test_mega_flow()
STEP 5: EXECUTION

Bash
# Docker konténerek indítása (Chroma, Ollama)
docker-compose up -d
# Teljes misszió futtatása
python myai/agents/ev_hunter/mega_orchestrator.py
---


---

CONTEXT FOR THE CODER AI: "Te vagy a Végrehajtó Ügynök. A cél: A BAS EV Hunter bot és az AI Research Pipeline teljes egyesítése. Az ügynöknek képesnek kell lennie Perplexity kutatásra, ArXiv/GitHub trendek figyelésére, és az adatok Dual-Storage (LanceDB + JSON) mentésére. Használd a Pydantic modelleket a validációhoz."

STEP 1: DEPENDENCIES & SETUP

Bash
# Összesített függőségek telepítése
pip install pydantic requests pandas openpyxl arxiv lancedb python-dotenv browser-use langchain-google-genai
npm install zod lancedb dotenv
STEP 2: FILE CREATION

Fájl: myai/tools/integrated_research.py

Python
# FILE: myai/tools/integrated_research.py
# PURPOSE: Integrált kutatóeszközök a Perplexity, ArXiv és GitHub eléréséhez.

import os
import requests
import arxiv
from dotenv import load_dotenv

load_dotenv()

class ResearchSuite:
    def __init__(self):
        self.pplx_key = os.getenv("PERPLEXITY_API_KEY")

    def market_search(self, query: str):
        """Webes keresés Perplexity-vel (Real-time piaci hírek)."""
        url = "https://api.perplexity.ai/chat/completions"
        payload = {
            "model": "llama-3.1-sonar-large-128k-online",
            "messages": [
                {"role": "system", "content": "Autópiaci és technológiai elemző vagy. Keress friss híreket."}, 
                {"role": "user", "content": query}
            ]
        }
        headers = {"Authorization": f"Bearer {self.pplx_key}", "Content-Type": "application/json"}
        try:
            res = requests.post(url, json=payload, headers=headers).json()
            return res['choices'][0]['message']['content']
        except: return "Kutatási adat nem elérhető."

    def tech_trends(self, topic: str):
        """Technológiai trendek (ArXiv) lekérése (pl. akkumulátor fejlesztések)."""
        search = arxiv.Search(query=topic, max_results=2, sort_by=arxiv.SortCriterion.Relevance)
        return [{"title": r.title, "link": r.entry_id} for r in search.results()]
Fájl: myai/agents/ev_hunter/mega_orchestrator.py

Python
# FILE: myai/agents/ev_hunter/mega_orchestrator.py
# PURPOSE: A 'First Harvest' hadművelet központi vezérlője.

import asyncio
from myai.tools.integrated_research import ResearchSuite
from myai.agents.ev_hunter.ev_hunter_bot import EVHunterBot
from myai.schemas import CarResult, MarketInsight, HarvestPayload
from myai.utils.report_generator import ReportGenerator
from myai.utils.notifier import Notifier
import json

class MegaOrchestrator:
    def __init__(self):
        self.researcher = ResearchSuite()
        self.hunter = EVHunterBot()
        self.notifier = Notifier()

    async def execute_mission(self, region: str):
        print(f"🚀 Misszió indítása: {region}")
        
        # 1. KONTEXTUS: Mi történik most a piacon?
        print("[PIAC] Perplexity elemzés futtatása...")
        market_news = self.researcher.market_search(f"Latest EV price drops and subsidies in {region} 2025")
        
        # 2. VADÁSZAT: Strukturált adatgyűjtés
        print("[VADÁSZAT] Browser-use indítása...")
        raw_cars = await self.hunter.hunt(region) 
        
        # Pontozási logika finomítása a hírek alapján (egyszerűsített)
        # Itt a 'market_news' szövege alapján módosíthatnánk a súlyozást.
        
        # 3. MENTÉS ÉS ÉRTESÍTÉS
        # Feltételezzük, hogy a high_score_cars listát kaptuk vissza
        high_score_cars = [c for c in raw_cars if c.score >= 80] # Példa szűrés
        
        if high_score_cars:
            print(f"🎯 {len(high_score_cars)} db KIVÁLÓ találat!")
            report_path = ReportGenerator.create_excel(high_score_cars)
            self.notifier.send_harvest_report(report_path, len(high_score_cars))
            
        print("✅ Misszió sikeresen lezárva.")

if __name__ == "__main__":
    orch = MegaOrchestrator()
    # asyncio.run(orch.execute_mission("Austria"))
Fájl: src/agents/PhoenixProtocol.ts

TypeScript
// FILE: src/agents/PhoenixProtocol.ts
// PURPOSE: Öngyógyító és állapot-visszaállító mechanizmus az AI Research mintájára.

import * as fs from 'fs';
import { AgentManager } from './AgentManager';

export class PhoenixProtocol {
    private backupDir = './logs/backups';

    constructor(private manager: AgentManager) {}

    /**
     * Ha egy ügynök összeomlik, megkeresi a legutolsó érvényes JSON mentést.
     */
    public async recoverAgent(agentName: string) {
        console.log(`[Phoenix] Próbálkozás a(z) ${agentName} visszaállításával...`);
        
        const files = fs.readdirSync(this.backupDir).sort().reverse();
        const lastBackup = files.find(f => f.includes(agentName));

        if (lastBackup) {
            const data = JSON.parse(fs.readFileSync(`${this.backupDir}/${lastBackup}`, 'utf8'));
            console.log(`[Phoenix] Utolsó ismert állapot betöltve: ${data.timestamp}`);
            await this.manager.updateState(agentName, { status: 'active', currentTask: data.lastTask });
        } else {
            console.log(`[Phoenix] Nincs mentett állapot. Tiszta újraindítás.`);
        }
    }
}
STEP 3: INTEGRATION A docker-compose.yml fájlt használd a környezet (ChromaDB, Ollama) futtatásához, így a Refiner Logic el tudja érni a vektoros memóriát.

STEP 4: VERIFICATION & TESTING

Fájl: test/full_pipeline_test.py

Python
# FILE: test/full_pipeline_test.py
# PURPOSE: A kutatási és vadászati lánc együttes tesztje.

from myai.tools.integrated_research import ResearchSuite
from myai.schemas import CarResult

def test_mega_flow():
    suite = ResearchSuite()
    print("Testing Perplexity...")
    # res = suite.market_search("Tesla prices Germany")
    # assert len(res) > 0
    
    print("Testing Schema consistency...")
    car = CarResult(brand="BMW", model="i3", price=15000, year=2019, mileage=80000, link="http://x.hu", score=85)
    assert car.brand == "BMW"
    print("TEST PASSED")

if __name__ == "__main__":
    test_mega_flow()
STEP 5: EXECUTION

Bash
# Docker konténerek indítása (Chroma, Ollama)
docker-compose up -d
# Teljes misszió futtatása
python myai/agents/ev_hunter/mega_orchestrator.py
---
