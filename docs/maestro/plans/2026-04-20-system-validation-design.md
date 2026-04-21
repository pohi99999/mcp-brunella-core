---
title: Brunella Full System Validation Design
design_depth: deep
task_complexity: complex
date: 2026-04-20
---

# Brunella Full System Validation Design

## 1. Problem Statement
Igazolni kell a Brunella Phase 5 transzformáció stabilitását. A 71 ügynök, 20 worker és a több-LLM struktúra integrációjának hibátlanul kell működnie az új monorepo környezetben, különös tekintettel a Dashboard (PAIOS) és a CLI funkciókra.

## 2. Requirements
- REQ-VAL-1: Teljes indítási lánc (Ollama -> AnythingLLM -> FastAPI -> Node -> Vite 5173).
- REQ-VAL-2: GitHub OpenAI GPT-4.1 elsődleges válaszadás Nova hangján.
- REQ-VAL-3: E2E Dashboard teszt (Kattintások, Chrome DevTools vezérlés).
- REQ-VAL-4: Minden CLI funkció hibátlan működése.
- REQ-VAL-5: Phoenix öngyógyítás és Golden Dataset gyűjtés.

## 3. Approach
Approach 1: Top-Down Integrált Audit. PAIOS Chat vezérelt tesztek proaktív hibainjektálással.

## 4. Architecture
UI (5173) -> Socket.IO -> Core -> LLM Gateway (GPT-4.1) -> Backend (Python). 
Szigorú app -> package függőségi irány betartása.

## 5. Agent Team
tester, debugger, frontend_specialist, performance_engineer, code_reviewer.

## 6. Risk Assessment
OOM hiba az ágensek felfűtésekor, Port ütközések, Integrációs szakadás a refaktor miatt.

## 7. Success Criteria
Minden Dashboard és CLI funkció 100%-os. GPT-4.1 válaszol. Phoenix újraindít. Baseline rögzítve.
