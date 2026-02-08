# Implementation Plan: EV Hunter Bot

## Phase 1: Environment & Bot Setup
- [ ] Task: **Source Code Preparation.**
    - Place `ev_hunter_bot.py` and `requirements.txt` into `external_research/ev_hunter_bot/`.
- [ ] Task: **Install Dependencies.**
    - Run `pip install -r requirements.txt`.
- [ ] Task: **Configure SMTP.**
    - Set up Gmail App Password and update bot script.
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Setup' (Protocol in workflow.md)

## Phase 2: Agent Architecture
- [ ] Task: **Create `ev_hunter` agent.**
    - Use **Agent Architect** to design the prompt and configuration for the EV Hunter agent.
    - Save to `myai/agents/ev_hunter.toml`.
- [ ] Task: **Register Agent.**
    - Add to `src/agents/registry.json`.
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Agent' (Protocol in workflow.md)

## Phase 3: Live Testing & Activation
- [ ] Task: **Manual Test Run.**
    - Execute `python ev_hunter_bot.py test`.
    - Verify email receipt and Excel attachment.
- [ ] Task: **CLI Integration Test.**
    - Run via Brunella CLI: `brunella run agent_delegate agent_name=ev_hunter task="Start immediate search"`.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Launch' (Protocol in workflow.md)
