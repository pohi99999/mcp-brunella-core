# Specifikacio: Konyvelesi n8n Phase 3 Finalizalas

## Hatter

Az `.worktrees\\n8n_workflow_tervek.md` konyvelesi resze a mar meglevo BAS backendre epit, es a hianyzo n8n workflow-ket irja le az email intake, banki egyeztetes, NAV ellenorzes, exception riport, Google Sheets sync es szamlazz.hu iranyokban.

## Cel

A Phase 3 konyvelesi workflow-kat egyseges, auditalhato n8n lancba rendezni, amely a BAS route-okkal es a meglevo matching logikaval egyutt mukodik.

## Scope

- WF-KA-1 emailes szamlafeldolgozas
- WF-KA-2 banki CSV vagy API reconciliation
- WF-KA-3 NAV validacio
- WF-KA-4 exception kezeles es ertesites
- WF-KA-5 Google Sheets sync
- WF-KA-6 szamlazz.hu kuldes

## Kimenetek

- Node-szintu Phase 3 workflow-terv
- Kulcsintegraciok listaja es credential matrix
- Audit trail es manual review szabalyok
- Validacios lista a BAS API vegpontokhoz

## Acceptance kriteriumok

- A bejovo szamla emailbol strukturalt adat kerul a BAS-ba.
- A banki egyeztetes legalabb a nem egyezo eseteket kulon kezeli.
- A NAV valasz alapjan statusz frissul VALIDATED vagy MANUAL_REVIEW ertekre.
- Az exception workflow naponta osszefoglalo riportot tud generalni.
- A szamlazz.hu kuldes siker vagy hiba eseten is visszair a BAS-ba es naploz.

## Nem resze ennek a tracknek

- A BAS konyvelesi domain teljes ujratervezese.
- Kulso ERP csatlakozok altalanos platformja.
- Nem Phase 3 scope-ba tartozo penzugyi riport motor.
