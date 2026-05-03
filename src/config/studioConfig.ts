import path from 'path';
import { z } from 'zod';

const StudioConfigSchema = z.object({
  ffmpegPath: z.string().default(process.env.FFMPEG_PATH?.trim() || 'ffmpeg'),
  ffprobePath: z.string().default(process.env.FFPROBE_PATH?.trim() || process.env.FFMPEG_PATH?.trim() || 'ffprobe'),
  pythonBin: z.string().default(process.env.PYTHON_BIN?.trim() || process.env.PYTHON_PATH?.trim() || 'python'),
  davinciResolveScriptApiPath: z.string().default(process.env.DAVINCI_RESOLVE_SCRIPT_API_PATH?.trim() || ''),
  davinciResolvePythonSitePackages: z.string().default(process.env.DAVINCI_RESOLVE_PYTHON_SITE_PACKAGES?.trim() || ''),
  davinciResolveProjectName: z.string().default(process.env.DAVINCI_RESOLVE_PROJECT_NAME?.trim() || 'BrunellaStudio'),
  defaultFps: z.coerce.number().positive().default(Number(process.env.BRUNELLA_STUDIO_DEFAULT_FPS || 25)),
  defaultResolution: z.string().default(process.env.BRUNELLA_STUDIO_DEFAULT_RESOLUTION?.trim() || '1920x1080'),
  exportDir: z.string().default(process.env.BRUNELLA_STUDIO_EXPORT_DIR?.trim() || path.join(process.cwd(), 'out', 'studio')),
  workDir: z.string().default(process.env.BRUNELLA_STUDIO_WORK_DIR?.trim() || path.join(process.cwd(), 'temp', 'studio')),
  projectTemplateDir: z.string().default(process.env.STUDIO_PROJECT_TEMPLATE_DIR?.trim() || path.join(process.cwd(), 'files', 'studio-templates')),
  exportPresetsDir: z.string().default(process.env.STUDIO_EXPORT_PRESETS_DIR?.trim() || path.join(process.cwd(), 'files', 'studio-presets')),
});

export type StudioConfig = z.infer<typeof StudioConfigSchema>;

let cachedConfig: StudioConfig | null = null;

export function getStudioConfig(): StudioConfig {
  if (!cachedConfig) {
    cachedConfig = StudioConfigSchema.parse({});
  }
  return cachedConfig;
}

export function parseStudioResolution(resolution: string): { width: number; height: number } {
  const match = resolution.trim().match(/^(\d{2,5})x(\d{2,5})$/i);
  if (!match) {
    throw new Error(`Érvénytelen BRUNELLA_STUDIO_DEFAULT_RESOLUTION: ${resolution}`);
  }

  return {
    width: Number(match[1]),
    height: Number(match[2]),
  };
}

export function getStudioProjectPaths(projectName: string): {
  projectRoot: string;
  manifestDir: string;
  exportDir: string;
  proxyDir: string;
  qcDir: string;
} {
  const config = getStudioConfig();
  const safeName = projectName.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'studio-project';
  const projectRoot = path.join(config.workDir, safeName);
  return {
    projectRoot,
    manifestDir: path.join(projectRoot, 'manifests'),
    exportDir: path.join(config.exportDir, safeName),
    proxyDir: path.join(projectRoot, 'proxies'),
    qcDir: path.join(projectRoot, 'qc'),
  };
}
