# Megvalósítási Terv: Dashboard MCP Natív Összekapcsolás

Ez a terv a Dashboard frontend és a Brunella Core szerver közötti natív MCP WebSocket kapcsolat kiépítését részletezi, követve a TDD (Test-Driven Development) módszertant.

## 1. Fázis: Infrastruktúra és Biztonság
Ebben a fázisban kialakítjuk a WebSocket kapcsolat alapjait és az API kulcs alapú hitelesítést.

- [x] **Feladat: WebSocket Szerver felkészítése a Core-ban**
    - [x] Task: Teszt írása: WebSocket handshake és API kulcs ellenőrzés (Red)
    - [x] Task: Implementáció: WebSocket szerver indítása a backend-en (Green)
    - [x] Task: Refaktorálás és biztonsági ellenőrzés
- [x] **Feladat: Dashboard Auth Interceptor**
    - [x] Task: Teszt írása: API Key beillesztése a kapcsolat felvételekor (Red)
    - [x] Task: Implementáció: Kliens oldali hitelesítési logika (Green)
- [x] **Feladat: Conductor - User Manual Verification '1. Fázis' (Protocol in workflow.md)**

## 2. Fázis: Zustand Állapotkezelés és useMCP Hook
Létrehozzuk a központi állapotkezelőt és a React hook-ot a kommunikációhoz.

- [x] **Feladat: Zustand Store kialakítása**
    - [x] Task: Teszt írása: Store alapértelmezett értékei és update funkciók (Red)
    - [x] Task: Implementáció: MCP store létrehozása (kapcsolat, eszközök, naplók) (Green)
- [x] **Feladat: useMCP() Hook implementálása**
    - [x] Task: Teszt írása: Csatlakozás és üzenetküldés tesztelése (Red)
    - [x] Task: Implementáció: useMCP hook megírása WebSocket támogatással (Green)
- [x] **Feladat: Conductor - User Manual Verification '2. Fázis' (Protocol in workflow.md)**

## 3. Fázis: Eszközfelfedezés (Tool Discovery) és Dinamikus UI
Automatizáljuk az MCP eszközök listázását és megjelenítését.

- [x] **Feladat: Tool List lekérése**
    - [x] Task: Tool discovery kérés és válasz feldolgozása (Red)
    - [x] Task: Szerver oldali `list_tools` hívás bekötése WebSocketre (Green)
- [x] **Feladat: Dinamikus Tool Form Generátor**
    - [x] Task: UI komponens generálása a tool sémája alapján (Red)
    - [x] Task: React komponens, amely JSON séma alapján inputokat generál (Green)
- [x] **Feladat: Tool Futtatás és Eredmény Kezelés**
    - [x] Task: Tool futtatás indítása és az eredmény visszajelzése (Red)
    - [x] Task: `call_tool` logika és eredmény megjelenítő (Green)
- [x] **Feladat: Conductor - User Manual Verification '3. Fázis' (Protocol in workflow.md)**

## 4. Fázis: Valós idejű Streamelés és Monitorozás
Bekötjük a naplókat és a rendszer metrikákat valós időben.

- [x] **Feladat: Rendszernapló Stream (Logs)**
    - [x] Task: Folyamatos naplóbejegyzések fogadása (Red)
    - [x] Task: Backend log-routing és frontend kijelzés (Green)
- [x] **Feladat: Rendszer Metrikák (Monitor)**
    - [x] Task: Metrikák periodikus frissülése (Red)
    - [x] Task: `monitor_get_metrics` bekötése és Dashboard grafikonok frissítése (Green)
- [x] **Feladat: Conductor - User Manual Verification '4. Fázis' (Protocol in workflow.md)**

## 5. Fázis: Végső Integráció és Mock Eltávolítás
Tisztítjuk a kódot és eltávolítjuk a statikus adatokat.

- [x] **Feladat: Mock adatok teljes kivezetése**
    - [x] Task: Dashboard működésének ellenőrzése mock modulok nélkül (Red)