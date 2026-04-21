import { URL } from "url";

export type SkillParams = Record<string, unknown>;

export interface SkillValidationResult {
  valid: boolean;
  error?: string;
}

export type AnthropicMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export interface PageSnapshot {
  url: string;
  status: number;
  title: string;
  description?: string;
  text: string;
  emails: string[];
  links: string[];
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function captureValidationResult(validator: () => void): SkillValidationResult {
  try {
    validator();
    return { valid: true };
  } catch (error: unknown) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function normalizeSkillName(name: string): string {
  return canonicalizeSkillName(name);
}

export function matchesSkillName(candidate: string, input: string): boolean {
  return canonicalizeSkillName(candidate) === canonicalizeSkillName(input);
}

export function requireString(params: SkillParams, key: string, label?: string): string {
  const value = params[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label ?? key} megadása kötelező.`);
  }
  return value.trim();
}

export function optionalString(params: SkillParams, key: string): string | undefined {
  const value = params[key];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function requireNumber(params: SkillParams, key: string, label?: string): number {
  const value = params[key];
  if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) {
    throw new Error(`${label ?? key} megadása kötelező számként.`);
  }
  return value;
}

export function optionalNumber(
  params: SkillParams,
  key: string,
): number | undefined {
  const value = params[key];
  if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) {
    return undefined;
  }
  return value;
}

export function requireBoolean(params: SkillParams, key: string, label?: string): boolean {
  const value = params[key];
  if (typeof value !== "boolean") {
    throw new Error(`${label ?? key} megadása kötelező logikai értékként.`);
  }
  return value;
}

export function optionalBoolean(
  params: SkillParams,
  key: string,
): boolean | undefined {
  const value = params[key];
  if (typeof value !== "boolean") return undefined;
  return value;
}

export function stringArrayParam(params: SkillParams, key: string): string[] {
  const value = params[key];
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string").map((entry) => entry.trim()).filter(Boolean);
}

export function truncateText(text: string, maxLength = 4000): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength - 1).trimEnd()}…`;
}

export function stripHtml(html: string): string {
  const withoutScripts = html.replace(/<script[\s\S]*?<\/script>/gi, " ");
  const withoutStyles = withoutScripts.replace(/<style[\s\S]*?<\/style>/gi, " ");
  const rawText = withoutStyles.replace(/<[^>]+>/g, " ");
  return decodeHtmlEntities(rawText.replace(/\s+/g, " ").trim());
}

export function extractTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return undefined;
  const title = decodeHtmlEntities(match[1].replace(/\s+/g, " ").trim());
  return title.length > 0 ? title : undefined;
}

export function extractMetaDescription(html: string): string | undefined {
  const match = html.match(
    /<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i,
  );
  if (!match) return undefined;
  const description = decodeHtmlEntities(match[1].replace(/\s+/g, " ").trim());
  return description.length > 0 ? description : undefined;
}

export function extractEmails(text: string): string[] {
  const matches = text.match(
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
  );
  if (!matches) return [];
  return [...new Set(matches.map((entry) => entry.trim()))];
}

export function extractLinks(html: string, baseUrl: string, limit = 10): string[] {
  const links = new Set<string>();
  const hrefRegex = /<a[^>]+href=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;

  while ((match = hrefRegex.exec(html)) !== null) {
    const rawHref = match[1].trim();
    if (!rawHref || rawHref.startsWith("#") || rawHref.startsWith("javascript:")) continue;

    try {
      const parsed = new URL(rawHref, baseUrl);
      if (parsed.hostname.includes("duckduckgo.com")) {
        const uddg = parsed.searchParams.get("uddg");
        if (!uddg) continue;
        const decoded = decodeURIComponent(uddg);
        if (decoded.startsWith("http://") || decoded.startsWith("https://")) {
          links.add(decoded);
        }
        continue;
      }

      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        links.add(parsed.toString());
      }
    } catch {
      continue;
    }

    if (links.size >= limit) break;
  }

  return [...links];
}

export async function fetchPageSnapshot(
  url: string,
  timeoutMs = 15000,
): Promise<PageSnapshot> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) BrunellaSkill/1.0",
      },
      signal: controller.signal,
    });

    const html = await response.text();
    const title = extractTitle(html) ?? new URL(response.url || url).hostname;
    const description = extractMetaDescription(html);
    const text = stripHtml(html);
    const emails = extractEmails([title, description ?? "", text].join("\n"));
    const links = extractLinks(html, response.url || url);

    return {
      url: response.url || url,
      status: response.status,
      title,
      description,
      text,
      emails,
      links,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function collectWebSearchUrls(
  query: string,
  limit = 5,
): Promise<string[]> {
  const searchUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const snapshot = await fetchPageSnapshot(searchUrl, 20000);
  return snapshot.links
    .filter((link) => !link.includes("duckduckgo.com"))
    .slice(0, limit);
}

export async function callAnthropicText(
  messages: AnthropicMessage[],
  model = "claude-3-5-sonnet-20241022",
  maxTokens = 2048,
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    throw new Error("Claude/Anthropic API kulcs nincs beállítva.");
  }

  const system = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n")
    .trim();
  const chatMessages = messages.filter(
    (message): message is { role: "user" | "assistant"; content: string } =>
      message.role !== "system",
  );

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      ...(system ? { system } : {}),
      messages: chatMessages,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API error: ${response.status} - ${errorText}`);
  }

  const data = (await response.json()) as {
    content?: Array<{ text?: string }>;
    output?: Array<{ content?: Array<{ text?: string }> }>;
    text?: string;
  };

  return String(
    data.content?.[0]?.text ??
      data.output?.[0]?.content?.[0]?.text ??
      data.text ??
      "",
  );
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function canonicalizeSkillName(value: string): string {
  return value
    .trim()
    .replace(/skill$/i, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

