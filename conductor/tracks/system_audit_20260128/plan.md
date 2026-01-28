# Megvalósítási Terv: Rendszer Átvilágítás

Ez a terv vezeti végig a `system_audit_20260128` tracket. A lépéseket szigorúan sorrendben kell végrehajtani.

## Fázis 1: Infrastruktúra és Szerver ("The Pulse")

- [ ] **Task 1.1: Környezet Validáció**
    - Ellenőrizni a `.env` fájl meglétét és tartalmát.
    - Ellenőrizni a Node.js és Python verziókat.
    - Ellenőrizni a Docker állapotát (ha szükséges a sandboxhoz).
- [ ] **Task 1.2: Szerver Indítási Teszt (Cold Start)**
    - Elindítani a szervert (`npm run dev` vagy buildelt verzió).
    - Figyelni a logokat (`szerver_log.md` vagy stdout) hibákra.
    - Ellenőrizni, hogy a portok (3000, 3001, stb.) nyitva vannak-e.
- [ ] **Task 1.3: Windows Socket Hiba Provokáció**
    - Megpróbálni reprodukálni a `src\win\async.c` assertion errort (szerver leállítás/újraindítás, gyors csatlakozások).

## Fázis 2: CLI Funkcionalitás ("The Voice")

- [ ] **Task 2.1: CLI Csatlakozás** - ⛔ BLOKKOLVA (Build hiba)
- [ ] **Task 2.2: Tool Listázás** - ⛔ BLOKKOLVA (Build hiba)
- [ ] **Task 2.3: Chat Teszt** - ⛔ BLOKKOLVA (Build hiba)

## Fázis 3: Dashboard & Frontend ("The Face")

- [x] **Task 3.1: Statikus Fájlok és Betöltés** - ✅ SIKERES (Vite dev server fut)
- [ ] **Task 3.2: WebSocket/SSE Kapcsolat** - ⛔ BLOKKOLVA (Backend nem fut)
- [ ] **Task 3.3: Agent Tools Tab** - ⛔ BLOKKOLVA (Backend nem fut)

## Fázis 4: Ügynök Képességek ("The Brain")

- [ ] **Task 4.1: Ollama Ping** - ⛔ BLOKKOLVA
- [ ] **Task 4.2: Python Sandbox (Open Interpreter)** - ⛔ BLOKKOLVA

## Fázis 5: Jelentés és Zárás

- [x] **Task 5.1: Audit Jelentés Összeállítása** - ✅ KÉSZ
- [x] **Task 5.2: Következő Lépések Meghatározása** - ✅ KÉSZ
