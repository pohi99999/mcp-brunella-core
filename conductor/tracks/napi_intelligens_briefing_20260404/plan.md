# Implementacios Terv: Napi Intelligens Briefing Ugynok

## Fazisok

### 1. Phase 1 - Core Briefing MVP
- WF-BRIEFING-MAIN cron trigger 06:30 Europe/Budapest idozonaban.
- Parhuzamos sub-workflow-k: WF-GMAIL-READER, WF-CALENDAR-READER, WF-LINEAR-READER, WF-GCHAT-READER.
- Merge node, GPT-4o briefing osszeallitas, Gmail kuldes.
- Manual trigger: WF-BRIEFING-MANUAL ugyanarra a fo workflow-ra mutatva.

### 2. Hibaturo orkesztracio
- Partial briefing strategia, ha valamelyik adatforras kiesik.
- Sub-workflow timeout es hibaagak.
- Opcionális Google Chat publikacio flag alapjan.

### 3. Phase 2 - Extension Pack
- Slack forras vagy publikacio.
- Notion feladatok vagy napi oldal.
- Idojaras blokk a napinditoba.
- TTS / audio briefing es Telegram vagy WhatsApp kuldes.
- Heti osszefoglalo kulon cron mintakent.

### 4. Validacio
- Cron es manual trigger kimenet osszehasonlitasa.
- Gmail, Calendar, Linear es Google Chat credential-ekkel vegigfutasi ellenorzes.
- HTML es plain-text briefing kimeneti formatum ellenorzese.
