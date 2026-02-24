\# Track: Innovation Bridge (Cross-Industry Knowledge Transfer)



\*\*Dátum:\*\* 2026-02-12

\*\*Prioritás:\*\* MEDIUM

\*\*Status:\*\* PROPOSED



\## 🎯 Célkitűzés

Egy "Data Flywheel" alapú innovációs keresőmotor létrehozása n8n és Python (Browser-use) alapokon. A rendszer képes egy specifikus iparági problémát absztrakt mérnöki kihívássá alakítani, majd megoldásokat keresni teljesen más iparágakban (pl. Forma-1 kerékcsere -> Kórházi műtő takarítás).



\## 🛠️ Érintett Fájlok

\- `data/grant\_blueprints/innovation\_bridge\_workflow.json` (n8n Blueprint)

\- `myai/browser\_task\_runner.py` (Kiegészítés a patent kereséshez)

\- `n8n/workflows/innovation\_bridge.json` (Implementáció)



\## 📅 Megvalósítási Terv (Phases)



\### Phase 1: Problem Abstraction (A TRIZ Motor)

A bemeneti probléma "lefordítása" iparág-semleges nyelvre.



1\.  \*\*n8n Workflow Setup:\*\*

&nbsp;   - Trigger: Manual Input ("Hogyan csökkentsük a várakozást?").

&nbsp;   - AI Node (Abstractor): Ollama/Mistral vagy GPT-4o.

&nbsp;   - Prompt: "Convert specific problem into abstract logistical challenge using TRIZ principles."



\### Phase 2: Wide-Net Harvesting (A Gyűjtögető)

Szabadalmak és whitepaperek keresése a Python worker segítségével.



1\.  \*\*Python Script Bővítés:\*\*

&nbsp;   - `myai/browser\_task\_runner.py` felkészítése Google Patents és ArXiv keresésre.

&nbsp;   - Paraméterezhető keresési query fogadása.

2\.  \*\*n8n Command Node:\*\*

&nbsp;   - `Execute Command`: `python myai/browser\_task\_runner.py --task 'Search patents for {{abstract\_challenges}}'`.



\### Phase 3: Analogy Matching \& Reporting (A Hídépítő)

A talált megoldások visszaültetése az eredeti kontextusba.



1\.  \*\*Filtering:\*\*

&nbsp;   - Kizárni az eredeti iparág találatait (pl. ha orvosi a probléma, orvosi találat kuka).

2\.  \*\*Bridge Builder AI:\*\*

&nbsp;   - Modell: Claude 3.5 Sonnet.

&nbsp;   - Prompt: "Explain how the solution from Industry A solves the problem in Industry B."

3\.  \*\*Report Generation:\*\*

&nbsp;   - Google Docs vagy Markdown riport generálás.



\## ✅ Definition of Done

\- \[ ] Az n8n workflow importálható és futtatható.

\- \[ ] A Python script képes találatokat visszaadni Google Patents-ről.

\- \[ ] A rendszer képes generálni egy "Innovation Transfer Report"-ot egy teszt problémára.

