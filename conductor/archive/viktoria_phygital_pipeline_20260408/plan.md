# Implementacios Terv: VIKTORIAVARGA phygital pipeline

## Cel
Átjárás a brand copy, a browser automation és a Python harvest/extract felületek között, hogy a phygital tapasztalat "Enjoy life in colours" stílusban egységes legyen.

## Lepesek
1. **Extraction Bridge (Python Schema Design)**: Hozzunk létre a `myai/schemas/viktoria_product.py` fájlját a specifikus divat-metaadatokkal (Color, Style, Material, Mood - HU/EN).
2. **Vision Bridge (RobotkezV2 augmentation)**: Frissítsük a `RobotkezV2Agent`-et, hogy képes legyen vizuális brand-biztonsági validációt kezdeményezni.
3. **Orchestration (Implementing ViktoriaPhygitalAgent.ts)**: Új ágens létrehozása, amely a Node.js-beli brand-voice és a Python-beli extraction réteget koordinálja.
4. **Monitoring (Dashboard Panel Registration)**: Új panel regisztrálása a `navigation.tsx`-ben a Phygital Pipeline vizualizációjához.
5. **Validation és fallback lánc**: Biztosítsuk a hibatűrést, ha az automatizált vizuális validáció bizonytalan (human-in-the-loop fallback).

## Kimenet
- `myai/schemas/viktoria_product.py`
- `src/agents/ViktoriaPhygitalAgent.ts`
- `src/dashboard/components/viktoria/PhygitalPipelinePanel.tsx`
- Registered dashboard route.

## Definition of done
- A pipeline egyértelműen tud browser és harvest felületre épülni.
- A brand voice nem sérül a technikai átjárón.
- Az extrakció során létrejön a kétnyelvű divat-metaadat struktúra.
- A build és teszt-suite zöld marad.
- A végén a változások commitolva és dokumentálva vannak a FOSZAL/copilot.md fájlokba
## Definition of done
- A pipeline egyértelműen tud browser és harvest felületre épülni.
- A brand voice nem sérül a technikai átjárón.
- Az extrakció során létrejön a kétnyelvű divat-metaadat struktúra.
- A build és teszt-suite zöld marad.
- A végén a változások commitolva és dokumentálva vannak a FOSZAL/copilot.md fájlokban.
