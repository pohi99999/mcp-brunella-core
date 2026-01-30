
import os
from crewai import Agent, Task, Crew, Process
from langchain.tools import tool

# --- A "Multiplier" Jelentés Alapelveinek Gyakorlati Implementációja ---
#
# Ez a szkript a "igen.md" dokumentumban leírt koncepciókat valósítja meg
# a crewai keretrendszer segítségével.
#
# 1. Supervisor Pattern: Egy "manager_agent" (Brunella) irányítja a munkafolyamatot.
#    A Crew `process` paramétere `Process.hierarchical`, ami biztosítja,
#    hogy a menedzser delegálja a feladatokat a "worker" ügynököknek.
#
# 2. Strukturált Kommunikáció: Bár a crewai a belső kommunikációt
#    elvonttá teszi, a Task-ok leírásai és a tool-ok paraméterei
#    hasonló célt szolgálnak, mint a jelentésben javasolt JSON sémák.
#    A `task` leírása a "directive", a `tool` által visszaadott érték az "output".

# --- 1. Egyedi Eszköz a Worker Ügynök Számára ---
@tool("Egyszerű Kereső Eszköz")
def simple_search_tool(query: str) -> str:
    """Használd ezt az eszközt, hogy szimulált keresést végezz egy adott témában.
    A bemenete egy keresési lekérdezés (query).
    A kimenete egy előre definiált, szimulált kutatási eredmény."""
    print(f"--- Eszköz futtatása: Szimulált keresés a '{query}' témában ---")
    # Valós implementáció helyett egy egyszerű, előre definiált választ adunk vissza.
    return f"A '{query}' témában végzett kutatás eredménye: a megbízhatóság kulcsfontosságú a rendszerekben."

# --- 2. Az Ügynökök Definiálása a Hierarchiának Megfelelően ---

# A Supervisor / Menedzser Ügynök (Brunella)
# Nincs közvetlen اربعهze, a célja a feladatok lebontása és delegálása.
sup<ctrl61>ervisor_agent = Agent(
    role='Projektmenedzser Supervisor',
    goal='Felügyelni egy kutatási projektet az elejétől a végéig. Feladatokat lebontani és delegálni a megfelelő szakértő ügynöknek.',
    backstory="""Te Brunella vagy, egy magas szintű MI projektmenedzser. Képességed a komplex célok egyszerű, végrehajtható lépésekre bontása
    és a megfelelő csapattaghoz rendelése. Te biztosítod a projekt sikerét a stratégiai irányítással.""",
    allow_delegation=True, # Képes delegálni a feladatokat
    verbose=True
)

# A Worker / Végrehajtó Ügynök
researcher_agent = Agent(
    role='Szakértő Kutató',
    goal='Részletes és pontos kutatást végezni a kapott utasítások alapján.',
    backstory="""Te egy precíz és alapos kutató ügynök vagy. Képes vagy bármilyen témában
    mélyreható kutatást végezni a rendelkezésedre álló eszközökkel és tiszta, érthető
    jelentést készíteni az eredményekről.""",
    tools=[simple_search_tool], # Hozzárendeljük a szimulált kereső eszközt
    allow_delegation=False,
    verbose=True
)

# --- 3. A Feladatok Létrehozása ---

# A fő feladat, amit a Supervisor kap.
# A leírás egy magas szintű célt fogalmaz meg.
main_task = Task(
    description="""Végezz átfogó kutatást az 'MI ügynökök megbízhatósága' témakörében.
    A végső cél egy rövid, egy mondatos összefoglaló készítése a kutatás legfontosabb tanulságáról.""",
    expected_output="Egyetlen mondat, amely összefoglalja a kutatás legfőbb következtetését.",
    agent=supervisor_agent # Ezt a feladatot a Supervisor kapja, hogy delegálja
)

# --- 4. A Crew Létrehozása Hierarchikus Módban ---
# A `process=Process.hierarchical` beállítás aktiválja a Supervisor mintát.
# A `manager_llm` határozza meg, hogy a Supervisor melyik modellt használja a döntésekhez.
# Ha nincs beállítva API kulcs, a rendszer alapértelmezett (pl. ingyenes) modellt használhat.
crew = Crew(
    agents=[supervisor_agent, researcher_agent],
    tasks=[main_task],
    process=Process.hierarchical,
    manager_llm=None, # Alapértelmezett modell használata a menedzsernek
    verbose=2
)

# --- 5. A Munkafolyamat Indítása ---
print("\n--- A Hierarchikus Crew Munkájának Indítása ---")
result = crew.kickoff()

print("\n\n--- A Crew Munkájának Végeredménye ---")
print(result)
