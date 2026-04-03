# Iszapfaló Kft. – n8n Rendszer Migrációs és Csatlakoztatási Útmutató

**Verzió:** 1.0
**Dátum:** 2026-02-27
**Készítette:** Pohánka Péter / Brunella AI
**Státusz:** Tesztelésre kész

---

## Mi ez az útmutató?

Ez a dokumentum leírja, hogyan csatlakoztathatod az **újonnan fejlesztett modulokat** a már meglévő Iszapfaló Kft. munkaidő-nyilvántartó rendszerhez. Az itt leírt workflow-kat az **Iszapfaló saját n8n instance-ába** kell importálni és konfigurálni.

---

## A Meglévő Rendszer (Amit Már Használtok)

Az Iszapfaló Kft. n8n-alapú rendszere tartalmaz egy fő workflow-t:

### Iszapfaló – AI Agent Asszisztens (v2 – Javított)

**Mit csinál:**
- Telegram-on fogadja a munkatársak bejelentéseit
- Claude AI (Anthropic) értelmezi az üzeneteket
- Automatikusan rögzíti Airtable-be:
  - Munkaidő kezdete/vége
  - Feladatok és megbízások
  - Költségek (üzemanyag, alkatrész)
  - Szabadságok

**Airtable táblák:**
| Tábla neve | Mit tárol |
|---|---|
| `Munkaidő Nyilvantartas` | Bejelentések, ledolgozott órák |
| `MUNKAK` | Feladatok, megbízások |
| `KOLTSEGEK` | Üzemanyag, alkatrész, egyéb kiadások |
| `SZABADSAGOK` | Szabadságkérelmek |

---

## Új Modulok (Amit Hozzáadtunk)

### 1. Géppark Karbantartás AI Diagnosztika
**Webhook:** `POST /geppark-figyelo-v2`

**Mit csinál:** A gépeknél észlelt hibatüneteket elemzi, karbantartási javaslatot ad és alkatrész-kódokat azonosít.

**Kapcsolódás a meglévő rendszerhez:**
- A munkatárs jelzi a géphiba tünetét (pl. Telegram-on: *"A Truxor hidraulikája nyomásvesztést mutat"*)
- A Geppark modul diagnosztizál és visszajelzést ad a chat-be
- A diagnosztika eredménye (feladatként) manuálisan rögzíthető a fő agenten keresztül a `MUNKAK` táblába

---

### 2. Okos Ajánlatkészítő Asszisztens
**Webhook:** `POST /okos-ajanlatado-v2`

**Mit csinál:** Munkaigénylés leírása alapján automatikusan kiszámolja és elküldi az árajánlatot (gépek, munkaerő, kiszállás, felár).

**Kapcsolódás a meglévő rendszerhez:**
- Az ajánlat elfogadása után a munka indítása a fő AI agenten keresztül rögzíthető
- A jövőben automatikusan létrehozhat bejegyzést a `MUNKAK` táblában

---

### 3. Telegram /statusz és /het Parancsok
**Telegram parancsok:** `/statusz`, `/het`

**Mit csinál:**
- `/statusz` – az aktuális nap munkaidő összesítőjét küldi vissza
- `/het` – a heti ledolgozott órák összesítője

**Kapcsolódás:** Közvetlenül a meglévő Airtable adatokból olvas.

---

### 4. Heti Emlékeztető (Csütörtök 16:00)
**Ütemezés:** Minden csütörtökön 16:00-kor automatikusan fut.

**Mit csinál:** Emlékeztetőt küld a hét végéig kitöltetlen bejelentésekre.

---

### 5. Google Calendar ↔ Airtable Szinkron
**Mit csinál:** A Google Naptárba felvett „szabadság" / „szabadnap" típusú eseményeket automatikusan rögzíti a `SZABADSAGOK` táblába.

---

## Importálás a Saját n8n-ebe – Lépésről Lépésre

### 1. lépés: Szükséges Credential-ek Előkészítése

Mielőtt importálsz, hozd létre ezeket az n8n-ben (Settings → Credentials → New):

| Credential típusa | Neve (adj bármilyen nevet) | Amire szükség van |
|---|---|---|
| **Telegram API** | pl. *"Iszapfalo Bot"* | A Telegram bot token (BotFather ad) |
| **Airtable Personal Access Token** | pl. *"Iszapfalo Airtable"* | Airtable personal token (airtable.com/create/tokens) |
| **Anthropic API** | pl. *"Anthropic"* | Anthropic API kulcs (console.anthropic.com) |
| **OpenAI API** | pl. *"OpenAI"* | OpenAI API kulcs (platform.openai.com) |
| **Google Calendar OAuth2** | pl. *"Google Calendar"* | Google OAuth (accounts.google.com) |

---

### 2. lépés: Airtable Base ID Meghatározása

Az Iszapfaló Airtable workspace-ében megtalálod a base URL-t:
```
https://airtable.com/appXXXXXXXXXXXXXX/...
                       ^^^^^^^^^^^^^^^^^^
                       Ez a BASE ID – jegyezd fel!
```

---

### 3. lépés: Workflow-k Importálása

**A) Fő Munkaidő Nyilvántartó (Ha Még Nincs Fenn):**
```
n8n → Workflows → Import → Válaszd: "Iszapfalo - AI Agent Asszisztens (v2 - Javitott).json"
```

**B) Géppark Diagnosztika:**
```
n8n → Workflows → Import → "iszapfalo_geppark_all_in_one_n8n.json"
```

**C) Okos Ajánlató:**
```
n8n → Workflows → Import → "iszapfalo_okos_ajanlatado_all_in_one_n8n.json"
```

**D) Telegram Parancsok:**
```
n8n → Workflows → Import → "Iszapfalo - Telegram Parancsok (_statusz, _het).json"
```

**E) Heti Emlékeztető:**
```
n8n → Workflows → Import → "Iszapfalo - Heti Emlekezteto (Csutortok 16_00).json"
```

**F) Google Calendar Szinkron (Opcionális):**
```
n8n → Workflows → Import → "Iszapfalo - Google Calendar - Airtable Szinkron.json"
```

---

### 4. lépés: Credential-ek Bekötése (Minden Importált Workflow-ban)

Minden importálás után nyisd meg a workflow-t és **minden piros⚠️ node-ban** csere le a credential-eket a saját előre elkészített credential-eidre:

#### Fő AI Agent Workflow:
| Node neve | Mit kell beállítani |
|---|---|
| **Telegram Trigger** | → Saját Telegram credential |
| **Claude 3.5 Sonnet** (Anthropic) | → Saját Anthropic credential |
| **Airtable Tool** (×4) | → Saját Airtable credential + Base ID: `app...` |
| **Naptar_Bejegyzes** | → Saját Google Calendar credential |
| **Telegram Válasz** | → Saját Telegram credential |

#### Géppark Diagnosztika:
| Node neve | Mit kell beállítani |
|---|---|
| **OpenAI Chat Model** | → Saját OpenAI credential |
| **Telegram Értesítés** | → Saját Telegram credential + Chat ID |

#### Okos Ajánlató:
| Node neve | Mit kell beállítani |
|---|---|
| **OpenAI Chat Model** | → Saját OpenAI credential |
| **Telegram Értesítés** | → Saját Telegram credential + Chat ID |

---

### 5. lépés: Környezeti Változók Beállítása

Az n8n-ben (Settings → Variables) add hozzá:

```
AIRTABLE_BASE_ID = appXXXXXXXXXXXXXX    (a te Airtable base ID-d)
TELEGRAM_ADMIN_CHAT_ID = XXXXXXXX        (az admin Telegram chat ID-ja)
```

A Telegram chat ID meghatározásához: küldd el a `/start` parancsot a botnak, majd GET `https://api.telegram.org/bot<TOKEN>/getUpdates` – a `chat.id` mező tartalmazza.

---

### 6. lépés: Airtable Táblák Ellenőrzése

Az AI Agent workflow pontosan ezeket a táblaneveket várja (case-sensitive!):

| Workflow által használt táblanév | Mit kell tartalmaznia |
|---|---|
| `Munkaidő Nyilvantartas` | Munkatárs neve, Telegram Chat ID, Dátum, Kezdés, Vég, Ledolgozott Órák |
| `MUNKAK` | Feladat leírása, Munkatárs neve, Prioritás, Állapot |
| `KOLTSEGEK` | Összeg, Típus, Munkatárs neve, Dátum |
| `SZABADSAGOK` | Munkatárs neve, Telegram Chat ID, Kezdő dátum, Záró dátum |
| `Munkatarsak` | Munkatárs neve, Telegram Felhasználónév, Telegram Chat ID, Aktív |

> **Fontos:** Ha a táblaneveid eltérnek (pl. `Munkaidő_Nyilvantartas` aláhúzással), akkor az Airtable Tool node-okban is frissíteni kell a táblanevet!

---

### 7. lépés: Aktiválás és Tesztelés

#### Aktiválási sorrend (fontos!):

1. ✅ **Fő AI Agent** (v2) – elsőként aktiváld
2. ✅ **Telegram Parancsok** – csak az AI Agent után
3. ✅ **Géppark Diagnosztika** – önálló modul, bármikor
4. ✅ **Okos Ajánlató** – önálló modul, bármikor
5. ✅ **Heti Emlékeztető** – legutoljára (cron-alapú)
6. ⚠️ **Google Calendar Szinkron** – csak ha Google OAuth bekonfigurálva

#### Tesztelő Telegram üzenetek az aktiválás után:

**Munkaidő rögzítés tesztelése:**
```
Kezdem a munkát a tónál
```
Várt eredmény: ✅ Airtable-ben Munkaidő Nyilvantartas táblában megjelenik egy új sor

**Feladat rögzítés tesztelése:**
```
Truxor olajcserét kell csinálni holnap
```
Várt eredmény: ✅ MUNKAK táblában megjelenik

**Géppark diagnosztika tesztelése (Webhook-on):**
```bash
curl -X POST https://[n8n-url]/webhook/geppark-figyelo-v2 \
  -H "Content-Type: application/json" \
  -d '{"query": "A Truxor T40 hidraulikája nyomásvesztést mutat"}'
```
Várt eredmény: ✅ Telegram üzenet érkezik karbantartási javaslattal

**Ajánlat tesztelése (Webhook-on):**
```bash
curl -X POST https://[n8n-url]/webhook/okos-ajanlatado-v2 \
  -H "Content-Type: application/json" \
  -d '{"query": "Tó nádvágás 5000 m2, 30 km Érdtől, sürgős"}'
```
Várt eredmény: ✅ Telegram üzenet érkezik részletes árajánlattal

---

## Rendszer Architektúra – Hogyan Kapcsolódnak a Modulok

```
┌─────────────────────────────────────────────────────────┐
│                    TELEGRAM BOT                         │
│           (munkatársak napi kommunikációja)             │
└───────────────┬─────────────────┬───────────────────────┘
                │                 │
    Munkaidő/   │            /statusz
    Feladat/    │            /het
    Költség     │            parancsok
    üzenetek    │                 │
                ▼                 ▼
┌───────────────────────┐  ┌─────────────────────────┐
│  FŐ AI AGENT (v2)    │  │  TELEGRAM PARANCSOK     │
│  Claude 3.5 Sonnet    │  │  /statusz, /het         │
│                       │  └────────┬────────────────┘
│  ↓ ↓ ↓ ↓            │           │
│  Munkaidő | MUNKAK    │           ▼
│  KOLTSEGEK| SZABADSAG │  ┌─────────────────────────┐
└───────────┬───────────┘  │      AIRTABLE           │
            │              │  appXXXXXXXXXXXXXX      │
            └──────────────►  Munkaidő Nyilvantartas  │
                           │  MUNKAK | KOLTSEGEK      │
   HTTP Webhook ──────────►  SZABADSAGOK              │
   (Geppark hiba)│         └─────────────────────────┘
                 ▼
┌──────────────────────────┐
│  GEPPARK DIAGNOSZTIKA    │
│  OpenAI gpt-4o-mini      │
│  Tudásbázis: Truxor T40  │
│  Honda WB30XT, Kotróhajó │
└──────────────────────────┘

   HTTP Webhook ──────────►┌──────────────────────────┐
   (Ajánlatkérés)          │  OKOS AJÁNLATÓ           │
                           │  OpenAI gpt-4o-mini      │
                           │  Árlista tudásbázis      │
                           └──────────────────────────┘

   Cron: Csüt. 16:00 ─────►┌──────────────────────────┐
                            │  HETI EMLÉKEZTETŐ        │
                            │  (kitöltetlen napokra)   │
                            └──────────────────────────┘

   Google Naptár ──────────►┌──────────────────────────┐
   (szabadság event)        │  CALENDAR ↔ AIRTABLE     │
                            │  SZINKRON                │
                            └──────────────────────────┘
```

---

## Hibaelhárítás

| Probléma | Ok | Megoldás |
|---|---|---|
| AI Agent nem válaszol Telegram-on | Bot token lejárt | Telegram Trigger node-ban frissítsd a credential-t |
| Airtable-be nem kerül be adat | Base ID/táblanév eltérés | Airtable Tool node-ban ellenőrizd a base ID-t és táblanevet |
| "Cannot connect to Airtable" | Token érvénytelen | Airtable Personal Access Token megújítása |
| Geppark webhook nem válaszol | Workflow inaktív | n8n-ben aktiváld a workflow-t |
| Ajánlat nem érkezik meg | OpenAI kvóta | platform.openai.com – egyenleg ellenőrzés |
| Google Calendar szinkron sikertelen | OAuth token lejárt | Google Calendar OAuth újra-autorizálás az n8n-ben |

---

## Szükséges API Kulcsok Összefoglalója

A migráció előtt szerezd be ezeket:

- [ ] **Telegram Bot Token** – https://t.me/BotFather → `/newbot`
- [ ] **Airtable Personal Access Token** – https://airtable.com/create/tokens → `data.records:read` + `data.records:write` scope a saját base-re
- [ ] **Anthropic API Key** – https://console.anthropic.com/settings/keys
- [ ] **OpenAI API Key** – https://platform.openai.com/api-keys
- [ ] **Google Calendar OAuth** – n8n-ben bejelentkező ablakos hitelesítés (Google Cloud Console projekt nem szükséges, az n8n kezeli)

---

## Verziókövetés

| Verzió | Dátum | Változás |
|---|---|---|
| v1.0 | 2026-02-27 | Initial release – 6 modul tesztelésre kész |

---

*Kérdések esetén: Pohánka Péter – peterpohankapersonal@gmail.com*
