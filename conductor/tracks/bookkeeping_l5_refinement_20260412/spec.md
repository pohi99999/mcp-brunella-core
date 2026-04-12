# Spec — Könyvelési Automatizálás L5 Finomítás

## Célkitűzés
A meglévő NAV és Számlázz.hu API integrációk stabilizálása, az automata IMAP-alapú számlabefogadás élesítése, és a hibakezelési mechanizmusok (Human-in-Loop visszacsatolás) tökéletesítése.

## Főbb követelmények
1. **IMAP Automata Pipeline:** A `gmailInvoiceFetcher.ts` élesítése és összekötése az n8n workflow-val.
2. **Intelligens Hibakezelés:** Ha a Számlázz.hu vagy a NAV hibaüzenetet küld (pl. érvénytelen adószám), az ágens küldjön konkrét javítási javaslatot Telegramon/Emailben.
3. **Dashboard Monitoring:** Valós idejű statisztikák a sikeres/sikertelen számlázásokról.
4. **Idempotencia:** Garantálni, hogy egy számla soha ne kerüljön kétszer beküldésre (NAV cross-check alapú védelem).
