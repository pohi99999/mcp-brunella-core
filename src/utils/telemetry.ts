/**
 * Lightweight telemetry for Brunella CLI – Gemini-style events.
 * Local: NDJSON to ~/.brunella/telemetry.log or telemetry.outfile.
 * GCP: same local file by default; set telemetry.target=gcp and use an OTLP collector
 * or future SDK export for direct GCP. Env: BRUNELLA_TELEMETRY_* (see config schema).
 */
import fs from 'fs';
import path from 'path';
import os from 'os';

export type TelemetryTarget = 'local' | 'gcp';

export interface TelemetryConfig {
  enabled: boolean;
  target: TelemetryTarget;
  otlpEndpoint?: string;
  otlpProtocol?: 'grpc' | 'http';
  outfile?: string;
  logPrompts: boolean;
  useCollector: boolean;
  /** Use CLI credentials for GCP telemetry (Gemini parity); ignored when target=local. */
  useCliAuth?: boolean;
}

const DEFAULT_CONFIG: TelemetryConfig = {
  enabled: false,
  target: 'local',
  otlpEndpoint: 'http://localhost:4317',
  otlpProtocol: 'grpc',
  logPrompts: true,
  useCollector: false,
  useCliAuth: false
};

let _config: TelemetryConfig = { ...DEFAULT_CONFIG };
let _outStream: fs.WriteStream | null = null;

export function configureTelemetry(config: Partial<TelemetryConfig>): void {
  _config = { ...DEFAULT_CONFIG, ...config };
  if (_outStream) {
    _outStream.end();
    _outStream = null;
  }
}

export function isTelemetryEnabled(): boolean {
  return !!_config.enabled;
}

export function getTelemetryConfig(): TelemetryConfig {
  return { ..._config };
}

function ensureOutfile(): string {
  if (_config.outfile) return path.isAbsolute(_config.outfile) ? _config.outfile : path.join(process.cwd(), _config.outfile);
  const dir = path.join(os.homedir(), '.brunella');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'telemetry.log');
}

function openStream(): fs.WriteStream | null {
  if ((_config.target !== 'local' && _config.target !== 'gcp') || !_config.enabled) return null;
  try {
    const file = ensureOutfile();
    _outStream = fs.createWriteStream(file, { flags: 'a' });
    return _outStream;
  } catch {
    return null;
  }
}

function stream(): fs.WriteStream | null {
  if (_outStream) return _outStream;
  return openStream();
}

/** Gemini-style log event (e.g. brunella_cli.config, brunella_cli.user_prompt, brunella_cli.tool_call). */
export function recordEvent(
  eventName: string,
  attributes: Record<string, string | number | boolean | undefined> = {}
): void {
  if (!_config.enabled) return;
  const rec = {
    ts: new Date().toISOString(),
    event: eventName,
    ...attributes
  };
  if (_config.target === 'local' || _config.target === 'gcp') {
    const s = stream();
    if (s?.writable) s.write(JSON.stringify(rec) + '\n');
  }
  if (_config.target === 'gcp' && _config.otlpEndpoint && !_config.outfile) {
    /* Direct OTLP export to GCP would use @opentelemetry/exporter-trace-otlp-* here. */
  }
}

/** Counter/histogram-style metric (e.g. gemini_cli.tool.call.count, gemini_cli.api.request.latency). */
export function recordMetric(
  name: string,
  value: number,
  attributes: Record<string, string | number | boolean> = {}
): void {
  if (!_config.enabled) return;
  const rec = {
    ts: new Date().toISOString(),
    metric: name,
    value,
    ...attributes
  };
  if (_config.target === 'local' || _config.target === 'gcp') {
    const s = stream();
    if (s?.writable) s.write(JSON.stringify(rec) + '\n');
  }
}

/** Session start – emit brunella_cli.config-style event once. */
export function recordSessionStart(attrs: Record<string, string | number | boolean>): void {
  recordEvent('brunella_cli.config', attrs);
}

/** User prompt (only if logPrompts). */
export function recordUserPrompt(promptId: string, promptLength: number, prompt?: string): void {
  if (!_config.logPrompts) return;
  recordEvent('brunella_cli.user_prompt', {
    prompt_id: promptId,
    prompt_length: promptLength,
    ...(prompt !== undefined ? { prompt } : {})
  });
}

/** Tool call. */
export function recordToolCall(
  functionName: string,
  durationMs: number,
  success: boolean,
  attrs?: Record<string, string | number | boolean>
): void {
  recordEvent('brunella_cli.tool_call', {
    function_name: functionName,
    duration_ms: durationMs,
    success,
    ...attrs
  });
  recordMetric('brunella_cli.tool.call.count', 1, { function_name: functionName, success });
  recordMetric('brunella_cli.tool.call.latency', durationMs, { function_name: functionName });
}

export function flushTelemetry(): void {
  if (_outStream?.writable) {
    _outStream.end();
    _outStream = null;
  }
}

/** Initialize from a config-like object (e.g. configManager.get('telemetry') or full settings). */
export function initTelemetryFromConfig(settings: { telemetry?: TelemetryConfig } | TelemetryConfig): void {
  const t = settings && 'enabled' in settings ? (settings as TelemetryConfig) : (settings as { telemetry?: TelemetryConfig }).telemetry;
  if (t) configureTelemetry(t);
}
