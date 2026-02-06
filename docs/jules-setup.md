# Jules Self-Healing CI – Beállítás

A Jules (Google AI coding agent) CI integrációja: ha a CI tesztek elbuknak, a workflow automatikusan Jules-t hívja az API-n keresztül a javítással.

---

## 1. Jules API kulcs

**Igen, az API kulcs pont erre való.** A Jules REST API-t használjuk, nincs szükség böngészős bejelentkezésre.

1. Menj a [jules.google.com/settings](https://jules.google.com/settings) oldalra
2. **API Key** szekció → **Generate API Key**
3. Másold ki és tárold biztonságosan (nem jelenik meg újra)

---

## 2. GitHub Secret beállítása

1. Repo → **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret**
3. Név: `JULES_API_KEY`, érték: a generált API kulcs

---

## 3. Workflow működése

A `.github/workflows/jules-self-heal.yml` a **hivatalos** `google-labs-code/jules-invoke@v1` actiont használja:

- CI bukás után automatikusan fut
- A `JULES_API_KEY` secret-tel autentikál
- Jules elemzi a hibát, javít, és PR-t nyit

Nincs szükség CLI telepítésre – minden az API-n keresztül megy.

---

## 4. Jules CLI (lokális, opcionális)

Ha lokálisan is használnád a Jules-t:

```bash
npm install -g @google/jules
jules login   # Böngészős Google auth (első használat)
jules version
```

---

## 5. Repo beállítás (Setup script + env vars)

Másolható konfiguráció: **`docs/jules-repo-config.md`** – setup script és environment változók a Jules felülethez.

---

## 6. Kapcsolódó fájlok

| Fájl | Cél |
|------|-----|
| `.github/workflows/jules-self-heal.yml` | CI workflow – jules-invoke action |
| `docs/jules-repo-config.md` | Másolható setup script + env vars a Jules felülethez |
| `scripts/run_jules_self_heal.mjs` | Alternatív: Jules CLI hívás (ha nem actiont használsz) |
| `testing/TEST_BOOK.md` | Szcenáriók Jules számára |
| `src/tools/julesCliTool.ts` | MCP tool – Jules parancsok lokálisan |
