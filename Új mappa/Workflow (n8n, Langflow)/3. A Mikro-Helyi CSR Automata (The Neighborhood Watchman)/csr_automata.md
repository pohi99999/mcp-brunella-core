3\. A "Mikro-Helyi" CSR Automata (The Neighborhood Watchman)

Technológia: Hibrid (Browser-Use Python Script + n8n). Filozófia: "Pohi AI Pro" logisztika, jótékony célra fordítva.

A Folyamat (Logic Flow):

1\. Geo-Fenced Harvesting: A Robotkéz (Browser-use) specifikusan a cég 5km-es körzetére szűrt Google News, Facebook Csoportok ("Minden ami \[Kerület neve]") és helyi önkormányzati híreket figyeli.

2\. Inventory Check: A rendszernek van olvasási joga a cég ERP/Raktárkészletéhez (vagy egy egyszerű Google Sheet-hez a "felesleggel").

3\. Matchmaking: Ha a hírekben "kutyatáp hiány" van a menhelyen, és a cég (pl. étterem) "maradék húst" jelzett, vagy a cég (IT) "leselejtezett laptopot", az egyezés létrejön.

4\. Logistics \& PR: Az n8n legenerálja a szállítólevelet (Pohi AI logika) és megírja a sajtóközlemény piszkozatát / LinkedIn posztot a sikeres adományozásról.

JSON Blueprint (n8n + Python integráció):



{

  "name": "Micro\_CSR\_Automator",

  "nodes": \[

    {

      "name": "Schedule\_Trigger",

      "type": "n8n-nodes-base.cron",

      "parameters": { "triggerTimes": "Every morning at 8am" }

    },

    {

      "name": "Local\_News\_Harvester",

      "type": "n8n-nodes-base.executeCommand",

      "parameters": {

        "command": "python myai/browser\_task\_runner.py --task 'Scan Facebook Groups and Local News in 5km radius for keywords: need, donation, help, shortage'"

      }

    },

    {

      "name": "Internal\_Inventory\_Check",

      "type": "n8n-nodes-base.googleSheets",

      "parameters": { "operation": "read", "sheetId": "Company\_Surplus\_Assets" }

    },

    {

      "name": "Matchmaker\_Agent",

      "type": "n8n-nodes-base.aiAgent",

      "parameters": {

        "model": "gemini-1.5-flash",

        "system\_prompt": "Match the 'Local Needs' list with 'Company Surplus' list. Only matches with >90% relevance and logical fit (e.g. dont send raw meat to a school). Output JSON: {match\_found: true, need: '...', asset: '...'}"

      }

    },

    {

      "name": "Logistics\_Planner",

      "type": "n8n-nodes-base.if",

      "parameters": { "conditions": "{{Matchmaker\_Agent.match\_found}} == true" }

    },

    {

      "name": "Email\_Offer",

      "type": "n8n-nodes-base.gmail",

      "parameters": {

        "to": "{{Local\_Need\_Contact}}",

        "subject": "Felajánlás: {{Company\_Name}} segíteni szeretne",

        "body": "Generált kedves, helyi hangvételű levél..."

      }

    },

    {

      "name": "PR\_Draft\_Generator",

      "type": "n8n-nodes-base.aiAgent",

      "parameters": {

        "system\_prompt": "Write a humble LinkedIn post about this donation emphasizing community support."

      }

    }

  ]

}



---------------------------------------



📄 3. Blueprint: "Mikro-Helyi" CSR Automata (Hybrid MCP)

Ez a legerősebb társadalmi hatás (Social Impact) érv. A fizikai és digitális világ összekötése.

Fájlnév: data/grant\_blueprints/csr\_neighbor\_watch.json

{

&nbsp; "name": "Micro-Local CSR Automator",

&nbsp; "architecture": "Hybrid (Python MCP + n8n)",

&nbsp; "steps": \[

&nbsp;   {

&nbsp;     "step": 1,

&nbsp;     "agent": "Geo-Fenced Harvester",

&nbsp;     "action": "Scan local news",

&nbsp;     "config": {

&nbsp;       "radius": "5km",

&nbsp;       "sources": \["District Facebook Groups", "Local Council RSS", "Nextdoor"],

&nbsp;       "keywords": \["need help", "donation", "shortage", "volunteer"]

&nbsp;     }

&nbsp;   },

&nbsp;   {

&nbsp;     "step": 2,

&nbsp;     "agent": "Internal Inventory Auditor",

&nbsp;     "action": "Check surplus assets",

&nbsp;     "database": "ERP\_SQL\_Interface",

&nbsp;     "query": "SELECT \* FROM assets WHERE status = 'surplus' OR expiry\_date < DATE('now', '+7 days')"

&nbsp;   },

&nbsp;   {

&nbsp;     "step": 3,

&nbsp;     "agent": "Matchmaker (Gemini 1.5)",

&nbsp;     "action": "Semantic Matching",

&nbsp;     "logic": "Match 'Local Need' (e.g., School needs laptops) with 'Surplus Asset' (e.g., Old ThinkPads). Filter for Safety \& Compliance."

&nbsp;   },

&nbsp;   {

&nbsp;     "step": 4,

&nbsp;     "agent": "Logistics Planner (Pohi AI)",

&nbsp;     "action": "Generate Transport Order",

&nbsp;     "output": {

&nbsp;       "pickup": "Company HQ",

&nbsp;       "dropoff": "{{Local\_Entity\_Address}}",

&nbsp;       "cargo": "{{Matched\_Items}}"

&nbsp;     }

&nbsp;   },

&nbsp;   {

&nbsp;     "step": 5,

&nbsp;     "agent": "PR Communicator",

&nbsp;     "action": "Draft Communication",

&nbsp;     "output": "Draft email to NGO + Internal Newsletter entry."

&nbsp;   }

&nbsp; ]

}



