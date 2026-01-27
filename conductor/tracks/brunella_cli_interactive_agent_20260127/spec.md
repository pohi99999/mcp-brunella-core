# Specification - Brunella CLI Interactive Agent Mode

## Overview
A Brunella CLI bővítése egy olyan interaktív chat móddal, amely képes eszközök (tools) hívására, különös tekintettel a Python és Node.js interpreterekre.

## User Stories
- "Felhasználóként szeretnék a `brunella chat` parancs után egy folyamatos párbeszédet folytatni az AI-val."
- "Szeretném, ha az AI képes lenne kódot írni és azt azonnal le is futtatni a kérésemre."
- "Szeretném látni a kód futásának eredményét közvetlenül a chat felületen."

## Requirements
1.  **REPL Loop:** A CLI ne lépjen ki minden válasz után, hanem várja a következő bemenetet.
2.  **Tool Orchestration:** Integrálni kell a `src/agents/AgentManager.ts` tervezési logikáját a CLI-be.
3.  **Formatting:** Markdown támogatás a terminálban (már részben kész, de finomítani kell).
4.  **Interpreter Integration:** Az AI-nak dedikált rendszerszintű hozzáférést kell kapnia az `interpreter_run_python` eszközhöz.
