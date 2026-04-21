import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export interface PrebuiltToolParameter {
  name: string;
  type: string;
  required: boolean;
}

export interface PrebuiltToolManifest {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  category: string;
  parameters: PrebuiltToolParameter[];
}

export interface ToolLike {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  id?: string;
  version?: string;
  enabled?: boolean;
  category?: string;
  deprecated?: boolean;
  deprecatedMessage?: string;
  tags?: string[];
  parameters?: PrebuiltToolParameter[];
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toStringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function toBooleanValue(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function toParameterType(value: unknown): string {
  if (
    value === "string" ||
    value === "number" ||
    value === "integer" ||
    value === "boolean" ||
    value === "array" ||
    value === "object"
  ) {
    return value;
  }
  return "string";
}

function normalizeParameters(value: unknown): PrebuiltToolParameter[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const params: PrebuiltToolParameter[] = [];
  for (const item of value) {
    if (!isRecord(item)) {
      continue;
    }

    const name = toStringValue(item.name);
    if (!name) {
      continue;
    }

    params.push({
      name,
      type: toParameterType(item.type),
      required: toBooleanValue(item.required, false),
    });
  }

  return params;
}

function normalizeManifest(value: unknown): PrebuiltToolManifest | null {
  if (!isRecord(value)) {
    return null;
  }

  const name = toStringValue(value.name, toStringValue(value.id));
  const id = toStringValue(value.id, name);
  if (!name || !id) {
    return null;
  }

  return {
    id,
    name,
    description: toStringValue(value.description),
    enabled: toBooleanValue(value.enabled, true),
    category: toStringValue(value.category, "custom"),
    parameters: normalizeParameters(value.parameters),
  };
}

function buildInputSchema(parameters: PrebuiltToolParameter[]): Record<string, unknown> {
  const properties: Record<string, { type: string }> = {};
  const required: string[] = [];

  for (const parameter of parameters) {
    properties[parameter.name] = { type: parameter.type };
    if (parameter.required) {
      required.push(parameter.name);
    }
  }

  const schema: Record<string, unknown> = {
    type: "object",
    properties,
    additionalProperties: false,
  };

  if (required.length > 0) {
    schema.required = required;
  }

  return schema;
}

export function loadPrebuiltToolsCatalog(): ToolLike[] {
  const candidates = [
    path.resolve(process.cwd(), "out", "tools.json"),
    path.resolve(__dirname, "..", "..", "out", "tools.json"),
  ];

  const toolsPath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!toolsPath) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(toolsPath, "utf-8"));
    let entries: unknown[] = [];
    if (Array.isArray(parsed)) {
      entries = parsed;
    } else if (isRecord(parsed) && Array.isArray(parsed.tools)) {
      entries = parsed.tools;
    }

    return entries
      .map(normalizeManifest)
      .filter((manifest): manifest is PrebuiltToolManifest => manifest !== null)
      .map((manifest) => ({
        id: manifest.id,
        name: manifest.name,
        description: manifest.description,
        version: "1.0.0",
        enabled: manifest.enabled,
        category: manifest.category,
        tags: [manifest.category],
        parameters: manifest.parameters,
        inputSchema: buildInputSchema(manifest.parameters),
      }));
  } catch {
    return [];
  }
}

export function getPrebuiltToolCatalog(): ToolLike[] {
  return loadPrebuiltToolsCatalog();
}

export function mergeToolLists(primary: ToolLike[], fallback: ToolLike[]): ToolLike[] {
  const merged = new Map<string, ToolLike>();

  for (const tool of primary) {
    const key = tool.id ?? tool.name;
    if (!merged.has(key)) {
      merged.set(key, tool);
    }
  }

  for (const tool of fallback) {
    const key = tool.id ?? tool.name;
    if (!merged.has(key)) {
      merged.set(key, tool);
    }
  }

  return Array.from(merged.values()).sort((left, right) => left.name.localeCompare(right.name));
}

export function hasPrebuiltTool(name: string): boolean {
  return loadPrebuiltToolsCatalog().some((tool) => tool.name === name || tool.id === name);
}
