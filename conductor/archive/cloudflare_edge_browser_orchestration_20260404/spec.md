# Specifikacio: Cloudflare Edge Browser Orchestration

## Hatter

Az `.worktrees\\cloudflare_böngészőrend.md` egy olyan orchestracios modellt ir le, amelyben a Playwright CDP-n keresztul Cloudflare headless browser peldanyhoz kapcsolodik, az n8n a workflow-kat vezerli, a Robotkez/harvest retegek pedig strukturalt adatokat adnak vissza.

## Cel

Kulon trackben rogzitett, Cloudflare edge-re tamaszkodo bongeszoautomatizalasi mintat letrehozni, amely n8n-bol es Brunella agentekbol is meghivhato.

## Scope

- Cloudflare Browser Rendering API + CDP kapcsolat
- N8n workflow-inditas HTTP node-okkal
- Browser action / harvest input-output contract
- Popup- es kivetelkezeles
- DevTools-szintu network, console es performance telemetry

## Kimenetek

- Edge browser orchestracios terv
- Agent es workflow illesztopontok
- Debug es glass-box megfigyelhetosegi kovetelmenyek
- E2E validacios forgatokonyvek

## Acceptance kriteriumok

- A Playwright csatlakozasi minta egyertelmu a Cloudflare CDP vegponthoz.
- Az n8n workflow strukturalt inputtal el tudja inditani a browser feladatot.
- A browser futas strukturalt JSON eredmennyel ter vissza.
- A hiba- es popup-kezeles, valamint a diagnosztikai csatornak dokumentaltak.
- A minta keszen all arra, hogy Robotkez es harvest pipeline-okba legyen bekotve.

## Nem resze ennek a tracknek

- Cloudflare account provisioning reszletes lepesenkenti guide-ja.
- Osszes target oldal scrape-szabalyainak implementacioja.
- Lokalis Chrome/Playwright altalanos oktatasi anyag.
