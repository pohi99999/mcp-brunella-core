# Brunella Studio Agent

## Purpose
Brunella Studio Agent adds a deterministic, auditable fashion promo post-production subsystem to BAS. It focuses on ingest, scoring, rough-cut planning, audio post planning, Resolve handoff, FFmpeg baseline rendering, QC, and reusable delivery presets.

## Architecture
- `src/schemas/studioSchemas.ts` — typed contracts for assets, timeline plans, audio plans, render jobs, QC, and pipeline reports.
- `src/config/studioConfig.ts` — env-backed studio config and working directory paths.
- `src/services/studio/*` — pure planning and organization logic: clip scoring, timeline assembly, beat mapping, ducking, export planning, media manifests.
- `src/tools/*studio*` — executable MCP tools around FFmpeg, Resolve, ingest, audio planning, delivery, and QC.
- `src/agents/*Studio*` — orchestration and specialist agents.
- `src/skills/*Studio*` — stable BAS skill entrypoints.
- `scripts/resolve/*` — Python bridge and detection scripts for DaVinci Resolve scripting.

## Agents
- `StudioSupervisorAgent` — orchestrates the end-to-end studio pipeline.
- `MediaIngestAgent` — scans source media and produces an ingest manifest.
- `StoryCutAgent` — produces rough-cut timeline plans.
- `AudioMixAgent` — generates beat map, cue, and ducking plans.
- `ColorPrepAgent` — builds Resolve handoff operations.
- `QcRenderAgent` — baseline render plus QC checks.

## Skills
- `studio-orchestration`
- `rough-cut`
- `audio-post`
- `delivery`

## Tools
- `ffmpegTool.ts` — probe, proxy, trim, concat, normalize, transcode, verify, thumbnail.
- `mediaAnalysisTool.ts` — media ingest and normalized metadata.
- `timelinePlanTool.ts` — rough-cut timeline generation.
- `audioPlanTool.ts` — beat/ducking/cue plan generation.
- `renderPresetTool.ts` — delivery presets and FFmpeg baseline render.
- `resolveBridgeTool.ts` — Python-based Resolve probe and command bridge.
- `qcTool.ts` — black-frame, stream, duration, and audio peak heuristics.

## Workflow
1. `studio init` creates work directories.
2. `studio probe` checks FFmpeg/Resolve readiness.
3. `studio ingest` creates an auditable ingest manifest.
4. `studio rough-cut` generates the promo sequence plan.
5. `studio audio-plan` creates beat and ducking guidance.
6. `studio render` produces baseline deliverables.
7. `studio qc` validates outputs.
8. `studio full-pipeline` chains the above and writes a pipeline report.

## Delivery presets
- `master-16x9`
- `reel-9x16`
- `social-1x1`
- `teaser-short`

## Dependencies
### Automatic / code-level
- Node.js / TypeScript orchestration
- Python bridge invocation through `PYTHON_BIN`
- FFmpeg / FFprobe via `FFMPEG_PATH` / `FFPROBE_PATH`

### Manual prerequisite
- DaVinci Resolve Studio or free Resolve with scripting enabled and Python API paths configured. See `docs/davinci-resolve-setup.md`.

## Assumptions
1. The FFmpeg render path is the deterministic baseline; Resolve is the finishing layer, not the only execution path.
2. Source media remains read-only. All generated artifacts live under `temp/studio` and `out/studio` by default.
3. Audio post is planning-first: full mix polish is expected to happen in Resolve/Fairlight when needed.
4. Social aspect conversions use scale/pad by default for safety. If center-crop is preferred, that should be a follow-up preset enhancement.
5. Resolve append/render commands are wired for production handoff, but successful execution still depends on a local Resolve installation.

## Common failure modes
- `studio probe` shows FFmpeg missing -> set `FFMPEG_PATH` or install FFmpeg.
- Resolve probe shows API not reachable -> configure `DAVINCI_RESOLVE_SCRIPT_API_PATH` and `DAVINCI_RESOLVE_PYTHON_SITE_PACKAGES`.
- QC warns about missing audio -> provide `--music-track` during render/full-pipeline.
- Unexpected duration -> adjust target duration or refine timeline plan.

## First full run
```bash
npm run build
node build/cli.js studio probe
node build/cli.js studio full-pipeline --input-dir F:\media\vv-promo --project-name vv-fashion --music-track F:\media\vv-promo\music.mp3 --style elegant --presets master-16x9,reel-9x16
```
