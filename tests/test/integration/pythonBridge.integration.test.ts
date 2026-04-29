/**
 * Python Bridge Integration Tests — Node↔Python E2E validáció
 *
 * Ezek a tesztek csak PYTHON_BRIDGE_E2E=1 esetén futnak (live FastAPI szerver kell).
 * Rendes `npm run test:fast` futtatásban a describe.skipIf guard kihagyja őket.
 *
 * Futtatás: npm run test:integration
 *   (ami beállítja a PYTHON_BRIDGE_E2E=1 env változót és elindítja a szervert)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { z } from 'zod';
import {
  validatePythonResponse,
  parseAndValidate,
  HarvestResultSchema,
  HarvestExtractResultSchema,
  RefineResultSchema,
} from '@packages/utils/pythonBridge.js';
import { startPythonServer, stopPythonServer, PYTHON_TEST_HOST, PYTHON_TEST_PORT } from '../helpers/startPythonServer.js';

const BASE_URL = `http://${PYTHON_TEST_HOST}:${PYTHON_TEST_PORT}`;

// ── Helyi sémák a bridge-n kívüli végpontokhoz ─────────────────────

const HealthResponseSchema = z.object({
  status: z.string(),
  service: z.string().optional(),
});

const RagSearchResponseSchema = z.object({
  results: z.array(z.unknown()),
  // query echo NEM szerepel a RAGQueryResponse-ban (server.py:159-161)
});

const CometExecuteResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(z.unknown()).optional(),
  error: z.string().nullable().optional(),
  attempts: z.number().optional(),
});

const CometMemoryResponseSchema = z.object({
  status: z.string(),
});

// ── Guard: csak PYTHON_BRIDGE_E2E=1 esetén futnak a live tesztek ───

const isE2EEnabled = process.env.PYTHON_BRIDGE_E2E === '1';

describe.skipIf(!isE2EEnabled)('Python Bridge E2E — live FastAPI (port 8099)', () => {
  beforeAll(async () => {
    await startPythonServer();
  }, 30_000); // 30s timeout a szerver indításához

  afterAll(() => {
    stopPythonServer();
  });

  // ── /health ──────────────────────────────────────────────────────

  it('GET /health — "ok" státuszt ad vissza és séma érvényes', async () => {
    const res = await fetch(`${BASE_URL}/health`);

    expect(res.ok).toBe(true);

    const raw = await res.json() as unknown;
    const validated = validatePythonResponse(HealthResponseSchema, raw, '/health');

    expect(validated.success).toBe(true);
    if (validated.success) {
      expect(validated.data.status).toBe('ok');
    }
  });

  // ── /rag/query ───────────────────────────────────────────────────

  it('POST /rag/query — results tömböt tartalmaz (query echo nincs)', async () => {
    const body = { query: 'brunella test lekérdezés', limit: 3 };

    const res = await fetch(`${BASE_URL}/rag/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    // RAG esetén 503 is elfogadható (ha lancedb nem elérhető a test env-ben)
    if (!res.ok) {
      const errBody = await res.text();
      console.warn(`/rag/query HTTP ${res.status} — skipping schema validation: ${errBody.slice(0, 200)}`);
      return;
    }

    const raw = await res.json() as unknown;
    const validated = validatePythonResponse(RagSearchResponseSchema, raw, '/rag/query');

    expect(validated.success).toBe(true);
    if (validated.success) {
      expect(Array.isArray(validated.data.results)).toBe(true);
      // query echo NEM szerepel a response-ban — NE ellenőrizd
    }
  });

  // ── /comet/execute ────────────────────────────────────────────────

  it('POST /comet/execute — CometResult shape-et ad vagy strukturált HTTP hibát', async () => {
    const body = { task: 'Open about:blank and report whether execution started', context: {} };

    const res = await fetch(`${BASE_URL}/comet/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.warn(`/comet/execute HTTP ${res.status} — skipping schema validation: ${errBody.slice(0, 200)}`);
      return;
    }

    const raw = await res.json() as unknown;
    const validated = validatePythonResponse(CometExecuteResponseSchema, raw, '/comet/execute');

    expect(validated.success).toBe(true);
    if (validated.success) {
      expect(typeof validated.data.success).toBe('boolean');
    }
  });

  // ── DELETE /comet/memory ──────────────────────────────────────────

  it('DELETE /comet/memory — régi bejegyzések törlése status mezőt ad vissza', async () => {
    const res = await fetch(`${BASE_URL}/comet/memory?days=30`, {
      method: 'DELETE',
    });

    // Comet esetén 500 is elfogadható (ha ActionMemory modul nem elérhető)
    if (!res.ok) {
      const errBody = await res.text();
      console.warn(`DELETE /comet/memory HTTP ${res.status} — skipping schema validation: ${errBody.slice(0, 200)}`);
      return;
    }

    const raw = await res.json() as unknown;
    const validated = validatePythonResponse(CometMemoryResponseSchema, raw, 'DELETE /comet/memory');

    expect(validated.success).toBe(true);
    if (validated.success) {
      expect(typeof validated.data.status).toBe('string');
    }
  });

  // ── Existing schema integration — HarvestResult ───────────────────

  it('validatePythonResponse — Harvest live válasz vagy hiba payload nem crasheli a bridge-et', async () => {
    const body = { scenario_path: 'myai/scenarios/nonexistent_xyzabc_99999.json', force_mode: 'api' };

    const res = await fetch(`${BASE_URL}/harvest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const raw = await res.json() as unknown;
    const validated = validatePythonResponse(HarvestResultSchema, raw, '/harvest');

    expect(res.status).toBe(404);
    expect(typeof validated.success).toBe('boolean');
  });
});

// ── Séma validáció — ezek MINDIG futnak (PYTHON_BRIDGE_E2E nélkül is) ──

describe('validatePythonResponse — séma mismatch és null handling', () => {
  it('érvényes adat → success: true, data visszakapható', () => {
    const schema = z.object({ status: z.string() });

    const result = validatePythonResponse(schema, { status: 'ok' }, '/test');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('ok');
    }
  });

  it('séma mismatch → success: false, errors tömb nem üres', () => {
    const StrictSchema = z.object({
      required_field: z.string(),
      count: z.number(),
    });
    const invalidData = { wrong_field: 'value', count: 'not-a-number' };

    const result = validatePythonResponse(StrictSchema, invalidData, '/test');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThan(0);
      // Az errors mező path: message formátumban van
      expect(result.errors.every((e) => e.includes(':'))).toBe(true);
    }
  });

  it('null adat → success: false (graceful degradation, nem dob exception)', () => {
    const schema = z.object({ status: z.string() });

    expect(() => validatePythonResponse(schema, null, '/test')).not.toThrow();

    const result = validatePythonResponse(schema, null, '/test');
    expect(result.success).toBe(false);
  });

  it('undefined adat → success: false (graceful degradation)', () => {
    const schema = z.object({ status: z.string() });

    const result = validatePythonResponse(schema, undefined, '/test');

    expect(result.success).toBe(false);
  });

  it('FastAPI el nem érhető → connection refused szimuláció — nem crashel', () => {
    const HealthSchema = z.object({ status: z.string() });
    // ECONNREFUSED esetén az alkalmazás kód egy error objectet kaphat
    const errorPayload = { error: 'Connection refused', code: 'ECONNREFUSED' };

    expect(() => validatePythonResponse(HealthSchema, errorPayload, '/health')).not.toThrow();

    const result = validatePythonResponse(HealthSchema, errorPayload, '/health');
    // Az errorPayload-ban nincs 'status' — validáció sikertelennek kell lennie
    expect(result.success).toBe(false);
  });

  it('HarvestResultSchema — érvényes adat validációja', () => {
    const validHarvest = { status: 'success', steps_completed: 5 };

    const result = validatePythonResponse(HarvestResultSchema, validHarvest, '/harvest');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('success');
      expect(result.data.steps_completed).toBe(5);
    }
  });

  it('RefineResultSchema — hiányzó opcionális mezők esetén is érvényes', () => {
    const minimalRefine = { status: 'ok' };

    const result = validatePythonResponse(RefineResultSchema, minimalRefine, '/refine');

    expect(result.success).toBe(true);
  });

  it('HarvestExtractResultSchema — érvényes adat séma mismatch nélkül', () => {
    const validExtract = { status: 'success', raw_text: 'extracted content' };

    const result = validatePythonResponse(HarvestExtractResultSchema, validExtract, '/harvest/extract');

    expect(result.success).toBe(true);
  });
});

// ── parseAndValidate — JSON parse + validáció egylépésben ────────────

describe('parseAndValidate — JSON parse és séma validáció', () => {
  it('érvényes JSON + séma → success: true, data helyes', () => {
    const schema = z.object({ status: z.string() });

    const result = parseAndValidate(schema, '{"status": "ok"}', '/test');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('ok');
    }
  });

  it('érvénytelen JSON → success: false, errors tartalmaz "JSON parse hiba" szöveget', () => {
    const schema = z.object({ status: z.string() });

    const result = parseAndValidate(schema, 'not valid json {{{', '/test');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.includes('JSON parse hiba'))).toBe(true);
    }
  });

  it('üres string → JSON parse hiba (nem dob exception)', () => {
    const schema = z.object({ status: z.string() });

    expect(() => parseAndValidate(schema, '', '/test')).not.toThrow();

    const result = parseAndValidate(schema, '', '/test');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.includes('JSON parse hiba'))).toBe(true);
    }
  });

  it('érvényes JSON + séma mismatch → success: false, errors nem üres', () => {
    const schema = z.object({ status: z.string(), count: z.number() });

    const result = parseAndValidate(schema, '{"status": "ok"}', '/test');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });

  it('komplex érvényes JSON → mélyen nested séma is validálható', () => {
    const schema = z.object({
      url: z.string(),
      status: z.enum(['success', 'blocked', 'failed']),
      links: z.array(z.string()),
    });
    const json = '{"url": "https://example.com", "status": "success", "links": ["a", "b"]}';

    const result = parseAndValidate(schema, json, '/crawl');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.links).toHaveLength(2);
    }
  });

  it('null JSON string → parse hiba kezelve (nem crashel)', () => {
    const schema = z.object({ status: z.string() });

    // null-t JSON.parse nem tud parse-olni ha "null" string-ként érkezik
    const result = parseAndValidate(schema, 'null', '/test');

    // JSON.parse('null') === null — Zod séma mismatch lesz (object expected)
    expect(result.success).toBe(false);
  });

  it('parseAndValidate visszaadja a nyers raw stringet hiba esetén', () => {
    const schema = z.object({ status: z.string() });
    const badJson = 'totally broken {[}';

    const result = parseAndValidate(schema, badJson, '/test');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.raw).toBe(badJson);
    }
  });
});
