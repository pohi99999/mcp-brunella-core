# Specification: Dashboard UI & Functionality Restoration

## Context
A felhasználó jelentése szerint a Dashboard (Localhost:3000) felülete működik (bejelentkezés sikeres), de a funkciók hiányosak vagy nem működnek:
- **Chat felület:** Nem működik egyáltalán.
- **Agents (Ügynökök) kezelése/monitorozása:** Üres, nem tölt be adatokat.
- **Kezdőlap:** Hiányos funkciók.

## Goals
1.  **Chat Funkcionalitás:** A chat felületnek képesnek kell lennie üzenetek küldésére és fogadására a backendtől/ügynököktől.
2.  **Agents Monitorozás:** Az "Agents" oldalon meg kell jelennie a regisztrált ügynökök listájának, státuszának (pl. IDLE, BUSY) és esetleg a logjaiknak.
3.  **Adatszinkronizáció:** A frontendnek (React) és a backendnek (Express) megfelelően kell kommunikálnia (API hívások, WebSocket/SSE).

## Technical Constraints
- **Frontend:** React + Vite (feltételezhetően Tailwind CSS).
- **Backend:** Node.js / Express (vagy hasonló) a `src/server` könyvtárban.
- **Kommunikáció:** REST API vagy SSE/WebSocket.

## Acceptance Criteria
- [ ] A felhasználó be tud lépni (ez már működik, de meg kell őrizni).
- [ ] A Chat felületen elküldött üzenet megjelenik, és a rendszer (Mock vagy Valós) válaszol rá.
- [ ] Az Agents oldalon kilistázódnak az aktív ügynökök.
- [ ] A böngésző konzolban nem lehetnek "Connection refused" vagy 404-es API hibák a fő funkciók használatakor.
