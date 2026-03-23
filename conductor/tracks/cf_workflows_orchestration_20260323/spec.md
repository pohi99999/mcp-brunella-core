# Specifikáció: Cloudflare Workflows Orkesztráció

**Track ID:** `cf_workflows_orchestration_20260323`
**Prioritás:** MEDIUM
**Tulajdonos:** Pohánka Péter
**Létrehozva:** 2026-03-23

---

## 1. Áttekintés

A Cloudflare Workflows bevezetése az N8N workflow engine részleges kiváltására. A cél egy edge-natív, tartós végrehajtású workflow rendszer, amely a BAS conductor track-ekkel integrálódik.

### Miért Cloudflare Workflows az N8N helyett?

| Szempont | N8N | CF Workflows |
|----------|-----|-------------|
| Hosting | Saját szerver (Docker) | Edge (serverless) |
| Tartósság | Szerver újraindítás = elveszett állapot | Durable execution (automatikus) |
| Latency | Központi szerver, hálózati késleltetés | Edge, alacsony latency |
| Skálázás | Manuális | Automatikus |
| Költség | VPS költség ($5-20/hó) | Free tier (100K lépés/hó) |
| Karbantartás | N8N frissítések, Docker kezelés | Zero maintenance |
| Integráció | HTTP webhook-ok | Natív Workers binding |

### Nem kiváltandó N8N funkciók

- Vizuális workflow szerkesztő (Cloudflare CLI/kód alapú)
- 400+ beépített integráció (Cloudflare-ben kódolni kell)
- GUI-alapú debug/monitoring (CF Dashboard korlátozott)

---

## 2. BAS Workflow-ok

### 2.1 Napi rendszer health check

```typescript
// cloudflare/src/workflows/daily-health-check.ts
import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';

export class DailyHealthCheckWorkflow extends WorkflowEntrypoint {
  async run(event: WorkflowEvent, step: WorkflowStep) {
    // 1. lépés: Rendszerállapot lekérdezés
    const systemStatus = await step.do('check-system-health', async () => {
      const response = await fetch('http://localhost:3120/api/health');
      return response.json();
    });

    // 2. lépés: Agent-ek állapota
    const agentStatus = await step.do('check-agents', async () => {
      const response = await fetch('http://localhost:3120/api/agents/status');
      return response.json();
    });

    // 3. lépés: D1 adatbázis méret
    const dbSize = await step.do('check-d1-size', async () => {
      const result = await this.env.DB.prepare(
        "SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()"
      ).first();
      return result;
    });

    // 4. lépés: Jelentés generálás
    const report = await step.do('generate-report', async () => {
      return {
        timestamp: new Date().toISOString(),
        system: systemStatus,
        agents: agentStatus,
        database: dbSize,
        healthy: systemStatus.status === 'ok',
      };
    });

    // 5. lépés: Értesítés (ha probléma van)
    if (!report.healthy) {
      await step.do('send-alert', async () => {
        // Discord webhook vagy email értesítés
        await fetch(this.env.DISCORD_WEBHOOK_URL, {
          method: 'POST',
          body: JSON.stringify({
            content: `⚠️ BAS Health Check FAILED: ${JSON.stringify(report)}`,
          }),
        });
      });
    }

    return report;
  }
}
```

### 2.2 Lead mining pipeline

```typescript
// cloudflare/src/workflows/lead-mining.ts
export class LeadMiningWorkflow extends WorkflowEntrypoint {
  async run(event: WorkflowEvent, step: WorkflowStep) {
    // 1. Forrás adatok gyűjtése
    const sources = await step.do('collect-sources', async () => {
      // Pályázati portálok, üzleti adatbázisok scraping
      return await collectLeadSources(this.env);
    });

    // 2. AI elemzés minden forrásra
    const analyzed = await step.do('analyze-leads', async () => {
      const results = [];
      for (const source of sources) {
        const analysis = await this.env.AI.run(
          '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
          { messages: [{ role: 'user', content: `Elemezd: ${source.content}` }] }
        );
        results.push({ ...source, analysis: analysis.response });
      }
      return results;
    });

    // 3. Szűrés és prioritizálás
    const filtered = await step.do('filter-leads', async () => {
      return analyzed.filter(lead => lead.analysis.includes('releváns'));
    });

    // 4. D1-be mentés
    await step.do('save-to-d1', async () => {
      for (const lead of filtered) {
        await this.env.DB.prepare(
          'INSERT INTO leads (source, content, analysis, created_at) VALUES (?, ?, ?, ?)'
        ).bind(lead.source, lead.content, lead.analysis, new Date().toISOString()).run();
      }
    });

    // 5. Összesítő értesítés
    await step.do('notify', async () => {
      await sendNotification(this.env, `${filtered.length} új lead találva`);
    });

    return { leadsFound: filtered.length };
  }
}
```

### 2.3 Pályázat monitoring

```typescript
// cloudflare/src/workflows/grant-monitoring.ts
export class GrantMonitoringWorkflow extends WorkflowEntrypoint {
  async run(event: WorkflowEvent, step: WorkflowStep) {
    // 1. Pályázati portálok ellenőrzése
    const grants = await step.do('check-grant-portals', async () => {
      return await scrapeGrantPortals(this.env);
    });

    // 2. Releváns pályázatok szűrése AI-val
    const relevant = await step.do('filter-relevant', async () => {
      const response = await this.env.AI.run(
        '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
        {
          messages: [{
            role: 'user',
            content: `Szűrd ki a BAS projekthez releváns pályázatokat: ${JSON.stringify(grants)}`
          }]
        }
      );
      return JSON.parse(response.response);
    });

    // 3. Értesítés és naplózás
    await step.do('notify-and-log', async () => {
      if (relevant.length > 0) {
        await sendNotification(this.env,
          `🏆 ${relevant.length} releváns pályázat: ${relevant.map(g => g.title).join(', ')}`
        );
      }
      // D1 naplózás
      await this.env.DB.prepare(
        'INSERT INTO grant_checks (checked_at, total, relevant) VALUES (?, ?, ?)'
      ).bind(new Date().toISOString(), grants.length, relevant.length).run();
    });

    return { total: grants.length, relevant: relevant.length };
  }
}
```

---

## 3. Wrangler konfiguráció

```jsonc
{
  "workflows": [
    {
      "name": "daily-health-check",
      "binding": "HEALTH_CHECK_WORKFLOW",
      "class_name": "DailyHealthCheckWorkflow"
    },
    {
      "name": "lead-mining",
      "binding": "LEAD_MINING_WORKFLOW",
      "class_name": "LeadMiningWorkflow"
    },
    {
      "name": "grant-monitoring",
      "binding": "GRANT_MONITORING_WORKFLOW",
      "class_name": "GrantMonitoringWorkflow"
    }
  ],
  "triggers": {
    "crons": [
      "0 6 * * *",     // daily-health-check: minden nap 6:00 UTC
      "0 8 * * 1",     // lead-mining: minden hétfőn 8:00 UTC
      "0 7 * * 1,4"    // grant-monitoring: hétfő és csütörtök 7:00 UTC
    ]
  }
}
```

---

## 4. Durable Execution előnyök

A Cloudflare Workflows automatikusan biztosítja:

- **Tartós állapot:** Ha egy lépés sikertelen, a workflow a legutolsó sikeres lépéstől folytatódik
- **Automatikus retry:** Hálózati hibák esetén automatikus újrapróbálás
- **Időkorlát nélkül:** Akár órákig futó workflow-ok is lehetségesek
- **Konzisztencia:** Minden lépés pontosan egyszer fut le (at-least-once szemantika)

---

## 5. N8N migráció terv

| N8N Workflow | CF Workflow | Prioritás | Megjegyzés |
|-------------|-------------|-----------|------------|
| Daily health check | `DailyHealthCheckWorkflow` | Fázis 1 | Egyszerű, pilot |
| Lead mining | `LeadMiningWorkflow` | Fázis 2 | Komplex, AI-intenzív |
| Grant monitoring | `GrantMonitoringWorkflow` | Fázis 3 | Scraping + AI |
| Report generation | (Fázis 5) | Később | Komplex formázás |
| Slack notifications | (Integrálva) | Minden fázisban | Step-ként |

---

## 6. Kockázatok

- **Workflow debug:** Kevésbé vizuális mint az N8N — CF Dashboard korlátozott
- **Vendor lock-in:** Cloudflare-specifikus API, nehéz migrálni más platformra
- **Scraping korlátok:** Workers-ből korlátozott a web scraping (fetch API korlátok)
- **Cold start:** Ritkán futó workflow-ok cold start latency-vel indulhatnak
- **Free tier limit:** 100,000 lépés/hó — komplex workflow-ok gyorsan fogyasztják

---

## 7. Kapcsolódó fájlok

- `cloudflare/wrangler.jsonc` — Workflow binding és cron trigger konfiguráció
- `cloudflare/src/index.ts` — Worker entry point, Workflow export
- `n8n/` — Jelenlegi N8N konfiguráció (migrációs referencia)
- `src/core/bifrost.ts` — AI hívások a Workflow lépésekből
- `conductor/tracks.md` — Conductor track rendszer
