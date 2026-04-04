# Specifikacio: Napi Intelligens Briefing Ugynok

## Hatter

Ez a workflow minden reggel 06:30-kor egyetlen briefing pipeline-ban gyujti ossze a Gmail, Google Calendar, Linear es Google Chat aktualis allapotat, majd GPT-4o segitsegevel strukturalt napi riportta alakitja es emailben kikuldi.

## Scope

- WF-BRIEFING-MAIN fo workflow
- 4 parhuzamos adatgyujto sub-workflow:
  - WF-GMAIL-READER
  - WF-CALENDAR-READER
  - WF-LINEAR-READER
  - WF-GCHAT-READER
- Merge node + GPT-4o briefing osszeallito
- Gmail kuldes es opcionális Google Chat visszajelzes
- WF-BRIEFING-MANUAL manualis trigger
- Phase 2 extension pack ugyanazon trackben

## Acceptance kriteriumok

- A briefing 06:30-as trigger utan hibaturo modon le tud futni es emailben megerkezik.
- A manual trigger ugyanazt az output szerkezetet adja, mint a cron inditas.
- Egyetlen kiesett adatforras nem akadalyozza meg a partial briefing kikuldeset.
- A briefing kotelezo szekcioi megjelennek: napindito, mai naptar, surgos emailek, Linear, Chat, holnap elonezet, napi javaslat.
- A Google Chat publikacio kikapcsolhato flaggel.
- Minden credential n8n credential store-bol jon.

## Phase 2 bovitesek

- Slack forras vagy publikacio
- Notion feladatok / napi oldal
- OpenWeatherMap idojaras blokk
- TTS audio briefing
- Telegram vagy WhatsApp rovid briefing
- Heti osszefoglalo kulon cron logikaval

## Nem resze ennek a tracknek

- Kulon conductor track a Gmail, Calendar, Linear vagy Chat olvasokra.
- Teljes szemelyes asszisztens platform ujratervezes.
- Kulon heti reporting track, amig a heti logika nem valik el erdemben a napi briefing adatmodelljetol.
