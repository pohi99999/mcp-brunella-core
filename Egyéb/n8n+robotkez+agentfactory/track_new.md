```python

import os



\# Create directories

os.makedirs("myai/tasks", exist\_ok=True)

os.makedirs("myai/prompts", exist\_ok=True)

os.makedirs("workers", exist\_ok=True)

os.makedirs("n8n\_workflows", exist\_ok=True)



\# 1. Create ev\_hunter\_prompt.md

prompt\_content = """TE VAGY AZ "EV HUNTER". A feladatod elektromos autók keresése az alábbi weboldalon: https://en.wiktionary.org/wiki/helye



1\. KERESÉSI PARAMÉTEREK:

&nbsp;  - Ár: 10.000 € és 19.000 € között.

&nbsp;  - Eladó típusa: KIZÁRÓLAG Magánszemély (Privat).

&nbsp;  - Állapot: Sérülésmentes, karbantartott (keresd a kulcsszavakat: "gepflegt", "unfallfrei", "serviceheft").



2\. CÉLAUTÓK LISTÁJA (Csak ezeket nyisd meg!):

&nbsp;  - BMW: i3 (94 Ah vagy 120 Ah)

&nbsp;  - Nissan: Leaf (77 kWh, 40 kWh)

&nbsp;  - Kia: Niro (64 kWh), EV6 (77.4 kWh)

&nbsp;  - Hyundai: Kona EV (64 kWh), Ioniq (72.6 kWh)

&nbsp;  - Audi: E-Tron 50

&nbsp;  - Volkswagen: ID.4 (77 kWh), ID.3 (58 kWh), ID.5 (77 kWh), UP e-UP



3\. AKCIÓ:

&nbsp;  - Ha találsz megfelelőt, nyisd meg a hirdetést.

&nbsp;  - Gyűjtsd ki: Modell, Ár, Évjárat, Kilométer, Link, Eladó Típusa.

&nbsp;  - Értékeld: Ha az ár/érték arány kiemelkedő, jelöld meg: "BEST BUY".



4\. KIMENET (JSON):

&nbsp;  - A végén adj vissza egy JSON listát a találatokkal. A formátum legyen:

&nbsp;    \[

&nbsp;      {

&nbsp;        "model": "BMW i3",

&nbsp;        "price": 14500,

&nbsp;        "year": 2019,

&nbsp;        "km": 45000,

&nbsp;        "link": "https://...",

&nbsp;        "seller\_type": "Private",

&nbsp;        "description": "...",

&nbsp;        "rating": "BEST BUY"

&nbsp;      }

&nbsp;    ]

"""

with open("myai/prompts/ev\_hunter\_prompt.md", "w", encoding="utf-8") as f:

&nbsp;   f.write(prompt\_content)



\# 2. Create myai/tasks/ev\_hunter.py

task\_code = """import sys

import os

import asyncio

import json

from langchain\_openai import ChatOpenAI

from browser\_use import Agent

from dotenv import load\_dotenv



\# Load environment variables

load\_dotenv()



async def run\_ev\_hunter():

&nbsp;   # Configuration for LLM (pointing to local Ollama or compatible API)

&nbsp;   llm = ChatOpenAI(

&nbsp;       base\_url=os.getenv('OLLAMA\_BASE\_URL', 'http://localhost:11434/v1'),

&nbsp;       api\_key='ollama',

&nbsp;       model=os.getenv('OLLAMA\_MODEL', 'qwen2.5-coder:latest') # or your preferred model

&nbsp;   )



&nbsp;   # Load Prompt

&nbsp;   prompt\_path = os.path.join(os.path.dirname(\_\_file\_\_), '../prompts/ev\_hunter\_prompt.md')

&nbsp;   with open(prompt\_path, 'r', encoding='utf-8') as f:

&nbsp;       prompt\_template = f.read()



&nbsp;   # Inject URL (Example: willhaben.at)

&nbsp;   target\_url = "https://www.willhaben.at/iad/gebrauchtwagen/auto/elektroauto"

&nbsp;   task = prompt\_template.replace("https://en.wiktionary.org/wiki/helye", target\_url)



&nbsp;   # Initialize Agent

&nbsp;   agent = Agent(

&nbsp;       task=task,

&nbsp;       llm=llm,

&nbsp;       use\_vision=True, # Enable if model supports vision

&nbsp;   )



&nbsp;   # Run

&nbsp;   history = await agent.run()

&nbsp;   

&nbsp;   # Extract Result (assuming the agent follows the JSON output instruction)

&nbsp;   # Ideally, we would use a structured output parser here, but for now we take the string.

&nbsp;   result = history.final\_result()

&nbsp;   

&nbsp;   # Print to stdout for n8n to capture

&nbsp;   print(json.dumps({"stdout": result}))



if \_\_name\_\_ == "\_\_main\_\_":

&nbsp;   asyncio.run(run\_ev\_hunter())

"""

with open("myai/tasks/ev\_hunter.py", "w", encoding="utf-8") as f:

&nbsp;   f.write(task\_code)



\# 3. Create workers/scraper-worker.js

worker\_code = """export default {

&nbsp; async fetch(request) {

&nbsp;   const url = new URL(request.url).searchParams.get("target");

&nbsp;   if (!url) return new Response("Add meg a target URL-t!", { status: 400 });



&nbsp;   try {

&nbsp;       const response = await fetch(url, {

&nbsp;           headers: {

&nbsp;               'User-Agent': 'Brunella-Scraper-Bot/1.0'

&nbsp;           }

&nbsp;       });

&nbsp;       let text = await response.text();



&nbsp;       // Simple cleanup: Remove scripts, styles, and comments

&nbsp;       text = text.replace(/<script\\b\[^>]\*>\[\\s\\S]\*?<\\/script>/gim, "");

&nbsp;       text = text.replace(/<style\\b\[^>]\*>\[\\s\\S]\*?<\\/style>/gim, "");

&nbsp;       text = text.replace(//g, "");

&nbsp;       

&nbsp;       // Remove generic tags to save tokens

&nbsp;       text = text.replace(/<\[^>]+>/g, " "); 

&nbsp;       text = text.replace(/\\s+/g, " ").trim();



&nbsp;       return new Response(JSON.stringify({ cleaned\_text: text }), {

&nbsp;         headers: { "Content-Type": "application/json" },

&nbsp;       });

&nbsp;   } catch (e) {

&nbsp;       return new Response(JSON.stringify({ error: e.message }), { status: 500 });

&nbsp;   }

&nbsp; },

};

"""

with open("workers/scraper-worker.js", "w", encoding="utf-8") as f:

&nbsp;   f.write(worker\_code)



\# 4. Create n8n\_workflows/ev\_hunter.json (Simplified representation)

n8n\_workflow = {

&nbsp; "name": "EV Hunter Automation",

&nbsp; "nodes": \[

&nbsp;   {

&nbsp;     "parameters": {

&nbsp;       "rule": {

&nbsp;         "interval": \[

&nbsp;           {

&nbsp;             "field": "hours",

&nbsp;             "hours": 1

&nbsp;           }

&nbsp;         ]

&nbsp;       }

&nbsp;     },

&nbsp;     "name": "Schedule Trigger",

&nbsp;     "type": "n8n-nodes-base.scheduleTrigger",

&nbsp;     "typeVersion": 1,

&nbsp;     "position": \[

&nbsp;       250,

&nbsp;       300

&nbsp;     ]

&nbsp;   },

&nbsp;   {

&nbsp;     "parameters": {

&nbsp;       "command": "cd F:/mcp-brunella-core \&\& python myai/tasks/ev\_hunter.py"

&nbsp;     },

&nbsp;     "name": "Execute EV Hunter",

&nbsp;     "type": "n8n-nodes-base.executeCommand",

&nbsp;     "typeVersion": 1,

&nbsp;     "position": \[

&nbsp;       450,

&nbsp;       300

&nbsp;     ]

&nbsp;   },

&nbsp;   {

&nbsp;     "parameters": {

&nbsp;       "jsCode": "const pythonOutput = JSON.parse(items\[0].json.stdout);\\nreturn pythonOutput.map(item => ({ json: item }));"

&nbsp;     },

&nbsp;     "name": "Parse JSON",

&nbsp;     "type": "n8n-nodes-base.code",

&nbsp;     "typeVersion": 1,

&nbsp;     "position": \[

&nbsp;       650,

&nbsp;       300

&nbsp;     ]

&nbsp;   },

&nbsp;   {

&nbsp;     "parameters": {

&nbsp;       "conditions": {

&nbsp;         "number": \[

&nbsp;           {

&nbsp;             "value1": "={{ $json.price }}",

&nbsp;             "operation": "larger",

&nbsp;             "value2": 10000

&nbsp;           },

&nbsp;           {

&nbsp;             "value1": "={{ $json.price }}",

&nbsp;             "operation": "smaller",

&nbsp;             "value2": 19000

&nbsp;           }

&nbsp;         ],

&nbsp;         "string": \[

&nbsp;           {

&nbsp;             "value1": "={{ $json.seller\_type }}",

&nbsp;             "operation": "contains",

&nbsp;             "value2": "Private"

&nbsp;           }

&nbsp;         ]

&nbsp;       }

&nbsp;     },

&nbsp;     "name": "Filter Deals",

&nbsp;     "type": "n8n-nodes-base.filter",

&nbsp;     "typeVersion": 1,

&nbsp;     "position": \[

&nbsp;       850,

&nbsp;       300

&nbsp;     ]

&nbsp;   },

&nbsp;   {

&nbsp;     "parameters": {

&nbsp;       "resource": "message",

&nbsp;       "subject": "=⚡ BAS TALÁLAT: {{ $json.model }} - {{ $json.price }}€",

&nbsp;       "message": "=Szia Péter! Találtam egy autót:\\nLink: {{ $json.link }}\\nÁr: {{ $json.price }} €\\nLeírás: {{ $json.description }}",

&nbsp;       "toEmail": "peterpohankapersonal@gmail.com"

&nbsp;     },

&nbsp;     "name": "Send Email",

&nbsp;     "type": "n8n-nodes-base.gmail",

&nbsp;     "typeVersion": 2,

&nbsp;     "position": \[

&nbsp;       1050,

&nbsp;       300

&nbsp;     ]

&nbsp;   }

&nbsp; ],

&nbsp; "connections": {

&nbsp;   "Schedule Trigger": {

&nbsp;     "main": \[

&nbsp;       \[

&nbsp;         {

&nbsp;           "node": "Execute EV Hunter",

&nbsp;           "type": "main",

&nbsp;           "index": 0

&nbsp;         }

&nbsp;       ]

&nbsp;     ]

&nbsp;   },

&nbsp;   "Execute EV Hunter": {

&nbsp;     "main": \[

&nbsp;       \[

&nbsp;         {

&nbsp;           "node": "Parse JSON",

&nbsp;           "type": "main",

&nbsp;           "index": 0

&nbsp;         }

&nbsp;       ]

&nbsp;     ]

&nbsp;   },

&nbsp;   "Parse JSON": {

&nbsp;     "main": \[

&nbsp;       \[

&nbsp;         {

&nbsp;           "node": "Filter Deals",

&nbsp;           "type": "main",

&nbsp;           "index": 0

&nbsp;         }

&nbsp;       ]

&nbsp;     ]

&nbsp;   },

&nbsp;   "Filter Deals": {

&nbsp;     "main": \[

&nbsp;       \[

&nbsp;         {

&nbsp;           "node": "Send Email",

&nbsp;           "type": "main",

&nbsp;           "index": 0

&nbsp;         }

&nbsp;       ]

&nbsp;     ]

&nbsp;   }

&nbsp; }

}



with open("n8n\_workflows/ev\_hunter.json", "w", encoding="utf-8") as f:

&nbsp;   json.dump(n8n\_workflow, f, indent=2)



print("Files created successfully.")







```



```text

Traceback (most recent call last):

&nbsp; File "<string>", line 279, in <module>

NameError: name 'json' is not defined





```



```python

import os

import json



\# Create directories

os.makedirs("myai/tasks", exist\_ok=True)

os.makedirs("myai/prompts", exist\_ok=True)

os.makedirs("workers", exist\_ok=True)

os.makedirs("n8n\_workflows", exist\_ok=True)



\# 1. Create ev\_hunter\_prompt.md

prompt\_content = """TE VAGY AZ "EV HUNTER". A feladatod elektromos autók keresése az alábbi weboldalon: https://en.wiktionary.org/wiki/helye



1\. KERESÉSI PARAMÉTEREK:

&nbsp;  - Ár: 10.000 € és 19.000 € között.

&nbsp;  - Eladó típusa: KIZÁRÓLAG Magánszemély (Privat).

&nbsp;  - Állapot: Sérülésmentes, karbantartott (keresd a kulcsszavakat: "gepflegt", "unfallfrei", "serviceheft").



2\. CÉLAUTÓK LISTÁJA (Csak ezeket nyisd meg!):

&nbsp;  - BMW: i3 (94 Ah vagy 120 Ah)

&nbsp;  - Nissan: Leaf (77 kWh, 40 kWh)

&nbsp;  - Kia: Niro (64 kWh), EV6 (77.4 kWh)

&nbsp;  - Hyundai: Kona EV (64 kWh), Ioniq (72.6 kWh)

&nbsp;  - Audi: E-Tron 50

&nbsp;  - Volkswagen: ID.4 (77 kWh), ID.3 (58 kWh), ID.5 (77 kWh), UP e-UP



3\. AKCIÓ:

&nbsp;  - Ha találsz megfelelőt, nyisd meg a hirdetést.

&nbsp;  - Gyűjtsd ki: Modell, Ár, Évjárat, Kilométer, Link, Eladó Típusa.

&nbsp;  - Értékeld: Ha az ár/érték arány kiemelkedő, jelöld meg: "BEST BUY".



4\. KIMENET (JSON):

&nbsp;  - A végén adj vissza egy JSON listát a találatokkal. A formátum legyen:

&nbsp;    \[

&nbsp;      {

&nbsp;        "model": "BMW i3",

&nbsp;        "price": 14500,

&nbsp;        "year": 2019,

&nbsp;        "km": 45000,

&nbsp;        "link": "https://...",

&nbsp;        "seller\_type": "Private",

&nbsp;        "description": "...",

&nbsp;        "rating": "BEST BUY"

&nbsp;      }

&nbsp;    ]

"""

with open("myai/prompts/ev\_hunter\_prompt.md", "w", encoding="utf-8") as f:

&nbsp;   f.write(prompt\_content)



\# 2. Create myai/tasks/ev\_hunter.py

task\_code = """import sys

import os

import asyncio

import json

\# Assuming standard imports for browser-use and langchain

\# from langchain\_openai import ChatOpenAI

\# from browser\_use import Agent

from dotenv import load\_dotenv



\# Load environment variables

load\_dotenv()



async def run\_ev\_hunter():

&nbsp;   # Configuration for LLM (pointing to local Ollama or compatible API)

&nbsp;   # This is a placeholder for the actual initialization which depends on the environment

&nbsp;   # llm = ChatOpenAI(

&nbsp;   #     base\_url=os.getenv('OLLAMA\_BASE\_URL', 'http://localhost:11434/v1'),

&nbsp;   #     api\_key='ollama',

&nbsp;   #     model=os.getenv('OLLAMA\_MODEL', 'qwen2.5-coder:latest')

&nbsp;   # )



&nbsp;   # Load Prompt

&nbsp;   prompt\_path = os.path.join(os.path.dirname(\_\_file\_\_), '../prompts/ev\_hunter\_prompt.md')

&nbsp;   with open(prompt\_path, 'r', encoding='utf-8') as f:

&nbsp;       prompt\_template = f.read()



&nbsp;   # Inject URL (Example: willhaben.at)

&nbsp;   target\_url = "https://www.willhaben.at/iad/gebrauchtwagen/auto/elektroauto"

&nbsp;   task = prompt\_template.replace("https://en.wiktionary.org/wiki/helye", target\_url)



&nbsp;   # Initialize Agent (Stub for demonstration)

&nbsp;   # agent = Agent(task=task, llm=llm, use\_vision=True)

&nbsp;   

&nbsp;   # Run

&nbsp;   # history = await agent.run()

&nbsp;   # result = history.final\_result()

&nbsp;   

&nbsp;   # Simulating Output for Testing

&nbsp;   simulated\_result = \[

&nbsp;       {

&nbsp;           "model": "BMW i3 94Ah",

&nbsp;           "price": 14900,

&nbsp;           "year": 2018,

&nbsp;           "km": 42000,

&nbsp;           "link": "https://www.willhaben.at/iad/gebrauchtwagen/d/auto/bmw-i3-94ah-123456",

&nbsp;           "seller\_type": "Private",

&nbsp;           "description": "Top zustand, serviceheft gepflegt",

&nbsp;           "rating": "BEST BUY"

&nbsp;       }

&nbsp;   ]

&nbsp;   

&nbsp;   # Print to stdout for n8n to capture

&nbsp;   print(json.dumps(simulated\_result))



if \_\_name\_\_ == "\_\_main\_\_":

&nbsp;   asyncio.run(run\_ev\_hunter())

"""

with open("myai/tasks/ev\_hunter.py", "w", encoding="utf-8") as f:

&nbsp;   f.write(task\_code)



\# 3. Create workers/scraper-worker.js

worker\_code = """export default {

&nbsp; async fetch(request) {

&nbsp;   const url = new URL(request.url).searchParams.get("target");

&nbsp;   if (!url) return new Response("Add meg a target URL-t!", { status: 400 });



&nbsp;   try {

&nbsp;       const response = await fetch(url, {

&nbsp;           headers: {

&nbsp;               'User-Agent': 'Brunella-Scraper-Bot/1.0'

&nbsp;           }

&nbsp;       });

&nbsp;       let text = await response.text();



&nbsp;       // Simple cleanup: Remove scripts, styles, and comments

&nbsp;       text = text.replace(/<script\\\\b\[^>]\*>\[\\\\s\\\\S]\*?<\\\\/script>/gim, "");

&nbsp;       text = text.replace(/<style\\\\b\[^>]\*>\[\\\\s\\\\S]\*?<\\\\/style>/gim, "");

&nbsp;       text = text.replace(//g, "");

&nbsp;       

&nbsp;       // Remove generic tags to save tokens

&nbsp;       text = text.replace(/<\[^>]+>/g, " "); 

&nbsp;       text = text.replace(/\\\\s+/g, " ").trim();



&nbsp;       return new Response(JSON.stringify({ cleaned\_text: text }), {

&nbsp;         headers: { "Content-Type": "application/json" },

&nbsp;       });

&nbsp;   } catch (e) {

&nbsp;       return new Response(JSON.stringify({ error: e.message }), { status: 500 });

&nbsp;   }

&nbsp; },

};

"""

with open("workers/scraper-worker.js", "w", encoding="utf-8") as f:

&nbsp;   f.write(worker\_code)



\# 4. Create n8n\_workflows/ev\_hunter.json (Simplified representation)

n8n\_workflow = {

&nbsp; "name": "EV Hunter Automation",

&nbsp; "nodes": \[

&nbsp;   {

&nbsp;     "parameters": {

&nbsp;       "rule": {

&nbsp;         "interval": \[

&nbsp;           {

&nbsp;             "field": "hours",

&nbsp;             "hours": 1

&nbsp;           }

&nbsp;         ]

&nbsp;       }

&nbsp;     },

&nbsp;     "name": "Schedule Trigger",

&nbsp;     "type": "n8n-nodes-base.scheduleTrigger",

&nbsp;     "typeVersion": 1,

&nbsp;     "position": \[

&nbsp;       250,

&nbsp;       300

&nbsp;     ]

&nbsp;   },

&nbsp;   {

&nbsp;     "parameters": {

&nbsp;       "command": "cd F:/mcp-brunella-core \&\& python myai/tasks/ev\_hunter.py"

&nbsp;     },

&nbsp;     "name": "Execute EV Hunter",

&nbsp;     "type": "n8n-nodes-base.executeCommand",

&nbsp;     "typeVersion": 1,

&nbsp;     "position": \[

&nbsp;       450,

&nbsp;       300

&nbsp;     ]

&nbsp;   },

&nbsp;   {

&nbsp;     "parameters": {

&nbsp;       "jsCode": "const pythonOutput = JSON.parse(items\[0].json.stdout);\\nreturn pythonOutput.map(item => ({ json: item }));"

&nbsp;     },

&nbsp;     "name": "Parse JSON",

&nbsp;     "type": "n8n-nodes-base.code",

&nbsp;     "typeVersion": 1,

&nbsp;     "position": \[

&nbsp;       650,

&nbsp;       300

&nbsp;     ]

&nbsp;   },

&nbsp;   {

&nbsp;     "parameters": {

&nbsp;       "conditions": {

&nbsp;         "number": \[

&nbsp;           {

&nbsp;             "value1": "={{ $json.price }}",

&nbsp;             "operation": "larger",

&nbsp;             "value2": 10000

&nbsp;           },

&nbsp;           {

&nbsp;             "value1": "={{ $json.price }}",

&nbsp;             "operation": "smaller",

&nbsp;             "value2": 19000

&nbsp;           }

&nbsp;         ],

&nbsp;         "string": \[

&nbsp;           {

&nbsp;             "value1": "={{ $json.seller\_type }}",

&nbsp;             "operation": "contains",

&nbsp;             "value2": "Private"

&nbsp;           }

&nbsp;         ]

&nbsp;       }

&nbsp;     },

&nbsp;     "name": "Filter Deals",

&nbsp;     "type": "n8n-nodes-base.filter",

&nbsp;     "typeVersion": 1,

&nbsp;     "position": \[

&nbsp;       850,

&nbsp;       300

&nbsp;     ]

&nbsp;   },

&nbsp;   {

&nbsp;     "parameters": {

&nbsp;       "resource": "message",

&nbsp;       "subject": "=⚡ BAS TALÁLAT: {{ $json.model }} - {{ $json.price }}€",

&nbsp;       "message": "=Szia Péter! Találtam egy autót:\\nLink: {{ $json.link }}\\nÁr: {{ $json.price }} €\\nLeírás: {{ $json.description }}",

&nbsp;       "toEmail": "peterpohankapersonal@gmail.com"

&nbsp;     },

&nbsp;     "name": "Send Email",

&nbsp;     "type": "n8n-nodes-base.gmail",

&nbsp;     "typeVersion": 2,

&nbsp;     "position": \[

&nbsp;       1050,

&nbsp;       300

&nbsp;     ]

&nbsp;   }

&nbsp; ],

&nbsp; "connections": {

&nbsp;   "Schedule Trigger": {

&nbsp;     "main": \[

&nbsp;       \[

&nbsp;         {

&nbsp;           "node": "Execute EV Hunter",

&nbsp;           "type": "main",

&nbsp;           "index": 0

&nbsp;         }

&nbsp;       ]

&nbsp;     ]

&nbsp;   },

&nbsp;   "Execute EV Hunter": {

&nbsp;     "main": \[

&nbsp;       \[

&nbsp;         {

&nbsp;           "node": "Parse JSON",

&nbsp;           "type": "main",

&nbsp;           "index": 0

&nbsp;         }

&nbsp;       ]

&nbsp;     ]

&nbsp;   },

&nbsp;   "Parse JSON": {

&nbsp;     "main": \[

&nbsp;       \[

&nbsp;         {

&nbsp;           "node": "Filter Deals",

&nbsp;           "type": "main",

&nbsp;           "index": 0

&nbsp;         }

&nbsp;       ]

&nbsp;     ]

&nbsp;   },

&nbsp;   "Filter Deals": {

&nbsp;     "main": \[

&nbsp;       \[

&nbsp;         {

&nbsp;           "node": "Send Email",

&nbsp;           "type": "main",

&nbsp;           "index": 0

&nbsp;         }

&nbsp;       ]

&nbsp;     ]

&nbsp;   }

&nbsp; }

}



with open("n8n\_workflows/ev\_hunter.json", "w", encoding="utf-8") as f:

&nbsp;   json.dump(n8n\_workflow, f, indent=2)



print("Files created successfully.")





```



```text

Files created successfully.





```



\*\*Állapot:\*\* \[Végrehajtás: Fájlok Generálva]



Kiváló döntés, Péter! Megírtam a szükséges kódokat és konfigurációs fájlokat a \*\*"Zöld Villám" (Green Lightning)\*\* hadművelethez. A rendszer most már készen áll az integrációra.



A következő fájlokat hoztam létre a munkaterületedben (ezeket megtalálod a fájlrendszerben):



1\. `myai/prompts/ev\_hunter\_prompt.md`: A részletes "EV Hunter" prompt a specifikált autó típusokkal és árkategóriával.

2\. `myai/tasks/ev\_hunter.py`: A Python script, ami a Robotkezet vezérli. \*\*Figyelem:\*\* Jelenleg "szimulációs módban" van (kamu adatokat ad vissza), hogy azonnal tesztelhesd az n8n összeköttetést anélkül, hogy böngészőt nyitna.

3\. `workers/scraper-worker.js`: A Cloudflare Worker kódja a HTML tisztításhoz.

4\. `n8n\_workflows/ev\_hunter.json`: Az importálható n8n workflow.



---



\### 🚀 Bevetési Útmutató (Lépésről lépésre)



\#### 1. Python "Robotkéz" Élesítése



A generált `myai/tasks/ev\_hunter.py` fájlban a valódi böngésző logika (`agent = Agent(...)`) ki van kommentezve, és egy "Simulated Output" blokk fut helyette.



\*\*Teendő:\*\*



1\. Nyisd meg a fájlt a VS Code-ban.

2\. Győződj meg róla, hogy a `pip install browser-use langchain-openai python-dotenv` megtörtént.

3\. \*\*Ha az n8n teszt megvolt\*\*, töröld ki a szimulációs blokkot, és kommentezd vissza az `Agent` részt.



\#### 2. n8n Workflow Importálása



1\. Nyisd meg az n8n felületét (`localhost:5678`).

2\. Hozz létre egy új workflow-t.

3\. Kattints a jobb felső sarokban a \*\*három pontra\*\* -> \*\*Import from File\*\*.

4\. Válaszd ki a `n8n\_workflows/ev\_hunter.json` fájlt.

5\. \*\*Fontos:\*\* Az "Execute Command" node-ban ellenőrizd az útvonalat (`cd F:/mcp-brunella-core...`), hogy biztosan helyes-e a te gépeden.



\#### 3. Cloudflare Worker ("Scraper Agent")



Ha használni akarod a gyors HTML tisztítót:



1\. Másold a `workers/scraper-worker.js` tartalmát.

2\. Menj a Cloudflare Dashboard -> Workers menübe.

3\. Hozz létre egy új szolgáltatást, és illeszd be a kódot.

4\. A kapott URL-t (pl. `scraper.peter.workers.dev`) használd majd a Python scriptben vagy n8n-ben, ha nyers HTML-t kell tisztítani.



\### Következő lépés:



Próbáld ki a \*\*szimulált\*\* Python scriptet a terminálban:



```powershell

python myai/tasks/ev\_hunter.py



```



Ha kiír egy JSON-t a BMW i3 adataival, akkor a rendszer működik, és mehetünk az n8n-be összekötni!



----------



II.



Rendben, Péter! A „Zöld Villám” (Green Lightning) hadművelet fájljai a helyükön vannak a `F:\\mcp-brunella-core` mappában.



Most jön a kedvenc részem: \*\*az integráció\*\*. Összekötjük a Python „agyat” (Robotkéz) az n8n „idegrendszerrel”.



Itt a konkrét, lépésről-lépésre útmutató (Glass Box módszertan), hogy a rendszered működésbe lépjen.



---



\### Állapot: \[Végrehajtás / Integráció]



\### 1. Lépés: A Python Környezet Felkészítése ("Az Izomzat")



A `browser-use` könyvtárnak szüksége van a Playwright-ra a böngésző vezérléséhez. Mivel most generáltuk a fájlokat, ezeket telepíteni kell.



\*\*Nyisd meg a VS Code terminált (PowerShell), és futtasd ezeket sorban:\*\*



```powershell

\# 1. Belépés a főkönyvtárba (ha nem ott vagy)

cd F:\\mcp-brunella-core



\# 2. Szükséges csomagok telepítése

pip install browser-use langchain-openai python-dotenv playwright



\# 3. Böngésző motorok letöltése (ez kötelező a browser-use-hoz!)

playwright install



```



\### 2. Lépés: A "Száraz Teszt" (Simulation Mode)



Jelenleg a `ev\_hunter.py` script "biztonsági módban" van: nem nyit meg böngészőt, csak visszaad egy kamu JSON-t. Ez azért kell, hogy leteszteljük, látja-e az n8n a Python kimenetét.



\*\*Teszteld le a terminálban:\*\*



```powershell

python myai/tasks/ev\_hunter.py



```



\*\*Elvárt eredmény:\*\* Egy JSON szöveget kell látnod a terminálban (pl. `\[{"model": "BMW i3", ...}]`). Ha ez megvan, a Python rész kész.



---



\### 3. Lépés: n8n Beállítás ("Az Idegrendszer")



Most importáljuk a workflow-t, amit írtam neked.



1\. Nyisd meg a böngészőben: `http://localhost:5678`

2\. Kattints a jobb felső sarokban a \*\*menüikonra\*\* (három pont vagy hamburger) -> \*\*Import from File\*\*.

3\. Válaszd ki ezt a fájlt: `F:\\mcp-brunella-core\\n8n\_workflows\\ev\_hunter.json`



\*\*Konfigurálás az n8n-en belül:\*\*



\* Kattints duplán az \*\*"Execute EV Hunter"\*\* (Execute Command) node-ra.

\* Ellenőrizd a parancsot: `cd F:/mcp-brunella-core \&\& python myai/tasks/ev\_hunter.py`

\* \*Tipp:\* Ha virtuális környezetet használsz (venv), akkor a `python` helyett a teljes útvonalat add meg (pl. `F:/mcp-brunella-core/.venv/Scripts/python`).





\* Kattints a \*\*"Execute Node"\*\* gombra a teszteléshez.

\* Ha zöld pipát kapsz és a "Output" ablakban ott a JSON, akkor a híd működik!







---



\### 4. Lépés: Élesítés ("Live Fire") 🔥



Ha az n8n teszt sikeres volt a szimulált adatokkal, most élesítjük a fegyvert.



1\. Nyisd meg a `myai/tasks/ev\_hunter.py` fájlt a VS Code-ban.

2\. \*\*Töröld ki (vagy kommentezd ki)\*\* a "Simulating Output" részt a végén.

3\. \*\*Kommentezd vissza (aktiváld)\*\* az `agent = Agent(...)` és `await agent.run()` részeket.

4\. \*\*Ellenőrizd a modellt:\*\*

\* A script alapértelmezetten az `ollama` szervert keresi (`qwen2.5-coder` modellel).

\* Győződj meg róla, hogy az Ollama fut (`ollama serve`), VAGY írd át a kódot, hogy `gpt-4o`-t használjon, ha van OpenAI kulcsod a `.env`-ben.







\*\*Itt a módosított, ÉLES kód részlet (csere erre a fájlban):\*\*



```python

&nbsp;   # ... (importok)



&nbsp;   # Initialize Agent (ÉLESÍTVE!)

&nbsp;   agent = Agent(

&nbsp;       task=task,

&nbsp;       llm=llm,

&nbsp;       use\_vision=True, # Fontos a hirdetések elemzéséhez!

&nbsp;   )



&nbsp;   # Futtatás

&nbsp;   history = await agent.run()

&nbsp;   

&nbsp;   # Eredmény kinyerése (ez már a valós keresés eredménye lesz)

&nbsp;   result = history.final\_result()

&nbsp;   

&nbsp;   # JSON output az n8n-nek

&nbsp;   print(json.dumps({"stdout": result}))



```



---------



III.



Rendben, Péter! Indítjuk a hajtóműveket. 🚀



A célunk most az, hogy a "Robotkéz" (Python) és az "Idegrendszer" (n8n) kezet fogjon egymással.



Kérlek, kövesd ezt a 3 lépést pontosan ebben a sorrendben a \*\*VS Code termináljában\*\*:



\### 1. Lépés: A "Robotkéz" izmainak telepítése



Telepítenünk kell a böngésző-vezérlő motorokat. Másold be és futtasd le ezt a blokkot egyben:



```powershell

\# 1. Belépünk a projekt mappába

cd F:\\mcp-brunella-core



\# 2. Telepítjük a Python csomagokat (kb. 1-2 perc)

pip install browser-use langchain-openai python-dotenv playwright



\# 3. Letöltjük a böngésző motorokat (ez fontos!)

playwright install



```



---



\### 2. Lépés: Szimulációs Teszt



Most megnézzük, hogy a Python script hajlandó-e szóba állni velünk. Mivel a scriptben benne hagytam a "szimulációs módot", most még \*\*nem fog böngészőt nyitni\*\*, csak kiír egy JSON adatot. Ez a biztonsági teszt.



Futtasd ezt:



```powershell

python myai/tasks/ev\_hunter.py



```



\*\*Ezt kell látnod a kimeneten (vagy hasonlót):\*\*



```json

\[{"model": "BMW i3 94Ah", "price": 14900, "year": 2018, ... }]



```



\*Ha piros hibaüzenetet kapsz, másold be ide nekem!\*



---



\### 3. Lépés: n8n Összekötés



Ha a fenti JSON megjelent, akkor mehetünk az n8n-be:



1\. Nyisd meg a böngészőben: `http://localhost:5678`

2\. Kattints jobb oldalt fent a menüre (\*\*három pont\*\* vagy hamburger menü) -> \*\*"Import from File"\*\*.

3\. Tallózd be ezt a fájlt: `F:\\mcp-brunella-core\\n8n\_workflows\\ev\_hunter.json`

4\. A megjelenő workflow-ban kattints duplán az \*\*"Execute EV Hunter"\*\* node-ra, majd nyomd meg a \*\*"Test Step"\*\* (vagy Execute Node) gombot.



---------------------



Rendben, Péter! Itt van a \*\*teljes, végrehajtható utasítás\*\*, amit egy az egyben bemásolhatsz a fejlesztő ügynöködnek (legyen az Cursor, Claude Dev, vagy a terminálban futó ügynök).



Ez a prompt végigviszi őt a telepítésen, a környezet ellenőrzésén és a "száraz" teszten.



---



\### 👾 MÁSOLD BE EZT A FEJLESZTŐ ÜGYNÖKNEK:



```markdown

\# TASK: "Green Lightning" (Zöld Villám) Környezet Élesítése \& Integráció



Te vagy a BAS (Brunella Agent System) DevOps mérnöke. A feladatod a Python alapú "Robotkéz" (Browser-use) alrendszer előkészítése és tesztelése az n8n integrációhoz.



\*\*Munkakönyvtár:\*\* `F:\\mcp-brunella-core`



Kérlek, hajtsd végre az alábbi lépéseket sorrendben, és minden lépésnél ellenőrizd a kimenetet!



\### 1. FÁZIS: Függőségek Telepítése ("Az Izomzat")

Futtasd le az alábbi parancsokat PowerShell-ben a szükséges Python csomagok és a böngésző motorok telepítéséhez:



```powershell

\# 1. Belépés a root mappába

cd F:\\mcp-brunella-core



\# 2. Python csomagok telepítése (Browser-use, LangChain, Playwright)

pip install browser-use langchain-openai python-dotenv playwright



\# 3. Playwright böngészők telepítése (Kritikus lépés!)

playwright install



```



\### 2. FÁZIS: Szimulációs Teszt ("Füstpróba")



Ellenőrizzük, hogy a script lefut-e hiba nélkül, és visszaadja-e az elvárt JSON formátumot az n8n számára. Jelenleg a script "Simulated Mode"-ban van, tehát nem nyit böngészőt, csak adatot generál.



Futtasd a parancsot:



```powershell

python myai/tasks/ev\_hunter.py



```



\*\*Elvárt eredmény:\*\*

A terminálban meg kell jelennie egy JSON stringnek (pl. `\[{"model": "BMW i3", ...}]`).



\### 3. FÁZIS: n8n Workflow Fájl Ellenőrzése



Ellenőrizd, hogy az n8n workflow fájl létrejött-e a megfelelő helyen, hogy a felhasználó importálni tudja:



```powershell

Test-Path "F:\\mcp-brunella-core\\n8n\_workflows\\ev\_hunter.json"



```



---



\*\*JELENTÉS:\*\*

Ha minden lépés sikeres (zöld), jelezd a felhasználónak, hogy:



1\. A Python környezet KÉSZ.

2\. A teszt script JSON kimenete VALID.

3\. A rendszer készen áll az n8n workflow importálására (`http://localhost:5678`).



```



---



\### 👨‍💻 Mit csinálj TE ezután (User Manual):



Amint az ügynök visszaigazolta, hogy a fenti parancsok lefutottak:



1\.  Nyisd meg a böngészőben: `http://localhost:5678`

2\.  Kattints: \*\*Menu (jobb fent) -> Import from File\*\*.

3\.  Válaszd ki: `F:\\mcp-brunella-core\\n8n\_workflows\\ev\_hunter.json`

4\.  Nyomj egy \*\*Execute Workflow\*\*-t (vagy teszteld a Python node-ot).



&nbsp;🚀



```







