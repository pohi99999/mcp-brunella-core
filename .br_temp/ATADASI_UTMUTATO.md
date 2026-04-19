# 📋 Iszapfaló Kft – n8n Automatizációs Rendszer
## Átadási Útmutató (2025-01-12)

---

## 🎯 ÖSSZEFOGLALÓ

Az n8n.cloud automatizációs rendszer **6 workflow AKTÍV**, további 9 workflow ismert okokból inaktív és az alábbiakban leírt lépésekkel aktiválható. Az átadás után a vezető elvégezheti a szükséges kézi beállításokat a jelszavak és hitelesítő adatok bevitelével.

**Belépési URL:** https://iszapfalo.app.n8n.cloud  
**Fiók:** peterpohankapersonal@gmail.com

---

## ✅ 1. MŰKÖDŐ AUTOMATIZÁCIÓK (6 db AKTÍV)

### 1. 📅 Airtable ↔ Google Calendar feladat szinkron
- **Mit csinál:** Az Airtable-ban létrehozott feladatokat automatikusan hozzáadja Google Calendar-ba
- **Trigger:** Airtable rekord módosítás (polling, 1 perces időközönként)
- **ID:** `g1W73bdF75DeBdG7`

### 2. 📱 Feladatok státuszállítás Telegram chaten
- **Mit csinál:** Telegramból küldött üzenetekre frissíti a feladatok státuszát az Airtable-ban
- **Trigger:** Telegram üzenet (automatikus)
- **ID:** `niT8FAq0FXIZJZta`

### 3. 📧 Gmail → Airtable kimenő ajánlat rögzítés
- **Mit csinál:** A kimenő ajánlat emaileket automatikusan rögzíti az Airtable-ban
- **Trigger:** Gmail polling (5 perces időközönként)
- **ID:** `k4jOPvARKksQzEu5`

### 4. 📬 Gmail kategorizáló (ÚJ, 38 node)
- **Mit csinál:** Bejövő emaileket automatikusan kategorizálja (munkakérés, ajánlat, számlák, stb.)
- **Trigger:** Gmail polling
- **ID:** `9uvNwFH4uZdJZz6O`

### 5. 🗓️ Google Calendar → Airtable Szinkron
- **Mit csinál:** Google Calendar eseményeket szinkronizálja az Airtable-ba
- **Trigger:** Polling / webhook
- **ID:** `8VqluKFPj0pkCRKR`

### 6. 🔔 Heti Emlékeztető (Csütörtök 16:00)
- **Mit csinál:** Minden csütörtökön 16:00-kor Telegram értesítést küld a heti feladatokról
- **Trigger:** Ütemezett (cron)
- **ID:** `ZeNCF1ZIg35bxkPl`

---

## 🔧 2. INAKTÍV WORKFLOW-OK ÉS JAVÍTÁSI TEENDŐK

### 🔴 KRITIKUS PRIORITÁS

#### 2.1 Telegram Parancsok (/statusz, /het)
- **ID:** `3OZ3j43U7qIjE9bQ`
- **Hiba:** `Credential "Telegram account 4" nem létezik`
- **Mit csinál:** Telegram parancsokra (/statusz, /het) válaszol a feladatok listájával
- **Teendő:**
  1. n8n → Settings → Credentials → **+ Add Credential**
  2. Típus: **Telegram API**
  3. Név: **Telegram account 4** (pontosan így!)
  4. Bot Token: A Telegram bot token-je (lásd MOST_KELL_ELOLVASM.md vagy @BotFather-től)
  5. Mentés → Workflow újraaktivál

#### 2.2 AI Agent Asszisztens
- **ID:** `GlqQf7zYh1vTu7N9`
- **Hiba:** Ugyanaz – `Telegram account 4` credential hiányzik
- **Teendő:** Ugyanaz mint 2.1 – ha az ott létrehozott credential-t menti, ez is megoldódik

---

### 🟡 KÖZEPES PRIORITÁS

#### 2.3 Geppark Karbantartás (All-in-One)
- **ID:** `SstCWGS6YpkPEfAy`
- **Hiba:** API hibát ad aktiváláskor, de manuálisan aktiválható
- **Mit csinál:** Géppark karbantartási naplót vezet, AI-val elemzi a gépek állapotát
- **Teendő:**
  1. n8n felületen nyisd meg a workflow-t
  2. Jobb felső sarokban kapcsold fel az **"Active"** kapcsolót
  3. Ha nem engedi, ellenőrizd a **Webhook** és **OpenAI** credential beállítást
  4. A Webhook URL-t meg kell osztani a géppark-adatokat küldő rendszerrel:
     - URL: `https://iszapfalo.app.n8n.cloud/webhook/geppark` (vagy hasonló)
  5. **OpenAI credential** beállítása szükséges: Settings → Credentials → OpenAI API key

#### 2.4 Okos Ajánlat Asszisztens
- **ID:** `fHJIvrbFaY012dNp`
- **Hiba:** Ugyanaz mint Geppark – webhook alapú, API nem ismeri fel
- **Mit csinál:** Webhook-on fogadja az ajánlatkéréseket, AI-val szöveges ajánlatot készít
- **Teendő:** Ugyanaz mint 2.3 – manuális aktiválás n8n felületen + OpenAI credential

#### 2.5 Munkaidő Nyilvántartás
- **ID:** `WMAB7hYqJObUwAHN`
- **Hiba:** 503 szerver hiba (tranziens)
- **Mit csinál:** Telegram parancsokkal rögzíti a munkaidőt Airtable-ba
- **Teendő:** Nyisd meg n8n felületen, kapcsold Active-ra (valószínűleg most már megy)

---

### ⚠️ TECHNIKAI JAVÍTÁST IGÉNYEL

#### 2.6 Telegram Hangvezérlés – Teljes Rendszer
- **ID:** `CZSN8FZBoE8GyFuF`
- **Hiba:** `Unrecognized node type: n8n-nodes-base.openai`
- **Oka:** A workflow régi n8n verzióból lett exportálva; az `openai` node neve megváltozott
- **Teendő:** n8n felületen:
  1. Nyisd meg a workflow-t
  2. Keresd meg a piros/hibás OpenAI node-ot
  3. Töröld, és adj hozzá `@n8n/n8n-nodes-langchain.openAi` típusú node-ot helyette
  4. (Vagy levelezz az n8n supporttal a workflow migrációról)

#### 2.7 Error Monitoring és Logging
- **ID:** `epDHGWixQvrrfAHA`
- **Hiba:** "no node to start the workflow"
- **Oka:** A workflow-ban `n8n-nodes-base.cron` (régi típus) van, de modernebb `scheduleTrigger` kellene
- **Teendő:** n8n felületen:
  1. Cseréld le a Cron node-ot **Schedule Trigger**-re (🕐 ikon, "When: Every week, Thursday 16:00")
  2. Az eredeti kapcsolatok megmaradnak

---

### ⚪ ARCHIVÁLHATÓ (nem szükséges aktiválni)

#### 2.8 Gmail kategorizáló (RÉGI)
- **ID:** `t12ZW64DFqNMPfu9`
- **Oka:** Az ÚJ Gmail kategorizáló (ID: `9uvNwFH4uZdJZz6O`) felváltotta
- **Teendő:** Hagyható inaktívan, vagy törölhető

#### 2.9 AI Agent workflow (általános)
- **ID:** `kJ3UxfFWx6bcli5U`
- **Oka:** Nem Iszapfaló-specifikus teszt workflow
- **Teendő:** Archiválható/törölhető

---

## 🗄️ 3. AIRTABLE BEÁLLÍTÁS

### Base ID: `apptMJgDmNy3I1lMm` (élős adatbázis)

#### Szükséges táblák (ha még nem léteznek):

**MUNKATARSAK**
| Mező neve | Típus | Megjegyzés |
|-----------|-------|------------|
| Név | Text | Teljes név |
| Chat ID | Number | Telegram chat ID (szám!) |
| Email | Email | |
| Státusz | Select | Aktív/Szabadságon/Beteg |

**Munkaidő Nyilvántartás**
| Mező neve | Típus | Megjegyzés |
|-----------|-------|------------|
| Dátum | Date | |
| Kezdés | Text | pl. "08:30" |
| Befejezés | Text | pl. "17:00" |
| Projekt | Text | |
| Megjegyzés | Text | |
| Chat ID | Number | Ki rögzítette |

**MUNKAK**
| Mező neve | Típus | Megjegyzés |
|-----------|-------|------------|
| Megjegyzés | Text | |
| Állapot | Select | Nyitott/Folyamatban/Kész |
| Határidő | Date | |
| Prioritás | Select | Alacsony/Közepes/Magas |
| Munka típusa | Text | |

**SZABADSAGOK**
| Mező neve | Típus | Megjegyzés |
|-----------|-------|------------|
| Kezdés | Date | |
| Befejezés | Date | |
| Típus | Select | Szabadság/Beteg/Home Office |
| Megjegyzés | Text | |
| Státusz | Select | Kérelem/Jóváhagyva/Elutasítva |
| Munkatárs Neve | Text | |

**ERROR_LOG**
| Mező neve | Típus | Megjegyzés |
|-----------|-------|------------|
| Timestamp | DateTime | |
| Workflow ID | Text | |
| Node Name | Text | |
| Error Message | Long Text | |
| Severity | Select | Info/Warning/Error/Critical |
| Execution ID | Text | |

---

## 📱 4. TELEGRAM BOT BEÁLLÍTÁS

### Szükséges Botok:

**1. Fő operatív bot** (Feladatok + Munkaidő + Státuszok)
- Botot a @BotFather Telegram bot-tól kell létrehozni (ha még nem létezik)
- Parancs: `/newbot` → Megadod a nevet → Megkapod a token-t
- Token bevitele: n8n → Settings → Credentials → Telegram account 4

**2. Telegram Csoport beállítás** (ha szükséges)
- A munkások Telegram chat ID-ját az Airtable `MUNKATARSAK` táblában kell tárolni
- Chat ID megkeresése: Telegram-ban a bot-tal `/start` → a bot logjában megjelenik

### Telegram parancsok (ha a Telegram Parancsok workflow aktív):
| Parancs | Funkció |
|---------|---------|
| `/statusz` | Megmutatja a nyitott feladataid |
| `/het` | Heti összefoglaló |
| `/start` | Regisztráció és üdvözlő üzenet |

---

## 🧪 5. TESZTELÉSI PROTOKOLL

### A rendszer átadás utáni ellenőrzése:

**1. Aktív workflow-k gyors teszt:**
```
n8n → Workflows → [workflow neve] → Executions fül
→ Megnézed az utolsó futásokat
→ Zöld = rendben, Piros = hiba
```

**2. Gmail kategorizáló teszt:**
- Küldj magadnak egy teszt emailt az Iszapfaló Gmail-re
- Pár percen belül az n8n Executions-ban megjelenik a feldolgozás
- Ellenőrzés: Gmail-ben a label/cimke megjelent-e?

**3. Telegram bot teszt (ha credential be van állítva):**
- Nyisd meg a Telegram botot
- Küld: `/start`
- Várt válasz: Üdvözlő üzenet

**4. Airtable↔Calendar szinkron teszt:**
- Hozz létre egy feladatot az Airtable-ban
- 1-2 perc múlva megjelenik Google Calendar-ban

---

## 🔑 6. FONTOS FIÓKADATOK ÉS ELÉRHETŐSÉGEK

| Rendszer | URL | Megjegyzés |
|----------|-----|------------|
| n8n Cloud | https://iszapfalo.app.n8n.cloud | Workflow kezelés |
| Airtable | https://airtable.com | Base: apptMJgDmNy3I1lMm |
| Google Calendar | calendar.google.com | OAuth2 already connected |
| Gmail | gmail.com | OAuth2 already connected |
| Telegram Bot | @BotFather | Új bot létrehozáshoz |

**Credential beállítások szükségesek:**
- [ ] **Telegram account 4** – Bot token bekötése (KRITIKUS)
- [ ] **OpenAI API key** – Geppark + Okos Ajanlo workflow-khoz
- [ ] *(opcionális)* Anthropic API key – AI Agent Asszisztens alternatívája

---

## 🚀 7. KÖVETKEZŐ LÉPÉSEK FONTOSSÁGI SORRENDBEN

### Azonnal (ma):
1. **Telegram account 4 credential** létrehozása n8n-ben → Bot token bekötése
   → Ez aktiválja: Telegram Parancsok + AI Agent Asszisztens workflow-kat
2. **Munkaidő Nyilvántartás** manuális aktiválás (503 hiba tranziens volt)

### Ezen a héten:
3. **OpenAI API key** bekötése → Geppark + Okos Ajanlo workflow-k aktiválása
4. **Geppark + Okos Ajanlo** manuális aktiválás n8n felületen
5. Airtable táblák ellenőrzése (léteznek-e a szükséges mezők)

### Következő sprint:
6. **Telegram Hangvezérlés** – OpenAI node típus csere (fejlesztői munkát igényel)
7. **Error Monitoring** – Cron → Schedule Trigger csere
8. Rendszer teszt: minden workflow futásának ellenőrzése

---

## 📞 8. SUPPORT ÉS SEGÍTSÉG

**Ha n8n-ben valami nem érthető:**
- n8n Dokumentáció: https://docs.n8n.io
- n8n Community Forum: https://community.n8n.io

**Ha credential bevitellel van kérdés:**
- n8n → Settings → Credentials → a "?" gomb minden credential típusnál mutatja az útmutatót

**Ha Telegram bot token kell:**
1. Telegram-ban keress rá: `@BotFather`
2. Küld: `/mybots`
3. Válaszd ki a meglévő botot → API Token látható lesz

---

*Dokumentum létrehozva: 2025-01-12 | Brunella AI Asszisztens által*
*Projekt: Iszapfaló Kft n8n Automatizáció | Track: Iszapfalo_n8n_Atadas*
