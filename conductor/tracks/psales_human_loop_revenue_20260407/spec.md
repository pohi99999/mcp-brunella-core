# Spec — P-Sales Human-in-Loop Revenue Pipeline

## Feladat összefoglalója

A `sel.md` és `sel2.md` dokumentumok elemzése alapján Pohánka Péter Brunella-alapú AI ügynökrendszerét bevételtermelő üzletté kell alakítani. A stratégia két párhuzamos célszegmensre épül:

1. **Magyar KKV szegmens** — automatizált lead-generálás + folyamatauto­matizálás értékesítése
2. **Prémium/lifestyle márka szegmens** — AI content automation, social media, fotóstúdió csere

---

## Főbb megállapítások a dokumentumok elemzéséből

### sel.md — Értékesítési stratégia és tooling terv
- **Legfontosabb kockázat**: a P-Sales Human-in-Loop Pipeline `0% készültségű` — automatizált outreach kizárólag emberi jóváhagyási kapuval szabad elindítani.
- **Ágensek elérhetők**: SalesHunterAgent, LeadMiningAgent, CampaignGeneratorAgent, ApifyScraping, copywriter mind megvan a registry-ben.
- **Hiányzó infrastruktúra**: `/api/v1/webhook/onboarding-intake` endpoint, n8n intake workflow, Apify `.env` konfiguráció, Google Sheets CRM tracker.
- **Bizonyított értékajánlat**: Varga Viktória fashion case study (heti 8h → 20 perc, fotó­zási költ­ség -60%).
- **Árazási struktúra kész** (brand): STARTER 150K Ft pilot, ALAP 280K/hó, PRÉMIUM 480K/hó, TELJES 680K/hó.
- **LinkedIn szövegek készen vannak**: Headline, About, connection request, follow-up szekvencia.

### sel2.md — KKV lead-gen monetizáció
- **Üzleti modell**: "automatizált ügyfélszerző rendszer" — nem lead listát, hanem eredményt ad el.
- **Árazási struktúra kész** (KKV): START 149K Ft, GROW 289K+89K/hó, SCALE 590K+189K/hó.
- **n8n + Brunella architektúra tervezett**: Webhook → validate → enrich (Brunella) → CRM → human approval → outreach.
- **GDPR/LinkedIn megfelelőség**: direct marketing human-in-loop nélkül jogi kockázat!
- **Audit termék**: Lead Funnel Mini Audit, 19K Ft vagy ingyenes setup felé upsell.
- **Elsőfokú belépő**: 30 perces audit → START csomag ajánlat.

### Ütközési pontok és konfliktusok
| Kérdés | sel.md | sel2.md | Döntés |
|---|---|---|---|
| Első platform | LinkedIn + Malt | LinkedIn főleg | LinkedIn-nel indulunk |
| Pricing szint | Brandnél 150-680K | KKV 149-590K | Mindkettő fenntartható |
| Human-in-loop | Kötelező | Kötelező | **Phase 1 blocker** |
| Apify LinkedIn scraping | Igen | GDPR megjegyzés | Csak B2B + opt-out kezelés |

---

## Scope

### Benne van
- P-Sales Human-in-Loop approval gate implementáció (n8n + Brunella)
- `/api/v1/webhook/onboarding-intake` endpoint a Brunella szerverbe
- Apify API integráció `.env` konfigurációval
- n8n KKV onboarding intake workflow (JSON)
- n8n Brand onboarding intake workflow (JSON)
- Typeform kérdőívek bekötése n8n-be
- Google Sheets lead tracker beállítása
- Brand Accelerator 3 csomag kész termékként
- KKV Lead-Gen 3 csomag kész termékként
- LinkedIn profil szövegek (kész, csak beillesztés kell)
- Case Study sablon Varga Viktória alapján
- Pilot kampány: első 25 lead + 3 outreach üzenet kör

### Nincs benne
- Tényleges LinkedIn/Instagram scraping adatvédelmi jogi vélemény — külső ügyvéd kell
- Toptal / Product Hunt profil (fázis 2+ anyag)
- Brunella SaaS termékké alakítás (külön track)
- Cloudflare edge deployment (külön track)

---

## Elfogadási kritériumok

1. ✅ P-Sales Human-in-Loop: semmi outreach üzenet nem mehet ki emberi jóváhagyás nélkül
2. ✅ `/api/v1/webhook/onboarding-intake` fogadja a Typeform webhook-okat és elindítja a Brunella agent pipeline-t
3. ✅ Első 25 lead fel van töltve Google Sheets-be a scraping után
4. ✅ Mindkét n8n workflow importálható és tesztelve van (teszt form beküldéssel)
5. ✅ Brand Accelerator és KKV csomag leírás publikálható állapotú (pohankaestarsa.com-ra kész)
6. ✅ LinkedIn profil szövegek be vannak illesztve
7. ✅ Case Study PDF kész és küldható

---

## Delegálási térkép

| Feladat | Delegált agent | Indok |
|---|---|---|
| Brunella webhook endpoint | `bas-lead-developer` | TypeScript implementáció |
| n8n workflow tesztelés | `bas-automation-architect` | n8n szaktudás |
| Brand/KKV csomag leírások | `copywriter` agent | Content |
| Apify konfiguráció | `ApifyScraping` agent | Saját doménje |
| Lead scoring | `LeadMiningAgent` | Saját doménje |
| Outreach jóváhagyás | `SalesHunterAgent` + human gate | Kötelező |

---

## Handoff / aktuális állapot

- A human-in-loop kapu és mindkét onboarding workflow lokálisan kész.
- Az n8n sandbox tiszta állapotban fut, az importok már bent vannak.
- A track továbbra is külső kulcsokra és a végleges form builderre vár.
- A következő implementációs slice a lead scraping és a piaci megjelenés.
