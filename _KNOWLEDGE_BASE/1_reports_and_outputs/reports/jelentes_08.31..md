

# **Kutató Ügynök Jelentése: Projekt "Multiplier"**

Dátum: 2025\. Augusztus 31\.  
Fókusz: Rendszer megbízhatóság és ügynök-koordináció javítása.

## **1\. Irány:** 

## **2025.08.31.**

Az ügynökök alapvető működési megbízhatóságának növelése érdekében a legújabb és leghatékonyabb technika a **ReAct (Reasoning \+ Acting)** keretrendszer, amely a "Belső Monológ" (Internal Monologue) vagy "Gondolkodási Puffer" (Thought Buffer) technikával van ötvözve.

---

**Technika Neve:** Belső Monológ / Gondolkodási Puffer (Internal Monologue / Thought Buffer) a ReAct Keretrendszerben

**Forrás:** [ReAct: Synergizing Reasoning and Acting in Language Models](https://www.promptingguide.ai/techniques/react)

**Rövid Leírás:** Ez a technika arra utasítja az ügynököt, hogy a végső válasz megadása előtt egy külön \` tags before providing your Final Answer.

\---

\#\# 2\. Irány: Koordinációs Protokollok és Kommunikáció (Brunella Optimalizálása)

A menedzser ügynök (Brunella) és a többi ügynök közötti kommunikáció optimalizálására a legmegbízhatóbb módszer a \*\*Strukturált, JSON-séma alapú Kommunikációs Protokollok\*\* bevezetése. Ez a megközelítés felváltja a szabad szöveges, félreérthető üzeneteket egy szigorú, gép által is értelmezhető formátummal.

\---

\*\*Technika Neve:\*\* Strukturált Kommunikációs Sémák (Structured Communication Schemas)

\*\*Forrás:\*\* \[Inter-agent communication protocols JSON schema\](https://research.aimultiple.com/agent-communication-protocol/)

\*\*Rövid Leírás:\*\* Ahelyett, hogy az ügynökök (pl. Brunella) természetes nyelven, kötetlenül delegálnának feladatokat, egy előre definiált JSON séma szerint kommunikálnak. Ez a séma pontosan meghatározza, hogy egy feladat delegálásakor milyen információkat kell átadni (pl. \`task\_id\`, \`agent\_role\`, \`goal\`, \`inputs\`, \`expected\_output\_format\`). A válaszok és a státuszjelentések is ugyanezen a strukturált módon történnek.

\*\*Potenciális Alkalmazás:\*\* Brunella delegálási munkafolyamataiban kötelezővé kell tenni. Ez biztosítja, hogy a feladatok mindig egyértelműek, a kontextus nem veszik el, és a várt kimenet formátuma kristálytiszta. Jelentősen növeli a rendszer megbízhatóságát, megkönnyíti az állapotkövetést (state management) és az automatizált hibakezelést. A \`CrewAI\` és \`LangGraph\` keretrendszerek is hasonló, formalizált kommunikációs mintákra épülnek a megbízhatóság érdekében.

\*\*Nyers Adat (Példa JSON Séma a Feladatdelegáláshoz):\*\*  
\`\`\`json  
{  
  "$schema": "http://json-schema.org/draft-07/schema\#",  
  "title": "Agent Task Delegation",  
  "description": "Schema for a supervisor agent to delegate a task to a worker agent.",  
  "type": "object",  
  "properties": {  
    "taskId": {  
      "type": "string",  
      "description": "Unique identifier for the task."  
    },  
    "assignee": {  
      "type": "object",  
      "properties": {  
        "agentId": {  
          "type": "string"  
        },  
        "role": {  
          "type": "string",  
          "description": "The designated role for the agent."  
        }  
      },  
      "required": \["agentId", "role"\]  
    },  
    "task": {  
        "type": "object",  
        "properties": {  
            "goal": {  
                "type": "string",  
                "description": "The final objective of the task."  
            },  
            "instructions": {  
                "type": "string",  
                "description": "Detailed step-by-step instructions for the agent."  
            },  
            "required\_tools": {  
                "type": "array",  
                "items": {  
                    "type": "string"  
                }  
            }  
        },  
        "required": \["goal", "instructions"\]  
    },  
    "expectedOutput": {  
      "type": "object",  
      "properties": {  
        "format": {  
          "type": "string",  
          "enum": \["json", "text", "markdown"\]  
        },  
        "schema": {  
          "type": "object",  
          "description": "JSON schema for the expected output, if format is json."  
        }  
      },  
      "required": \["format"\]  
    }  
  },  
  "required": \["taskId", "assignee", "task", "expectedOutput"\]  
}  
