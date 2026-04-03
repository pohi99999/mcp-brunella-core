# Invoice to Sheets Automation - Szolgáltatás Leírása

## 📊 Áttekintés
Az **Invoice to Sheets Automation** egy intelligens adminisztrációs megoldás, amely leveszi a válláról a számlák kézi rögzítésének terhét. A rendszer automatikusan figyeli a kijelölt Gmail fiókot, kinyeri a PDF számlákból a legfontosabb adatokat, és rendszerezetten rögzíti azokat egy Google Sheets táblázatban.

---

## 🛠️ Főbb Funkciók
- **Automatikus Gmail Figyelés:** Keresés "számla", "invoice" kulcsszavakra vagy specifikus feladókra.
- **MI-alapú Adatkinyerés (OCR):** Számlaszám, eladó neve, összeg, pénznem és határidők pontos kinyerése.
- **Duplikátum Detektálás:** Megakadályozza ugyanazon számla többszöri rögzítését.
- **Google Sheets Integráció:** Azonnali, strukturált adatrögzítés a felhőben.
- **Pénzügyi Riport:** Havi összesítők és anomália detekció (pl. váratlan áremelkedés).

---

## 💰 Üzleti Modell
- **Egyszeri Setup díj:** 200.000 Ft (Google Cloud Console beállítás, Gmail & Sheets integráció).
- **Havi üzemeltetési díj:** 25.000 Ft (Korlátlan száma feldolgozás, rendszerfelügyelet).

---

## 🚀 Kliens Oldali Beállítások (Setup Guide)

A szolgáltatás élesítéséhez az alábbi lépésekre van szükség:

### 1. Google API Hozzáférés
A kliensnek Google service-account hitelesítést kell biztosítania a Sheets szinkronhoz:

- `GOOGLE_CREDENTIALS_FILE=./credentials/google-service-account.json`, vagy
- `GOOGLE_SERVICE_ACCOUNT_JSON={...}` inline secret injectionnel.

Az interaktív BAS Google Workspace tooling külön Desktop OAuth2 credential surface-et használ (`google-oauth2-credentials.json`), ezt nem kell összekeverni a service-account alapú invoice automatizálással.

### 2. Engedélyek
A rendszernek hozzáférést kell adni az alábbi scope-okhoz:
- `gmail.modify` (PDF-ek olvasásához és letöltéséhez)
- `spreadsheets` (A táblázat írásához)
- `drive` (A fájlok ideiglenes kezeléséhez)

### 3. Konfiguráció
Futtassa a mellékelt setup scriptet:
```powershell
.\scripts\setup_invoice_automation.ps1
```
A script bekéri:
- A figyelt Gmail label nevét (pl. "Feldolgozandó Számlák")
- A cél Google Sheets URL-jét vagy ID-ját.

---

## 🛡️ Biztonság és GDPR
- A számlák PDF fájljai csak a feldolgozás idejéig tárolódnak ideiglenesen.
- Az adatok titkosított LanceDB adatbázisban kerülnek tárolásra a duplikátum ellenőrzéshez.
- Nincs harmadik fél számára átadott adat.

---
*BAS Finance Module Team | 2026-02-23*
