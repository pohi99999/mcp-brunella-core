# Megvalósítási Terv: Szigorú Tesztelés

## Fázis 1: CLI Alapok (Connectivity & Discovery)
- [ ] **Test 1.1: `about` és Config**
    - Parancs: `node build/cli.js about`
- [ ] **Test 1.2: `tools` Listázás**
    - Parancs: `node build/cli.js tools`
    - Cél: Látni kell a `ping`, `agent_delegate` és `ollama_generate` toolokat.
- [ ] **Test 1.3: `agents` Listázás**
    - Parancs: `node build/cli.js agents`
    - Cél: Látni kell a 6 alapügynököt.

## Fázis 2: Core Tool Végrehajtás
- [ ] **Test 2.1: Ping**
    - Parancs: `node build/cli.js run ping`
- [ ] **Test 2.2: Ollama (LLM) Közvetlen Hívás**
    - Parancs: `node build/cli.js run ollama_generate prompt="Hello"`
    - Ez validálja az LLM klienst az ügynökök előtt.

## Fázis 3: Ügynök Intelligencia (Agent Brains)
- [ ] **Test 3.1: Orchestrator (Chat)**
    - Parancs: `node build/cli.js delegate orchestrator "Szia, hogy vagy?"`
- [ ] **Test 3.2: Python Developer (Interpreter)**
    - Parancs: `node build/cli.js delegate python_developer "Calculate 10 + 20"`
    - Ellenőrzi a Python Shell integrációt.
- [ ] **Test 3.3: Data Scientist (Refiner)**
    - Parancs: `node build/cli.js delegate data_scientist "clean: adatok..."`
    - Ellenőrzi a Python Refiner script hívását.

## Fázis 4: Komplex Scenáriók
- [ ] **Test 4.1: Hibatűrés**
    - Nem létező agent vagy tool hívása.
