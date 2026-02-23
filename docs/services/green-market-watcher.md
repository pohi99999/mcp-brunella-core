# Green Market Watcher B2B - Szolgáltatás Leírása

## 📊 Áttekintés
A **Green Market Watcher B2B** egy professzionális piaci hírszerző és konkurencia figyelő szolgáltatás. Az "EV Hunter" (Green Lightning) és az "Industrial Machine Hunter" technológiákra épülve, bármilyen termék vagy szolgáltatás piacát képes monitorozni, azonosítva a legjobb vételi és befektetési lehetőségeket.

---

## 🛠️ Főbb Funkciók
- **Dinamikus Web Scraping:** Bármilyen weboldalról (e-kereskedelem, aukciók, ingatlan) kinyeri az árakat, készletadatokat és műszaki leírásokat.
- **MI-alapú Potenciál Pontozás:** Összeveti az árakat a piaci átlaggal, elemzi a keresletet és a ritkaságot, majd 0-100 közötti pontszámot ad.
- **Historikus Adatkezelés:** LanceDB-ben tárolja a korábbi árakat, így láthatóvá válnak a trendek és az áresések.
- **Azonnali Riasztások:** Ha egy figyelt termék ára jelentősen esik, vagy egy új, magas pontszámú ajánlat tűnik fel, a rendszer azonnal értesíti Önt (Slack, Email).
- **Napi Piaci Jelentés:** Minden reggel összefoglaló dokumentumot kap a legfontosabb változásokról.

---

## 💰 Üzleti Modell
- **Havi előfizetés:** 50.000 Ft - 150.000 Ft / hónap (függően a figyelt oldalak számától és a frissítési gyakoriságtól).
- **Setup fee:** 50.000 Ft (Egyedi selectorok beállítása és n8n integráció).

---

## 🚀 Ügyfél Konfiguráció
Az ügyfél az alábbiakat állíthatja be a BAS Dashboardon:
1.  **Cél URL-ek:** Mely oldalakat figyeljük?
2.  **Selectorok:** Melyik elemen van az ár és a név? (AI-segítséggel is beállítható).
3.  **Kulcsszavak:** Milyen termékekre fókuszáljunk?
4.  **Értesítési küszöb:** Mekkora áresésnél kér azonnali riasztást?

---

## 🛡️ Technológia
- **RobotkezV2 (Playwright):** A böngészéshez.
- **FastAPI / Python:** Az adatelemzéshez.
- **LanceDB:** A nagysebességű vektoros és strukturált tároláshoz.
- **n8n:** Az automatizált jelentésküldéshez.

---
*BAS Market Intelligence Team | 2026-02-23*
