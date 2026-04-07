#!/usr/bin/env npx tsx
import 'dotenv/config';
/**
 * BAS Startup Smoke Test — Szolgáltatás végpont ellenőrzés
 *
 * Minden futó szolgáltatás HTTP endpointját teszteli és összesített riportot ad.
 * Használat: npx tsx scripts/startup_smoke_test.ts
 * Vagy: npm run smoke:startup
 */

interface EndpointCheck {
  name: string;
  url: string;
  optional: boolean;
  status: 'ok' | 'fail' | 'skip';
  responseTime: number;
  error?: string;
}

const anythingLlmBaseUrl = process.env.ANYTHINGLLM_BASE_URL || process.env.ANYTHINGLLM_URL || 'http://localhost:3001';

function joinUrl(base: string, path: string): string {
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  return new URL(path.replace(/^\//, ''), normalizedBase).toString();
}

const ENDPOINTS: Omit<EndpointCheck, 'status' | 'responseTime' | 'error'>[] = [
  { name: 'Brunella Core Ready', url: 'http://localhost:3000/readyz', optional: false },
  { name: 'Dashboard UI', url: 'http://localhost:3000/', optional: false },
  { name: 'FastAPI Python', url: 'http://localhost:8000/health', optional: false },
  { name: 'Dashboard Dev UI', url: 'http://localhost:5173', optional: true },
  { name: 'Ollama LLM', url: 'http://localhost:11434/api/tags', optional: false },
  { name: 'AnythingLLM', url: joinUrl(anythingLlmBaseUrl, '/api/ping'), optional: true },
];

async function checkEndpoint(ep: Omit<EndpointCheck, 'status' | 'responseTime' | 'error'>): Promise<EndpointCheck> {
  const start = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(ep.url, { signal: controller.signal });
    return {
      ...ep,
      status: res.ok || res.status === 401 || res.status === 403 ? 'ok' : 'fail',
      responseTime: Date.now() - start,
    };
  } catch (e: unknown) {
    return {
      ...ep,
      status: 'fail',
      responseTime: Date.now() - start,
      error: e instanceof Error ? e.message : String(e),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function icon(status: string): string {
  if (status === 'ok') return '\x1b[32m✅\x1b[0m';
  if (status === 'skip') return '\x1b[33m⏭️\x1b[0m';
  return '\x1b[31m❌\x1b[0m';
}

async function main() {
  console.log('\n\x1b[36m╔══════════════════════════════════════════╗\x1b[0m');
  console.log('\x1b[36m║   BAS Startup Smoke Test                 ║\x1b[0m');
  console.log('\x1b[36m╚══════════════════════════════════════════╝\x1b[0m\n');

  const results = await Promise.all(ENDPOINTS.map(checkEndpoint));

  const maxName = Math.max(...results.map((result) => result.name.length));
  for (const result of results) {
    const name = result.name.padEnd(maxName);
    const time = `${result.responseTime}ms`.padStart(6);
    const detail = result.error ? ` (${result.error.slice(0, 40)})` : '';
    console.log(`  ${icon(result.status)} ${name}  ${time}${detail}`);
  }

  const tableHeader = `\n\x1b[36m╔${'═'.repeat(maxName + 22)}╗\x1b[0m\n`
    + `\x1b[36m║  Szolgáltatás${' '.repeat(maxName - 12)}  │  Státusz  │  Idő   │ Hiba\x1b[0m\n`
    + `\x1b[36m╠${'═'.repeat(maxName + 2)}╦══════════╦========╦${'═'.repeat(20)}╣\x1b[0m`;
  console.log(tableHeader);

  for (const result of results) {
    const name = result.name.padEnd(maxName);
    const time = `${result.responseTime}ms`.padStart(6);
    const stat = icon(result.status).padEnd(8);
    const err = result.error ? `\x1b[31m${result.error.slice(0, 20)}\x1b[0m` : '';
    console.log(`\x1b[36m║\x1b[0m ${name} │  ${stat} │ ${time} │ ${err}`);
  }

  console.log(`\x1b[36m╚${'═'.repeat(maxName + 22)}╝\x1b[0m`);

  const ok = results.filter((result) => result.status === 'ok').length;
  const fail = results.filter((result) => result.status === 'fail' && !result.optional).length;
  const warnFail = results.filter((result) => result.status === 'fail' && result.optional).length;

  console.log(`\n  Összesítés: ${ok}/${results.length} elérhető`
    + (warnFail > 0 ? `, ${warnFail} opcionális nem elérhető` : '')
    + (fail > 0 ? `, \x1b[31m${fail} KRITIKUS HIBA\x1b[0m` : ''));

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ timestamp: new Date().toISOString(), results }, null, 2));
  }

  process.exitCode = fail > 0 ? 1 : 0;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
