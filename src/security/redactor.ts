/**
 * Guardrails Phase 3: PII & Secret Redaction
 * Track: guardrails_evaluation_20260323
 *
 * Agent outputokból PII (email, telefon, IP, SSN) és titkok
 * (API kulcsok, token-ek, jelszavak) automatikus eltávolítása.
 *
 * FONTOS: Soft-fail — ha a redakció hibát dob, az eredeti szöveg megy tovább,
 * de logolásra kerül a hiba.
 */
import { logWarn, logInfo } from '../utils/logger.js';

export interface RedactionResult {
  redacted: string;
  findings: RedactionFinding[];
  hadFindings: boolean;
}

export interface RedactionFinding {
  type: string;
  count: number;
  pattern: string;
}

// PII minták
const PII_PATTERNS: Array<{ name: string; pattern: RegExp; replacement: string }> = [
  { name: 'email', pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: '[EMAIL_REDACTED]' },
  { name: 'phone_hu', pattern: /(?:\+36|06)[\s-]?(?:\d{1,2})[\s-]?\d{3}[\s-]?\d{3,4}/g, replacement: '[PHONE_REDACTED]' },
  { name: 'phone_intl', pattern: /\+\d{1,3}[\s-]?\d{2,4}[\s-]?\d{3,4}[\s-]?\d{3,4}/g, replacement: '[PHONE_REDACTED]' },
  { name: 'ipv4', pattern: /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g, replacement: '[IP_REDACTED]' },
  { name: 'credit_card', pattern: /\b(?:\d{4}[\s-]?){3}\d{4}\b/g, replacement: '[CC_REDACTED]' },
  { name: 'hungarian_tax_id', pattern: /\b\d{10}\b/g, replacement: '[TAX_ID_REDACTED]' },
];

// Secret/token minták
const SECRET_PATTERNS: Array<{ name: string; pattern: RegExp; replacement: string }> = [
  { name: 'jwt_token', pattern: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_\-]+/g, replacement: '[JWT_REDACTED]' },
  { name: 'anthropic_key', pattern: /sk-ant-[A-Za-z0-9_\-]{20,}/g, replacement: '[ANTHROPIC_KEY_REDACTED]' },
  { name: 'openai_key', pattern: /sk-[A-Za-z0-9]{20,}/g, replacement: '[OPENAI_KEY_REDACTED]' },
  { name: 'aws_key', pattern: /(?:AKIA|ASIA)[A-Z0-9]{16}/g, replacement: '[AWS_KEY_REDACTED]' },
  { name: 'github_token', pattern: /(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,}/g, replacement: '[GITHUB_TOKEN_REDACTED]' },
  { name: 'bearer_token', pattern: /Bearer\s+[A-Za-z0-9_\-.]+/gi, replacement: 'Bearer [TOKEN_REDACTED]' },
  { name: 'connection_string', pattern: /(?:mongodb|postgres|mysql|redis):\/\/[^\s"']+/gi, replacement: '[CONNECTION_STRING_REDACTED]' },
  { name: 'api_key_generic', pattern: /(?:api[_-]?key|apikey|api[_-]?secret)\s*[:=]\s*['"]?[A-Za-z0-9_\-]{20,}['"]?/gi, replacement: '[API_KEY_REDACTED]' },
  { name: 'password_field', pattern: /(?:password|passwd|pwd)\s*[:=]\s*['"]?[^\s'"]{4,}['"]?/gi, replacement: '[PASSWORD_REDACTED]' },
];

/**
 * Redaktálja a PII-t és titkokat egy szövegből.
 */
export function redactText(text: string): RedactionResult {
  const findings: RedactionFinding[] = [];
  let redacted = text;

  // Titkok először (specifikusabb minták)
  for (const { name, pattern, replacement } of SECRET_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    const matches = redacted.match(regex);
    if (matches && matches.length > 0) {
      findings.push({ type: name, count: matches.length, pattern: name });
      redacted = redacted.replace(regex, replacement);
    }
  }

  // PII minták
  for (const { name, pattern, replacement } of PII_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    const matches = redacted.match(regex);
    if (matches && matches.length > 0) {
      findings.push({ type: name, count: matches.length, pattern: name });
      redacted = redacted.replace(regex, replacement);
    }
  }

  return {
    redacted,
    findings,
    hadFindings: findings.length > 0,
  };
}

/**
 * Deep redakció: egy objektum összes string mezőjében futtatja a redaktort.
 * Rekurzívan bejárja az objektumot.
 */
export function redactObject<T>(obj: T): { redacted: T; allFindings: RedactionFinding[] } {
  const allFindings: RedactionFinding[] = [];

  function walk(value: unknown): unknown {
    if (typeof value === 'string') {
      const result = redactText(value);
      allFindings.push(...result.findings);
      return result.redacted;
    }
    if (Array.isArray(value)) {
      return value.map(walk);
    }
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) {
        out[k] = walk(v);
      }
      return out;
    }
    return value;
  }

  const redacted = walk(obj) as T;
  return { redacted, allFindings };
}

/**
 * Agent output redakció — soft-fail wrapper.
 * Hiba esetén az eredeti data marad, de logolásra kerül.
 */
export function safeRedactAgentOutput<T>(data: T, agentName: string): T {
  try {
    const { redacted, allFindings } = redactObject(data);
    if (allFindings.length > 0) {
      const summary = allFindings.map(f => `${f.type}(${f.count})`).join(', ');
      logWarn('Redactor', `[${agentName}] PII/secret találat redaktálva: ${summary}`);
    }
    return redacted;
  } catch (err) {
    logWarn('Redactor', `[${agentName}] Redakció hiba (soft-fail): ${err instanceof Error ? err.message : String(err)}`);
    return data;
  }
}
