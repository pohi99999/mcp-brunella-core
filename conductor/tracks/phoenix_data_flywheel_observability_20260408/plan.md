# Implementacios Terv: Phoenix + Data Flywheel Observability & Self-Healing

## Cel
A Phoenix Protocol, a Data Flywheel es a learning pipeline metrikait egyetlen megfigyelhetosegi retegre kell hozni, hogy a gyakori hibak, retry mintak es adatminosegi trendek azonnal lathatok legyenek.

## Kiindulasi alap
- `src/core/phoenixEventBus.ts`
- `src/core/checkpoint.ts`
- `src/core/goldenDatasetBridge.ts`
- `src/core/telemetry.ts`
- `src/core/metricsArchiveService.ts`
- `src/dashboard/components/dashboard/PhoenixPanel.tsx`
- `src/dashboard/components/dashboard/PhoenixEventsPanel.tsx`
- `src/dashboard/components/dashboard/RemediationRunsPanel.tsx`

## Fazisok
### 1. Metric alapok
- Phoenix failure es retry mintak csoportositasa.
- Data Flywheel ingest/refine/index/learn/execute metrikak definialasa.
- Normalizalt observability payload letrehozasa.

### 2. Self-healing javaslat motor
- Failure trendek es timeout mintak felismerese.
- Mitigation javaslatok generalasa.
- "Generate mitigation track" output support.

### 3. UX es monitorozas
- Phoenix es Flywheel dashboard panel integracio.
- Trend / bar / summary nezhetoseg.
- CLI observability status parancs.

### 4. Verifikacio
- Aggregator tesztek.
- Panel tesztek.
- Build es conductor rescan ellenorzes.

## Acceptance kriteriumok
- A Phoenix es Flywheel metrikak egyutt lekervizhetok.
- A mitigacios javaslatok reprodukalhatoak.
- A dashboard es CLI ugyanazt a health allapotot jeleniti meg.
- A track active marad es teszttel vedett.
