# 🛡️ Brunella Agent System (BAS) - Master Rendszer Átvilágítás és Audit (2026-02-23)

## 📊 Áttekintés
Ez a dokumentum a Brunella Rendszer központi katalógusa és stratégiai iránytűje. Tartalmazza a projekt teljes történetét, az összes fejlesztési szálat (track), az alvó funkciókat és a jövőbeli monetizációs tervet.

---

## 💰 A 9 Stratégiai Üzleti Pillér (Bevételszerzési Terv)

| # | Szolgáltatás Neve | Célkitűzés | Állapot |
| :--- | :--- | :--- | :--- |
| 1 | **RobotkezV2 Pro** | Autonóm webes asszisztens bármilyen weboldalhoz. | **KÉSZ (Cloudflare Integrált)** |
| 2 | **Enterprise Lead Hunter** | LinkedIn lead kutatás és automata outreach. | **Master Track 1 Folyamatban** |
| 3 | **Logistics Smart Dispatcher**| Automata csomagkövetés és útvonal-optimalizálás. | **Aktív (Logistics Vertical)** |
| 4 | **Invoice to Sheets** | Gmail PDF-ből automata adatkinyerés és Sheets könyvelés. | **Master Track 2 KÉSZ** |
| 5 | **Green Market Watcher** | Piaci árazás és konkurencia figyelés. | **Master Track 3 & 5 KÉSZ** |
| 6 | **Lead Mining-as-a-Service** | Validált lead listák MI által írt jégtörő mondatokkal. | **Master Track 1 Aktív** |
| 7 | **Digitális Fejvadász (HR)** | Önéletrajz szűrés, pontozás és interjúkérdés generálás. | **Alvó / Tervezett** |
| 8 | **Innovation Bridge** | Kereszt-iparági technológiai megoldás kereső. | **Tervezett** |
| 9 | **Law Detective** | Közlöny figyelő és pályázat előkészítés. | **AKTÍV (Phase 1)** |

---

## 📚 Master Track Katalógus

### 🟢 Aktív és Legfrissebb Fejlesztések
| Track ID | Cél / Leírás | Spec / Plan |
| :--- | :--- | :--- |
| `master_track_1_lead_mining` | RobotkezV2 + Lead Hunter integráció. | [Spec](conductor/tracks/master_track_1_lead_mining_20260223/spec.md) / [Plan](conductor/tracks/master_track_1_lead_mining_20260223/plan.md) |
| `master_track_2_invoice_sheets` | Gmail PDF -> Sheets automatizáció. | [Spec](conductor/tracks/master_track_2_invoice_to_sheets_20260223/spec.md) / [Plan](conductor/tracks/master_track_2_invoice_to_sheets_20260223/plan.md) |
| `master_track_3_market_watcher` | Általános piaci/konkurencia figyelő. | [Spec](conductor/tracks/master_track_3_market_watcher_20260223/spec.md) / [Plan](conductor/tracks/master_track_3_market_watcher_20260223/plan.md) |
| `apify_deep_scraping` | Apify platform integrációja mély adatbányászathoz. | [Spec](conductor/tracks/apify_deep_scraping_agent_20260223/spec.md) |
| `chrome_devtools_mcp` | Böngésző-szintű vezérlés MCP-n keresztül. | [Spec](conductor/tracks/chrome_devtools_mcp_agent_20260223/spec.md) |
| `paios_unified_config` | Egységes konfigurációs réteg az összes modellhez. | [Spec](conductor/tracks/paios_unified_config_20260223/spec.md) |
| `robotkez_comet_upgrade` | RobotkezV2 Perplexity Comet-stílusú upgrade. | [Spec](conductor/tracks/robotkez_comet_upgrade_20260222/spec.md) |
| `logistics_vertical` | Nehézanyag-logisztikai platform integráció. | [Spec](conductor/tracks/logistics_vertical_20260222/spec.md) |

### 🟡 Alvó vagy Stabilizációt igénylő Szálak
| Track ID | Státusz / Miért állt meg? | Megjegyzés |
| :--- | :--- | :--- |
| `invoice-e2e-testing` | Proposed - E2E tesztelésre vár. | Az 4. pillér validációja. |
| `innovation_bridge` | Proposed - TRIZ alapú probléma absztrakció. | A 8. pillér alapja. |
| `industrial_machine_hunter` | Pending - Ipari gépek arbitrázs figyelése. | A 5. pillér speciális esete. |
| `marketing_swarm` | In Progress (33%) - Több-ágensű kampányok. | Marketing Director ágens alapja. |

### ⚪ Archivált (Befejezett vagy Alapozó) Tracks
| Track ID | Eredmény | Tanulság |
| :--- | :--- | :--- |
| `green_lightning` | ✅ KÉSZ | Az EV Hunter logika sikeresen bizonyított (willhaben.at). |
| `bas_enterprise_suite` | ✅ ARCHÍV | Alapozó architektúra (18 modul) leírása. |
| `cloudflare_edge_network` | ✅ KÉSZ | Cloudflare Edge képességek élesítve. |
| `ai_recommendation` | ✅ ARCHÍV | Ajánló rendszer integráció. |

---

## 🔍 Funkcionális Leltár (Működő vs Alvó)

### 💻 Magrendszer (Core)
- **Bifrost Gateway:** Működik (Multi-LLM routing).
- **Phoenix Event Bus:** Működik (Eseményvezérelt kommunikáció).
- **SpecWriter:** Működik (Automatikus track generálás).

### 🤖 Specializált Ágensek (src/agents/)
- **RobotkezV2:** Aktív (Comet upgrade alatt).
- **Sales Hunter:** Aktív (LinkedIn scraping).
- **Financial Guard:** Aktív (Invoice OCR logika kész).
- **Logistics Dispatcher:** Aktív (GLS/DPD integráció folyamatban).
- **Email Triage:** **Alvó** (Logika kész, Gmail bekötés kell).
- **Law Detective:** **Alvó** (Közlöny figyelő PDF OCR-rel).
- **Property Analyst:** **Alvó** (Vision ingatlan elemzés).

---

## 🛠️ Következő Lépések: Üzleti Élesítés

1.  **Lead Mining (MT1):** Automatikus végrehajtás folyamatban a külön terminálban.
2.  **Invoice to Sheets (MT2):** Következő lépés: Gmail API bekötése és PDF letöltés implementálása.
3.  **Market Watcher (MT3):** Általános scraper és pontozó logika finomítása.

---
*Ez a dokumentum a Brunella Rendszer "élő lelkiismerete". Frissítve: 2026-02-23*
