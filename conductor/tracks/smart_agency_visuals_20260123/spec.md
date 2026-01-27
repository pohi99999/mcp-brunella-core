# Specifikáció: Smart Agency & Visuals

## Cél
Az Orchestrator (Brunella) kognitív képességeinek növelése, hogy képes legyen összetett, többlépcsős problémákat megoldani (pl. "Nézd meg a logokat, és ha hibát találsz, keress rá a megoldásra a tudásbázisban, majd írj egy fix scriptet"). Ezzel párhuzamosan a Dashboard-on vizualizálni kell ezt a gondolkodási folyamatot (Chain of Thought).

## Funkcionális Követelmények

### 1. Backend (Ügynök Evolúció)
- **Planner Modul:** Az Orchestrator kapjon egy dedikált "Tervező" képességet, amely a felhasználói kérést atomi lépésekre bontja (Step-by-Step Plan).
- **Kontextus-megosztás:** Az ügynökök (Ops, Dev, Research) képesek legyenek megosztani a köztes eredményeket egymással (Shared Context).
- **Smart Python:** A `Developer` ügynök tudjon Python kódokat futtatni a `Persistent Python Shell`-ben a tervezés részeként.

### 2. Frontend (Dashboard UI)
- **Gondolatmenet (Trace) Nézet:** A chat felületen jelenjen meg vizuálisan az ügynök "gondolkodása" (pl. "🔎 Logok elemzése..." -> "📚 Keresés a tudásbázisban..." -> "✅ Megoldás").
- **Interaktív Tool Eredmények:** Ha egy tool JSON-t ad vissza (pl. metrikák), az jelenjen meg szépen formázva (táblázat/kártya), ne nyers szövegként.

## Elfogadási Kritériumok
- [ ] Az Orchestrator képes egy 3 lépéses feladatot (pl. Log -> Keresés -> Válasz) végrehajtani egyetlen promptból.
- [ ] A Dashboard megjeleníti az aktuális lépést (pl. egy folyamatjelző vagy lista formájában).
- [ ] A Python Shell állapota megmarad a lépések között.
