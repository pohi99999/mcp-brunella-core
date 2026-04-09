# Specifikacio: KKV Pack Productization & Cockpit Definition

## Hatter
A `kkv_business_automation_20260408` masterplan mar lefedi a KKV backoffice osszkepet. Ez a track arra szolgál, hogy a major domain-eket termekesitett pack-ekbe rendezzuk, ha a Brunella feluleten keresztul kulso vagy belso use case-kent jol kommunikalthato cockpiteket akarunk.

## Scope
- KKV finance / inventory / logistics pack boundary.
- Pack manifest es orchestration API.
- Cockpit dashboard surface.
- CLI pack runner.
- Product brief es pilot dokumentacio.

## Outside scope
- A masterplan teljes ujratervezese.
- Teljesen uj business domain-ek bevonasa.
- Kulsorepo product launch workflow.

## Implementacios celpontok
- `src/tools/kkvFinancePack.ts`
- `src/tools/kkvInventoryPack.ts`
- `src/tools/kkvLogisticsPack.ts`
- `src/dashboard/components/dashboard/KKVPackCockpit.tsx`
- `src/dashboard/components/dashboard/KKVPackStatus.tsx`
- `src/cli/kkvPackCommands.ts`
- `src/server/routes/kkvPack.ts`
- `src/server/registry.ts`
- `test/kkvPack.test.ts`
- `test/dashboard/components/KKVPackCockpit.test.tsx`

## Acceptance kriteriumok
- A pack boundary es cockpit definicio dokumentalt.
- Legalabb egy pack vegig lehet futtatni vagy ellenorizni.
- A masterplanhoz kepest a pack layer nem duplikal scope-ot.
- A trackhez tartozó tesztek zoldre futnak.

## Rollout
1. Pack boundary.
2. Cockpit/API.
3. Product brief layer.
4. Verification and rollout.
