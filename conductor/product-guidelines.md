# Product Guidelines - MCP Brunella Core

## Communication Style
- **Tone:** Asszisztív és barátságos. A rendszer természetes nyelven kommunikál, segítőkész és a végfelhasználók számára is könnyen értelmezhető válaszokat ad.
- **Error Messages:** Proaktív és transzparens. A hibákat azonnal és jól láthatóan jelzi, részletes információkkal és lehetséges megoldási javaslatokkal szolgál.

## Visual & Interaction Design
- **Theme:** Modern és reszponzív (Material Design / Radix UI alapokon). Letisztult elrendezés, sötét mód támogatás és sima animációk jellemzik.
- **Interactions:** Kártya-alapú UI, ahol a fontos események és státuszok vizuális visszajelzést kapnak.

## Technical Standards
- **Type Safety:** Szigorú TypeScript típusok használata és Zod alapú sémavalidáció minden interfészen a hibák minimalizálása érdekében.
- **Architecture:** Magas fokú modularitás. Az üzleti logikát elválasztjuk az MCP specifikus kódoktól, biztosítva a könnyű tesztelhetőséget.
- **Observability:** Átfogó, strukturált (JSON) naplózás minden rendszerműveletről (fájlok, parancsok, kód futtatás).

## Security & Safety
- **Transparency:** Minden biztonsági esemény és kritikus hiba azonnal látható a Dashboardon.
- **Logging:** Minden kritikus művelet visszakövethető a `logs/` könyvtárban található naplófájlokból.