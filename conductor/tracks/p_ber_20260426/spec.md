# p-ber (Bér és munkaügy) Specifikáció

## Áttekintés
A p-ber egy rugalmas bérszámfejtési és munkaügyi megoldás, amely a Telegram és Google Sheets ökoszisztémára épít, a Brunella Agent System motorját használva (`Z:\001_Workspace\ber,es munkaugy\`). A cél az operatív munka megkönnyítése gyors interakciókkal és átlátható táblázatos adatkezeléssel.

## Funkcionális Követelmények
- **Bérszámfejtés:** Havi bérszámfejtési kalkulációk, bérjegyzékek generálása PDF-ben.
- **Távollétkezelés:** Szabadságok és betegszabadságok rögzítése (akár Telegramon keresztül).
- **Munkavállalói adatok:** Személyi törzsadatok és dokumentumok kezelése.
- **Adatszolgáltatás:** Havi adó- és járulékbevallások (08-as bevallás) adatainak előkészítése.

## Nem-funkcionális Követelmények
- **Interfész:** Telegram Bot az interakciókhoz és értesítésekhez.
- **Adattárolás / Megjelenítés:** Google Sheets (a Brunella GWS CLI/GWS-Sheets képességeit használva).
- **Backend / Motor:** Brunella (Python/FastAPI) végzi az adatok feldolgozását és a Sheets szinkront.
- **Biztonság:** Szigorú hozzáférés-kezelés a Telegram és Google Workspace azonosítókkal.

## Hatókörön kívül (Out of Scope)
- Hagyományos webes frontend (első körben csak Telegram/Sheets).
- Könyvelési modul (az a P-book track feladata).

## Elfogadási Kritériumok
- Sikeres adatírás és olvasás a kijelölt Google Sheets táblázatba a Brunella ügynök által.
- A Telegram Bot válaszol a bérszámfejtéssel kapcsolatos alapvető lekérdezésekre.
- Egy minta bérjegyzék sikeres generálása.
