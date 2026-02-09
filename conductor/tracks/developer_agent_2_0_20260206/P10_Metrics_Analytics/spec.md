# P10: Developer Metrics & Analytics

**Track ID:** `developer_agent_2_0_20260206`
**Phase:** 4.1
**Status:** `approved` ✅

---

## 🎯 Célkitűzés

A fejlesztési folyamat transzparenciájának növelése perzisztens metrikagyűjtéssel. Olyan rendszert építünk, amely nyomon követi a build sikereket, teszt lefedettséget, AI költségeket és agent teljesítményt.

## 🏗️ Architektúra

### 1. Persistent Storage

- Fájl: `data/developer_metrics.json`
- Osztály: `DeveloperMetrics` (`src/utils/developerMetrics.ts`)

### 2. Integration Points

- **PipelineRunner**: Automatikus task rögzítés (siker/hiba, időtartam).
- **REST API**: `/api/v1/developer/metrics` végpont az adatok lekéréséhez.
- **CLI**: `brunella dev metrics` parancs a vizualizációhoz.
- **Dashboard**: (Jövőbeli) Metrics widgetek.

## 📋 Feladatlista

- [x] **P10.1: Metrics Utility Scaffolding**
  - [x] JSON storage és Singleton osztály kialakítása
  - [x] Task, Build, Test rekord funkciók implementálása
- [x] **P10.2: Pipeline Integration**
  - [x] `PipelineRunner` hook-ok beépítése (siker/hiba ágak)
- [x] **P10.3: API & CLI Support**
  - [x] Express route (`/metrics`) publikálása
  - [x] CLI parancs rögzítése (`brunella dev metrics`)
- [x] **P10.4: Interactive Menu Integration**
  - [x] Nyíl-navigációs menübe való felvétel (🛠️ Dev Tools → 📊 Metrics)
- [ ] **P10.5: Validation & Testing**
  - [ ] Vitest tesztek írása (`test/developer_metrics.test.ts`)
  - [ ] Manuális verifikáció a CLI-vel

## 🧪 Tesztelés

```bash
npm run build
brunella dev metrics
```

---
**Utolsó frissítés:** 2026-02-10
