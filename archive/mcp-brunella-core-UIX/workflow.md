# MCP Brunella Core - Munkafolyamat és Rendszerarchitektúra

## Áttekintés

Az MCP Brunella Core egy intelligens szerver irányítópult, amely AI-alapú vezérlést és monitoring funkciókat biztosít. A rendszer lokális Ollama környezetben futtatott LlamaIndex-szel kommunikál, és Agent Tool alapú műveletvégrehajtást tesz lehetővé.

## Architektúra

### Fő Komponensek

```
┌─────────────────────────────────────────────────────────────┐
│                  MCP Brunella Core Dashboard                 │
│                     (React Frontend)                         │
└──────────────────────┬──────────────────────────────────────┘
                       │
       ┌───────────────┼───────────────┐
       │               │               │
       ▼               ▼               ▼
┌─────────────┐ ┌────────────┐ ┌──────────────┐
│   Auth      │ │  Server    │ │   AI Agent   │
│   System    │ │  Monitor   │ │   System     │
└─────────────┘ └────────────┘ └──────┬───────┘
                                       │
                                       ▼
                              ┌────────────────┐
                              │ Ollama/Llama   │
                              │  Local Runtime │
                              └────────────────┘
```

### Adatfolyam és Perzisztencia

Az alkalmazás teljes mértékben az **useKV** React hook-ot használja az adatok perzisztálására:

- **Felhasználói session**: `auth-user`
- **Szerver állapot**: `server-state`
- **Naplóbejegyzések**: `server-logs`
- **Konfiguráció**: `server-config`
- **Agent Tools**: `agent-tools`
- **Chat előzmények**: `chat-messages`

## Munkafolyamatok

### 1. Felhasználói Hitelesítés

```
Felhasználó → Bejelentkezési Oldal → Hitelesítés
                                          │
                     ┌────────────────────┼────────────────────┐
                     │                    │                    │
                 Siker                Hiba               Demo Fiók
                     │                    │                    │
                     ▼                    ▼                    ▼
           Dashboard Betöltés    Hibaüzenet          Gyors Bejelentkezés
                     │              Megjelenik         (Admin/Operator/Viewer)
                     ▼
           Jogosultságok Betöltése
           (Admin/Operator/Viewer)
```

**Szerepkörök és jogosultságok:**

| Művelet | Admin | Operator | Viewer |
|---------|-------|----------|--------|
| Szerver indítás/leállítás | ✓ | ✓ | ✗ |
| Szerver újraindítás | ✓ | ✓ | ✗ |
| Naplók megtekintése | ✓ | ✓ | ✓ |
| Naplók törlése | ✓ | ✗ | ✗ |
| Konfiguráció megtekintése | ✓ | ✓ | ✓ |
| Konfiguráció szerkesztése | ✓ | ✗ | ✗ |
| Agent Tools konfigurálás | ✓ | ✗ | ✗ |
| AI Chat használat | ✓ | ✓ | ✓ |

### 2. Szerver Életciklus Kezelés

```
┌──────────────┐
│   STOPPED    │
└──────┬───────┘
       │ start_server
       ▼
┌──────────────┐
│   STARTING   │ (átmeneti állapot, ~2s)
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   RUNNING    │ ◄─────┐
└──────┬───────┘       │
       │ stop/restart  │ restart_server
       ▼               │
┌──────────────┐       │
│   STOPPING   │───────┘
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   STOPPED    │
└──────────────┘
```

**Szerver Állapot Monitoring:**

- **Folyamatos frissítés**: 5 másodpercenként
- **Metrikák**: CPU használat, Memória használat, Uptime
- **Automatikus naplózás**: Állapotváltozások automatikusan naplózódnak
- **Valós idejű értesítések**: Toast üzenetek minden állapotváltozáskor

### 3. AI Chat és Agent Tool Workflow

```
Felhasználó Üzenet
       │
       ▼
┌──────────────────┐
│ Ollama Kapcsolat │
│   Ellenőrzés     │
└────────┬─────────┘
         │
    ┌────┴────┐
    │         │
  OK        HIBA
    │         │
    │         ▼
    │   Hibaüzenet
    │   (Ollama offline)
    │
    ▼
┌──────────────────┐
│  Üzenet Küldés   │
│   Ollama API-ra  │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ AI Válasz Stream │
│   (chunk-by-chunk)│
└────────┬─────────┘
         │
    ┌────┴────────────────┐
    │                     │
Normál Válasz      Tool Hívás Detektálva
    │                     │
    ▼                     ▼
Megjelenítés      ┌──────────────────┐
                  │ Tool Végrehajtás │
                  │ Jogosultság Check│
                  └────────┬─────────┘
                           │
                      ┌────┴────┐
                      │         │
                   SIKER      HIBA
                      │         │
                      ▼         ▼
               Eredmény    Hibaüzenet
               Visszaadás   AI-nak
                      │         │
                      └────┬────┘
                           │
                           ▼
                    Válasz Folytatása
```

**Agent Tool Végrehajtási Logika:**

1. **Tool Felismerés**: AI válasz parseolása `[TOOL:toolName]({"param": "value"})` formátumra
2. **Jogosultság Ellenőrzés**: Tool `requiresPermission` mező alapján
3. **Paraméter Validáció**: Kötelező paraméterek ellenőrzése
4. **Végrehajtás**: Megfelelő handler függvény hívása
5. **Naplózás**: Tool hívás és eredmény automatikus naplózása
6. **Eredmény Visszaadás**: AI továbbfejleszti válaszát az eredmény alapján

### 4. Chat Előzmények Kezelése

```
┌─────────────────┐
│ Chat Előzmények │
│   Perzisztálva  │
└────────┬────────┘
         │
         ▼
┌────────────────────────────────┐
│    Szűrési Lehetőségek:        │
│  ┌──────────────────────────┐  │
│  │ 1. Keresés (szöveg)      │  │
│  │ 2. Dátumtartomány szűrés │  │
│  │ 3. Kombinált szűrés      │  │
│  └──────────────────────────┘  │
└────────┬───────────────────────┘
         │
         ▼
┌────────────────────┐
│ Szűrt Eredmények   │
│ Valós időben       │
└────────┬───────────┘
         │
         ▼
┌────────────────────────────────┐
│    Export Lehetőségek:         │
│  ┌──────────────────────────┐  │
│  │ 1. JSON formátum         │  │
│  │ 2. TXT formátum          │  │
│  │ 3. Szűrt eredmények      │  │
│  │ 4. Teljes előzmények     │  │
│  └──────────────────────────┘  │
└────────────────────────────────┘
```

**Keresési és Szűrési Funkciók:**

- **Valós idejű keresés**: Szöveg keresése az üzenetekben és szerepkörökben
- **Dátumtartomány szűrés**: 
  - Kezdő dátum (from)
  - Záró dátum (to)
  - Kombinált tartomány
- **Aktív szűrők megjelenítése**: Badge-ek az aktív szűrőkről
- **Gyors törlés**: Egyetlen kattintással törölhetők a szűrők
- **Találatok számlálása**: "X / Y üzenet" formátumban

### 5. Agent Tools Konfigurálás

```
Admin Bejelentkezés
         │
         ▼
┌──────────────────┐
│ Agent Tools Tab  │
└────────┬─────────┘
         │
    ┌────┴────────────┐
    │                 │
Meglévő Tools    Új Tool Hozzáadás
    │                 │
    ▼                 ▼
┌──────────────┐  ┌──────────────┐
│ Enable/      │  │ Tool Form    │
│ Disable      │  │ - Név        │
│ Toggle       │  │ - Leírás     │
└──────┬───────┘  │ - Kategória  │
       │          │ - Paraméterek│
       │          └──────┬───────┘
       │                 │
       │                 ▼
       │          ┌──────────────┐
       │          │ Perzisztálás │
       │          │ (useKV)      │
       │          └──────┬───────┘
       │                 │
       └─────────┬───────┘
                 │
                 ▼
         ┌────────────────┐
         │ AI Chat Update │
         │ Tool-ok újra-  │
         │ betöltése      │
         └────────────────┘
```

**Tool Kategóriák:**

- **Server**: Szerver vezérlési műveletek (start, stop, restart)
- **Monitoring**: Monitoring és állapotlekérdezések (status, logs, metrics)
- **Configuration**: Konfigurációs műveletek (config update)
- **Custom**: Egyéni, felhasználó által definiált tool-ok

### 6. Konfiguráció Kezelés

```
┌──────────────────┐
│ Konfiguráció     │
│ Tárolás (useKV)  │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────┐
│ Kategóriák szerint           │
│ csoportosítva:               │
│ - Hálózat                    │
│ - Naplózás                   │
│ - Teljesítmény               │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ Jogosultság Ellenőrzés       │
│ (csak Admin szerkeszthet)    │
└────────┬─────────────────────┘
         │
    ┌────┴────┐
    │         │
  Admin    Más Szerepkör
    │         │
    ▼         ▼
 Edit Mode  Read-Only Mode
    │
    ▼
┌──────────────────┐
│ Validáció        │
│ - Típus check    │
│ - Érték check    │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Mentés           │
│ Toast Visszajelzés│
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Napló Bejegyzés  │
│ "Konfig frissült"│
└──────────────────┘
```

### 7. Naplózási Rendszer

```
┌────────────────────────────────────┐
│        Napló Források:             │
│  ┌──────────────────────────────┐  │
│  │ 1. Szerver Események         │  │
│  │ 2. Felhasználói Műveletek    │  │
│  │ 3. Agent Tool Végrehajtások  │  │
│  │ 4. Konfiguráció Változások   │  │
│  │ 5. Rendszer Monitoring       │  │
│  └──────────────────────────────┘  │
└────────────┬───────────────────────┘
             │
             ▼
    ┌────────────────┐
    │  Napló Bejegyzés│
    │  Létrehozás     │
    │  - Timestamp    │
    │  - Level        │
    │  - Message      │
    │  - Source       │
    └────────┬────────┘
             │
             ▼
    ┌────────────────┐
    │ Perzisztálás   │
    │ (useKV)        │
    │ Max 100 entry  │
    └────────┬────────┘
             │
             ▼
    ┌────────────────────────┐
    │ Log Viewer             │
    │ - Szűrés level szerint │
    │ - Auto-scroll          │
    │ - Színkódolás          │
    │ - Törlés (Admin)       │
    └────────────────────────┘
```

**Napló Szintek és Színkódolás:**

- **INFO** (kék): Normál információs üzenetek
- **WARNING** (sárga): Figyelmeztető üzenetek
- **ERROR** (piros): Hibaüzenetek
- **DEBUG** (szürke): Debug információk

### 8. Valós Idejű Monitoring

```
┌──────────────────┐
│ Monitoring Timer │
│ (5 sec interval) │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────┐
│ Szerver Állapot Frissítés    │
│ - Uptime növelés             │
│ - CPU/Memory random update   │
│ - lastUpdated timestamp      │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ Metrikák Generálás           │
│ - Requests/min               │
│ - Active connections         │
│ - Error rate                 │
│ - Avg response time          │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ Random Log Generation        │
│ (30% valószínűség)           │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ UI Frissítés                 │
│ - StatusCard                 │
│ - MetricsCard                │
│ - LogViewer                  │
└──────────────────────────────┘
```

## Integráció - Ollama és LlamaIndex

### Ollama Connection Flow

```
┌──────────────────┐
│ Dashboard Init   │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Ollama Status    │
│ Check            │
│ (API: /api/tags) │
└────────┬─────────┘
         │
    ┌────┴────┐
    │         │
  OK        FAIL
    │         │
    ▼         ▼
┌────────┐  ┌──────────────┐
│Connected│ │ Disconnected │
│Status  │  │ Alert        │
│Badge   │  │ Displayed    │
└────────┘  └──────────────┘
         │
         ▼
┌──────────────────┐
│ Model Detection  │
│ llama3.2 vagy    │
│ első elérhető    │
└──────────────────┘
```

### Chat Request Flow

```
Felhasználó Üzenet
         │
         ▼
┌──────────────────────────────┐
│ System Prompt Építés         │
│ - Alapvető instrukciók       │
│ - Engedélyezett Tool-ok      │
│ - Tool paraméterek           │
│ - Tool formátum leírás       │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ Ollama API Request           │
│ POST /api/chat               │
│ - model: llama3.2            │
│ - messages: history          │
│ - stream: true               │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ Stream Processing            │
│ - Chunk-by-chunk olvasás     │
│ - JSON parsing               │
│ - Tool detection             │
└────────┬─────────────────────┘
         │
    ┌────┴────────────┐
    │                 │
Normál Text    Tool Pattern Match
    │                 │
    │                 ▼
    │          ┌──────────────┐
    │          │ Tool Execute │
    │          └──────┬───────┘
    │                 │
    └─────────┬───────┘
              │
              ▼
        ┌──────────┐
        │ UI Update│
        │ (stream) │
        └──────────┘
```

## Adatmodell

### Perzisztált Adatok Struktúra

```typescript
// useKV keys és típusok

'auth-user': User | null
{
  id: string
  username: string
  role: 'admin' | 'operator' | 'viewer'
  displayName: string
  email?: string
  avatarUrl?: string
  createdAt: string
  lastLogin?: string
}

'server-state': ServerState
{
  status: 'running' | 'stopped' | 'starting' | 'stopping' | 'error'
  uptime: number (seconds)
  cpuUsage: number (percentage)
  memoryUsage: number (percentage)
  lastUpdated: string (ISO timestamp)
}

'server-logs': LogEntry[]
{
  id: string
  timestamp: string (ISO)
  level: 'info' | 'warning' | 'error' | 'debug'
  message: string
  source?: string
}

'server-config': ConfigItem[]
{
  key: string
  value: string | number | boolean
  type: 'string' | 'number' | 'boolean'
  description: string
  category: string
}

'agent-tools': AgentTool[]
{
  id: string
  name: string
  description: string
  enabled: boolean
  parameters: AgentToolParameter[]
  category: 'server' | 'monitoring' | 'configuration' | 'custom'
  requiresPermission?: keyof Permission
  createdAt: string
  updatedAt?: string
}

'chat-messages': ChatMessage[]
{
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string (ISO)
  toolCalls?: ToolCall[]
  isStreaming?: boolean
}
```

## Hibaelhárítás és Kivételkezelés

### Ollama Kapcsolati Hibák

```
Ollama Request
       │
       ▼
┌──────────────┐
│ Network Call │
└──────┬───────┘
       │
  ┌────┴────┐
  │         │
SUCCESS   FAIL
  │         │
  │         ▼
  │    ┌─────────────────┐
  │    │ Error Catch     │
  │    │ - Network error │
  │    │ - Timeout       │
  │    │ - 404/500       │
  │    └────────┬────────┘
  │             │
  │             ▼
  │    ┌─────────────────┐
  │    │ isConnected:    │
  │    │ false           │
  │    │ model: null     │
  │    └────────┬────────┘
  │             │
  │             ▼
  │    ┌─────────────────┐
  │    │ Alert Display   │
  │    │ "Ollama offline"│
  │    │ + Instructions  │
  │    └─────────────────┘
  │
  ▼
┌─────────────────┐
│ Normal Operation│
└─────────────────┘
```

### Agent Tool Végrehajtási Hibák

```
Tool Execution Request
         │
         ▼
┌──────────────────┐
│ Tool Validation  │
└────────┬─────────┘
         │
    ┌────┴────────────────────┐
    │                         │
Valid                     Invalid
    │                         │
    ▼                         ▼
┌─────────┐            ┌────────────┐
│Permission│           │ Error:     │
│ Check   │            │ "Tool not  │
└────┬────┘            │  found"    │
     │                 └────────────┘
┌────┴────┐
│         │
OK      DENY
│         │
│         ▼
│    ┌────────────┐
│    │ Error:     │
│    │ "No        │
│    │  permission"│
│    └────────────┘
│
▼
┌──────────────┐
│ Execute      │
└──────┬───────┘
       │
  ┌────┴────┐
  │         │
SUCCESS   ERROR
  │         │
  ▼         ▼
Result   Error Log
Return   + Toast
```

## Teljesítmény Optimalizáció

### useKV Hook Használat - KRITIKUS!

```typescript
// ❌ ROSSZ - State closure bug, adatvesztés!
const [todos, setTodos] = useKV('todos', [])
setTodos([...todos, newTodo])  // todos lehet elavult!

// ✅ JÓ - Functional update, mindig friss érték
const [todos, setTodos] = useKV('todos', [])
setTodos(current => [...current, newTodo])
```

### React Re-render Optimalizáció

- **useMemo**: Szűrt üzenetek kalkulációjához (chat)
- **useCallback**: Event handler funkciókhoz
- **useRef**: Scroll container referenciához
- **React.memo**: Komponens memorizáláshoz (ha szükséges)

### Monitoring Timer Kezelés

```typescript
useEffect(() => {
  if (!currentUser) return  // Ne fusson bejelentkezés nélkül
  
  const interval = setInterval(() => {
    // Frissítések...
  }, 5000)
  
  return () => clearInterval(interval)  // Cleanup!
}, [currentUser])
```

## Biztonság

### Jogosultság Ellenőrzés Több Szinten

1. **UI Szint**: Gombok disabled állapota, tooltip magyarázat
2. **Action Szint**: Funkciók elején jogosultság check
3. **Tool Végrehajtás**: requiresPermission mező ellenőrzése

```typescript
// Példa: Multi-layer permission check
const canEdit = canPerformAction(user, 'editConfig')

// UI layer
<Button disabled={!canEdit}>Szerkesztés</Button>

// Action layer
const handleSave = () => {
  if (!canEdit) {
    toast.error('Nincs jogosultság')
    return
  }
  // ... mentés
}
```

### Érzékeny Műveletek Védelme

- Szerver vezérlés: Admin vagy Operator
- Konfiguráció szerkesztés: Csak Admin
- Naplók törlése: Csak Admin
- Agent Tools konfig: Csak Admin

## Jövőbeli Bővítési Lehetőségek

1. **Valós Backend Integráció**: Mock adatok helyett valós API
2. **WebSocket Support**: Valós idejű push notification szerverről
3. **Multi-szerver Support**: Több szerver kezelése egyidejűleg
4. **Részletesebb Metrikák**: Grafikonok, történeti adatok
5. **Custom Dashboard Widgets**: Drag & drop widget rendszer
6. **Alert Rules**: Automatikus értesítések bizonyos események alapján
7. **Audit Log**: Teljes audit trail minden műveletről
8. **Export/Import**: Konfiguráció és Tool-ok export/import
9. **Role Management UI**: Szerepkörök definiálása UI-ból
10. **Multi-language Support**: Angol és más nyelvek támogatása

## Összefoglalás

Az MCP Brunella Core egy moduláris, AI-vezérelt szerver irányítópult, amely:

- ✅ **Biztonságos** jogosultság-alapú hozzáférés-kezeléssel
- ✅ **Intelligens** AI chat integráció Agent Tool támogatással
- ✅ **Valós idejű** monitoring és állapotkövetés
- ✅ **Perzisztens** adattárolás useKV hook-kal
- ✅ **Moduláris** architektúra könnyű bővíthetőséggel
- ✅ **Felhasználóbarát** magyar nyelvű, professzionális UI

A rendszer teljesen funkcionális mock adatokkal, készen áll valós backend integrációra.
