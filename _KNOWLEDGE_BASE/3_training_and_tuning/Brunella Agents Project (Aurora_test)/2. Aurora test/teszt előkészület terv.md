Résztvevők: Brunella (fő ügynök), támogató MI ügynökök, emberi facilitátor

1. Fázis – Bevezetés és küldetésátvétel (15 perc)
Narratíva:
A nemzetközi kutatási konzorcium adatközpontjában kritikus rendszerhiba történt. A projekt, amely egy új generációs energiatároló technológiát fejleszt, veszélybe került. A csapat feladata: adatmentés, hibaelemzés, stratégiai döntés, kommunikáció és végrehajtás.
Feladat:
- Rövid eligazítás a célokról és a szabályokról.
- Minden résztvevő kap egy szerepet (lásd lent).

2. Fázis – Szerepkiosztás


3. Fázis – Adatmentés és előszűrés (30 perc)
Adatminta (részlet a szimulált logfájlból):

[2025-09-02 08:14:22] ERROR: Module E-Storage-Alpha failed checksum
[2025-09-02 08:15:10] WARNING: Temperature spike detected in Node-7
[2025-09-02 08:16:45] INFO: Backup initiated by system
[2025-09-02 08:17:03] ERROR: Data packet loss at 14%
[2025-09-02 08:18:55] CRITICAL: Unauthorized access attempt detected

Feladat:
• 	 és  használatával szűrni a kritikus hibákat.
• 	Zero‑Shot Promptinggal kategorizálni a hibákat (biztonsági, hardver, szoftver).


4. Fázis – Problémafeltárás (40 perc)
Minta Few‑Shot Prompt:

Example 1: "Temperature spike" → Hardware cooling failure
Example 2: "Checksum failed" → Data integrity issue
Example 3: "Unauthorized access" → Security breach

Feladat:
- Azonosítani a hibák ok‑okozati láncát Chain‑of‑Thought módszerrel.
- Dokumentálni a logikai lépéseket.

5. Fázis – Stratégiai tervezés (40 perc)
Tree‑of‑Thought feladat:
- Kidolgozni 3 különböző helyreállítási stratégiát (pl. azonnali patch, teljes rendszer rollback, hibrid megoldás).
- Meta‑Promptinggal optimalizálni a promptot a legjobb terv kiválasztásához.

6. Fázis – Kommunikációs adaptáció (30 perc)
Role‑Based Prompting feladat:
Ugyanazt a tervet kell prezentálni:
- Mérnöknek – technikai részletekkel.
- Projektmenedzsernek – idő- és erőforrás‑tervvel.
- Befektetőnek – üzleti érték és ROI hangsúlyozásával.

7. Fázis – Minőségbiztosítás (20 perc)
Self‑Critique Loop:
- A teljes anyag önkritikus átnézése.
- Iterative Refinement: 2–3 körös javítás.

8. Fázis – Váratlan események (beépítve a fázisok közé)
Példák:
- Új logfájl érkezik, amely ellentmond az eddigi következtetéseknek.
- A befektető hirtelen új prioritást ad (pl. költségcsökkentés).
- Egy kulcsmodul fejlesztője szabadságra megy, és nem elérhető.

9. Fázis – Zárás és értékelés (15 perc)
Értékelési szempontok:
- Pontosság (adatfeldolgozás hibátlansága)
- Kreativitás (megoldási utak újdonsága)
- Adaptivitás (kommunikációs stílusváltás minősége)
- Koherencia (végső anyag logikai felépítése)
- Időmenedzsment (feladatok teljesítése a határidőn belül)

💡 Pro Tipp: A szimuláció végén érdemes egy rövid „tanulságkört” tartani, ahol minden ügynök elmondja, melyik technika volt számára a leghasznosabb, és hogyan lehetne még jobban integrálni a következő kihívásba.
