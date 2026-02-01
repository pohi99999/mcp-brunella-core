# Specifikáció: EV Hunter Bot Integráció

## 1. Áttekintés
Az EV Hunter Bot egy Python alapú automatizált keresőrendszer, amely elektromos autó hirdetéseket figyel az AutoScout24 (Ausztria, Szlovénia) és Mobile.de oldalakon. A bot célja a legjobb ár-érték arányú ajánlatok (Score alapú szűrés) azonosítása és email értesítés küldése.

## 2. Funkcionális Követelmények
- **Web Scraping:** AutoScout24.at, AutoScout24.si és mobile.de oldalak monitorozása.
- **Szűrés:** 10.000 - 19.000 EUR árkategória, specifikus modellek (BMW i3, Nissan Leaf, stb.).
- **Értékelés (Scoring):** Ár, kilométeróra állás és évjárat alapján 0-100 közötti pontszám számítása.
- **Értesítés:** Gmail SMTP-n keresztül (App Password használatával) HTML táblázat és Excel melléklet küldése.
- **Ütemezés:** Napi 3 alkalommal (08:00, 13:00, 18:00) vagy manuális 'test' indítás.

## 3. Ügynök Integráció (BAS)
- **EV_Hunter ügynök:** Létrehozunk egy új ügynököt, amely képes paraméterezni és indítani a botot.
- **Monitorozás:** Az ügynök követi a bot futását és a talált autók számát jelenti a Brunella Dashboardon.

## 4. Telepítési Paraméterek
- **Python:** 3.8+
- **Függőségek:** requirements.txt alapján.
- **Email:** Gmail App Password alapú hitelesítés.
