# Termék Irányelvek

## Szövegezés és Stílus
- **Nyelv**: A felhasználói felület és a dokumentáció elsõdleges nyelve a magyar. A forráskód és a belsõ API dokumentáció angol nyelvû.
- **Tónus**: Mérnöki pontosságú, professzionális és közvetlen. Kerüljük a sallangokat.

## UX Alapelvek
- **Zero Broken Windows**: Minden kiadott funkciónak stabilnak és hibamentesnek kell lennie.
- **Vizuális visszajelzés**: A Dashboardon minden folyamat (különösen a hosszú futású ágens feladatok) valós idejû állapotjelzéssel rendelkezzen.
- **Responsivity**: A felületnek mobilra is optimalizáltnak kell lennie.

## Ágens Viselkedés (EPP v2)
- **Stop-and-Fix**: Hiba esetén az ágens azonnal álljon meg, jelentse a hibát, és kérjen javítást vagy utasítást.
- **Visszakövethetõség**: Minden ágens döntésnek és akciónak naplózottnak kell lennie a `logs/` mappában és a Dashboardon.
