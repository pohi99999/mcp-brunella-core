# Track: Magyar CLI Menürendszer (Teljes Átírás)

**Status:** PROPOSED
**Priority:** P0
**Complexity:** MEDIUM
**Created:** 2026-02-11
**Owner:** Claude

## 🎯 Cél

Teljes CLI átírás magyar nyelvre menüvezérelt interface-szel. NINCS begépelés (pl. `brunella tracks status name`), helyette interaktív menük (fel/le nyíl + enter).

## ✅ Acceptance Criteria

1. Magyar főmenü (kategóriákkal: Ügynökök, Track-ek, Chat, Tesztek, Rendszer)
2. Minden almenü magyar nyelven
3. Inquirer.js vagy prompts.js használat (nyíl navigáció)
4. Szép vizualizáció (chalk, boxen, figlet)
5. Minden meglévő funkció elérhető menüből
6. Gyors kilépés (ESC vagy q)

## 🔧 Technikai Követelmények

### Főmenü Struktúra (src/cli-hu.ts)

```
╔════════════════════════════════════════╗
║                                        ║
║     BRUNELLA AGENT RENDSZER            ║
║     Verzió: 2.3.0                      ║
║                                        ║
╚════════════════════════════════════════╝

Főmenü:
─────────────────────────────────────────
  🤖 Ügynökök kezelése
  📋 Track-ek kezelése
  💬 Chat (Cloudflare)
  🧪 Tesztek futtatása
  📊 Rendszer státusz
  ⚙️  Beállítások
  ❌ Kilépés
─────────────────────────────────────────

Válassz (↑/↓ nyíl, Enter): _
```

### Almenük

**1. Ügynökök kezelése**
```
  ▸ Ügynök lista (státusszal)
  ▸ Ügynök futtatása
  ▸ Ügynök logok
  ▸ Vissza
```

**2. Track-ek kezelése**
```
  ▸ Új track generálása ötletből
  ▸ Track státusz megtekintése
  ▸ Összes track listázása
  ▸ Track szerkesztése
  ▸ Vissza
```

**3. Chat (Cloudflare)**
```
  ▸ Chat indítása
  ▸ Chat előzmények
  ▸ Vissza
```

**4. Tesztek futtatása**
```
  ▸ Teljes teszt suite
  ▸ Integráció tesztek
  ▸ E2E tesztek
  ▸ Performance tesztek
  ▸ Legutóbbi eredmények
  ▸ Vissza
```

**5. Rendszer státusz**
```
  ▸ Agent Manager státusz
  ▸ Ollama kapcsolat
  ▸ Cloudflare kapcsolat
  ▸ LanceDB státusz
  ▸ Python subsystem
  ▸ Vissza
```

### Dependencies
- inquirer.js (menü navigáció)
- chalk (színek)
- boxen (keretek)
- ora (loading spinners)
- cli-table3 (táblázatok)

## 📋 Implementation Plan

### Phase 1: Főmenü + Struktúra
- [ ] cli-hu.ts létrehozás
- [ ] inquirer.js setup
- [ ] Főmenü implementálás
- [ ] Kategória routing
- [ ] ESC/q kilépés kezelés

### Phase 2: Almenük Implementálása
- [ ] Ügynökök menü
- [ ] Track-ek menü
- [ ] Chat menü
- [ ] Tesztek menü
- [ ] Rendszer menü
- [ ] Beállítások menü

### Phase 3: Meglévő Funkciók Átírása
- [ ] conductor commands átírás
- [ ] agents commands átírás
- [ ] chat commands átírás
- [ ] Minden funkcióhoz almenü

### Phase 4: Vizualizáció
- [ ] Chalk színek hozzáadása
- [ ] Boxen keretek
- [ ] Figlet banner (BRUNELLA)
- [ ] Loading spinners (ora)
- [ ] Table formatting (cli-table3)

### Phase 5: Testing & Docs
- [ ] Manual testing (minden menü)
- [ ] README.md CLI szekció frissítés
- [ ] Gyorsindítási útmutató (magyar)
- [ ] GitHub commit

## 📝 Implementation Prompt

```
Brunella CLI teljes átírás magyar menürendszerre:

Főmenü:
- 6 kategória (Ügynökök, Track-ek, Chat, Tesztek, Rendszer, Beállítások)
- inquirer.js navigáció (nyíl + enter)
- chalk színek + boxen keretek

Almenük:
- Minden kategóriának saját almenü
- Minden meglévő funkció elérhető
- "Vissza" opció minden szinten

Vizualizáció:
- Figlet banner (BRUNELLA)
- Színkódolt kimenetek
- Loading spinners
- Szép táblázatok
```
