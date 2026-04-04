# Specifikacio: KKV Ugyfelszolgalati AI

## Hatter

Az ugyfelszolgalati blokk egyetlen, de magas erteku workflow-t ad: bejovo ugyfelmegkeresesek AI-val torteno osztalyozasat, reszben automatikus megvalaszolasat es ticketes eszkalaciojat.

## Scope

- WF-CS-1 AI-alapu elso valasz es ticketkezeles
- Gmail trigger vagy webhook bemenet
- FAQ, ticket, rendelesi statusz eszkalacios utak
- Supabase ticketnaplo

## Acceptance kriteriumok

- A rendszer kategoriat es prioritat rendel a bejovo kereshez.
- FAQ tipusu kerdesnel automatikus valasz kuldheto.
- Panasz eseten ticket jon letre es belso riasztas megy.
- Minden interakcio ticket ID-val naplozodik.

## Rollout

- Haladobb, de nagy hatekonysagu track a magas bejovo email forgalmu KKV-knak.
