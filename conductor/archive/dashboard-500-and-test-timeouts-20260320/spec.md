# Spec: Dashboard 500 + Teszt Stabilitás (2026-03-20)

## Track ID
`dashboard-500-and-test-timeouts-20260320`

## Cél
1. A dashboardon jelentkező `Tasks HTTP 500` és `Stats fetch failed: 500` hibák reprodukálása és javítása.
2. Az 5 bukó teszt gyökérokának feltárása és javítása úgy, hogy legalább célzott futtatásban PASS legyenek.

## Érintett hibák
- `ironCladBackend.test.ts` (timeout)
- `marketIntelAgent.test.ts` (timeout)
- `n8n_automation.test.ts` (401 unauthorized)
- `salesHunterAgent.test.ts` (timeout)
- `SpecWriterAgent.test.ts` (timeout)

## Elfogadási kritériumok
- Dashboard endpointok ne adjanak 500-at normál helyi fejlesztői környezetben.
- A fenti tesztek determinisztikusan fussanak (vagy environment-gated skip, ha külső dependency).
- `npm run build` sikeres.
- Célzott tesztfuttatás sikeres a javított területeken.
