# Végrehajtási Terv: Zero-Prompt Core — Slack/Discord/Email Jóváhagyás

**Track ID:** `zero_prompt_notification_channels_20260329`  
**Fázis:** Fázis 1 — Zero-Prompt Core  
**Célállapot:** PROPOSED → ACTIVE → TESTING → COMPLETED

## Kimenet

- Notification channel adapter interface
- Slack, Discord és email alap adapterek
- Approval message template csomag
- Delivery log és hibakezelés

## Todo lista

### 1. Channel design

- [x] Slack/Discord/email adapter interface és config modell megírása
- [x] Message template contract és severity mapping rögzítése
### 2. Implementáció

- [x] Email adapter továbbfejlesztése approval payloadokra
- [x] Slack webhook adapter létrehozása
- [x] Discord webhook adapter létrehozása
- [x] Delivery logika és retry stratégia bevezetése
### 3. Integráció

- [x] Approval Router notification dispatch bekötése
- [x] Alert és status update message type-ok hozzáadása
### 4. Validáció

- [x] Email, Slack és Discord smoke teszt
- [x] Delivery failure fallback ellenőrzése
- [x] Approval üzenet sablonok review-ja

## Megjegyzések

- Elsődleges függőségek: `zero_prompt_approval_router_20260329`, `zero_prompt_signal_ingest_20260329`
- A megvalósításnak illeszkednie kell a BAS meglévő Phoenix / scheduler / agent / dashboard architektúrájához.
- Track lezárási minimum: dokumentált tesztstratégia, elfogadási kritériumok ellenőrzése, naplófrissítés.
