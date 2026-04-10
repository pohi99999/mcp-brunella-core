# Specifikáció: Swarm Orchestration Chat (ClawSwarm)

## Háttér
A `ClawSwarm` kutatás (2026-04-09.md) egy olyan hangszerelési modellt javasol, ahol az ügynökök egy közös csoportos csevegésben ("unified group chat") működnek együtt. A BAS jelenleg főleg hierarchikus (Orchestrator -> Agent) vagy DAG alapú delegálást használ. A raj intelligencia (swarm intelligence) bevezetése lehetővé tenné az ügynökök közötti közvetlen interakciót és konszenzus-alapú döntéshozatalt.

## Célkitűzés
Egy "Raj Hangszerelő" (`SwarmOrchestrator`) modul kialakítása, amely lehetővé teszi 3-5 speciális ügynök számára, hogy egyetlen megosztott kontextusban dolgozzanak egy komplex feladaton, minimalizálva a központi orchestrátor terhelését.

## Követelmények
1. **Swarm Manager:** Egy új `SwarmManager` osztály létrehozása a `src/core/` alatt, amely kezeli az ügynökök közötti üzenetváltásokat és a megosztott memóriát.
2. **Group Chat Protocol:** Definiálni egy protokollt, amellyel az ügynökök "megszólíthatják" egymást a kontextuson belül (pl. `@DeveloperAgent: Kérlek nézd meg ezt a hibát`).
3. **Consensus Engine:** Egy egyszerű mechanizmus, amellyel a raj eldönti, mikor készült el a feladat, vagy mikor kell visszaadni az irányítást a fő Orchestrátornak.
4. **AgentGraph Frissítés:** A Dashboard-on vizualizálni kell a raj-alakzatokat (ügynökök közötti pókháló-szerű kapcsolatok a hierarchia helyett).

## Sikerességi Kritériumok
- Komplex, kereszt-funkcionális feladatok (pl. "Tervezz meg és implementálj egy új API-t dokumentációval együtt") sikeres végrehajtása raj üzemmódban.
- Az ügynökök közötti üzenetváltások száma legalább 3 körös iterációt tesz lehetővé emberi beavatkozás nélkül.
- Dashboard vizualizáció kész.