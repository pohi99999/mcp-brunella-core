# Plan: API Documentation & Swagger

**Track ID:** `docs_swagger_openapi_20260130`
**Cél:** OpenAPI (Swagger) dokumentáció generálása a Node.js backendhez, hogy a fejlesztők és ügynökök könnyen felfedezhessék az API-t.

## 1. Helyzetkép
- A backend Express.js alapú.
- Sok API végpont van (`/api/health`, `/api/agents`, `/api/ollama`...), de nincs formális specifikáció.
- A dokumentáció jelenleg Markdown fájlokban van szétszórva.

## 2. Lépések

- [x] **1. Függőségek Telepítése:**
    - `npm install swagger-jsdoc swagger-ui-express`
    - `npm install -D @types/swagger-jsdoc @types/swagger-ui-express`
- [x] **2. Swagger Konfiguráció (`src/server/swagger.ts`):**
    - OpenAPI definíció (cím, verzió).
    - `swagger-jsdoc` opciók beállítása.
- [x] **3. Végpontok Dokumentálása:**
    - JSDoc kommentek hozzáadása a `src/server/web.ts` fájlban a legfontosabb végpontokhoz.
- [x] **4. Swagger UI Integráció:**
    - `app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs))` a `web.ts`-ben.
- [x] **5. Verifikáció:**
    - Szerver indítása (`npm start`).
    - `/api-docs` megnyitása böngészőben (vagy curl ellenőrzés).

## 3. Kockázatok
- A kód "zajos" lesz a sok kommenttől (ezért érdemes lehet később külön fájlba szervezni a route definíciókat).