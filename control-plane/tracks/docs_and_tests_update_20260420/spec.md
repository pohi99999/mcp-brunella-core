# Track: A meglévő AI multi-agent rendszer dokumentációjának és tesztelési protokolljának frissítése

## Cél
A projekt meglévő AI multi-agent rendszerének dokumentációját és tesztelési protokollját frissíteni, hogy az tükrözze a legújabb fejlesztéseket, konvenciókat és a kódminőségi sztenderdeket. Ez magában foglalja a `README.md`, `.ai/FOSZAL.md`, `.ai/gemini.md` és a `conductor/tracks.md` fájlok, valamint a tesztelési eljárások áttekintését és szükség szerinti frissítését.

## Funkcionális követelmények
- A `README.md` fájl teljes mértékben tükrözi a projekt aktuális architektúráját, kódkonvencióit, fejlesztési workflow-ját és parancsreferenciáját.
- Az `.ai/FOSZAL.md` és az `.ai/gemini.md` fájlok frissítése a legújabb munkamenet-naplókkal és releváns információkkal.
- A `conductor/tracks.md` fájl pontosan listázza az összes aktív, befejezett és archivált tracket.
- A projekt tesztelési protokollja (pl. `package.json`-ban definiált tesztparancsok, `vitest.config.ts` konfigurációk) naprakész és hatékonyan lefedi a kulcsfontosságú komponenseket.
- Biztosítani kell, hogy a tesztelési lefedettség megfeleljen az EPP v2 protokollban meghatározott minimum követelményeknek.

## Nem-funkcionális követelmények
- **Fenntarthatóság:** A dokumentáció legyen könnyen érthető és karbantartható a jövőbeli fejlesztések során.
- **Pontosság:** Az összes dokumentált információ pontosan tükrözze a kód aktuális állapotát.
- **Teljesítmény:** A tesztelési protokollnak hatékonyan és gyorsan kell futnia, anélkül, hogy indokolatlanul lelassítaná a fejlesztési ciklust.
- **Biztonság:** A teszteknek ki kell terjedniük a biztonsági szempontokra is, ahol releváns.

## Kiemelt komponensek
- `README.md`
- `.ai/FOSZAL.md`
- `.ai/gemini.md`
- `conductor/tracks.md`
- `package.json` (tesztparancsok)
- `vitest.config.ts` és más tesztkonfigurációs fájlok
- `scripts/sync_foszal.py`