# Vectorize Cleanup - Scheduled Task példa

## Windows Task Scheduler

Hozz létre egy scheduled task-ot amely naponta futtatja a cleanup scriptet:

```powershell
# PowerShell parancs a Task Scheduler-ben (napi 02:00-kor)
$action = New-ScheduledTaskAction -Execute "node" -Argument "--import tsx F:\mcp-brunella-core\scripts\cleanup_old_vectors.ts" -WorkingDirectory "F:\mcp-brunella-core"
$trigger = New-ScheduledTaskTrigger -Daily -At 2am
Register-ScheduledTask -Action $action -Trigger $trigger -TaskName "Vectorize Cleanup" -Description "Töröl 90+ napos vektorokat"
```

## Linux/Mac (cron)

Adj hozzá egy cron job-ot:

```bash
# Napi 02:00-kor
0 2 * * * cd /path/to/mcp-brunella-core && node --import tsx scripts/cleanup_old_vectors.ts
```

## Manuális futtatás

```bash
# Alap futtatás (90 napos retention)
node --import tsx scripts/cleanup_old_vectors.ts

# Dry run (preview mode, nem töröl semmit)
DRY_RUN=true node --import tsx scripts/cleanup_old_vectors.ts

# Custom retention (60 nap)
VECTORIZE_RETENTION_DAYS=60 node --import tsx scripts/cleanup_old_vectors.ts

# Dry run + custom retention
DRY_RUN=true VECTORIZE_RETENTION_DAYS=60 node --import tsx scripts/cleanup_old_vectors.ts
```

## Environment Variables

- `VECTORIZE_RETENTION_DAYS`: Retention policy (default: 90 nap)
- `DRY_RUN`: Ha `true`, csak preview, nem töröl semmit
- `CLOUDFLARE_API_TOKEN`: Cloudflare API token (vagy CLOUDFLARE_GLOBAL_API_KEY + CLOUDFLARE_EMAIL)
- `CF_VECTORIZE_INDEX`: Index név (default: brunella-agent-memory)

## Tracking Database (Opcionális)

A cleanup script teljes működéséhez egy tracking database szükséges, ahol tároljuk:
- Vector IDs
- Létrehozás dátumok (createdAt)
- Metadata

### D1 Table példa:

```sql
CREATE TABLE vector_tracking (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata TEXT
);
```

### Használat:

1. Minden `vectorizeClient.upsert()` műveletnél track-eld a vector ID-t
2. Cleanup script lekérdezi a tracking table-t
3. Régi vektorok törlése
4. Tracking table cleanup
