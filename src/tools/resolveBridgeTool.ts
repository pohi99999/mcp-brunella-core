import { execFile } from 'child_process';
import { readFile } from 'fs/promises';
import path from 'path';

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { getStudioConfig } from '../config/studioConfig.js';
import type { RenderJob, ResolveOperation, TimelinePlan } from '../schemas/studioSchemas.js';
import { loadTimelinePlan } from './timelinePlanTool.js';

function execFileAsync(command: string, args: string[], input?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile(command, args, { maxBuffer: 8 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`${command} ${args.join(' ')} failed: ${stderr || error.message}`));
        return;
      }
      resolve(stdout);
    });
    if (input) {
      child.stdin?.write(input);
      child.stdin?.end();
    }
  });
}

function getResolveScripts(): { probeScript: string; bridgeScript: string } {
  return {
    probeScript: path.join(process.cwd(), 'scripts', 'resolve', 'resolve_probe.py'),
    bridgeScript: path.join(process.cwd(), 'scripts', 'resolve', 'resolve_bridge.py'),
  };
}

export async function probeResolveBridge(): Promise<Record<string, unknown>> {
  const config = getStudioConfig();
  const scripts = getResolveScripts();
  const probe = JSON.parse(await execFileAsync(config.pythonBin, [scripts.probeScript])) as Record<string, unknown>;
  const bridge = JSON.parse(await execFileAsync(config.pythonBin, [scripts.bridgeScript], JSON.stringify({ command: 'probe', payload: {} }))) as Record<string, unknown>;
  return { ...probe, bridge };
}

export async function executeResolveBridge(command: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const config = getStudioConfig();
  const scripts = getResolveScripts();
  return JSON.parse(await execFileAsync(config.pythonBin, [scripts.bridgeScript], JSON.stringify({ command, payload }))) as Record<string, unknown>;
}

export function prepareResolveTimelineImportFlow(options: {
  projectName: string;
  timelinePlan: TimelinePlan;
  renderJobs?: RenderJob[];
}): { projectName: string; operations: ResolveOperation[] } {
  const uniqueMedia = [...new Set(options.timelinePlan.timeline.map((clip) => clip.assetPath))];
  const operations: ResolveOperation[] = [
    { command: 'create_or_open_project', payload: { projectName: options.projectName } },
    { command: 'create_bins', payload: { projectName: options.projectName, bins: ['hero', 'details', 'motion', 'ending', 'music'] } },
    { command: 'import_media', payload: { projectName: options.projectName, paths: uniqueMedia } },
    { command: 'create_timeline', payload: { projectName: options.projectName, timelineName: `${options.projectName}-rough-cut` } },
    {
      command: 'append_clips',
      payload: {
        projectName: options.projectName,
        clips: options.timelinePlan.timeline.map((clip) => ({
          path: clip.assetPath,
          startSec: clip.startSec,
          endSec: clip.endSec,
          placementSec: clip.placementSec,
          segmentId: clip.segmentId,
        })),
      },
    },
    {
      command: 'add_markers',
      payload: {
        projectName: options.projectName,
        markers: options.timelinePlan.markers.map((marker) => ({
          frameId: marker.timeSec * 25,
          color: marker.color,
          name: marker.label,
          note: marker.note || '',
          duration: 1,
        })),
      },
    },
  ];

  for (const job of options.renderJobs ?? []) {
    operations.push({
      command: 'queue_render',
      payload: {
        projectName: options.projectName,
        renderSettings: {
          SelectAllFrames: true,
          TargetDir: path.dirname(job.outputPath),
          CustomName: path.basename(job.outputPath),
          Format: job.preset.container,
        },
      },
    } as unknown as ResolveOperation);
  }

  return { projectName: options.projectName, operations };
}

export async function loadRenderJobs(renderJobsPath: string): Promise<RenderJob[]> {
  return JSON.parse(await readFile(renderJobsPath, 'utf-8')) as RenderJob[];
}

export function registerResolveBridgeTools(server: McpServer): void {
  server.tool('studio_resolve_probe', 'Checks DaVinci Resolve scripting readiness via the Python bridge.', {}, async () => ({ content: [{ type: 'text', text: JSON.stringify(await probeResolveBridge(), null, 2) }] }));
  server.tool('studio_resolve_execute', 'Executes a raw Resolve bridge command payload.', { command: z.string().min(1), payload: z.record(z.string(), z.unknown()).default({}) }, async (args) => ({ content: [{ type: 'text', text: JSON.stringify(await executeResolveBridge(args.command, args.payload), null, 2) }] }));
  server.tool('studio_resolve_prepare_timeline', 'Prepares a Resolve timeline import flow from a timeline plan and optional render jobs.', {
    project_name: z.string().min(1),
    timeline_plan_path: z.string().min(1),
    render_jobs_path: z.string().optional(),
  }, async (args) => {
    const timelinePlan = await loadTimelinePlan(args.timeline_plan_path);
    const renderJobs = args.render_jobs_path ? await loadRenderJobs(args.render_jobs_path) : undefined;
    return { content: [{ type: 'text', text: JSON.stringify(prepareResolveTimelineImportFlow({ projectName: args.project_name, timelinePlan, renderJobs }), null, 2) }] };
  });
}
