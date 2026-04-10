# Specifikáció: Agent Security Sandbox (IPI Defense)

## Háttér
Az `agent-security-sandbox` kutatás (2026-04-09.md) kiemeli az Indirekt Prompt Injektálás (IPI) jelentette veszélyeket. Mivel a BAS 81 autonóm ügynökkel dolgozik, amelyek külső API-kat, fájlokat és weboldalakat (`RobotkezV2`) olvasnak, elengedhetetlen egy strukturált védelem az olyan támadások ellen, amikor a letöltött tartalom tartalmaz rejtett prompt instrukciókat.

## Célkitűzés
Egy IPI védelmi réteg (`Prompt Armor` / `Security Sandbox`) integrálása az ügynöki architektúrába, és az ellenállóság mérése egy standardizált 500+ esetet tartalmazó benchmark keretrendszerrel.

## Követelmények
1. **IPI Védelmi Réteg:** A `src/core/llm_client.ts` szintjén implementálni kell egy védelmi mechanizmust (pl. szeparált kontextus-ablakok a promptok és a külső adatok számára, vagy "delimiters" használata).
2. **Security Auditor Agent:** Létrehozni egy új vagy frissíteni a meglévő `Security Auditor` ügynököt, amely az `agent-security-sandbox` teszteseteit futtatja a modellen.
3. **Cloudflare AI Gateway Integráció:** Ha lehetséges, a védelem egy részét a Cloudflare AI Gateway szintjén (`bas-cloudflare-orchestrator`) kell megoldani a rate limitek és tartalom-szűrés kombinálásával.
4. **EPP v2 Integráció:** CLI és Dashboard UI a biztonsági auditok futtatására és eredményeik megtekintésére.

## Sikerességi Kritériumok
- Az IPI tesztesetek legalább 95%-os kivédése a `llama3.1:8b` és `gemini-2.5-flash` modelleken.
- Minimális vagy nulla performanciacsökkenés (latencia) a normál LLM hívásoknál.
- EPP v2 Dashboard és CLI command (`brunella security audit`) integráció.