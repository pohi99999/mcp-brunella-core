# Implementacios Terv: P-Search n8n Pipeline

## Fazisok

### 1. Workflow alapok
- WF-PS-1 napi palyazatfigyelo trigger, HTTP lekeresek es AI relevancia-szures.
- WF-PS-2 dokumentacio varazslo webhook, fajlkigyujtes es hianylista-generalas.
- WF-PS-3 hataridofigyelo cron es emailertesites.

### 2. Adat- es credential reteg
- Supabase/Postgres tabla- es audit-schema kijelolese.
- Gmail/SMTP, HTTP es AI credential-ek biztonsagos n8n credential store-ba helyezese.
- Cegprofil betoltese a relevancia-szureshez.

### 3. Stabilitas es gate-ek
- Hibakezeles, retry es naplozas minden kritikus node korul.
- Relevancia kuszob es emberi review szabalyok finomhangolasa.
- Opcionális kanban kapcsolat (Trello vagy Notion) külön adapterrel.

### 4. Validacio
- Minta feeddel es webhookkal vegigfuttatott teszt.
- Adatmentes, email-es es hianylista-kimeneti ellenorzes.
- Uzemeltetesi leiras az idozitesekhez es kulcsokhoz.
