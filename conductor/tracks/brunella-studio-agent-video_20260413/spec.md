# Spec — Brunella Studio Agent

## Inputs
- Media source directory containing raw clips, stills, and optional music
- Optional project name, edit style, target duration, and preset selection
- Optional Resolve project settings and render queue preferences

## Core contracts
- `MediaAsset`: normalized probe metadata and ingest tags
- `TimelinePlan`: deterministic segment plan + clip placement + markers
- `AudioPlan`: beat markers, intensity curve, ducking plan, loudness targets
- `RenderJob`: preset-driven delivery output specification
- `QcReport`: auditable render validation output
- `PipelineRunReport`: multi-stage run summary with generated artifacts

## Required capabilities
1. Probe FFmpeg and Resolve readiness
2. Ingest a directory without mutating source files
3. Generate a rough-cut plan JSON from analyzed clips
4. Generate an audio plan JSON from music + timeline
5. Prepare Resolve operations when Resolve is available
6. Produce export jobs for master/social variants
7. Run QC heuristics on final outputs

## Safety rules
- All outputs must land under a dedicated studio work/export directory
- Source media paths are read-only
- External process execution must avoid shell interpolation
- All stage failures return structured errors/warnings

## Acceptance targets
- `npm run build` succeeds
- Studio agents/skills/tools are registered
- `brunella studio ...` commands are callable
- FFmpeg/Resolve probe commands produce structured output
- Rough-cut, audio-plan, render planning, and QC can run end-to-end in JSON-first mode
