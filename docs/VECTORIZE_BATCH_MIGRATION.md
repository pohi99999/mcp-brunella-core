# LanceDB → Vectorize Batch Migration

## Alapvető használat

```bash
# Standard migráció (50-es batch size, max 10,000 row/table)
node --import tsx scripts/migrate_lancedb_to_vectorize.ts

# Dry run (preview mode, nincs tényleges migráció)
DRY_RUN=true node --import tsx scripts/migrate_lancedb_to_vectorize.ts

# Custom max rows (20,000 row per table)
MIGRATE_MAX_ROWS=20000 node --import tsx scripts/migrate_lancedb_to_vectorize.ts

# Kombinált (dry run + custom max)
DRY_RUN=true MIGRATE_MAX_ROWS=20000 node --import tsx scripts/migrate_lancedb_to_vectorize.ts
```

## Environment Variables

| Változó | Default | Leírás |
|---------|---------|--------|
| `MIGRATE_MAX_ROWS` | 10000 | Max sorok száma table-enként |
| `DRY_RUN` | false | Ha `true`, preview mode (nincs migráció) |
| `CLOUDFLARE_API_TOKEN` | - | Cloudflare API token (kötelező) |
| `CLOUDFLARE_ACCOUNT_ID` | - | Cloudflare Account ID (kötelező) |
| `CF_VECTORIZE_INDEX` | brunella-agent-memory | Vectorize index név |

## Batch működés

A script automatikusan batch-eli a migrációt:

1. **Read batch size**: 100 row (2x a upsert batch size)
2. **Upsert batch size**: 50 vector
3. **Metadata limit**: 10KB/vector (Cloudflare limit)
4. **Progress logging**: Minden 100. migrált row után

### Optimalizálás nagy adatbázisokhoz

```bash
# Nagy table (100k+ rows) - több fázisban
MIGRATE_MAX_ROWS=25000 node --import tsx scripts/migrate_lancedb_to_vectorize.ts

# Ellenőrzés egy kis minta-migrációval
DRY_RUN=true MIGRATE_MAX_ROWS=100 node --import tsx scripts/migrate_lancedb_to_vectorize.ts

# Első 10k row tesztelése
MIGRATE_MAX_ROWS=10000 node --import tsx scripts/migrate_lancedb_to_vectorize.ts
```

## Hibakezelés

### Oversized metadata

Ha egy vector metadata túl nagy (>10KB), a script automatikusan kihagyja:

```
[ERROR] [VectorizeClient] upsert failed: oversized metadata for vector id="..."
```

**Megoldás**: A script csak kis méretű metadata mezőket másol (<1000 karakter).

### Rate limiting

Cloudflare Vectorize limitek:
- **Free tier**: 30M vector reads/hó, 100K vector writes/hó
- **Paid tier**: 5M vector queries/nap

Ha rate limit-et kapsz:
1. Csökkentsd a `MIGRATE_MAX_ROWS` értékét
2. Futtasd fázisokban (pl. napi 10k row)

### Connection timeout

Hosszú migrációnál timeout lehet. **Megoldás**:

```bash
# Kisebb batch-ek több futtatással
for i in {1..10}; do
  MIGRATE_MAX_ROWS=5000 node --import tsx scripts/migrate_lancedb_to_vectorize.ts
  sleep 60  # 1 perc szünet futtatások között
done
```

## Migration Analytics

A script logol:
- Migrated rows (sikeres)
- Skipped rows (oversized metadata hiba)
- Progress (minden 100. row)

### Példa output:

```
[INFO] [Migration] Starting LanceDB to Vectorize migration...
[INFO] [Migration] Processing table: memory_v2_nomic
[INFO] [Migration] Found 2500 rows in memory_v2_nomic
[INFO] [Migration] Migrating 2500 rows (max: 10000)
[INFO] [Migration] Progress: 100 migrated, 3 skipped
[INFO] [Migration] Progress: 200 migrated, 5 skipped
...
[INFO] [Migration] Migration complete! Total migrated: 2497, skipped: 3
```

## Post-Migration Verification

Ellenőrizd a migrációt:

```bash
# Test search
node --import tsx test_vectorize.ts

# Dashboard: RAG Memory widget
# Keresd meg: "test query"
```

## Rollback

Vectorize nem támogatja a batch delete API-t (csak ID listával). Ha rollback szükséges:

```bash
# Wrangler CLI-vel
wrangler vectorize delete <index-name>

# Új index létrehozása
wrangler vectorize create brunella-agent-memory --dimensions=384 --metric=cosine
```
