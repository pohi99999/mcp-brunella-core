# Specifikacio: VIKTORIAVARGA brand monitor

## Hatter
A márkafigyelés a brand stack utolsó rétege: piaci jelzések, versenytárs mozgások és kampány-felügyelet, scheduled executionnel.

## Scope
- Market intelligence summaries.
- Apify-based scraping signals.
- Scheduled task plumbing.

## Outside scope
- Teljes social listening platform.
- Kézi dashboard redesign.
- Marketing döntés automatizálása review nélkül.

## Implementacios celpontok
- `src/agents/MarketIntelAgent.ts`
- `src/agents/ApifyScrapingAgent.ts`
- `src/server/schedulers/scheduledTasksRunner.ts`
- `src/cli.ts`

## Acceptance kriteriumok
- A monitor időzítve futtatható.
- A scraping és intel jelzések összevonhatók.
- A review loop ember által ellenőrizhető.

## Rollout
1. Signal ingestion.
2. Scheduled monitoring.
3. Summary generation.
4. Review and escalation.
