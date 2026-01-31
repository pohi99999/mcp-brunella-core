import os
from crewai import Agent, Task, Crew, Process
from langchain_google_vertexai import ChatVertexAI
# ÚJ: Importáljuk a kereső eszközt
from crewai_tools import SerperDevTool

# --- 1. Eszközök (Tools) Létrehozása ---
# Létrehozzuk a kereső eszközt. A működéséhez a SERPER_API_KEY
# környezeti változó beállítása szükséges.
search_tool = SerperDevTool()

# --- 2. LLM (Nagy Nyelvi Modell) Beállítása ---
llm = ChatVertexAI(model_name="gemini-2.5-flash",
                   temperature=0.7)

# --- 3. Ügynökök (Agents) Definiálása ---

# A Kutató ügynököt most felruházzuk a kereső eszközzel
researcher = Agent(
  role='Szenior Piackutató Elemző',
  goal='A legújabb trendek és áttörések feltárása az AI területén a szoftverfejlesztésben.',
  backstory="""Ön egy tapasztalt piackutató, aki a technológiai innovációkra specializálódott.
  Képessége van arra, hogy hatalmas mennyiségű adatból kiszűrje a legfontosabb,
  piacformáló trendeket és azokat érthető riportokká szintetizálja.""",
  verbose=True,
  allow_delegation=False,
  # ÚJ: Hozzáadjuk az eszközt az ügynök eszköztárához
  tools=[search_tool],
  llm=llm
)

# Az Író ügynök változatlan marad
writer = Agent(
  role='Elismert Tech Tartalomíró',
  goal='Lebilincselő és informatív blogposztok írása a technológiai trendekről.',
  backstory="""Ön egy híres tech újságíró, aki arról ismert, hogy képes a komplex
  technikai témákat a szélesebb közönség számára is érdekessé és érthetővé tenni.
  Stílusa olvasmányos, mégis szakmailag megalapozott.""",
  verbose=True,
  allow_delegation=True,
  llm=llm
)

# --- 4. Feladatok (Tasks) Definiálása ---

# A feladatok leírása változatlan, de a kutató most már használhatja a keresőt
research_task = Task(
  description="""Használd a kereső eszközt, hogy megtaláld az AI legfrissebb, 2024-es és 2025-ös, meghatározó trendjeit a szoftverfejlesztés területén.
  Fókuszálj a 3-4 legfontosabb új eszközre, keretrendszerre vagy módszertanra.
  Gyűjts információt arról, hogy ezek hogyan változtatják meg a fejlesztők munkáját.""",
  expected_output="""Egy strukturált, pontokba szedett riport, amely bemutatja a 3-4 legfontosabb trendet,
  konkrét példákkal, nevekkel (pl. új eszközök, cégek), és hivatkozásokkal a forrásokra.
  Tartalmazzon egy rövid elemzést arról, hogy milyen hatással vannak a szoftverfejlesztési piacra.""",
  agent=researcher
)

write_task = Task(
  description="""A piackutató által szolgáltatott, hivatkozásokkal ellátott riport alapján írj egy legalább 500 szavas,
  lebilincselő blogposztot. A cikk címe legyen figyelemfelkeltő.
  Strukturáld a cikket bevezetővel, a trendek részletes bemutatásával és egy jövőbe mutató összegzéssel.""",
  expected_output="""Egy teljes, publikálásra kész, Markdown formátumú blogposzt magyar nyelven,
  amely tartalmaz egy címet, egy bevezetőt, a kutatási eredményeket bemutató szekciókat és egy konklúziót.""",
  agent=writer,
  context=[research_task]
)

# --- 5. A Csapat (Crew) Összeállítása és Elindítása ---

crew = Crew(
  agents=[researcher, writer],
  tasks=[research_task, write_task],
  process=Process.sequential,
  verbose=2
)

result = crew.kickoff()

# --- 6. Az Eredmény Megjelenítése ---
print("\n\n########################")
print("## A munka eredménye:")
print("########################\n")
print(result)