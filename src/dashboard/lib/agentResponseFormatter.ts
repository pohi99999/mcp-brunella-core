/**
 * Agent Response Formatter
 * Átalakítja az ügynökök JSON válaszait olvasható magyar nyelvre
 */

interface AgentResponse {
  status?: string;
  data?: any;
  error?: string;
  success?: boolean;
  [key: string]: any;
}

export function formatAgentResponse(response: any, agentName?: string): string {
  if (typeof response === 'string') return response;

  try {
    const data = response as AgentResponse;

    // Hiba formázás
    if (data.status === 'error' || data.error) {
      return `❌ Hiba: ${data.error || 'Ismeretlen hiba történt'}`;
    }

    // Health check formázás (Evaluator)
    if (data.data?.status && data.data?.components) {
      return formatHealthCheck(data.data);
    }

    // Általános success válasz
    if (data.status === 'success' && data.data) {
      return formatSuccessData(data.data, agentName);
    }

    // Delegated válasz (Orchestrator)
    if (data.status === 'delegated') {
      return `🔄 Feladat delegálva → ${data.delegatedTo}${data.reason ? `\n   Indok: ${data.reason}` : ''}`;
    }

    // Ha nincs speciális formázás, próbáljuk emberi nyelvre fordítani
    return formatGenericResponse(data);

  } catch (e) {
    return JSON.stringify(response, null, 2);
  }
}

function formatHealthCheck(healthData: any): string {
  const statusIcon = healthData.status === 'HEALTHY' ? '✅' : '⚠️';
  let result = `${statusIcon} Rendszer állapot: ${translateStatus(healthData.status)}\n\n`;

  if (healthData.components) {
    result += '📊 Komponensek:\n';
    for (const [name, info] of Object.entries(healthData.components as Record<string, any>)) {
      const componentStatus = info.status === 'healthy' ? '🟢' : '🔴';
      const latency = info.latencyMs ? ` (${info.latencyMs}ms)` : '';
      result += `   ${componentStatus} ${name}: ${translateStatus(info.status)}${latency}\n`;
    }
  }

  if (healthData.recommendation) {
    result += `\n💡 Javaslat: ${translateRecommendation(healthData.recommendation)}`;
  }

  return result;
}

function formatSuccessData(data: any, agentName?: string): string {
  if (typeof data === 'string') {
    return `✅ ${data}`;
  }

  if (Array.isArray(data)) {
    return `✅ Sikeresen lekérve (${data.length} elem)\n${data.map((item, i) => `   ${i + 1}. ${JSON.stringify(item)}`).join('\n')}`;
  }

  if (typeof data === 'object' && data !== null) {
    let result = '✅ Művelet sikeres:\n';
    for (const [key, value] of Object.entries(data)) {
      result += `   • ${translateKey(key)}: ${formatValue(value)}\n`;
    }
    return result;
  }

  return `✅ ${data}`;
}

function formatGenericResponse(data: AgentResponse): string {
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

function formatValue(value: any): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? '✓ Igen' : '✗ Nem';
  if (typeof value === 'number') return value.toString();
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return `[${value.length} elem]`;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
