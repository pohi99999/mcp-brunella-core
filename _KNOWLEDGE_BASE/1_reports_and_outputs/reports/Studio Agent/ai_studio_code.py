import os
from crewai import Agent, Task, Crew, Process
# A Gemini modell használatához a langchain_google_vertexai csomagot használjuk
from langchain_google_vertexai import ChatVertexAI

# --- 1. LLM (Nagy Nyelvi Modell) Beállítása ---
# A modell inicializálása. A 'gemini-2.5-flash' modellt használjuk,
# de ezt kicserélheted más kompatibilis Gemini modellre is.
# Győződj meg róla, hogy a GOOGLE_API_KEY környezeti változó be van állítva.
llm = ChatVertexAI(model_name="gemini-2.5-flash", 
                   temperature=0.7) 

# --- 2. Ügynökök (Agents) Definiálása ---

# Kutató ügynök
researcher = Agent(
  role='Szenior Piackutató Elemző',
  goal='A legújabb trendek és áttörések feltárása az AI területén a szoftverfejlesztésben.',
  backstory="""Ön egy tapasztalt piackutató, aki a technológiai innovációkra specializálódott. 
  Képessége van arra, hogy hatalmas mennyiségű adatból kiszűrje a legfontosabb, 
  piacformáló trendeket és azokat érthető riportokká szintetizálja.""",
  verbose=True,
  allow_delegation=False,
  llm=llm
)

# Író ügynök
writer = Agent(
  role='Elismert Tech Tartalomíró',
  goal='Lebilincselő és informatív blogposztok írása a technológiai trendekről.',
  backstory="""Ön egy híres tech újságíró, aki arról ismert, hogy képes a komplex 
  technikai témákat a szélesebb közönség számára is érdekessé és érthetővé tenni. 
  Stílusa olvasmányos, mégis szakmailag megalapozott.""",
  verbose=True,
  # Az író delegálhat feladatokat, pl. lektorálást (bár ebben a példában nem tesszük).
  allow_delegation=True, 
  llm=llm
)

# --- 3. Feladatok (Tasks) Definiálása ---

# Kutatási feladat
research_task = Task(
  description="""Kutass az AI legfrissebb, meghatározó trendjei után a szoftverfejlesztés területén. 
  Fókuszálj a 3-4 legfontosabb új eszközre, keretrendszerre vagy módszertanra. 
  Vizsgáld meg, hogyan változtatják meg ezek a fejlesztők napi munkáját és a szoftverek minőségét.
  Az eredmény egy lényegretörő, pontokba szedett összefoglaló legyen.""",
  expected_output="""Egy strukturált, pontokba szedett riport, amely bemutatja a 3-4 legfontosabb trendet, 
  konkrét példákkal és nevekkel (pl. új eszközök, cégek), valamint rövid elemzéssel arról, 
  hogy milyen hatással vannak a szoftverfejlesztési piacra.""",
  agent=researcher
)

# Írási feladat
write_task = Task(
  description="""A piackutató által szolgáltatott riport alapján írj egy legalább 500 szavas, 
  lebilincselő blogposztot. A cikk címe legyen figyelemfelkeltő. 
  Strukturáld a cikket bevezetővel, a trendek részletes bemutatásával és egy jövőbe mutató összegzéssel.""",
  expected_output="""Egy teljes, publikálásra kész, Markdown formátumú blogposzt magyar nyelven, 
  amely tartalmaz egy címet, egy bevezetőt, a kutatási eredményeket bemutató szekciókat és egy konklúziót.""",
  agent=writer,
  # Fontos: a 'context' segítségével adjuk át a kutatási feladat eredményét az írónak.
  context=[research_task] 
)

# --- 4. A Csapat (Crew) Összeállítása és Elindítása ---

crew = Crew(
  agents=[researcher, writer],
  tasks=[research_task, write_task],
  process=Process.sequential,  # A feladatokat szigorúan sorban hajtja végre
  verbose=2 
)

# A munka elindítása
result = crew.kickoff()

# --- 5. Az Eredmény Megjelenítése ---
print("\n\n########################")
print("## A munka eredménye:")
print("########################\n")
print(result)