// FILE: src/utils/telemetry.ts
// PURPOSE: Zone I: LangSmith integráció + CLI telemetry (OTLP/stub).

import { Client } from "langsmith";

/** LangSmith tracer for LangChain runnables (optional: use when @langchain/core available). */
export function getTracer(projectName: string = "brunella-core"): { projectName: string; client?: Client } {
  try {
    if (process.env.LANGCHAIN_API_KEY) {
      const client = new Client({ apiKey: process.env.LANGCHAIN_API_KEY });
      return { projectName, client };
    }
  } catch {
    // fallback to stub
  }
  return { projectName };
}

export const logTokenUsage = (agentName: string, usage: { input: number; output: number }) => {
  console.log(`[Telemetry] Agent: ${agentName} | Tokens: In=${usage.input}, Out=${usage.output}`);
};

// --- CLI telemetry (Brunella OTLP / config-driven): stubs so CLI builds ---
export function initTelemetryFromConfig(_config: unknown): void {}
export function recordSessionStart(_payload: Record<string, string>): void {}
export function flushTelemetry(): void {}
export function recordToolCall(_tool: string, _payload?: unknown): void {}
export function isTelemetryEnabled(): boolean {
  return Boolean(process.env.BRUNELLA_TELEMETRY_ENABLED);
}
