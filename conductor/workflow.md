# Project Workflow - MCP Brunella Core

## General Rules
- All code changes must follow the selected code style guides.
- Test coverage must be maintained above 80%.
- Changes must be committed after every successful task.
- Git Notes are used to record task summaries.

## Core Documentation (mag.md)
- A `mag.md` file must be maintained in the project root.
- This file is the "brain" of the project, containing all relevant information, architectural decisions, and a log of all developments and changes.
- Every task completion must be reflected in `mag.md` with a summary of the change.

## Task Execution
1. Before starting a task, review the project context in `conductor/index.md`.
2. Follow the plan defined in the current track's `plan.md`.
3. After completing a task:
    - Run tests to ensure quality.
    - Update `mag.md` with the latest changes and development report.
    - Commit changes and add a Git Note with the task summary.