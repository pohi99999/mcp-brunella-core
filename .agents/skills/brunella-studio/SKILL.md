---
name: brunella-studio
description: "Use when the user says /Brunella_Studio, Brunella Studio, or asks for the video / post-production pipeline inside Brunella."
---

# Brunella Studio

Use this skill for the fashion / promo video pipeline and the Studio dashboard surface.

## Trigger conditions

- `/Brunella_Studio`
- Brunella Studio
- studio render / qc / rough-cut
- any request to manage the video post-production workflow

## Relevant surfaces

- `src/components/dashboard/BrunellaStudio.tsx`
- `src/components/dashboard/CampaignStudio.tsx`
- `src/dashboard/lib/navigation.tsx` (`studio`, `campaign-studio`)
- `docs/brunella-studio-agent.md`
- `docs/davinci-resolve-setup.md`

## Workflow

1. Probe the environment and confirm media readiness.
2. Ingest the assets into a manifest.
3. Build the rough cut and audio plan.
4. Render the baseline deliverables.
5. Run QC before calling the pipeline done.

## Do

- Keep the workflow deterministic where possible.
- Preserve manifests and QC artifacts.
- Prefer explicit stage-by-stage progress over opaque "done" states.
- Ask before overwriting media or render outputs.

## Don't

- Skip QC or treat a failed render as acceptable.
- Hide media-path assumptions.
- Mix studio workflow changes with unrelated runtime edits.

## Validation

- The Studio panel surfaces the expected workflow stages.
- The asset manifest matches the run inputs.
- Render and QC outputs can be traced back to the requested job.
