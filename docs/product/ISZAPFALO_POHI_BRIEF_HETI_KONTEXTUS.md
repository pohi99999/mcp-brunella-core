# Pohi brief — Heti Kontextus Workflow

## Cél
Építs meg egy új n8n workflow-t, ami minden hétfő reggel legenerál egy Claude-kompatibilis heti kontextus riportot az Airtable adatokból, majd feltölti Google Drive-ra.

## Workflow neve
`07 - ISZ Heti Kontextus Csomag`

## Kötelező node-ok
1. Schedule Trigger
2. Airtable - Folyamatok lekérdezés
3. Airtable - Feladatok lekérdezés
4. Airtable - Munkatársak lekérdezés
5. Airtable - Szabadságok lekérdezés
6. Code - Heti Kontextus Generátor
7. Google Drive - Upload

## Opcionális node
8. Airtable - Munkaidő Nyilvántartás
9. Telegram értesítés adminnak

## Forrásfájlok a megvalósításhoz
- Vízió: `docs/ISZAPFALO_CLAUDE_VIZIO_2026.md`
- Akcióterv: `docs/ISZAPFALO_HETI_KONTEXTUS_AKCIOPLAN.md`
- Code node guide: `docs/ISZAPFALO_HETI_KONTEXTUS_CODE_NODE_GUIDE.md`
- Kész JavaScript: `docs/snippets/n8n/iszapfalo_heti_kontextus_code_node.js`
- Riport sablon: `docs/templates/HETI_KONTEXTUS_TEMPLATE.md`

## N8N beállítások
### Trigger
- hétfő 07:00

### Code node
- Language: JavaScript
- Mode: Run once for all items
- Script: a fenti JS fájl teljes tartalma

### Google Drive node
- Upload
- Binary input: `report`
- fájlnév: `={{ $json.fileName }}`
- célmappa: `Airtable Kontextus`

## MVP output
A generált Markdown riport legalább ezeket tartalmazza:
- vezetői összkép
- aktív projektek
- kritikus projektek
- magas prioritású feladatok
- munkatárs elérhetőség
- pénzügyi pipeline

## Elfogadási kritérium
A munka akkor kész, ha:
- kézi futtatással létrejön egy `Heti_Kontextus_YYYYMMDD.md`
- felmegy Google Drive-ra
- Claude abból képes heti prioritási és munkarend-javaslatot adni

## Fontos megjegyzés
Első körben nem kell tökéletes rendszer.
A cél az, hogy legyen egy stabil, heti snapshot, amit Claude már értelmezni tud.
