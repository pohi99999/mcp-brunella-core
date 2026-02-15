\# TRACK: Hybrid Live Commander (Avatar Mode)

\*\*ID:\*\* TR-2026-02-14

\*\*Status:\*\* ACTIVE

\*\*Priority:\*\* HIGH

\*\*Owner:\*\* Brunella (User: Péter)



\## 🎯 Célkitűzés

Létrehozni a "Brunella Live Commander" felületet, amely egy "Avatar Üzemmódot" biztosít a felhasználónak. Ez egy Streamlit alapú webes chat felület, amelyen keresztül a felhasználó élőben utasíthatja a Robotkezet (browser-use).



\*\*Kiemelt Funkció:\*\* Hibrid Intelligencia Motor.

1\.  \*\*Elsődleges:\*\* Helyi Ollama futtatás (ingyenes, privát).

2\.  \*\*Fallback:\*\* Automatikus átváltás Gemini 2.0 Flash-re hiba vagy lassulás esetén.



\## 🛠️ Tech Stack

\- \*\*Frontend:\*\* Streamlit (Python)

\- \*\*Agent Core:\*\* Browser-Use (LangChain alapú)

\- \*\*LLM 1 (Local):\*\* Ollama (`qwen2.5-coder:7b`)

\- \*\*LLM 2 (Cloud):\*\* Google Gemini 2.0 Flash (`langchain-google-genai`)

\- \*\*Logic:\*\* `langchain.schema.runnable.fallbacks`



\## 📋 Implementációs Terv (Step-by-Step)



\### 1. Fázis: Környezet és Függőségek

\- \[ ] Ellenőrizni, hogy a `myai` mappa létezik.

\- \[ ] Telepíteni a szükséges Python csomagokat a virtuális környezetbe:

&nbsp;   ```bash

&nbsp;   pip install streamlit browser-use langchain-ollama langchain-google-genai python-dotenv playwright

&nbsp;   playwright install

&nbsp;   ```

\- \[ ] `.env` fájl ellenőrzése: `GEMINI\_API\_KEY` meglétének validálása.



\### 2. Fázis: "Hybrid Brain" Logika Implementálása

\- \[ ] Létrehozni a `myai/live\_commander.py` fájlt.

\- \[ ] Implementálni a `get\_hybrid\_llm` függvényt:

&nbsp;   - Inicializálja a `ChatOllama`-t (Primary).

&nbsp;   - Inicializálja a `ChatGoogleGenerativeAI`-t (Backup).

&nbsp;   - Beállítja a `.with\_fallbacks(\[backup\_llm])` láncot.



\### 3. Fázis: Streamlit UI (Parancsnoki Híd)

\- \[ ] Felépíteni a Chat Interface-t (`st.chat\_message`).

\- \[ ] Sidebar hozzáadása a konfigurációhoz (Modell váltó, Chrome path).

\- \[ ] Aszinkron futtató hurok (`asyncio.run`) integrálása a Streamlitbe.

\- \[ ] Browser-Use Agent inicializálása `use\_vision=True` beállítással.



\### 4. Fázis: Chrome Debug Script

\- \[ ] Létrehozni egy indító scriptet (`start\_chrome\_debug.ps1`), ami elindítja a Chrome-ot a megfelelő porton, hogy a robotkéz átvehesse az irányítást.

&nbsp;   - Parancs: `chrome.exe --remote-debugging-port=9222`



\## 💻 Referencia Kód (A "live\_commander.py" tartalma)



```python

import streamlit as st

import asyncio

import os

from browser\_use import Agent

from langchain\_ollama import ChatOllama

from langchain\_google\_genai import ChatGoogleGenerativeAI

from dotenv import load\_dotenv



load\_dotenv(dotenv\_path="../.env")



st.set\_page\_config(page\_title="Brunella Live Commander", page\_icon="🤖", layout="wide")

st.title("🤖 Brunella Live Commander (Hybrid Mode)")



with st.sidebar:

&nbsp;   st.header("⚙️ Motorháztető")

&nbsp;   ollama\_model = st.text\_input("🏠 Helyi Modell", "qwen2.5-coder:7b")

&nbsp;   use\_own\_browser = st.checkbox("Saját Chrome Használata", value=True)

&nbsp;   if st.button("🧹 Memória Törlése"):

&nbsp;       st.session\_state.messages = \[]

&nbsp;       st.rerun()



def get\_hybrid\_llm(local\_model\_name):

&nbsp;   primary = ChatOllama(model=local\_model\_name, temperature=0.0, num\_ctx=4096)

&nbsp;   backup = ChatGoogleGenerativeAI(model="gemini-2.0-flash", google\_api\_key=os.getenv("GEMINI\_API\_KEY"))

&nbsp;   return primary.with\_fallbacks(\[backup])



if "messages" not in st.session\_state:

&nbsp;   st.session\_state.messages = \[]



for msg in st.session\_state.messages:

&nbsp;   st.chat\_message(msg\["role"]).markdown(msg\["content"])



async def run\_task(task, model):

&nbsp;   llm = get\_hybrid\_llm(model)

&nbsp;   agent = Agent(task=task, llm=llm, use\_vision=True)

&nbsp;   history = await agent.run()

&nbsp;   return history.final\_result()



if prompt := st.chat\_input("Parancs a Robotkéznek..."):

&nbsp;   st.session\_state.messages.append({"role": "user", "content": prompt})

&nbsp;   st.chat\_message("user").markdown(prompt)

&nbsp;   with st.chat\_message("assistant"):

&nbsp;       container = st.empty()

&nbsp;       container.markdown("⚙️ \*Indítom a hibrid motort...\*")

&nbsp;       try:

&nbsp;           res = asyncio.run(run\_task(prompt, ollama\_model))

&nbsp;           container.markdown(f"✅ \*\*Kész!\*\*\\n\\n{res}")

&nbsp;           st.session\_state.messages.append({"role": "assistant", "content": res})

&nbsp;       except Exception as e:

&nbsp;           container.error(f"Hiba: {e}")



Elfogadási Kritériumok (Definition of Done)

A streamlit run myai/live\_commander.py parancs hiba nélkül elindul.



A böngészőben megjelenik a chat felület.



Ha beírunk egy parancsot, a rendszer először az Ollama-t használja (ellenőrizhető a feladatkezelőben a GPU/CPU használaton).



Ha az Ollama le van állítva, a rendszer automatikusan Gemini-vel hajtja végre a feladatot összeomlás nélkül.



Szia! A Brunella projekt "Live Commander" modulját kell elkészítened. 

A cél egy Streamlit alapú chat felület, ahol természetes magyar nyelven tudok utasítást adni a Browser-Use robotkéznek.



Hivatkozási alap: F:\\mcp-brunella-core\\conductor\\tracks\\TR\_20260214\_Hybrid\_Live\_Commander.md



A feladatod lépései:



1\. TELEPÍTÉS:

Telepítsd a szükséges csomagokat a terminálban:

pip install streamlit browser-use langchain-ollama langchain-google-genai python-dotenv playwright

playwright install



2\. KÓD LÉTREHOZÁSA:

Hozd létre a 'myai/live\_commander.py' fájlt.

A kódnak tudnia kell a következőket:

\- Hibrid LLM használata: Elsődlegesen Ollama (helyi), hiba esetén fallback a Gemini Flash-re.

\- Chat history kezelése: A Streamlit felületen lássam, mit beszéltünk eddig.

\- Vision Capability: Az ágens lássa a képernyőt (use\_vision=True), hogy értse, mi van ott.

\- System Prompt: Állítsd be, hogy az ágens tudja, ő egy segítőkész asszisztens, aki magyarul kommunikál.



Itt a specifikációban lévő Python kód alapja, ezt használd és bővítsd ki a magyar rendszerüzenettel:



import streamlit as st

import asyncio

import os

from browser\_use import Agent, Controller

from langchain\_ollama import ChatOllama

from langchain\_google\_genai import ChatGoogleGenerativeAI

from langchain\_core.prompts import SystemMessagePromptTemplate

from dotenv import load\_dotenv



load\_dotenv(dotenv\_path="../.env")



st.set\_page\_config(page\_title="Brunella Live Commander", page\_icon="🤖", layout="wide")

st.title("🤖 Brunella Live Commander")

st.markdown("Írj nyugodtan, természetes nyelven! Pl: \*'Lépj be a Gmailbe és nézd meg van-e új számla.'\*")



\# Sidebar

with st.sidebar:

&nbsp;   st.header("⚙️ Beállítások")

&nbsp;   model\_name = st.text\_input("Helyi Modell", "qwen2.5-coder:7b")

&nbsp;   use\_own\_browser = st.checkbox("Saját Chrome használata", value=True)

&nbsp;   if st.button("🧹 Új beszélgetés"):

&nbsp;       st.session\_state.messages = \[]

&nbsp;       st.rerun()



\# Hybrid Brain Logic

def get\_llm(model):

&nbsp;   primary = ChatOllama(model=model, temperature=0.0, num\_ctx=16000)

&nbsp;   backup = ChatGoogleGenerativeAI(model="gemini-2.0-flash", google\_api\_key=os.getenv("GEMINI\_API\_KEY"))

&nbsp;   return primary.with\_fallbacks(\[backup])



\# Chat History

if "messages" not in st.session\_state:

&nbsp;   st.session\_state.messages = \[]



for msg in st.session\_state.messages:

&nbsp;   st.chat\_message(msg\["role"]).markdown(msg\["content"])



\# Execution Logic

async def run\_agent(task\_text):

&nbsp;   llm = get\_llm(model\_name)

&nbsp;   

&nbsp;   # Itt adjuk meg neki a személyiséget, hogy értse a folytonos szöveget

&nbsp;   system\_instruction = """

&nbsp;   Te Brunella vagy, egy intelligens webes asszisztens. 

&nbsp;   A felhasználó magyarul beszél hozzád. 

&nbsp;   A feladatod: értelmezd a kérést, és hajtsd végre a böngészőben.

&nbsp;   Ha a felhasználó nem ad konkrét URL-t, használd a józan eszed (pl. Google keresés).

&nbsp;   """

&nbsp;   

&nbsp;   agent = Agent(

&nbsp;       task=task\_text,

&nbsp;       llm=llm,

&nbsp;       use\_vision=True,

&nbsp;       system\_prompt\_class=None, # Opcionális finomhangolás

&nbsp;   )

&nbsp;   

&nbsp;   history = await agent.run()

&nbsp;   return history.final\_result()



\# Input Handling

if prompt := st.chat\_input("Miben segíthetek?"):

&nbsp;   st.session\_state.messages.append({"role": "user", "content": prompt})

&nbsp;   st.chat\_message("user").markdown(prompt)

&nbsp;   

&nbsp;   with st.chat\_message("assistant"):

&nbsp;       container = st.empty()

&nbsp;       container.markdown("🕵️‍♀️ \*Értelmezem és végrehajtom...\*")

&nbsp;       try:

&nbsp;           result = asyncio.run(run\_agent(prompt))

&nbsp;           final\_response = f"✅ \*\*Kész!\*\*\\n\\n{result}"

&nbsp;           container.markdown(final\_response)

&nbsp;           st.session\_state.messages.append({"role": "assistant", "content": final\_response})

&nbsp;       except Exception as e:

&nbsp;           container.error(f"Hiba történt: {e}")



"Natural Language Control" (NLC) lesz a rendszer alapfilozófiája. Nem parancssorok, nem bonyolult gombok, hanem beszéd és írás, mintha egy emberrel kommunikálnál.



A live\_commander.py kódjában a system\_instruction részt pontosan erre hegyeztem ki:



Python

&nbsp;   system\_instruction = """

&nbsp;   Te Brunella vagy, egy intelligens webes asszisztens. 

&nbsp;   A felhasználó magyarul beszél hozzád. 

&nbsp;   A feladatod: értelmezd a kérést, és hajtsd végre a böngészőben.

&nbsp;   Ha a felhasználó nem ad konkrét URL-t, használd a józan eszed (pl. Google keresés).

&nbsp;   """

