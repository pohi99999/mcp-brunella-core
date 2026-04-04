# Specifikacio: P-Search n8n Pipeline

## Hatter

Az `.worktrees\\n8n_workflow_tervek.md` P-Search resze egy olyan n8n workflow-csomagot ir le, amely palyazati es hitelajanlat forrasokat figyel, AI-val szuri a talalatokat, dokumentumokat rendszerez, majd hataridoertesiteseket kuld.

## Cel

Egy olyan uzleti workflow-lanc letrehozasa, amely a P-Search szolgaltatas fo operativ folyamatait automatikusan futtatja, mikozben audit-nyomot es emberileg atnezheto kimeneteket ad.

## Scope

- WF-PS-1 napi palyazat- es hitelajanlat figyeles
- WF-PS-2 dokumentumfeltoltes, adatkinyeres, hianylista
- WF-PS-3 hataridofigyeles es 7/1 napos ertesites
- Supabase/Postgres mentes es emailertesitesek
- Opcionális kanban integracios pont

## Kimenetek

- n8n workflow-tervek node-szintu bontasban
- Szükséges credential lista es adattar terv
- Hiba- es retry-szabalyok
- Operatori validacios checklist

## Acceptance kriteriumok

- A napi workflow legalabb ket kulso forrast kezel es AI relevancia-alapu szurest alkalmaz.
- A dokumentumfeltolto webhook strukturalt hianylistat ad vissza.
- A hataridoertesites 7 nappal es 1 nappal a hatarido elott is le tud futni.
- A talalatok, hianylistak es workflow-futasok audit-tal naplozhatok.
- Minden kulcs es jelszo n8n credential store-ban marad.

## Nem resze ennek a tracknek

- A P-Search frontend teljes implementacioja.
- Uj AI modellprovider fejlesztese.
- Nem palyazati forrasok altalanos scrape platformja.
