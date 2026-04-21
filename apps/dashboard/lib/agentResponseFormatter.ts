/**
 * Agent Response Formatter
 * Átalakítja az ügynökök JSON válaszait olvasható magyar nyelvre
 */

interface AgentResponse {
  status?: string;
  data?: unknown;
  error?: string;
  success?: boolean;
  delegatedTo?: string;
  reason?: string;
  [key: string]: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function formatAgentResponse(response: unknown, agentName?: string): string {
  if (typeof response === 'string') return response;
  if (!isRecord(response)) return JSON.stringify(response, null, 2);

  try {
    const data = response;
    const status = typeof data.status === 'string' ? data.status : undefined;
    const error = typeof data.error === 'string' ? data.error : undefined;
    const payload = data.data;

    // Hiba formázás
    if (status === 'error' || error) {
      return `❌ Hiba: ${error || 'Ismeretlen hiba történt'}`;
    }

    // Health check formázás (Evaluator)
    if (isRecord(payload) && 'status' in payload && 'components' in payload) {
      return formatHealthCheck(payload);
    }

    // Általános success válasz
    if (status === 'success' && payload) {
      return formatSuccessData(payload, agentName);
    }

    // Delegated válasz (Orchestrator)
    if (status === 'delegated') {
      const delegatedTo = typeof data.delegatedTo === 'string' ? data.delegatedTo : 'ismeretlen ügynök';
      const reason = typeof data.reason === 'string' ? data.reason : '';
      return `🔄 Feladat delegálva → ${delegatedTo}${reason ? `\n   Indok: ${reason}` : ''}`;
    }

    // Ha nincs speciális formázás, próbáljuk emberi nyelvre fordítani
    return formatGenericResponse(data);

  } catch (e) {
    return JSON.stringify(response, null, 2);
  }
}

function formatHealthCheck(healthData: Record<string, unknown>): string {
  const status = typeof healthData.status === 'string' ? healthData.status : '';
  const statusIcon = status === 'HEALTHY' ? '✅' : '⚠️';
  let result = `${statusIcon} Rendszer állapot: ${translateStatus(status)}\n\n`;

  if (isRecord(healthData.components)) {
    result += '📊 Komponensek:\n';
    for (const [name, info] of Object.entries(healthData.components)) {
      const component = isRecord(info) ? info : {};
      const componentStatus = typeof component.status === 'string' && component.status === 'healthy' ? '🟢' : '🔴';
      const latency = component.latencyMs !== undefined && component.latencyMs !== null
        ? ` (${formatValue(component.latencyMs)}ms)`
        : '';
      const componentState = typeof component.status === 'string' ? component.status : '';
      result += `   ${componentStatus} ${name}: ${translateStatus(componentState)}${latency}\n`;
    }
  }

  if (typeof healthData.recommendation === 'string' && healthData.recommendation) {
    result += `\n💡 Javaslat: ${translateRecommendation(healthData.recommendation)}`;
  }

  return result;
}

function formatSuccessData(data: unknown, agentName?: string): string {
  if (typeof data === 'string') {
    return `✅ ${data}`;
  }

  if (Array.isArray(data)) {
    return `✅ Sikeresen lekérve (${data.length} elem)\n${data.map((item, i) => `   ${i + 1}. ${JSON.stringify(item)}`).join('\n')}`;
  }

  if (isRecord(data)) {
    let result = '✅ Művelet sikeres:\n';
    for (const [key, value] of Object.entries(data)) {
      result += `   • ${translateKey(key)}: ${formatValue(value)}\n`;
    }
    return result;
  }

  return `✅ ${data}`;
}

function formatGenericResponse(data: Record<string, unknown>): string {
  let result = '';

  if (data.success === true) {
    result += '✅ Művelet sikeres\n';
  } else if (data.success === false) {
    result += '❌ Művelet sikertelen\n';
  }

  const excludeKeys = ['status', 'success', 'data'];
  const entries = Object.entries(data).filter(([key]) => !excludeKeys.includes(key));

  if (entries.length > 0) {
    for (const [key, value] of entries) {
      result += `   • ${translateKey(key)}: ${formatValue(value)}\n`;
    }
  }

  return result || JSON.stringify(data, null, 2);
}

function translateStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'HEALTHY': 'Egészséges',
    'healthy': 'működik',
    'DEGRADED': 'Korlátozott',
    'UNHEALTHY': 'Hibás',
    'idle': 'tétlen',
    'working': 'dolgozik',
    'error': 'hiba',
    'success': 'sikeres',
    'failure': 'sikertelen'
  };
  return statusMap[status] || status;
}

function translateRecommendation(text: string): string {
  const translations: Record<string, string> = {
    'System is nominal.': 'A rendszer normálisan működik.',
    'All systems operational.': 'Minden rendszer működőképes.',
    'Check logs for details.': 'Ellenőrizd a naplókat a részletekért.'
  };
  return translations[text] || text;
}

function translateKey(key: string): string {
  const keyMap: Record<string, string> = {
    'message': 'üzenet',
    'result': 'eredmény',
    'output': 'kimenet',
    'code': 'kód',
    'description': 'leírás',
    'timestamp': 'időbélyeg',
    'duration': 'időtartam',
    'delegatedTo': 'delegálva',
    'reason': 'indok',
    'taskId': 'feladat azonosító',
    'agentName': 'ügynök neve',
    'status': 'állapot',
    'components': 'komponensek',
    'latencyMs': 'késleltetés (ms)',
    'recommendation': 'javaslat'
  };
  return keyMap[key] || key;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? '✓ Igen' : '✗ Nem';
  if (typeof value === 'number') return value.toString();
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return `[${value.length} elem]`;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
