/**
 * MCP Tool Response Helpers
 *
 * Consistent, structured MCP tool responses for all Brunella tools.
 * Provides:
 *   - Uniform `isError` flag usage
 *   - Automatic `structuredContent` from JSON data (MCP SDK 1.26+)
 *   - Consistent truncation for large payloads
 *   - Typed response shapes
 *
 * Usage:
 *   import { mcpOk, mcpError, mcpTruncate } from "../utils/mcpResponse.js";
 *   return mcpOk({ count: 5, items: [...] });
 *   return mcpError("Not found: resource_id=42");
 */

/** MCP text content block. */
export interface McpTextContent {
  type: "text";
  text: string;
}

/** Full MCP tool response — compatible with server.tool() handler return type.
 *  The index signature `[key: string]: unknown` is required by the SDK's TypeScript types. */
export interface McpToolResponse {
  [key: string]: unknown;           // required by MCP SDK type signature
  content: McpTextContent[];
  structuredContent?: Record<string, unknown>;
  isError?: true;
}

/** Maximum character count before truncation is applied to text responses. */
const DEFAULT_CHAR_LIMIT = 20_000;

/**
 * Truncate a string to `limit` characters, appending a marker when truncated.
 * Does NOT truncate structured data — only the serialised text representation.
 */
export function mcpTruncate(text: string, limit = DEFAULT_CHAR_LIMIT): string {
  return text.length > limit ? `${text.slice(0, limit)}\n…[csonkítva — ${text.length - limit} karakter elhagyva]` : text;
}

/**
 * Build a successful MCP tool response.
 *
 * @param data   The result payload — serialised to JSON for `content` AND returned
 *               as `structuredContent` so clients that support it get typed data.
 * @param text   Optional human-readable override for `content[0].text`.
 *               When omitted the JSON serialisation of `data` is used.
 * @param limit  Optional character limit for text truncation (default 20 000).
 */
export function mcpOk(
  data: Record<string, unknown> | unknown[],
  text?: string,
  limit = DEFAULT_CHAR_LIMIT,
): McpToolResponse {
  const json = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  const responseText = text ?? json;
  return {
    content: [{ type: "text", text: mcpTruncate(responseText, limit) }],
    // structuredContent gives MCP clients direct access to typed data without JSON parsing
    structuredContent: Array.isArray(data) ? { items: data } : (data as Record<string, unknown>),
  };
}

/**
 * Build a plain-text (non-JSON) successful MCP tool response.
 * Use this for human-readable output that is not a JSON object.
 */
export function mcpText(text: string, limit = DEFAULT_CHAR_LIMIT): McpToolResponse {
  return {
    content: [{ type: "text", text: mcpTruncate(text, limit) }],
  };
}

/**
 * Build a failed MCP tool response with `isError: true`.
 *
 * @param message  A clear, actionable error description.
 *                 Include context: what failed, why, and what the caller can do.
 * @param details  Optional extra details object serialised as JSON.
 */
export function mcpError(
  message: string,
  details?: Record<string, unknown>,
): McpToolResponse {
  const detailText = details ? `\n\nRészletek:\n${JSON.stringify(details, null, 2)}` : "";
  return {
    isError: true,
    content: [{ type: "text", text: `❌ Hiba: ${message}${detailText}` }],
  };
}

/**
 * Convenience: catch-block helper that normalises unknown errors.
 *
 * @example
 *   } catch (e: unknown) {
 *     return mcpCatch(e, "task_queue_list");
 *   }
 */
export function mcpCatch(
  e: unknown,
  toolName?: string,
  extraDetails?: Record<string, unknown>,
): McpToolResponse {
  const message = e instanceof Error ? e.message : String(e);
  const prefix = toolName ? `[${toolName}] ` : "";
  return mcpError(`${prefix}${message}`, extraDetails);
}
