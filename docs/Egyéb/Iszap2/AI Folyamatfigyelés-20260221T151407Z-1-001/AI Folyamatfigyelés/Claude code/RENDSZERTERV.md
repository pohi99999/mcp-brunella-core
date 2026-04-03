# 🏗️ Multi-Agent Tender Monitoring System - Rendszerterv

**Verzió**: 1.0
**Dátum**: 2025-12-03
**Cél**: Profi, strukturált tender monitoring rendszer 4 ügynökkel + orchestrator

---

## 📋 ARCHITEKTÚRA ÁTTEKINTÉS

### Rendszer Komponensek:

```
┌─────────────────────────────────────────────────────────────┐
│                    WEB DASHBOARD                            │
│              (Flask/Streamlit Frontend)                     │
│   - Ügynökök státusza                                       │
│   - Találatok megjelenítése                                 │
│   - Orchestrator parancsok                                  │
└───────────────────────┬─────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────────┐
│              ORCHESTRATOR AGENT                             │
│   - Ügynök koordináció                                      │
│   - Feladat ütemezés                                        │
│   - Eredmény aggregálás                                     │
│   - Riport generálás                                        │
└───┬───────────┬───────────┬───────────┬─────────────────────┘
    │           │           │           │
    ▼           ▼           ▼           ▼
┌───────┐  ┌───────┐  ┌───────┐  ┌───────┐
│Agent 1│  │Agent 2│  │Agent 3│  │Agent 4│
│  EKR  │  │ Közbsz│  │  EU   │  │ Local │
│Keresés│  │Monitor│  │Tender │  │Tender │
└───────┘  └───────┘  └───────┘  └───────┘
```

---

## 🤖 ÜGYNÖKÖK SPECIFIKÁCIÓJA

### Agent 1: **EKR Keresési Ügynök** (KÉSZ ✅)
**Felelősség**: Magyar EKR rendszer monitoring
**Kulcsszavak**: 9 db (iszapkotrás, mederkotrás, stb.)
**Futás**: Hetente hétfőn
**Output**: JSON + Markdown riport

### Agent 2: **Közbeszerzési Monitor Ügynök** (ÚJ)
**Felelősség**: Közbeszerzési Értesítő monitoring
**Kulcsszavak**: Ugyanazok + CPV kódok
**Futás**: Naponta
**Output**: Új tenderek listája

### Agent 3: **EU TED Ügynök** (ÚJ)
**Felelősség**: Európai Uniós tenderek (TED database)
**Kulcsszavak**: Angol fordítások + CPV
**Futás**: Hetente
**Output**: EU tenderek releváns Magyarországra

### Agent 4: **Helyi Tender Ügynök** (ÚJ)
**Felelősség**: Megyei, városi önkormányzati tenderek
**Kulcsszavak**: Helyi módosított kulcsszavak
**Futás**: Hetente kétszer
**Output**: Helyi kiírások

---

## 🎛️ ORCHESTRATOR FUNKCIONALITÁS

### Fő Feladatok:

1. **Ütemezés**
   - Ügynökök futtatási időpontjának kezelése
   - Párhuzamos vs. soros futtatás döntése
   - Újrapróbálkozás hibák esetén

2. **Koordináció**
   - Ügynökök közötti kommunikáció
   - Duplikátumok szűrése
   - Prioritások kezelése

3. **Aggregálás**
   - Összes ügynök eredményének összevonása
   - Deduplikáció
   - Relevancia rangsorolás

4. **Riportolás**
   - Összesített riportok
   - Email értesítések
   - Dashboard frissítés

### Orchestrator Parancsok:

```python
# Példa parancsok:
orchestrator.start_agent("EKR")           # Egy ügynök indítása
orchestrator.start_all()                  # Minden ügynök
orchestrator.get_status()                 # Státusz lekérés
orchestrator.get_results(agent_id)        # Eredmények
orchestrator.schedule(agent, schedule)    # Ütemezés
```

---

## 💻 FRONTEND DASHBOARD OPCIÓK

### Opció 1: **Streamlit Dashboard** (AJÁNLOTT - Gyors)
**Előnyök**:
- ✅ Python alapú
- ✅ Gyors fejlesztés (1-2 nap)
- ✅ Szép, interaktív UI
- ✅ Nincs frontend tudás szükséges

**Dashboard elemek**:
- Ügynök státusz kártyák
- Találatok táblázat (szűrhető)
- Grafikon (találatok időben)
- Orchestrator parancs gomb

### Opció 2: **Flask + React Dashboard** (Profi)
**Előnyök**:
- ✅ Professzionális
- ✅ Teljes testreszabás
- ✅ Skálázható

**Hátrányok**:
- ⚠️ Több fejlesztési idő (1-2 hét)
- ⚠️ Frontend tudás szükséges

### Opció 3: **Notion Integration** (Legegyszerűbb)
**Előnyök**:
- ✅ Nincs fejlesztés
- ✅ Már létező UI
- ✅ Mobil app is elérhető

**Működés**:
- Orchestrator frissíti a Notion adatbázist
- Ügynökök státusza Notion kártyákban
- Találatok Notion táblázatban

---

## 🗂️ ADATSTRUKTÚRA

### Központi Adatbázis:

```json
{
  "tenders": {
    "tender_id": {
      "title": "Tender címe",
      "source": "EKR / Közbeszerzési Értesítő / TED / Local",
      "keywords_matched": ["iszapkotrás", "vízépítés"],
      "deadline": "2026-02-02",
      "url": "https://...",
      "status": "active / watched / applied / rejected",
      "relevance_score": 0.85,
      "discovered_by": "Agent_1",
      "discovered_at": "2025-12-03T12:00:00"
    }
  },
  "agents": {
    "agent_1": {
      "name": "EKR Keresési Ügynök",
      "status": "running / idle / error",
      "last_run": "2025-12-03T12:00:00",
      "next_run": "2025-12-10T08:00:00",
      "results_count": 66,
      "execution_time": "2m"
    }
  }
}
```

---

## 📅 FEJLESZTÉSI ÜTEMTERV

### Fázis 1: Orchestrator + Dashboard (1 hét)
- [ ] Orchestrator core logika
- [ ] Agent manager osztály
- [ ] Streamlit dashboard alapok
- [ ] Agent 1 integráció (EKR - már kész)

### Fázis 2: Agent 2-3 (1 hét)
- [ ] Közbeszerzési Monitor ügynök
- [ ] EU TED ügynök
- [ ] Dashboard bővítés

### Fázis 3: Agent 4 + Finomítás (1 hét)
- [ ] Helyi Tender ügynök
- [ ] Email értesítések
- [ ] Relevancia scoring
- [ ] Duplikátum szűrés

### Fázis 4: Production Ready (3 nap)
- [ ] Hibakezelés
- [ ] Naplózás
- [ ] Monitoring
- [ ] Dokumentáció

**Összesen: ~3 hét fejlesztés**

---

## 🛠️ TECHNOLÓGIAI STACK

### Backend:
- **Python 3.9+**
- **Flask** (API)
- **SQLite / PostgreSQL** (adatbázis)
- **Celery** (ütemezés)
- **Redis** (cache)

### Frontend:
- **Streamlit** (dashboard) - AJÁNLOTT
- **vagy React + Flask** (ha profibb kell)

### Deployment:
- **Docker** (konténerizálás)
- **GitHub Actions** (CI/CD)
- **Railway / Heroku** (hosting)

### Monitoring:
- **Sentry** (hibák)
- **Prometheus + Grafana** (metrikák)

---

## 💰 KÖLTSÉGBECSLÉS

### Opció A: Claude Code + Streamlit (Legolcsóbb)
**Költség**: ~$20/hó
- Railway hosting: $5/hó
- Claude API: ~$10/hó (használat alapú)
- Domain: $5/hó

**Fejlesztési idő**: 2-3 hét (Claude segítségével)

### Opció B: Teljes Professzionális Stack
**Költség**: ~$50-100/hó
- AWS/DigitalOcean: $30/hó
- Monitoring tools: $20/hó
- Claude API: $10/hó
- Extra services: $10-40/hó

**Fejlesztési idő**: 4-5 hét

---

## 🎯 AJÁNLOTT MEGKÖZELÍTÉS

### Start: **Streamlit Dashboard + Orchestrator**

**Miért ez?**
1. ✅ Gyors fejlesztés (1-2 hét)
2. ✅ Szép, használható UI
3. ✅ Könnyen bővíthető
4. ✅ Alacsony költség

**Első Lépések**:
1. Orchestrator Python osztály készítése
2. Agent 1 (EKR) integrálása
3. Streamlit dashboard alapok
4. Ügynök státusz megjelenítés
5. Találatok táblázat

**Később Bővítés**:
- Agent 2-4 hozzáadása egyenként
- Email értesítések
- Mobilapp (Streamlit támogatja!)

---

## 📊 DASHBOARD MOCK-UP

```
┌────────────────────────────────────────────────────────┐
│  🎯 Tender Monitoring Dashboard - Iszapfaló Kft.      │
├────────────────────────────────────────────────────────┤
│                                                        │
│  Ügynökök Státusza:                                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐│
│  │ Agent 1  │ │ Agent 2  │ │ Agent 3  │ │ Agent 4  ││
│  │ ✅ Aktív │ │ ⏸️ Idle  │ │ 🔄 Fut   │ │ ❌ Hiba  ││
│  │ 66 találat│ │ 12 találat│ │ ...      │ │ ...      ││
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘│
│                                                        │
│  [▶️ Indítsd Mind]  [⏸️ Állítsd Le]  [🔄 Frissítés]  │
│                                                        │
│  📊 Aktív Tenderek (66):                              │
│  ┌────┬─────────────┬──────────┬──────────┬─────────┐│
│  │ ID │ Cím         │ Határidő │ Forrás   │ Státusz ││
│  ├────┼─────────────┼──────────┼──────────┼─────────┤│
│  │ 1  │ Tápió-Hajta │ 02-02    │ EKR      │ 👀 Néz  ││
│  │ 2  │ Csapadék... │ 01-15    │ EKR      │ ⭐ TOP  ││
│  └────┴─────────────┴──────────┴──────────┴─────────┘│
│                                                        │
│  📈 Statisztika:                                      │
│  [Grafikon: Találatok az elmúlt 30 napban]           │
│                                                        │
└────────────────────────────────────────────────────────┘
```

---

## 🚀 KÖVETKEZŐ LÉPÉS - MIT VÁLASSZ?

### 1. **Minimális Viable Product (MVP)** - 1 hét
- Orchestrator
- Agent 1 integráció (már kész)
- Streamlit dashboard
- Találatok táblázat

### 2. **Teljes Rendszer** - 3 hét
- 4 ügynök
- Orchestrator
- Dashboard
- Email értesítések

### 3. **Notion Integráció** - 2 nap
- Legegyszerűbb
- Nincs UI fejlesztés
- Orchestrator + Notion API

---

**Mit válaszol? Melyik útvonalat kezdjük el?**

1. MVP (1 hét) - Gyors, működő rendszer ✅
2. Teljes Rendszer (3 hét) - Professzionális megoldás
3. Notion Integráció (2 nap) - Legegyszerűbb

