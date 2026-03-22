# BAS Dashboard v3.0 Design Specifikáció

**Dátum:** 2026-03-22
**Státusz:** Validált (Brainstorming lezárva)
**Téma:** Teljes vizuális és strukturális refaktorálás (Integrated Shell koncepció)

## 1. Architektúra: Integrated Shell
A felületet három fő függőleges zónára osztjuk a stabilitás és a nagy felbontású megjelenítés érdekében:
- **Sticky Header:** Fix 64px magasság, éles `zinc-800` szegély, rendszerszintű állapotjelzőkkel.
- **Masonry Main Content:** Dinamikus munkaterület, ahol a kártyák a tartalmuknak megfelelő magasságot veszik fel, elkerülve a torzulást.
- **Docked Terminal Footer:** Fixen az aljára rögzített (sticky/fixed) naplózó felület, `max-h-[400px]` korláttal.

## 2. Vizuális Stílus: Ultra-Minimalist High-Res
- **Színpaletta:** Mélyfekete (`#020203`) háttér, `zinc-950` kártyák, `zinc-800` tűvékony hairline szegélyek.
- **Tipográfia:** `antialiased` renderelés mindenhol. Kártyacímek: `text-[11px] font-medium tracking-wider uppercase text-zinc-500`. Logok: `JetBrains Mono` vagy `ui-monospace`.
- **Effektek:** Finom `backdrop-blur-md` a kártyákon és a Sidebar-on. Aktív állapot jelzése: `ring-1 ring-emerald-500/20` belső izzás.
- **Ikonok:** `Lucide-react` egységesen `size={14}` és `strokeWidth={1.5}`.

## 3. Funkcionális Részletek
### Masonry Grid
- A `WidgetGrid.tsx` átalakítása Tailwind `columns-x` alapú elrendezésre a kényszerített `fr` sorok helyett.
- Egységes `p-4` belső padding a moduloknál.

### Docked Terminal (Log Viewer)
- Alulra rögzített, monospaced nézet.
- **Auto-scroll:** Intelligens görgetés (csak akkor követi az alját, ha a felhasználó nem navigált feljebb).
- **Színkódolt adatfolyam:** `INFO` (kék), `SUCCESS` (menta), `WARNING` (borostyán), `ERROR` (neon-piros).

## 4. Technológiai Stack
- React / Tailwind CSS
- Lucide React (Ikonok)
- GSAP / Framer Motion (finom átmenetekhez a masonry átrendeződésnél)
