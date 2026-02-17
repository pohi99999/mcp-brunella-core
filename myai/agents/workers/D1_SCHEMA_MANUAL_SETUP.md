# CEAN Production D1 Schema Setup - Manual Solution

## Probléma
A `wrangler d1 execute --remote` nem működik API token permission issue miatt még OAuth login-nal sem.

## Megoldás: Cloudflare Dashboard SQL Console

### Lépések:

1. **Nyisd meg a D1 Dashboard-ot:**
   ```
   https://dash.cloudflare.com/1bf6118df97f0e12f3592a89d90deb1e/workers/d1/960ec488-9e16-4d3d-ad74-9bf978594498
   ```

2. **Kattints a "Console" fülre** (bal oldali menü)

3. **Másold be a teljes SQL schema tartalmát** a következő fájlból:
   ```
   myai/agents/workers/schema/d1_schema.sql
   ```

4. **Kattints:** "Execute" gomb

5. **Várj:** ~30 másodperc (52 SQL parancs végrehajtása)

6. **Ellenőrzés:** Tablák listázása
   ```sql
   SELECT name FROM sqlite_schema WHERE type='table' ORDER BY name;
   ```
   
   Várható eredmény (12 tábla):
   - cean_fleets
   - cean_metrics_archive
   - cean_metrics_cache
   - cean_scaling_events
   - cean_workers
   - cean_chat_history
   - edge_audit_log
   - edge_executions
   - edge_metrics
   - edge_results
   - edge_tasks
   - edge_workers_status

## Alternatív Megoldás (CLI)

Ha mégis CLI-ből szeretnéd:

```powershell
# 1. Átmeneti .env rename
Rename-Item .env .env.backup

# 2. OAuth login
npx wrangler login

# 3. Schema betöltés
npx wrangler d1 execute cean-tasks --file=myai/agents/workers/schema/d1_schema.sql --remote

# 4. .env visszaállítás
Rename-Item .env.backup .env
```

## Teszt Után

Production query teszt:
```bash
curl -X POST https://research-agent.peterpohankapersonal.workers.dev/query \
  -H "Content-Type: application/json" \
  -d '{"query":"AI frameworks","sources":["github"],"limit":5}'
```

Várható válasz: 200 OK, task_id + results array
