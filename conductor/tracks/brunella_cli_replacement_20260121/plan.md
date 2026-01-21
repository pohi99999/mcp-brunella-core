# Megvalósítási Terv: Brunella CLI Megvalósítás

Ez a terv a Gemini CLI kiváltását célzó saját Brunella CLI fejlesztését részletezi, Node.js és Commander.js alapokon, TDD módszertannal.

## 1. Fázis: CLI Alapok és Konfiguráció
Létrehozzuk a parancssori eszköz vázát és a beállítások kezelését.

- [x] **Feladat: project struktúra és bináris regisztráció**
    - [x] Task: `brunella` parancs beállítása a `package.json`-ban (Red)
    - [x] Task: Belépési pont (`cli.ts`) és alap Commander setup (Green)
- [x] **Feladat: Konfigurációs rendszer (Settings)**
    - [x] Task: Beállítások beolvasása és mentése a `~/.brunella/settings.json` fájlba (Red)
    - [x] Task: `brunella config` parancs implementálása (Green)
- [x] **Feladat: Conductor - User Manual Verification '1. Fázis' (Protocol in workflow.md)**

## 2. Fázis: Hibrid MCP Kapcsolat
Implementáljuk az automatikus szerver-felfedezést és a WebSocket alapú kommunikációt.

- [x] **Feladat: Szerver felfedezés és indítás**
    - [x] Task: Teszt: Csatlakozás futó szerverhez vs. új indítása (Red)
    - [x] Task: Hibrid kapcsolódási logika megírása (Green)
    - [x] Task: Hibrid kapcsolódási logika megírása (Green)
- [x] **Feladat: MCP Üzenetkezelő (CLI Client)**
    - [x] Task: MCP handshake és JSON-RPC alapú kérések/válaszok kezelése (Red)
    - [x] Task: Alapvető kommunikációs réteg implementálása (Green)
- [x] **Feladat: Conductor - User Manual Verification '2. Fázis' (Protocol in workflow.md)**

## 3. Fázis: Mag Parancsok és Formázott Kimenet
Kiépítjük a funkcionális parancsokat és az átlátható terminál megjelenítést.

- [~] **Feladat: Eszközök kezelése (`tools`, `run`)**
    - [x] Task: Táblázatos és JSON kimenet implementálása (Red) [7d82cfc]
    - [ ] Task: `tools` lista és `run` parancs megírása (Green)
- [~] **Feladat: Interaktív Chat (`chat`)**
    - [ ] Task: Streaming output és Markdown renderelés a terminálban (Red)
    - [ ] Task: `chat` parancs implementálása LLM integrációval (Green)
- [~] **Feladat: Conductor - User Manual Verification '3. Fázis' (Protocol in workflow.md)**

## 4. Fázis: Gemini CLI Paritás és Finomhangolás
Biztosítjuk, hogy minden korábbi funkció elérhető legyen az új eszközben.

- [ ] **Feladat: Ágens kezelés (`agents`)**
    - [ ] Task: Ügynökök listázása és delegálási parancsok (Red)
    - [ ] Task: `agents` és `delegate` parancsok implementálása (Green)
- [ ] **Feladat: Hibakezelés és UX polírozás**
- [ ] **Feladat: Conductor - User Manual Verification '4. Fázis' (Protocol in workflow.md)**
