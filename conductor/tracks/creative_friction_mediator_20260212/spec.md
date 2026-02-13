\# Track: Creative Friction Mediator (The Vibe-Check)



\*\*Dátum:\*\* 2026-02-12

\*\*Prioritás:\*\* LOW (Experimental)

\*\*Status:\*\* PROPOSED



\## 🎯 Célkitűzés

Egy LangFlow alapú "Soft-Skill AI" létrehozása, amely a szervezeti kommunikációt (Slack/Email) elemzi rejtett konfliktusok (passzív-agresszió, késés, hangnemváltás) után kutatva. Célja a mediáció, nem a megfigyelés.



\## 🛠️ Érintett Fájlok

\- `data/grant\_blueprints/creative\_friction\_protocol.json` (LangFlow Blueprint)

\- `src/agents/MediatorAgent.ts` (Ha dedikált ágensként fut)

\- `data/vibe\_check.db` (LanceDB a mintákhoz)



\## 📅 Megvalósítási Terv (Phases)



\### Phase 1: Sentiment Decomposition (Az Elemző)

Nem csak a "mit", hanem a "hogyan"-t elemzi.



1\.  \*\*Input Stream:\*\*

&nbsp;   - Webhook fogadó (Slack/Discord szimuláció).

&nbsp;   - Anonimizáló réteg (GDPR!).

2\.  \*\*LLM Chain:\*\*

&nbsp;   - Modell: Llama 3.2 vagy GPT-4o.

&nbsp;   - Prompt: Keressen passzív-agresszív mintákat, késést, rövidséget. Output: "Friction Score" (0-10).



\### Phase 2: Graph Analysis (A Hálózat)

A kapcsolatok és feszültségek térképezése.



1\.  \*\*Vector Memory:\*\*

&nbsp;   - LanceDB használata a kommunikációs minták ("Vibe") tárolására.

&nbsp;   - Eltérés detektálása a megszokottól (pl. hirtelen formális hangnem).



\### Phase 3: Intervention (A Diplomata)

Beavatkozás vádaskodás nélkül.



1\.  \*\*Logic Gate:\*\*

&nbsp;   - Ha a Friction Score > 7.5 -> Trigger.

2\.  \*\*Advice Generator:\*\*

&nbsp;   - Privát üzenet generálása a Projektmenedzsernek.

&nbsp;   - Javaslat: "Hívd össze őket egy 5 perces sync-re, mert írásban elbeszélnek egymás mellett."



\## ✅ Definition of Done

\- \[ ] A LangFlow gráf összeállt és importálható.

\- \[ ] A rendszer képes detektálni a "passzív-agresszív" hangnemet egy teszt üzenetváltásban.

\- \[ ] A kimenet egy konstruktív, mediációt segítő javaslat.

