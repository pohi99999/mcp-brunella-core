

## **Kutató Ügynök Jelentése: Projekt "Multiplier"**

Dátum: 2025\. augusztus 25\.  
Jelentés Azonosító: KP-20250825-01  
Státusz: Befejezett

### **Bevezetés**

Ez a jelentés a "Multiplier" projekt keretében végzett kutatás eredményeit foglalja össze. A cél az ügynöki rendszerek megbízhatóságának és koordinációs képességeinek növelése volt, különös tekintettel a "Brunella" menedzser ügynök optimalizálására. A kutatás két fő irány mentén haladt: az ügynökök belső működésének stabilizálása ("Ügynök Alkotmány") és az ügynökök közötti kommunikáció és együttműködés fejlesztése ("Koordinációs Protokollok").

---

### **1\. Irány: Az "Ügynök Alkotmány" és Megbízhatóság Mesterfogásai**

Ez a szekció az ügynökök alapvető működési elveit, gondolkodási folyamatait és önellenőrzési mechanizmusait célozza, hogy a kimenetük pontosabb, megbízhatóbb és jobban strukturált legyen.

#### **1.1. Technika: ReAct Keretrendszer (Reasoning \+ Acting)**

* **Forrás:** [ReAct \- Prompt Engineering Guide](https://www.promptingguide.ai/techniques/react)  
* **Rövid Leírás:** A ReAct egy olyan promptolási technika, amely az LLM-eket arra ösztönzi, hogy a feladatmegoldás során szisztematikusan váltogassanak a **gondolkodás** (a helyzet elemzése, terv készítése) és a **cselekvés** (eszközök, pl. keresés használata) között. A modell minden lépésben egy Thought, Action, Observation (Gondolat, Cselekvés, Megfigyelés) ciklust követ, ami transzparenssé teszi a döntési folyamatot és javítja a komplex problémamegoldó képességet.  
* **Potenciális Alkalmazás:** Minden olyan ügynök alapvető működési logikájába integrálandó, amelynek külső eszközöket kell használnia. Brunella számára elengedhetetlen a feladatok lebontásához és a megfelelő al-ügynökök delegálásához.  
* **Nyers Adat (Prompt Minta):**  
  Solve a question answering task with interleaving Thought, Action, Observation steps.  
  Thought: The user wants to know X. I need to use a search tool to find the answer.  
  Action: Search\[X\]  
  Observation: The search result for X is Y.  
  Thought: I have the answer.  
  Final Answer: The answer is Y.

  Question: Who is Olivia Wilde's boyfriend? What is his current age raised to the 0.23 power?  
  Thought: I need to find out who Olivia Wilde's boyfriend is and then calculate his age raised to the 0.23 power.  
  Action: Search\[Olivia Wilde boyfriend\]  
  Observation: Olivia Wilde started dating Harry Styles...  
  Thought: I need to find out Harry Styles' age.  
  Action: Search\[Harry Styles age\]  
  Observation: 29 years  
  Thought: I need to calculate 29 raised to the 0.23 power.  
  Action: Calculator\[29^0.23\]  
  Observation: 2.169459462491557  
  Thought: I now know the final answer.  
  Final Answer: Harry Styles, Olivia Wilde's boyfriend, is 29 years old and his age raised to the 0.23 power is 2.169459462491557.

#### **1.2. Technika: Belső Monológ / Gondolkodási Puffer (Internal Monologue / Scratchpad)**

* **Forrás:** [Use Scratchpad Prompting to Improve AI Interactions](https://relevanceai.com/prompt-engineering/use-scratchpad-prompting-to-improve-ai-interactions)  
* **Rövid Leírás:** Ez a technika arra utasítja az ügynököt, hogy a végső válasz megfogalmazása előtt egy dedikált, strukturált blokkban (pl. \<thought\> vagy \<scratchpad\> tagek között) vezesse le a teljes gondolatmenetét. Ez a "hangos gondolkodás" lehetővé teszi a modell számára, hogy lépésről lépésre haladjon, felismerje a saját logikai hibáit, és korrigálja azokat, mielőtt a végleges kimenetet előállítaná. Drasztikusan csökkenti a hibák számát komplex, többlépéses feladatoknál.  
* **Potenciális Alkalmazás:** Minden ügynök alapvető "Alkotmányába" integrálandó. Különösen kritikus a Tervező és a Kutató ügynökök számára, ahol a logikai lánc pontossága kulcsfontosságú. Brunella esetében az átláthatóságot és az auditálhatóságot növeli.  
* **Nyers Adat (Prompt Minta):**  
  You must follow this process:  
  1\. Analyze the input and the goal.  
  2\. Formulate a step-by-step plan.  
  3\. Execute the plan, using tools if necessary.  
  4\. Critically analyze the results and check if the goal is met.  
  5\. Formulate your final answer.

  You MUST output your entire internal reasoning process within \<thought\> tags before providing your Final Answer.

  Example:  
  \`) technikával, hogy a döntéshozatali folyamatuk transzparens és önkorrekciós legyen.

2. **ReAct Implementálása:** Az eszközöket használó ügynököket (különösen a Kutatót) át kell állítani a **ReAct** (Thought/Action/Observation) ciklusra a robusztusabb működés érdekében.  
3. **JSON Sémák Bevezetése:** Az ügynökök közötti minden kommunikációt (delegálás, jelentés) át kell állítani **szigorúan validált JSON sémákra**.  
4. **Állapot-központú Orchestráció:** El kell kezdeni a Brunella menedzser logikájának átalakítását egy **LangGraph-alapú állapotkezelő rendszerre**, amely a fentebb vázolt központi állapot objektumot menedzseli.

Ezek a technikák együttesen egy sokkal megbízhatóbb, skálázhatóbb és hatékonyabb multi-ügynök rendszert eredményeznek, amely képes komplex, hosszú távú projektek sikeres menedzselésére.

**Jelentést készítette:** Kutató Ügynök