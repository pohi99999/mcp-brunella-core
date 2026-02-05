# Data Flywheel & Incubator - Automatizált Fine-Tuning

## Összefoglaló
Automatizált finomhangolási pipeline ami a sikeres adatkinyerésekből tanul és éjszakánként frissíti a lokális LLM modellt.

## Üzleti Érték
- **Exponenciális tanulás:** A rendszer minden nappal okosabb
- **Vendor lock-in elkerülés:** Saját finomhangolt modell
- **IP érték:** Golden Dataset + brunella.gguf eladható/licencelhető

## Architektúra

```
┌─────────────────────────────────────────────────────────────┐
│                    DATA FLYWHEEL                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. HARVEST          2. ACCUMULATE        3. TRAIN          │
│  ┌──────────┐       ┌──────────┐        ┌──────────┐        │
│  │Browser   │──────►│Golden    │───────►│Unsloth   │        │
│  │Worker    │       │Dataset   │        │LoRA      │        │
│  │Refiner   │       │.jsonl    │        │Trainer   │        │
│  └──────────┘       └──────────┘        └──────────┘        │
│       │                                       │              │
│       │              4. SERVE                 │              │
│       │            ┌──────────┐              │              │
│       └───────────►│Ollama    │◄─────────────┘              │
│                    │brunella  │                              │
│                    │-nightly  │                              │
│                    └──────────┘                              │
└─────────────────────────────────────────────────────────────┘
```

## Fázisok

### Fázis A: Golden Dataset Collector
**Fájl:** `myai/utils/dataset_manager.py`

```python
def save_to_golden_dataset(user_prompt, system_prompt, model_output, metadata):
    """ChatML formátum (Llama 3 kompatibilis)"""
    entry = {
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
            {"role": "assistant", "content": json.dumps(model_output)}
        ],
        "metadata": {
            "source": metadata.get("source"),
            "timestamp": datetime.now().isoformat(),
            "validation_score": 1.0
        }
    }
```

**Integráció:** `myai/refiner_logic.py` - Pydantic validáció után mentés

### Fázis B: Nightly Trainer (Incubator)
**Fájl:** `myai/incubator/train.py`

**Technológia:**
- Unsloth (2x gyorsabb, 60% kevesebb VRAM)
- QLoRA 4-bit kvantálás
- Target: RTX 3060 12GB

**Ajánlott modellek (méret szerint):**
1. `unsloth/Qwen2.5-7B-Instruct` - Legjobb magyar nyelv
2. `unsloth/Mistral-7B-Instruct-v0.3` - Gyors, stabil
3. `unsloth/Meta-Llama-3.1-8B-Instruct` - Legjobb reasoning

### Fázis C: Model Hot-Swap
**Fájl:** `scripts/update_ollama_model.bat`

```batch
@echo off
echo Creating new Modelfile...
echo FROM ./models/brunella_nightly.Q4_K_M.gguf > Modelfile.nightly
echo SYSTEM You are Brunella, an advanced AI agent. >> Modelfile.nightly

echo Registering with Ollama...
ollama create brunella-nightly -f Modelfile.nightly

echo Testing...
ollama run brunella-nightly "Ready for work?"
```

### Fázis D: Scheduler
**Windows Task Scheduler:** Minden éjjel 03:00

## Technikai Követelmények

| Komponens | Requirement |
|-----------|-------------|
| GPU | NVIDIA RTX 3060+ (12GB VRAM) |
| Python | 3.10+ with CUDA support |
| Packages | unsloth, torch, transformers, peft |
| Storage | ~20GB modelleknek |

## Mérföldkövek

- [ ] `dataset_manager.py` implementálás
- [ ] `refiner_logic.py` integráció
- [ ] `myai/incubator/` mappa és trainer script
- [ ] GGUF export tesztelés
- [ ] Ollama integráció
- [ ] Windows Task Scheduler beállítás
- [ ] Első sikeres nightly training

## Kockázatok

1. **VRAM limit:** 8B modell QLoRA-val szoros, alternatíva: 7B modell
2. **Training idő:** ~2-4 óra/éjszaka 1000 sample-re
3. **Dataset minőség:** Csak 100% validált adat kerülhet be

## Kapcsolódó Trackek
- `browser_use_harvester` - Adatforrás
- `phoenix_protocol` - Hiba esetén recovery
