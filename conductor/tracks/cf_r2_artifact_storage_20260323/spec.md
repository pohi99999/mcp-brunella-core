# Specifikáció: R2 Alapú Agent Artifact Tárolás

**Track ID:** `cf_r2_artifact_storage_20260323`
**Prioritás:** HIGH
**Tulajdonos:** Pohánka Péter
**Létrehozva:** 2026-03-23
**Függőség:** `cf_r2_activation_20260323` (R2 aktiválás)

---

## 1. Áttekintés

Az R2 Object Storage használata a BAS agent rendszer futási melléktermékei (artifact-ok) tartós tárolására. Jelenleg ezek az adatok lokálisan, a szerveren maradnak, és nincs központi, elérhető tároló hely.

### Tárolandó artifact típusok

| Típus | Forrás | Méret (átlag) | Gyakoriság |
|-------|--------|---------------|------------|
| Agent futási logok | Minden agent | 5-50 KB | Minden futásnál |
| Screenshotok | RobotkezV2 | 200-800 KB | Böngésző feladatoknál |
| Generált kód | CoderAgent | 1-20 KB | Kódgenerálási feladatoknál |
| Teszt eredmények | TestRunnerAgent | 10-100 KB | Tesztelésnél |
| Golden dataset minták | QualityAssurance | 1-5 KB | Minőségellenőrzésnél |
| DAG állapot snapshot | DAGOrchestrator | 2-10 KB | Komplex feladatoknál |

### Becsült tárhely igény

- Napi: ~50 MB (normál használat)
- Havi: ~1.5 GB
- R2 Free tier: 10 GB/hó → ~6 hónap adat tárolható ingyenesen
- Lifecycle policy-val az 1 hónapnál régebbi logok törölhetők

---

## 2. R2Client Utility Osztály

### 2.1 Interfész tervezés

```typescript
// src/utils/r2Client.ts
import { logger } from './logger.js';

export interface R2ArtifactMetadata {
  agentId: string;
  runId: string;
  trackId?: string;
  taskId?: string;
  artifactType: 'log' | 'screenshot' | 'code' | 'test-result' | 'dataset' | 'dag-state';
  createdAt: string;
  sizeBytes: number;
  contentType: string;
}

export class R2Client {
  private bucket: R2Bucket;  // Cloudflare Workers R2 binding

  constructor(bucket: R2Bucket) {
    this.bucket = bucket;
  }

  /**
   * Artifact feltöltés strukturált elérési úttal
   * Séma: {artifactType}/{YYYY-MM-DD}/{agentId}/{runId}/{filename}
   */
  async uploadArtifact(
    data: ReadableStream | ArrayBuffer | string,
    metadata: R2ArtifactMetadata,
    filename: string
  ): Promise<R2Object> {
    const key = this.buildKey(metadata, filename);
    logger.info(`R2 feltöltés: ${key}`);

    return await this.bucket.put(key, data, {
      customMetadata: {
        agentId: metadata.agentId,
        runId: metadata.runId,
        trackId: metadata.trackId ?? '',
        artifactType: metadata.artifactType,
      },
      httpMetadata: {
        contentType: metadata.contentType,
      },
    });
  }

  /**
   * Artifact letöltés kulcs alapján
   */
  async downloadArtifact(key: string): Promise<R2ObjectBody | null> {
    return await this.bucket.get(key);
  }

  /**
   * Artifact-ok listázása prefix alapján
   */
  async listArtifacts(
    prefix: string,
    limit: number = 100
  ): Promise<R2Objects> {
    return await this.bucket.list({
      prefix,
      limit,
    });
  }

  /**
   * Régi artifact-ok törlése (lifecycle policy)
   */
  async cleanupOldArtifacts(
    olderThanDays: number = 30
  ): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);

    const objects = await this.bucket.list({ limit: 1000 });
    let deleted = 0;

    for (const obj of objects.objects) {
      if (obj.uploaded < cutoff) {
        await this.bucket.delete(obj.key);
        deleted++;
      }
    }

    logger.info(`R2 cleanup: ${deleted} artifact törölve (>${olderThanDays} napos)`);
    return deleted;
  }

  private buildKey(metadata: R2ArtifactMetadata, filename: string): string {
    const date = metadata.createdAt.split('T')[0]; // YYYY-MM-DD
    return `${metadata.artifactType}/${date}/${metadata.agentId}/${metadata.runId}/${filename}`;
  }
}
```

### 2.2 Bucket struktúra

```
vodor1/
├── log/
│   └── 2026-03-23/
│       ├── CoderAgent/
│       │   └── run-abc123/
│       │       └── execution.log
│       └── ReviewerAgent/
│           └── run-def456/
│               └── execution.log
├── screenshot/
│   └── 2026-03-23/
│       └── RobotkezV2/
│           └── run-ghi789/
│               ├── step-1-login.png
│               └── step-2-navigate.png
├── code/
│   └── 2026-03-23/
│       └── CoderAgent/
│           └── run-jkl012/
│               └── generated-component.tsx
├── test-result/
│   └── 2026-03-23/
│       └── TestRunnerAgent/
│           └── run-mno345/
│               └── vitest-results.json
└── dataset/
    └── 2026-03-23/
        └── QualityAssurance/
            └── run-pqr678/
                └── golden-sample.json
```

---

## 3. Agent Framework Integráció

### 3.1 BaseAgent bővítés

Minden agent-nek legyen lehetősége artifact-ot feltölteni az R2-be:

```typescript
// src/agents/baseAgent.ts kiegészítés
export abstract class BaseAgent implements IAgent {
  protected r2?: R2Client;

  protected async saveArtifact(
    data: string | ArrayBuffer,
    filename: string,
    artifactType: R2ArtifactMetadata['artifactType']
  ): Promise<void> {
    if (!this.r2) return; // Graceful degradation ha nincs R2

    await this.r2.uploadArtifact(data, {
      agentId: this.id,
      runId: this.currentRunId,
      trackId: this.currentTrackId,
      artifactType,
      createdAt: new Date().toISOString(),
      sizeBytes: typeof data === 'string' ? data.length : data.byteLength,
      contentType: this.getContentType(artifactType, filename),
    }, filename);
  }
}
```

### 3.2 RobotkezV2 screenshot integráció

```typescript
// A RobotkezV2 böngésző agent screenshot-jai automatikusan R2-be kerülnek
const screenshot = await page.screenshot({ type: 'png' });
await this.saveArtifact(screenshot, `step-${stepIndex}.png`, 'screenshot');
```

---

## 4. Dashboard R2 böngésző panel

A BAS dashboard-on egy R2 fájlböngésző panel:

- Fa nézet az R2 bucket struktúráról
- Szűrés agent, dátum, artifact típus szerint
- Screenshot előnézet
- Log tartalom megjelenítés
- Letöltés gomb

### API endpoint

```typescript
// Worker API a dashboard számára
GET /api/r2/list?prefix=screenshot/2026-03-23/
GET /api/r2/download/:key
DELETE /api/r2/cleanup?olderThanDays=30
```

---

## 5. Lifecycle Policy

| Artifact típus | Megőrzési idő | Indoklás |
|----------------|---------------|----------|
| `log` | 30 nap | Hibakereséshez elegendő |
| `screenshot` | 14 nap | Nagy méret, gyorsan elavul |
| `code` | 90 nap | Referencia és audit célra |
| `test-result` | 60 nap | Trendanalízishez |
| `dataset` | Végtelen | Golden dataset nem törlendő |
| `dag-state` | 30 nap | Debug célú |

---

## 6. Kockázatok

- **R2 aktiválás függőség** — ez a track blokkolva van amíg `cf_r2_activation_20260323` nem teljesül
- **Méret korlát** — nagy screenshotok tömörítése szükséges lehet
- **Hálózati latency** — lokálról R2 feltöltés lassabb mint helyi fájlrendszer
- **S3 kompatibilitás** — Worker binding API nem teljesen S3-kompatibilis, de a BAS csak a Worker binding-ot használja

---

## 7. Kapcsolódó fájlok

- `cloudflare/wrangler.jsonc` — R2 bucket binding (`R2_KNOWLEDGE`)
- `cloudflare/src/index.ts` — Worker R2 binding export
- `src/agents/baseAgent.ts` — BaseAgent osztály (bővítendő)
- `src/dashboard/` — React dashboard (R2 böngésző panel)
- `myai/robotkez/` — RobotkezV2 böngésző agent (screenshot integráció)
