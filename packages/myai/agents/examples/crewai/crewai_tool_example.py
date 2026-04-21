
import os
import requests
from bs4 import BeautifulSoup
from crewai import Agent, Task, Crew, Process
from crewai_tools import Tool
from langchain_community.llms import GoogleGenerativeAI
from dotenv import load_dotenv

# Környezeti változók betöltése
load_dotenv()

# Gemini API kulcs beállítása
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
os.environ["GEMINI_API_KEY"] = GEMINI_API_KEY
print(f"DEBUG: GEMINI_API_KEY betöltve: {GEMINI_API_KEY[:5]}...") # Az első 5 karakter a biztonság kedvéért

# --- Eszköz Definíció ---
@Tool
def website_summary_tool(url: str) -> str:
    """Használd ezt az eszközt egy weboldal tartalmának összefoglalására.
    A bemenete egy érvényes URL, és visszatér a weboldal első 500 karakterével."""
    try:
        response = requests.get(url)
        response.raise_for_status()  # Hibák ellenőrzése
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Kinyerjük a tiszta szöveget
        for script in soup(["script", "style"]):
            script.extract()
        text = soup.get_text()
        
        # Eltávolítjuk a felesleges whitespace-eket
        lines = (line.strip() for line in text.splitlines())
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        text = '\n'.join(chunk for chunk in chunks if chunk)
        
        return text[:500] if len(text) > 500 else text
    except requests.exceptions.RequestException as e:
        return f"Hiba a weboldal letöltésekor: {e}"
    except Exception as e:
        return f"Ismeretlen hiba történt: {e}"

# --- Ügynök Létrehozása ---
# Az OpenAI modell helyett a GoogleGenerativeAI-t fogjuk használni
llm = GoogleGenerativeAI(model="gemini-pro") # Vagy a "gemini-1.5-flash", ha az elérhető és preferált

researcher_agent = Agent(
    role='Kutató',
    goal='Weboldalak tartalmának elemzése és összefoglalása a felhasználói kérés alapján.',
    backstory='Szisztematikusan gyűjt információkat a weboldalakról, és tömör összefoglalókat készít.',
    verbose=True,
    allow_delegation=False,
    tools=[website_summary_tool],
    llm=llm
)

# --- Feladat Definiálása ---
research_task = Task(
    description="Összefoglalja a 'https://www.origo.hu' weboldal tartalmát, kiemelve a fő cikkeket és a legfontosabb híreket.",
    expected_output="Egy tömör, magyar nyelvű összefoglaló a weboldal fő cikkiről és legfontosabb híreiről, maximum 200 szóban.",
    agent=researcher_agent
)

# --- Crew Létrehozása és Futtatása ---
project_crew = Crew(
    agents=[researcher_agent],
    tasks=[research_task],
    verbose=2, # Részletes logolás
    process=Process.sequential # A feladatok szekvenciális végrehajtása
)

# A munkafolyamat elindítása
result = project_crew.kickoff()

print("\n\n-----------------------------------------------------------")
print("A CrewAI munkafolyamat befejeződött. Eredmény:")
print("-----------------------------------------------------------")
print(result)
