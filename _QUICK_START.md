# 🚀 Gyors Indítás - Asszisztens Eszközök

## Windows PowerShell / CMD parancsok

Nyisd meg a PowerShell-t vagy CMD-t a `F:\mcp-brunella-core` mappában és használd ezeket:

---

### 📋 AI Kontextus (bemásolni AI-nak)
```powershell
npm run context          # Rövid verzió
npm run context:full     # Teljes verzió
```
Utána nyisd meg: `_AI_CONTEXT.md` és másold be az AI-nak!

---

### 🔄 Szinkronizálás (dokumentáció frissítés)
```powershell
npm run sync             # Minden frissítése
npm run sync:check       # Csak ellenőrzés
npm run sync:fix         # Automatikus javítás
```

---

### 👁️ Változás Figyelő
```powershell
npm run watch:changes    # Mi változott? Van hiba?
```
Ha hibát talál → `_FIX_INSTRUCTIONS.md` - másold be a kódoló AI-nak!

---

### 📝 Chat Napló
```powershell
npm run chatlog:add      # Új bejegyzés (kérdésekre válaszolsz)
npm run chatlog:list     # Korábbi beszélgetések
npm run chatlog:search "kulcsszó"   # Keresés
```

---

## 🎯 Tipikus Munkafolyamat

### Új AI-val kezdesz dolgozni?
1. `npm run context`
2. Nyisd meg `_AI_CONTEXT.md`
3. Másold be az AI-nak
4. Írd le mit szeretnél

### Kódolás után?
1. `npm run watch:changes` - van hiba?
2. `npm run sync` - dokumentáció frissítés
3. `npm run chatlog:add` - írd be mit csináltatok

### Reggeli rutin?
1. `npm run sync`
2. `npm run watch:changes`

---

## 📁 Generált Fájlok

| Fájl | Mire való |
|------|-----------|
| `_AI_CONTEXT.md` | Másold be új AI-nak |
| `_CHANGE_REPORT.md` | Mi változott a projektben |
| `_FIX_INSTRUCTIONS.md` | Hibák javítási utasításai |
| `_PROJECT_STRUCTURE.md` | Projekt struktúra áttekintés |
| `_AI_CHAT_LOG.md` | Beszélgetések naplója |

Ezek a fájlok `_` aláhúzással kezdődnek, hogy a lista elején legyenek!
