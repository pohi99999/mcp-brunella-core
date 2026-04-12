import { ServerState, LogEntry, ConfigItem, ServerMetrics, AgentTool } from './types'

export function generateMockServerState(): ServerState {
  const statuses = ['running', 'stopped', 'starting'] as const
  const randomStatus = statuses[Math.floor(Math.random() * statuses.length)]
  
  return {
    status: randomStatus,
    uptime: Math.floor(Math.random() * 86400),
    cpuUsage: Math.random() * 100,
    memoryUsage: Math.random() * 100,
    lastUpdated: new Date().toISOString()
  }
}

export function generateMockLogs(count: number = 20): LogEntry[] {
  const levels = ['info', 'warning', 'error', 'debug'] as const
  const messages = [
    'Szerver elindult sikeresen',
    'Új kapcsolat fogadva',
    'Konfiguráció betöltve',
    'Adatbázis kapcsolat létrehozva',
    'API kérés feldolgozva',
    'Memória használat: normál tartomány',
    'Figyelmeztető: magas CPU használat',
    'Hiba: kapcsolat időtúllépés',
    'Debug: változó értéke ellenőrizve',
    'Művelet sikeresen végrehajtva'
  ]
  
  return Array.from({ length: count }, (_, i) => ({
    id: `log-${Date.now()}-${i}`,
    timestamp: new Date(Date.now() - Math.random() * 3600000).toISOString(),
    level: levels[Math.floor(Math.random() * levels.length)],
    message: messages[Math.floor(Math.random() * messages.length)],
    source: Math.random() > 0.5 ? 'core' : 'api'
  })).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
}

export function generateMockConfig(): ConfigItem[] {
  return [
    {
      key: 'server.port',
      value: 3000,
      type: 'number',
      description: 'Szerver port száma',
      category: 'Hálózat'
    },
    {
      key: 'server.host',
      value: 'localhost',
      type: 'string',
      description: 'Szerver host címe',
      category: 'Hálózat'
    },
    {
      key: 'logging.level',
      value: 'info',
      type: 'string',
      description: 'Naplózási szint',
      category: 'Naplózás'
    },
    {
      key: 'logging.enabled',
      value: true,
      type: 'boolean',
      description: 'Naplózás engedélyezése',
      category: 'Naplózás'
    },
    {
      key: 'cache.ttl',
      value: 3600,
      type: 'number',
      description: 'Cache élettartam (másodperc)',
      category: 'Teljesítmény'
    },
    {
      key: 'cache.enabled',
      value: true,
      type: 'boolean',
      description: 'Cache engedélyezése',
      category: 'Teljesítmény'
    }
  ]
}

export function generateMockMetrics(): ServerMetrics {
  return {
    requestsPerMinute: Math.floor(Math.random() * 1000),
    activeConnections: Math.floor(Math.random() * 50),
    errorRate: Math.random() * 5,
    averageResponseTime: Math.floor(Math.random() * 500)
  }
}

export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  
  if (days > 0) {
    return `${days}n ${hours}ó ${minutes}p`
  } else if (hours > 0) {
    return `${hours}ó ${minutes}p ${secs}mp`
  } else if (minutes > 0) {
    return `${minutes}p ${secs}mp`
  } else {
    return `${secs}mp`
  }
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

export function formatTimestamp(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleString('hu-HU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

export function generateMockAgentTools(): AgentTool[] {
  return [
    {
      id: 'tool-1',
      name: 'get_server_status',
      description: 'Lekérdezi a szerver aktuális állapotát, beleértve a CPU és memória használatot',
      enabled: true,
      category: 'monitoring',
      parameters: [],
      createdAt: new Date().toISOString(),
    },
    {
      id: 'tool-2',
      name: 'start_server',
      description: 'Elindítja a szervert',
      enabled: true,
      category: 'server',
      requiresPermission: 'startServer',
      parameters: [],
      createdAt: new Date().toISOString(),
    },
    {
      id: 'tool-3',
      name: 'stop_server',
      description: 'Leállítja a szervert',
      enabled: true,
      category: 'server',
      requiresPermission: 'stopServer',
      parameters: [],
      createdAt: new Date().toISOString(),
    },
    {
      id: 'tool-4',
      name: 'get_logs',
      description: 'Lekérdezi a szerver naplóbejegyzéseit',
      enabled: true,
      category: 'monitoring',
      parameters: [
        {
          name: 'level',
          type: 'string',
          description: 'Napló szint szűrő (info, warning, error, debug)',
          required: false,
        },
        {
          name: 'limit',
          type: 'number',
          description: 'Maximum bejegyzések száma',
          required: false,
          defaultValue: 10,
        },
      ],
      createdAt: new Date().toISOString(),
    },
    {
      id: 'tool-5',
      name: 'update_config',
      description: 'Frissít egy konfigurációs értéket',
      enabled: false,
      category: 'configuration',
      requiresPermission: 'editConfig',
      parameters: [
        {
          name: 'key',
          type: 'string',
          description: 'Konfigurációs kulcs',
          required: true,
        },
        {
          name: 'value',
          type: 'string',
          description: 'Új érték',
          required: true,
        },
      ],
      createdAt: new Date().toISOString(),
    },
    {
      id: 'tool-6',
      name: 'get_metrics',
      description: 'Lekérdezi a szerver teljesítmény metrikáit',
      enabled: true,
      category: 'monitoring',
      parameters: [],
      createdAt: new Date().toISOString(),
    },
    {
      id: 'tool-7',
      name: 'get_weather',
      description: 'Lekérdezi az időjárási adatokat egy adott városra (Példa külső API tool)',
      enabled: false,
      category: 'custom',
      parameters: [
        {
          name: 'city',
          type: 'string',
          description: 'Város neve',
          required: true,
        },
      ],
      externalApi: {
        url: 'https://wttr.in/{{city}}?format=j1',
        method: 'GET',
        authType: 'none',
        timeout: 10000,
        responseMapping: 'current_condition.0',
      },
      createdAt: new Date().toISOString(),
    },
    {
      id: 'tool-8',
      name: 'check_ip_info',
      description: 'IP cím információk lekérdezése (Példa külső API tool)',
      enabled: false,
      category: 'custom',
      parameters: [
        {
          name: 'ip',
          type: 'string',
          description: 'IP cím',
          required: true,
        },
      ],
      externalApi: {
        url: 'https://ipapi.co/{{ip}}/json/',
        method: 'GET',
        authType: 'none',
        timeout: 10000,
      },
      createdAt: new Date().toISOString(),
    },
  ]
}
