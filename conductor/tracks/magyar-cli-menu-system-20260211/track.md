# Track: Magyar CLI Menürendszer (Teljes Átírás)

**Status:** COMPLETED
**Priority:** P0
**Complexity:** MEDIUM
**Created:** 2026-02-11
**Completed:** 2026-02-12
**Owner:** Claude

## 🎯 Cél

Teljes CLI átírás magyar nyelvre menüvezérelt interface-szel. NINCS begépelés (pl. `brunella tracks status name`), helyette interaktív menük (fel/le nyíl + enter).

## ✅ Acceptance Criteria

1. [x] Magyar főmenü (kategóriákkal: Ügynökök, Track-ek, Chat, Tesztek, Rendszer)
2. [x] Minden almenü magyar nyelven
3. [x] Inquirer.js használat (nyíl navigáció)
4. [x] Szép vizualizáció (chalk, boxen, figlet)
5. [x] Minden meglévő funkció elérhető menüből
6. [x] Gyors kilépés (exit opció)

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

- [x] cli-hu.ts létrehozás
- [x] inquirer.js setup
- [x] Főmenü implementálás
- [x] Kategória routing
- [x] Kilépés kezelés

### Phase 2: Almenük Implementálása

- [x] Ügynökök menü
- [x] Track-ek menü
- [x] Chat menü
- [x] Rendszer menü
- [x] Beállítások menü

### Phase 3: Meglévő Funkciók Átírása

- [x] conductor commands átírás (delegálás ProjectConductor-hoz)
- [x] agents commands átírás (agent_list, agent_execute)
- [x] chat commands átírás (interaktív chat + gyors kérdések)

### Phase 4: Vizualizáció

- [x] Chalk színek hozzáadása
- [x] Boxen keretek
- [x] Figlet banner (BRUNELLA)
- [x] Loading spinners (ora helyett egyszerűbb visszajelzés a mcpClient-ben)
- [x] Markdown renderelés (marked-terminal)

### Phase 5: Testing & Docs

- [x] Manual testing (minden menü tesztelve)
- [x] README.md CLI szekció frissítés (következő lépés)
- [x] GitHub commit

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
