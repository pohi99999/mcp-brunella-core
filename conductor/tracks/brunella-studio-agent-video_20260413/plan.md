# Plan — Brunella Studio Agent

## Goal
Build a production-grade BAS subsystem for fashion promo post-production: ingest media, create rough-cut plans, prepare audio mix logic, bridge to DaVinci Resolve, export multiple deliverables, and run QC checks.

## Phases

### Phase 1 — Contracts and config
- Create typed studio schemas
- Add studio configuration loader and env documentation
- Scaffold conductor track and workflow docs

### Phase 2 — Media intelligence services
- Implement media ingest/bin organization
- Add clip scoring and duplicate heuristics
- Add timeline assembly templates and edit styles
- Add beat mapping and ducking planning
- Add export planning presets

### Phase 3 — Tooling and bridge
- Implement FFmpeg wrapper layer
- Implement Resolve Python bridge + probe script
- Add media analysis, rough-cut, audio-plan, preset, and QC tools

### Phase 4 — Agent orchestration
- Implement StudioSupervisorAgent and specialist sub-agents
- Implement studio skills and register them
- Wire MCP tools and agent registry entries

### Phase 5 — CLI, docs, tests
- Add Brunella studio CLI commands
- Document setup and operating model
- Add focused tests and verify build/test flow

## Notes
- Source media must never be overwritten.
- Resolve integration must remain optional and explicit.
- FFmpeg should provide the deterministic baseline; Resolve/Fairlight is the professional finishing layer.
