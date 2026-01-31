
import os
from crewai import Agent, Task, Crew
from langchain.tools import tool
import requests
from bs4 import BeautifulSoup

# --- 1. Az Egyedi Eszköz (Custom Tool) Létrehozása ---
# A `@tool` dekorátor jelzi a CrewAI számára, hogy ez a Python függvény
# egy használható eszközként (tool) viselkedik.
# A függvény alatti docstring ("""...") kulcsfontosságú, mert ebből érti meg
# az MI ügynök, hogy mire való az eszköz, és hogyan kell használni.

@tool("Weboldal Összefoglaló Eszköz")
def website_summary_tool(url: str) -> str:
    """Használd ezt az eszközt egy weboldal tartalmának letöltésére és összefoglalására.
    A bemenete egyetlen URL-cím. Az eszköz visszaadja a weboldal szöveges tartalmának
    első 500 karakterét a HTML tagek eltávolítása után."""
    try:
        print(f"--- Eszköz futtatása: Weboldal letöltése a {url} címről ---")
        response = requests.get(url)
        response.raise_for_status()  # Hiba dobása, ha a kérés sikertelen (pl. 404)

        # A BeautifulSoup segítségével kinyerjük a tiszta szöveget a HTML-ből
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Szöveg kinyerése és felesleges szóközök, sortörések eltávolítása
        text = soup.get_text(separator=' ', strip=True)
        
        # Visszaadjuk az első 500 karaktert
        return text[:500]
    except requests.exceptions.RequestException as e:
        return f"Hiba a weboldal letöltése közben: {e}"
    except Exception as e:
        return f"Váratlan hiba történt az eszköz futtatása során: {e}"

# --- 2. Az Ügynök (Agent) Létrehozása ---
# Az ügynökök a CrewAI "dolgozói". Meghatározzuk a szerepüket (role),
# a céljukat (goal), a háttértörténetüket (backstory), és ami a legfontosabb,
# hozzárendeljük a használható eszközöket (tools).

# A Gemini modell használatához be kell állítani az API kulcsot.
# Cseréld le a 'YOUR_API_KEY' részt a saját Google AI Studio kulcsodra.
# os.environ["GEMINI_API_KEY"] = "YOUR_API_KEY"

print("--- Ügynök és Feladat előkészítése ---")

kutato_ugynok = Agent(
    role='Szakértő Web Kutató',
    goal='Információk hatékony kinyerése és összefoglalása weboldalakról.',
    backstory="""Te egy tapasztalt kutató vagy, aki mesterien bánik az online eszközökkel,
    hogy bármilyen weboldalról gyorsan és pontosan kinyerje a legfontosabb információkat.""",
    verbose=True,  # Részletes kimenetet ad a működéséről
    allow_delegation=False, # Ebben a példában nem engedjük, hogy más ügynöknek adjon feladatot
    tools=[website_summary_tool] # Itt rendeljük hozzá a korábban létrehozott eszközünket
)

# --- 3. A Feladat (Task) Definiálása ---
# A feladat egy konkrét megbízás az ügynök számára. A leírásban (description)
# pontosan megmondjuk, mit várunk el tőle. Az ügynök a leírás és az eszközei
# alapján fogja kitalálni, hogy mit kell tennie.

web_kutatasi_feladat = Task(
    description="""Olvasd be a 'https://www.origo.hu' weboldal tartalmát a rendelkezésedre álló
    eszközzel, majd add vissza az oldal szöveges tartalmának rövid összefoglalóját
    az eszköz által biztosított karakterlimitig.""",
    expected_output="Egy rövid, 1-2 mondatos összefoglaló a weboldal tartalmáról.",
    agent=kutato_ugynok # Meghatározzuk, hogy melyik ügynök végezze el a feladatot
)

# --- 4. A Crew Létrehozása és Futtatása ---
# A Crew összefogja az ügynököket és a feladatokat. A `kickoff()` metódus
# elindítja a munkafolyamatot.

print("--- Crew indítása ---")
crew = Crew(
    agents=[kutato_ugynok],
    tasks=[web_kutatasi_feladat],
    verbose=2 # A legmagasabb szintű logolás, minden lépést látni fogunk
)

result = crew.kickoff()

print("\n--- A Crew Munkájának Végeredménye ---")
print(result)
