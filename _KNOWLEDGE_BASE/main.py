import os
from crewai import Agent, Task, Crew, Process
from langchain_google_vertexai import ChatVertexAI

# --- KÖRNYEZETI VÁLTOZÓ BEÁLLÍTÁSA ---
os.environ["GOOGLE_API_KEY"] = "AIzaSyDZaoyLDM79Q7s4sPc87XZwspBm6-oFSZM"

# --- 1. LLM (Nagy Nyelvi Modell) Beállítása ---
llm = ChatVertexAI(model_name="vertex_ai/gemini-1.5-pro-latest")

# --- 2. Ügynökök (Agents) Definiálása ---

# Kutató ügynök
researcher = Agent(
  role='Szenior Piackutató',
  goal='Információk és adatok gyűjtése az AI legújabb trendjeiről a szoftverfejlesztésben.',
  backstory="""Te egy tapasztalt piackutató vagy, aki a technológiai szektor legújabb
  fejleményeire specializálódott. Képességed van arra, hogy releváns és naprakész
  információkat találj a legösszetettebb témákban is.""",
  verbose=True,
  allow_delegation=False,
  llm=llm
)

# Író ügynök
writer = Agent(
  role='Kreatív Tartalomíró',
  goal='Egy rövid, informatív és olvasmányos blogposzt írása a kapott kutatási anyag alapján.',
  backstory="""Te egy tehetséges tech-újságíró vagy, aki képes a száraz, technikai
  információkat érdekfeszítő és könnyen érthető cikkekké alakítani. A célközönséged
  a technológia iránt érdeklődő, de nem feltétlenül mélyen technikai tudású olvasók.""",
  verbose=True,
  allow_delegation=True,
  llm=llm
)

# Lektor (Editor) ügynök
editor = Agent(
  role='Szakmai Lektor',
  goal='A tartalomíró által készített blogposzt szakmai és nyelvtani ellenőrzése, javítása.',
  backstory="""Te egy precíz és tapasztalt szerkesztő vagy, aki a tech cikkekre specializálódott.
  Kiszúrod a legapróbb hibákat is, és javaslatokat teszel a szöveg érthetőségének javítására.""",
  verbose=True,
  allow_delegation=False,
  llm=llm
)

# --- 3. Feladatok (Tasks) Definiálása ---

# Kutatási feladat
research_task = Task(
  description="""Kutass az AI legfrissebb, 2024-es és 2025-ös trendjei után a szoftverfejlesztés területén.
  Fókuszálj a 3-4 legfontosabb új eszközre, keretrendszerre vagy módszertanra.
  Gyűjts információt arról, hogy ezek hogyan változtatják meg a fejlesztők munkáját.""",
  expected_output="""Egy 3-5 bekezdésből álló, lényegre törő összefoglaló a legfontosabb trendekről,
  konkrét példákkal és nevekkel (pl. új eszközök, cégek).""",
  agent=researcher
)

# Írási feladat
write_task = Task(
  description="""A piackutató által szolgáltatott információk alapján írj egy legalább 400 szavas,
  olvasmányos blogposztot magyar nyelven. A cikk címe legyen figyelemfelkeltő.
  Strukturáld a cikket bevezetővel, a trendek részletes bemutatásával és egy rövid összegzéssel.""",
  expected_output="""Egy teljes, formázott blogposzt magyar nyelven, címmel, bevezetővel,
  tárgyalással és konklúzióval.""",
  agent=writer,
  context=[research_task]
)

# Lektorálási feladat
edit_task = Task(
  description="""Ellenőrizd a tartalomíró által írt blogposztot. Keress benne szakmai pontatlanságokat,
  gépelési hibákat és nyelvtani problémákat. Javítsd a szöveget, hogy az professzionális és hibátlan legyen.""",
  expected_output="""A blogposzt végleges, lektorált, publikálásra kész verziója magyar nyelven.""",
  agent=editor,
  context=[write_task]
)

# --- 4. A Csapat (Crew) Összeállítása és Elindítása ---

crew = Crew(
  agents=[researcher, writer, editor],
  tasks=[research_task, write_task, edit_task],
  process=Process.sequential,
  verbose=True
)

# A munka elindítása
result = crew.kickoff()

print("\n\n########################")
print("## A munka eredménye:")
print("########################\n")
print(result)
