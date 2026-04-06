# Specifikáció: Agent Runtime Hardening

## 🎯 Cél
A Brunella runtime kapjon egy explicit, visszakövethető micro-iterációs működési réteget és strukturált kontextuskezelést, hogy a multi-agent rendszer ne csak retry-oljon, hanem láthatóan gondolkodjon, megfigyeljen és szükség esetén újratervezzen.

## 🔴 Kezelt fájdalompontok

### 1. Explicit ReAct ciklus hiánya
- Kell egy újrafelhasználható scratchpad / ReAct loop modul.
- A fő orchestratornak dokumentálnia kell a thought → action → observation lépéseket.

### 2. Strukturálatlan working memory
- A session-szintű rövid távú memória ne csak nyers üzenetlista legyen.
- Kell gördülő összefoglalás, releváns tool observation lista és strukturált kontextusformátum.

### 3. Osztályozatlan tool-hibák
- A tool hibákat meg kell különböztetni (retryable, rate limited, auth, bad input, not found, policy blocked).
- A retry/megfigyelési logika ne kezeljen minden hibát egyformán.

### 4. Csak formai guardrails
- A meglévő séma-validáció és redakció mellé tartalom-szintű gyorskritika kell.
- A guardrails statisztika kapjon tényleges runtime hívási pontokat.

## ✅ Elvárt állapot
- Új `reactLoop.ts` scratchpad-modul működik és az Orchestrator használja.
- Új `workingMemory.ts` strukturált session memory snapshotot ad.
- Új `toolErrorClassifier.ts` egységes hibaosztályozást ad.
- Új `outputGuard.ts` összefogja a validation + critic quick review + redaction lépéseket.
- A `BaseAgent` és az `OrchestratorAgent` is használja a guardrails kimeneti védelmét.
- A változásokat conductor track dokumentálja és tesztek védik.# Specifikáció: Agent Runtime Hardening

## 🎯 Cél
A Brunella runtime kapjon egy explicit, visszakövethető micro-iterációs működési réteget és strukturált kontextuskezelést, hogy a multi-agent rendszer ne csak retry-oljon, hanem láthatóan gondolkodjon, megfigyeljen és szükség esetén újratervezzen.

## 🔴 Kezelt fájdalompontok

### 1. Explicit ReAct ciklus hiánya
- Kell egy újrafelhasználható scratchpad / ReAct loop modul.
- A fő orchestratornak dokumentálnia kell a thought → action → observation lépéseket.

### 2. Strukturálatlan working memory
- A session-szintű rövid távú memória ne csak nyers üzenetlista legyen.
- Kell gördülő összefoglalás, releváns tool observation lista és strukturált kontextusformátum.

### 3. Osztályozatlan tool-hibák
- A tool hibákat meg kell különböztetni (retryable, rate limited, auth, bad input, not found, policy blocked).
- A retry/megfigyelési logika ne kezeljen minden hibát egyformán.

### 4. Csak formai guardrails
- A meglévő séma-validáció és redakció mellé tartalom-szintű gyorskritika kell.
- A guardrails statisztika kapjon tényleges runtime hívási pontokat.

## ✅ Elvárt állapot
- Új `reactLoop.ts` scratchpad-modul működik és az Orchestrator használja.
- Új `workingMemory.ts` strukturált session memory snapshotot ad.
- Új `toolErrorClassifier.ts` egységes hibaosztályozást ad.
- Új `outputGuard.ts` összefogja a validation + critic quick review + redaction lépéseket.
- A `BaseAgent` és az `OrchestratorAgent` is használja a guardrails kimeneti védelmét.
- A változásokat conductor track dokumentálja és tesztek védik.