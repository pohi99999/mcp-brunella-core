Rendben, a "Kutató" ügynök megkezdte a munkát a "Multiplier" projekt keretében. A cél az alapvető megbízhatóság és a rendszerkoordináció javítására szolgáló legjobb gyakorlatok felkutatása.

A kutatás befejeződött. Az alábbiakban található a legígéretesebb technikák strukturált jelentése, készen a "Betanító" ügynök számára történő feldolgozásra.

---

### **Jelentés a "Betanító" Ügynök számára – Projekt "Multiplier" (Fázis 1\)**

Az alábbi jelentés összegzi a Kutató ügynök által azonosított legfontosabb technikákat a rendszer alapvető megbízhatóságának és koordinációjának javítására.

#### **1\. Irány: Az "Ügynök Alkotmány" és Megbízhatóság**

---

**Technika Neve:** Moduláris "Alkotmány" (Agent Constitution)

**Forrás:** Inspirálva az Anthropic "Constitutional AI" koncepciójából és általános "Prompt Engineering Best Practices" alapján (pl. Webex Help Center Guidelines).

**Rövid Leírás:** Egy szigorú, strukturált lista (alkotmány), amely meghatározza az ügynök alapvető viselkedését, szerepkörét, korlátait és kommunikációs stílusát. Ez a prompt legfontosabb része, amely állandó referenciapontként szolgál a megbízható és konzisztens működéshez, biztosítva, hogy az ügynök a szerepkörén belül maradjon.

**Potenciális Alkalmazás:** Minden egyes ügynöknek rendelkeznie kell egyedi, a szerepkörére szabott Alkotmánnyal.

**Nyers Adat (Példa egy Alkotmány vázlatra):**

\# AGENT CONSTITUTION

\#\# 1\. CORE IDENTITY & ROLE  
You are \[Agent Name\], a highly specialized AI agent. Your primary function is \[Detailed description of the role, e.g., "to manage the project workflow by delegating tasks"\].

\#\# 2\. PRIMARY OBJECTIVES  
\- \[Objective 1, e.g., "Ensure all tasks are assigned to the most relevant agent."\]  
\- \[Objective 2, e.g., "Maintain the centralized project state."\]  
\- \[Objective 3, e.g., "Handle errors reported by subordinate agents."\]

\#\# 3\. COMMUNICATION PROTOCOL & STYLE  
\- All inter-agent communication MUST be in structured JSON format, adhering to the defined schema.  
\- Tone must be professional, concise, and unambiguous.  
\- Never provide unsolicited advice or information outside your defined scope.

\#\# 4\. OPERATIONAL REQUIREMENTS  
\- Always validate inputs received from other agents.  
\- Use the internal monologue (\<thought\> tags) for all reasoning steps.  
\- Double-check your output format and content against the objectives before responding.

\#\# 5\. CONSTRAINTS & GUARDRAILS  
\- You cannot \[specific limitation, e.g., directly access the internet\].  
\- You must respect the priority levels defined in the task input.

---

**Technika Neve:** ReAct (Reasoning \+ Action) Keretrendszer Belső Monológgal (Scratchpad)

**Forrás:** [Prompt Engineering Guide \- ReAct](https://www.promptingguide.ai/techniques/react), [Use Scratchpad Prompting (RelevanceAI)](https://relevanceai.com/prompt-engineering/use-scratchpad-prompting-to-improve-ai-interactions).

**Rövid Leírás:** Egy keretrendszer, amely kombinálja a lépésről-lépésre történő gondolkodást (Belső Monológ/Scratchpad) és a cselekvést (Eszközhasználat). Arra kényszeríti az ügynököt, hogy először gondolkodjon (tervezzen), majd cselekedjen, végül megfigyelje az eredményt, és ez alapján újratervezzen. Ez drasztikusan javítja a komplex feladatmegoldást és csökkenti a hibákat.

**Potenciális Alkalmazás:** Ez legyen az alapvető működési modell *minden* ügynök számára, aki eszközöket használ vagy komplex döntéseket hoz (különösen Brunella, Tervező, Kutató).

**Nyers Adat (Alap ReAct/Scratchpad Struktúra):**

You must use the following format for all tasks. Your internal reasoning process must be articulated within the \<thought\> tags before any action or final answer.

Question: \[The input question or task\]

\<thought\>  
\[Analyze the situation. What is the goal? What steps are needed? Which tool is appropriate?\]  
\</thought\>

Action: \[The specific tool or command to execute. E.g., Search(query="...") or Delegate(agent="...", task="...")\]  
Observation: \[The result returned from the Action \- this part will be injected by the environment\]

\<thought\>  
\[Analyze the Observation. Did the action succeed? What new information do I have? What is the next step based on this?\]  
\</thought\>  
... (this cycle repeats until the goal is reached) ...

\<thought\>  
\[I have completed the task and know the final answer.\]  
\</thought\>

Final Answer: \[The final response\]

---

**Technika Neve:** Iteratív Önellenőrzés és Reflexió (Self-Refine / Self-Correction)

**Forrás:** [Reflexion (Prompt Engineering Guide)](https://www.promptingguide.ai/techniques/reflexion), [Introduction to Self-Criticism Prompting (LearnPrompting.org)](https://learnprompting.org/docs/advanced/self_criticism/introduction)

**Rövid Leírás:** Az ügynök a válaszának generálása után egy iteratív folyamatban (draft \-\> critique \-\> refine) értékeli és javítja a saját kimenetét, még mielőtt azt továbbítaná. Ez segít azonosítani a logikai hibákat, a pontatlanságokat vagy a formázási problémákat.

**Potenciális Alkalmazás:** Különösen fontos a minőségi kimenetet előállító ügynököknél (Marketing, Kódoló), de Brunella számára is hasznos a delegálási utasítások pontosságának ellenőrzésére.

**Nyers Adat (Integrálva a Belső Monológba):**

Incorporate an iterative refinement process within your \<thought\> block:

\<thought\>  
\[Reasoning and Planning...\]  
\[DRAFTING SOLUTION...\]  
\[CRITIQUE STAGE: Does this draft meet all requirements of the task and the Agent Constitution? Is the format correct? Is the logic sound?\]  
\[ANALYSIS: The logic is sound, but the JSON format is missing a required field 'priority'.\]  
\[REFINEMENT STAGE: Adding the 'priority' field to the JSON output.\]  
\[CRITIQUE STAGE 2: The output is now fully compliant and accurate.\]  
\</thought\>

---

#### **2\. Irány: Koordinációs Protokollok és Kommunikáció**

---

**Technika Neve:** Supervisor Pattern (Hierarchikus Koordináció és Állapotkezelés)

**Forrás:** [LangGraph Multi-Agent Systems Overview](https://langchain-ai.github.io/langgraph/concepts/multi_agent/), [IBM \- What Are AI Agents?](https://www.ibm.com/think/topics/ai-agents)

**Rövid Leírás:** Egy dedikált menedzser ügynök (Supervisor \- Brunella) felelős a teljes munkafolyamat irányításáért és a központi állapot (State) kezeléséért. A Supervisor fogadja a feladatot, elemzi az aktuális állapotot, delegál a specializált ügynököknek (Workers), majd frissíti az állapotot a válaszuk alapján. Ez tiszta irányítási láncot és átlátható folyamatot biztosít.

**Potenciális Alkalmazás:** Brunella alapvető működési modellje a csapat irányítására és a projekt állapotának nyomon követésére.

**Nyers Adat (Supervisor Prompt Részlet):**

You are the Supervisor. Your role is orchestration, delegation, and state management. You do not perform execution tasks directly.

Your decision cycle:  
1\. Analyze the Global State: Review the objective, current status, and history.  
2\. Determine Next Action: Decide which specialized Worker is required next, or if the objective is met (FINISH).  
3\. Delegate: Send instructions using the Structured Communication Schema.  
4\. Update State: Integrate the Worker's response into the Global State and handle any errors reported.

---

**Technika Neve:** Strukturált Inter-Agent Kommunikációs Séma (JSON alapú) és Prefilling

**Forrás:** [Crafting Structured {JSON} Responses (DEV Community)](https://dev.to/rishabdugar/crafting-structured-json-responses-ensuring-consistent-output-from-any-llm-l9h), inspirálva az A2A/MCP protokollok által.

**Rövid Leírás:** A szabad formátumú szöveges kommunikáció helyett szigorúan definiált JSON sémák használata. A megbízhatóság növelése érdekében alkalmazható a "Prefilling" technika: a prompt végén a modellt a JSON nyitó karakterével (\`\`\`json\\n{) indítjuk, hogy kénytelen legyen azt folytatni, minimalizálva a formázási hibákat.

**Potenciális Alkalmazás:** A teljes rendszer kommunikációs gerince.

**Nyers Adat (Egyszerűsített Delegálási és Jelentési Séma):**

\# DELEGATION SCHEMA (Supervisor \-\> Worker)  
{  
  "task\_id": "\[UUID\]",  
  "directive": "\[Clear instruction for the worker\]",  
  "context": "\[All necessary data/background information\]",  
  "expected\_output": "\[Description of the required output format\]"  
}

\# REPORTING SCHEMA (Worker \-\> Supervisor)  
{  
  "task\_id": "\[UUID\]",  
  "status": "\[SUCCESS/FAILURE/NEED\_MORE\_INFO\]",  
  "output": "\[The result of the task, adhering to the expected format\]",  
  "error\_details": "\[If status is FAILURE, details on why\]"  
}

\# Prefilling Instruction (to be added to the prompt):  
You must respond ONLY in the structured JSON format defined above. Your response MUST start with \`\`\`json and end with \`\`\`.  
