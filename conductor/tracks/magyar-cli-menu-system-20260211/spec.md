# Specifikáció: Magyar CLI Menürendszer (Teljes Átírás)

**Track ID:** `magyar-cli-menu-system-20260211`
**Spec státusz:** `pending_approval`
**Dátum:** 2026-02-12
**Owner:** Claude

## 1. Cél és motiváció

A Brunella CLI-t teljesen magyar nyelvű, **menüvezérelt** (↑/↓ + Enter) felületté alakítjuk.

**Kiemelt szabály:** *NINCS begépelés* (klasszikus parancsok helyett interaktív menük). A power-usereknek később lehet „haladó mód”, de ez a spec első körben nem tartalmazza.

## 2. Scope

### In-scope

- Új belépési pont: `src/cli-hu.ts` (magyar főmenü)
- Főmenü + almenü routing:
  - 🤖 Ügynökök
  - 📋 Track-ek
  - 💬 Chat (Cloudflare)
  - 🧪 Tesztek
  - 📊 Rendszer státusz
  - ⚙️ Beállítások
  - ❌ Kilépés
- Szép CLI UX:
  - banner (figlet)
  - keretezés (boxen)
  - színek (chalk)
  - töltő animáció (ora)
  - táblázatok (cli-table3)
- ESC vagy `q` gyors kilépés *minden* szinten

### Out-of-scope (első iteráció)

- Teljes „parancssoros” kompatibilitás megőrzése (a régi parancsok maradhatnak, de nem cél mindent azonnal refaktorálni)
- Remote (Cloudflare/GitHub) auth wizard-ok
- TUI (blessed) jellegű, teljes képernyős UI

## 3. UX és interakciós elvek

- Minden menüpont egyetlen képernyőn
- „Vissza” opció minden almenüben
- Hiba esetén: emberi, magyar üzenet + „Vissza” lehetőség

## 4. Technológiai döntések

- Menü: **inquirer** (list/expand/confirm)
  - indok: stabil, bevált nyíl-navigáció
- Kimenet:
  - chalk (színek)
  - boxen (keret)
  - ora (spinner)
  - cli-table3 (táblázat)

## 5. Funkcionális követelmények (Acceptance mapping)

1. Magyar főmenü ✅
2. Minden almenü magyar ✅
3. Nyíl navigáció (inquirer) ✅
4. Vizualizáció (chalk/boxen/figlet) ✅
5. Minden meglévő funkció menüből ✅
6. Gyors kilépés (ESC/q) ✅

## 6. Integráció

- A menük mögött a meglévő CLI/agent funkcionalitást hívjuk meg (delegálás, status, track update, stb.)
- A menü „wrapper” nem duplikáljon üzleti logikát: *csak* bemenet/irányítás + output formázás.

## 7. Tesztelés

- Unit teszt: menü routing (pure függvények / handler mapping)
- Snapshot jellegű teszt: a menü struktúra nem változik véletlenül
- E2E (opcionális): non-interactive smoke (pl. `--help` / dry-run mód)

## 8. Kockázatok

- Interaktív menü nehéz automatizáltan tesztelni → handler-mappinget külön, tiszta függvényként kezelni.
- Windows terminál kompatibilitás (ESC, nyíl) → inquirer beállítások és fallback keybinding.

## 9. Approval checklist

- [ ] A menüstruktúra lefedi a jelenlegi CLI képességeket
- [ ] Kilépés / vissza UX minden szinten definiált
- [ ] Dependencies elfogadva
- [ ] Teszt-stratégia elfogadva
