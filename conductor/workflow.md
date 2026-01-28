# Workflow: The Data Flywheel & Phoenix Protocol

## 1. Az Adat-Volán (Data Flywheel)
1. **Gyűjtés (Harvesters):** A raj beküldi a nyers adatokat a `Raw Lake`-be.
2. **Tisztítás (Refiners):** Az Adattudós ügynökök lefuttatják a `refiner_logic.py`-t.
3. **Indexelés:** A tiszta adat bekerül a Vektor Memóriába (RAG).
4. **Tanulás:** A "Kis Csibészek" frissítik tudásukat a Vektor Memória alapján.
5. **Végrehajtás:** Az Orchestrator delegálja a feladatokat az immár okosabb ügynököknek.

## 2. Phoenix Protocol (Öngyógyítás)
- **Checkpointing:** Minden ügynök-művelet állapota mentésre kerül.
- **Auto-Reset:** Ha egy perzisztens shell vagy tool elhasal, az Ops Agent azonnal újraindítja.
- **Git Recovery:** Automatikus mentés és verziókövetés (`git_sync.ps1`).

## 3. Fejlesztési Szabályok (0-Hiba)
- Minden kódmódosítást build teszt követ.
- Az ügynökök kimeneteit a "Biztonsági Főnök" (Guardrails) ellenőrzi.