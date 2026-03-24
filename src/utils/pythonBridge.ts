/**
 * Python Bridge — Zod sémák a Node.js ↔ Python határ típusbiztonságához.
 *
 * Minden Python API válaszhoz definiál egy Zod sémát, és safeParse-t
 * használ a validációhoz. Silent failure helyett explicit hibajelzés.
 */

import { z } from "zod";

// ── Python /execute válasz ──────────────────────────────────────────
export const ExecuteResultSchema = z.object({
  stdout: z.string(),
  error: z.string().optional(),
});
export type ExecuteResult = z.infer<typeof ExecuteResultSchema>;

// ── Crawl4AI /crawl4ai/crawl válasz ─────────────────────────────────
export const CrawlResultSchema = z.object({
  url: z.string(),
  markdown: z.string().default(""),
  title: z.string().default(""),
  description: z.string().default(""),
  language: z.string().default(""),
  extracted_data: z.unknown().nullable().optional(),
  links: z.array(z.string()).default([]),
  status: z.enum(["success", "blocked", "failed"]),
  error: z.string().nullable().optional(),
});
export type CrawlResult = z.infer<typeof CrawlResultSchema>;

// ── Harvest /harvest válasz ─────────────────────────────────────────
export const HarvestResultSchema = z.object({
  status: z.string(),
  data: z.unknown().optional(),
  error: z.string().optional(),
  steps_completed: z.number().optional(),
});
export type HarvestResult = z.infer<typeof HarvestResultSchema>;

// ── Harvest Extract /harvest/extract válasz ─────────────────────────
export const HarvestExtractResultSchema = z.object({
  status: z.string(),
  extracted: z.unknown().optional(),
  raw_text: z.string().optional(),
  error: z.string().optional(),
});
export type HarvestExtractResult = z.infer<typeof HarvestExtractResultSchema>;

// ── Refine /refine válasz ───────────────────────────────────────────
export const RefineResultSchema = z.object({
  status: z.string(),
  refined: z.unknown().optional(),
  original: z.unknown().optional(),
  error: z.string().optional(),
});
export type RefineResult = z.infer<typeof RefineResultSchema>;

// ── Generic Python error válasz ─────────────────────────────────────
export const PythonErrorSchema = z.object({
  error: z.string(),
});
export type PythonError = z.infer<typeof PythonErrorSchema>;

// ── Validáló segédfüggvények ────────────────────────────────────────

/**
 * Validálja a Python választ egy Zod sémával.
 * Sikertelen validáció esetén a nyers adatot adja vissza
 * warning log-gal, nem dob hibát (graceful degradation).
 */
export function validatePythonResponse<T>(
  schema: z.ZodType<T>,
  data: unknown,
  endpoint: string,
): { success: true; data: T } | { success: false; data: unknown; errors: string[] } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const errors = result.error.issues.map(
    (issue) => `${issue.path.join(".")}: ${issue.message}`,
  );
  return { success: false, data, errors };
}

/**
 * JSON string parse + Zod validáció egylépésben.
 * Ha a JSON parse vagy a séma validáció sikertelen, hibaüzenetet ad.
 */
export function parseAndValidate<T>(
  schema: z.ZodType<T>,
  jsonString: string,
  endpoint: string,
): { success: true; data: T } | { success: false; raw: string; errors: string[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    return { success: false, raw: jsonString, errors: [`JSON parse hiba (${endpoint}): invalid JSON`] };
  }
  const result = schema.safeParse(parsed);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const errors = result.error.issues.map(
    (issue) => `${issue.path.join(".")}: ${issue.message}`,
  );
  return { success: false, raw: jsonString, errors };
}
