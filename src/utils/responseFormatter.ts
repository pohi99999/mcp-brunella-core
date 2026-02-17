/**
 * Response Formatter - Magyar nyelvű, emberi olvasható válaszok
 *
 * Minden ügynök válaszát természetes magyar nyelvű szöveggé alakítja
 * JSON/kód formátum helyett.
 *
 * @version 1.0.0
 * @created 2026-02-16
 */

import type { AgentResponse } from '../agents/types.js';
import type { AgentResult } from '../agents/BaseAgent.js';

/**
 * Formázási opciók
 */
export interface FormatterOptions {
  /** Emoji használat (alapértelmezett: true) */
  useEmojis?: boolean;
  /** Részletes mód (több technikai info) */
  verbose?: boolean;
  /** Nyelv (jelenleg csak 'hu') */
  language?: 'hu';
}

/**
 * Sikeres műveletet formáz magyar nyelvre
 */
function formatSuccess(
  message: string,
  data?: unknown,
  options: FormatterOptions = {}
): string {
  const { useEmojis = true, verbose = false } = options;
  const emoji = useEmojis ? '✅ ' : '';

  let response = `${emoji}**Sikeresen végrehajtva!**\n\n${message}`;

  // Ha van adat és verbose mód, akkor hozzáadunk részleteket
  if (verbose && data) {
    response += '\n\n**Részletek:**\n';
    if (typeof data === 'object' && data !== null) {
      response += formatDataObject(data);
    } else {
      response += `${data}`;
    }
  }

  return response;
}

/**
 * Hibás műveletet formáz magyar nyelvre
 */
function formatError(
  error: string,
  options: FormatterOptions = {}
): string {
  const { useEmojis = true } = options;
  const emoji = useEmojis ? '❌ ' : '';

  return `${emoji}**Nem sikerült a művelet**\n\n${error}\n\nKérlek, próbáld újra vagy adj más utasítást!`;
}

/**
 * Delegált műveletet formáz magyar nyelvre
 */
function formatDelegated(
  targetAgent: string,
  message?: string,
  options: FormatterOptions = {}
): string {
  const { useEmojis = true } = options;
  const emoji = useEmojis ? '🔄 ' : '';

  const msg = message || `Átadom a feladatot a **${targetAgent}** ügynöknek`;
  return `${emoji}${msg}`;
}

/**
 * Handoff műveletet formáz magyar nyelvre
 */
function formatHandoff(
  targetAgent: string,
  reason: string,
  options: FormatterOptions = {}
): string {
  const { useEmojis = true } = options;
  const emoji = useEmojis ? '🤝 ' : '';

  return `${emoji}**Feladatátadás:** ${targetAgent}\n\n**Indok:** ${reason}`;
}

/**
 * Data objektumot formáz olvasható formára
 */
function formatDataObject(data: unknown): string {
  if (!data || typeof data !== 'object') {
    return String(data);
  }

  const lines: string[] = [];

  for (const [key, value] of Object.entries(data)) {
    // Kihagyjuk a belső technikai mezőket
    if (key.startsWith('_') || key === 'thoughts' || key === 'contextUsed') {
      continue;
    }

    const formattedKey = formatKey(key);

    if (Array.isArray(value)) {
      lines.push(`- **${formattedKey}:** ${value.length} elem`);
      if (value.length > 0 && value.length <= 5) {
        value.forEach((item, idx) => {
          lines.push(`  ${idx + 1}. ${formatValue(item)}`);
        });
      }
    } else if (typeof value === 'object' && value !== null) {
      lines.push(`- **${formattedKey}:**`);
      const nested = formatDataObject(value);
      lines.push(nested.split('\n').map(line => `  ${line}`).join('\n'));
    } else {
      lines.push(`- **${formattedKey}:** ${formatValue(value)}`);
    }
  }

  return lines.join('\n');
}

/**
 * Kulcs nevét formázza magyar olvasható formára
 */
function formatKey(key: string): string {
  // CamelCase -> Szóköz + Nagybetű
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

/**
 * Értéket formáz olvasható formára
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '-';
  }
  if (typeof value === 'boolean') {
    return value ? 'Igen' : 'Nem';
  }
  if (typeof value === 'number') {
    return value.toLocaleString('hu-HU');
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
}

/**
 * AgentResponse-t formáz magyar nyelvű szöveggé
 */
export function formatAgentResponse(
  response: AgentResponse,
  agentName?: string,
  options: FormatterOptions = {}
): string {
  const { useEmojis = true } = options;

  // Agent név prefix (ha van)
  const prefix = agentName && useEmojis ? `🤖 **${agentName}:**\n\n` : '';

  switch (response.status) {
    case 'success': {
      const successMsg = response.message || 'A művelet sikeres volt';
      return prefix + formatSuccess(successMsg, response.data, options);
    }

    case 'error': {
      const errorMsg = response.error || 'Ismeretlen hiba történt';
      return prefix + formatError(errorMsg, options);
    }

    case 'delegated': {
      const targetAgent = response.delegatedTo || 'másik ügynök';
      return prefix + formatDelegated(targetAgent, response.message, options);
    }

    case 'handoff':
      if (response.handoff) {
        return prefix + formatHandoff(
          response.handoff.targetAgent,
          response.handoff.reason,
          options
        );
      }
      return prefix + formatDelegated(response.delegatedTo || 'másik ügynök', response.message, options);

    default:
      return prefix + (response.message || JSON.stringify(response));
  }
}

/**
 * BaseAgent AgentResult-ot formáz magyar nyelvű szöveggé
 */
export function formatAgentResult(
  result: AgentResult,
  agentName?: string,
  options: FormatterOptions = {}
): string {
  const { useEmojis = true } = options;

  // Agent név prefix (ha van)
  const prefix = agentName && useEmojis ? `🤖 **${agentName}:**\n\n` : '';

  if (result.success) {
    return prefix + formatSuccess(result.message, result.data, options);
  } else {
    return prefix + formatError(result.message, options);
  }
}

/**
 * Automatikus formázás - bármilyen válasz típust kezel
 */
export function formatResponse(
  response: AgentResponse | AgentResult | unknown,
  agentName?: string,
  options: FormatterOptions = {}
): string {
  // Ha már string, visszaadjuk
  if (typeof response === 'string') {
    return response;
  }

  // Ha AgentResponse
  if (response && typeof response === 'object' && 'status' in response) {
    return formatAgentResponse(response as AgentResponse, agentName, options);
  }

  // Ha BaseAgent AgentResult (success + message)
  if (response && typeof response === 'object' && 'success' in response && 'message' in response) {
    return formatAgentResult(response as AgentResult, agentName, options);
  }

  // Fallback: JSON stringify
  const prefix = agentName ? `🤖 **${agentName}:**\n\n` : '';
  return prefix + JSON.stringify(response, null, 2);
}

/**
 * Speciális formázók különböző ügynök típusokhoz
 */
export const specialFormatters = {
  /**
   * Robotkéz V2 válasz formázás
   */
  robotkez(result: AgentResult, options: FormatterOptions = {}): string {
    const { useEmojis = true } = options;
    const emoji = useEmojis ? '🤖 ' : '';

    if (!result.success) {
      return formatError(result.message, options);
    }

    const data = result.data as any;
    let response = `${emoji}**Robotkéz V2 - Végrehajtva**\n\n`;

    // Plan steps
    if (data?.plan && Array.isArray(data.plan)) {
      response += `**Végrehajtott lépések:**\n`;
      data.plan.forEach((step: any, idx: number) => {
        const status = step.status === 'completed' ? '✅' : step.status === 'error' ? '❌' : '⏳';
        response += `${idx + 1}. ${status} ${step.description}\n`;
      });
      response += '\n';
    }

    response += result.message;

    // Completed steps summary
    if (data?.completedSteps && Array.isArray(data.completedSteps)) {
      const successful = data.completedSteps.filter((s: any) => s.status === 'completed').length;
      response += `\n\n**Összesítés:** ${successful}/${data.completedSteps.length} lépés sikeres`;
    }

    return response;
  },

  /**
   * Developer Agent válasz formázás
   */
  developer(result: AgentResult, options: FormatterOptions = {}): string {
    const { useEmojis = true } = options;
    const emoji = useEmojis ? '👨‍💻 ' : '';

    if (!result.success) {
      return formatError(result.message, options);
    }

    const data = result.data as any;
    let response = `${emoji}**Developer Agent - Kód írva**\n\n`;

    response += result.message;

    if (data?.filesModified) {
      response += `\n\n**Módosított fájlok:** ${data.filesModified}`;
    }

    if (data?.linesAdded || data?.linesRemoved) {
      response += `\n**Változtatások:** +${data.linesAdded || 0} / -${data.linesRemoved || 0} sor`;
    }

    return response;
  },

  /**
   * Researcher Agent válasz formázás
   */
  researcher(result: AgentResult, options: FormatterOptions = {}): string {
    const { useEmojis = true } = options;
    const emoji = useEmojis ? '🔍 ' : '';

    if (!result.success) {
      return formatError(result.message, options);
    }

    const data = result.data as any;
    let response = `${emoji}**Researcher Agent - Kutatás kész**\n\n`;

    response += result.message;

    if (data?.sources && Array.isArray(data.sources)) {
      response += `\n\n**Források (${data.sources.length}):**\n`;
      data.sources.slice(0, 5).forEach((source: any, idx: number) => {
        response += `${idx + 1}. ${source.title || source.url || source}\n`;
      });
    }

    return response;
  }
};

/**
 * Default export - egyszerű használat
 */
export default {
  format: formatResponse,
  formatAgentResponse,
  formatAgentResult,
  specialFormatters
};
