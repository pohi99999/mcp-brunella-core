# CEAN Operations Center UI - React Komponensek Katalógusa

**Created:** 2026-02-15
**Framework:** React 18 + TypeScript (ESM)
**UI Library:** Radix UI v1.0 + Tailwind CSS v4
**Base Path:** `src/dashboard/components/cean/`

---

## 📦 Modul Szerkezet

```
src/dashboard/components/cean/
├── CEANLayout.tsx              # 🔴 MAIN COMPONENT
├── CEANNavBar.tsx              # Header
├── types.ts                    # TypeScript interfaces
├── hooks/
│   ├── useCEANSocket.ts        # Socket.IO hook
│   ├── useCEANWorkers.ts       # Worker data hook
│   ├── useCEANTasks.ts         # Task queue hook
│   └── useCEANMetrics.ts       # Metrics hook
├── tabs/
│   ├── DashboardTab.tsx        # Dashboard (default)
│   ├── WorkersTab.tsx          # Workers list & detail
│   ├── TasksTab.tsx            # Tasks queue
│   ├── DataTab.tsx             # D1 + R1 explorer
│   └── SettingsTab.tsx         # User settings
├── components/
│   ├── WorkerStatusCard.tsx    # Worker mini card
│   ├── WorkerDetailModal.tsx   # Worker config editor
│   ├── TaskQueueTable.tsx      # Tasks sortable list
│   ├── TaskDetailPanel.tsx     # Task execution viewer
│   ├── D1Explorer.tsx          # Database table browser
│   ├── R1SearchPanel.tsx       # Vector search UI
│   ├── MetricsChart.tsx        # recharts line/bar
│   └── ActivityTimeline.tsx    # 6-hour graph
├── chat/
│   ├── OrchestratorChat.tsx    # Chat container (fixed right panel)
│   ├── ChatMessage.tsx         # Single message bubble
│   ├── ChatInput.tsx           # Input field + send
│   ├── TaskTemplates.tsx       # Predefined prompt dropdown
│   └── StreamingResponse.tsx   # Char-by-char animation
└── utils/
    ├── formatters.ts           # Data formatters
    ├── validators.ts           # Input validation
    └── constants.ts            # Magic strings, enums
```

---

## 🎨 Komponensek Listája

### **1. CEANLayout.tsx** ⭐
*A main container — tab routing + layout wrapper*

```typescript
interface Props {
  // no props — uses React Router or custom tab state
}

export const CEANLayout = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'workers' | 'tasks' | 'data' | 'settings'>('dashboard');
  
  return (
    <div className="grid grid-cols-[1fr_350px] h-screen">
      <div className="">
        <CEANNavBar activeTab={activeTab} onTabChange={setActiveTab} />
        <div className="overflow-auto flex-1">
          {activeTab === 'dashboard' && <DashboardTab />}
          {activeTab === 'workers' && <WorkersTab />}
          {/* ... */}
        </div>
      </div>
      <OrchestratorChat /> {/* Fixed right panel */}
    </div>
  );
};
```

**Dependencies:** Radix Tabs, type-safe tab routing
**Tests:** Tab switching, content preservation

---

### **2. CEANNavBar.tsx**
*Top navbar — logo, active tab indicator, user info, logout*

```typescript
interface Props {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const CEANNavBar = ({ activeTab, onTabChange }: Props) => {
  return (
    <nav className="border-b bg-white px-6 py-3 flex justify-between">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold">🚀 CEAN Operations Center</h1>
      </div>
      {/* Tabs: Dashboard | Workers | Tasks | Data | Settings */}
      <div className="flex items-center gap-6">
        {/* User info: "Pohánka Péter" + Logout button */}
      </div>
    </nav>
  );
};
```

**CSS:** Sticky top, border-bottom
**Interactions:** Tab highlighting, hover effects
**Tests:** User info display, logout button click

---

### **3. DashboardTab.tsx** 📊
*Main overview — worker grid, metrics, activity feed*

```typescript
export const DashboardTab = () => {
  return (
    <div className="p-6 space-y-6">
      {/* Worker Status Grid — 5 cards */}
      <WorkerStatusGrid />
      
      {/* Metrics Row */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Összes kérés" value="1,234" trend="+12%" />
        <StatCard label="Átlagos válaszidő" value="2.3s" trend="-5%" />
        <StatCard label="Hiba ráta" value="0.2%" trend="=stable" />
        <StatCard label="Halmozott költség" value="$0.42" trend="+8%" />
      </div>
      
      {/* Activity Timeline */}
      <ActivityTimeline />
      
      {/* Recent Tasks */}
      <RecentTasksList />
    </div>
  );
};
```

**Components used:** WorkerStatusCard (x5), MetricsChart, ActivityTimeline
**Data fetching:** useCEANMetrics hook
**Real-time:** Socket.IO listener for worker status updates

---

### **4. WorkerStatusCard.tsx** 🟢
*Mini card für einzelnen worker — status, CPU, RAM, actions*

```typescript
interface Props {
  workerId: string;
  name: string;
  status: 'RUNNING' | 'IDLE' | 'ERROR';
  cpu?: number;        // percentage
  memory?: number;     // percentage
  tasks?: number;      // queued tasks
  onDetail: (workerId: string) => void;
  onTrigger: (workerId: string) => void;
}

export const WorkerStatusCard = ({ workerId, name, status, ...props }: Props) => {
  const statusColor = status === 'RUNNING' ? 'text-green-500' : status === 'ERROR' ? 'text-red-500' : 'text-yellow-500';
  
  return (
    <card className="border rounded-lg p-4 hover:shadow-lg transition">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-semibold">{name}</h3>
          <p className={statusColor}>● {status}</p>
        </div>
        <button onClick={() => onDetail(workerId)} className="text-sm text-blue-600">
          részletek →
        </button>
      </div>
      
      {/* Progress bars for CPU, Memory */}
      <div className="mt-3 space-y-2 text-xs">
        <ProgressBar label="CPU" value={props.cpu} />
        <ProgressBar label="RAM" value={props.memory} />
      </div>
      
      {/* Action buttons */}
      <div className="mt-4 flex gap-2">
        <button onClick={() => onTrigger(workerId)} className="text-xs px-2 py-1 bg-blue-100 rounded">
          Manuális trigger
        </button>
      </div>
    </card>
  );
};
```

**Reusable:** Yes, used in DashboardTab (x5)
**Tests:** Status color, progress bar rendering, button clicks

---

### **5. WorkersTab.tsx** & **WorkerDetailModal.tsx**
*Worker management — list view + edit modal*

**WorkersTab.tsx:**
```typescript
export const WorkersTab = () => {
  const [selectedWorker, setSelectedWorker] = useState<string | null>(null);
  
  return (
    <>
      <WorkersList onSelect={setSelectedWorker} />
      {selectedWorker && (
        <WorkerDetailModal
          workerId={selectedWorker}
          onClose={() => setSelectedWorker(null)}
        />
      )}
    </>
  );
};
```

**WorkerDetailModal.tsx:**
```typescript
interface Props {
  workerId: string;
  onClose: () => void;
}

export const WorkerDetailModal = ({ workerId, onClose }: Props) => {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="w-full max-w-2xl">
        <Tabs defaultValue="config">
          <TabsList>
            <TabsTrigger value="config">Konfiguráció</TabsTrigger>
            <TabsTrigger value="logs">Naplók</TabsTrigger>
            <TabsTrigger value="metrics">Metrikák</TabsTrigger>
          </TabsList>
          
          <TabsContent value="config">
            {/* YAML config editor */}
            <ConfigEditor workerId={workerId} />
          </TabsContent>
          
          <TabsContent value="logs">
            {/* Live log tail */}
            <LiveLogTail workerId={workerId} />
          </TabsContent>
          
          <TabsContent value="metrics">
            {/* Worker perf. chart */}
            <WorkerMetricsChart workerId={workerId} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
```

**Features:** YAML editor, live tail logs, worker metrics
**API calls:** PUT /api/cean/workers/:id, GET /api/cean/workers/:id/logs
**WebSocket:** Subscribe to logs stream

---

### **6. TasksTab.tsx** & **TaskQueueTable.tsx**
*Task queue management — list + detail drawer*

**TasksTab.tsx:**
```typescript
export const TasksTab = () => {
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  
  return (
    <div className="grid grid-cols-[1fr_400px]">
      <TaskQueueTable onSelect={setSelectedTask} />
      {selectedTask && (
        <TaskDetailPanel
          taskId={selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </div>
  );
};
```

**TaskQueueTable.tsx:**
```typescript
columns: [
  { key: 'id', header: 'Task ID', sortable: true },
  { key: 'worker', header: 'Worker', sortable: true },
  { key: 'status', header: 'Státusz', sortable: true },
  { key: 'priority', header: 'Prioritás', sortable: true },
  { key: 'enqueued', header: 'Bevezetett', sortable: true },
  { key: 'eta', header: 'ETA', sortable: true },
]

// Data: TanStack React Table v8 (sorting, pagination, filtering)
```

**Features:** Sorting, pagination, inline status badge
**Actions:** Cancel button per task

---

### **7. TaskDetailPanel.tsx**
*Task execution details — payload, logs, results*

```typescript
interface Props {
  taskId: string;
  onClose: () => void;
}

export const TaskDetailPanel = ({ taskId, onClose }: Props) => {
  return (
    <div className="border-l p-4 overflow-auto">
      <h2 className="text-lg font-bold mb-4">Task: {taskId}</h2>
      
      <Tabs defaultValue="payload">
        <TabsTrigger value="payload">Payload</TabsTrigger>
        <TabsTrigger value="execution">Végrehajtás</TabsTrigger>
        <TabsTrigger value="results">Eredmények</TabsTrigger>
      </Tabs>
      
      {/* Payload JSON view */}
      {/* Execution log stream */}
      {/* Results CSV export */}
    </div>
  );
};
```

**Data source:** GET /api/cean/tasks/:id
**Stream:** WebSocket `cean:task:update` events
**Export:** Results as CSV button

---

### **8. DataTab.tsx** - D1 & R1 Explorer

**D1Explorer.tsx:**
```typescript
export const D1Explorer = () => {
  const [selectedTable, setSelectedTable] = useState<string>('edge_tasks');
  
  return (
    <div className="grid grid-cols-[200px_1fr]">
      <div className="border-r p-4">
        {/* Table list sidebar */}
        <TableList onSelect={setSelectedTable} />
      </div>
      
      <div className="p-4">
        {/* Table schema + data preview */}
        <TablePreview tableName={selectedTable} />
        
        {/* Query builder form */}
        <QueryBuilder onExecute={handleQuery} />
        
        {/* Results grid */}
        <ResultsGrid results={results} />
      </div>
    </div>
  );
};
```

**Data source:** GET /api/cean/d1/tables, POST /api/cean/d1/query
**Safety:** Whitelist-based SELECT queries only
**Export:** CSV button

---

### **9. R1SearchPanel.tsx**
*Vector search demo*

```typescript
export const R1SearchPanel = () => {
  return (
    <div className="space-y-4">
      <div>
        <label>Keresési lekérdezés (embedding)</label>
        <textarea placeholder="Milyen eredményt keresünk?" />
      </div>
      
      <button onClick={handleSearch}>Keresés az R1-ben</button>
      
      {/* Results: embedding similarity scores */}
      <div className="space-y-2">
        {results.map(r => (
          <div key={r.id} className="border p-2 rounded">
            <p className="font-semibold">{r.metadata.title}</p>
            <p className="text-sm text-gray-500">Relevancia: {(r.score * 100).toFixed(1)}%</p>
          </div>
        ))}
      </div>
    </div>
  );
};
```

**API:** POST /api/cean/r1/search
**Viz:** Relevance score bars + metadata

---

### **10. OrchestratorChat.tsx** 💬
*Main chat interface — fixed right panel*

```typescript
export const OrchestratorChat = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const socketRef = useRef(null);
  
  useEffect(() => {
    // Socket.IO connection
    socketRef.current = io();
    socketRef.current.on('cean:orchestrator:response', (msg) => {
      // Streaming response
    });
  }, []);
  
  const handleSendPrompt = async (userMessage: string) => {
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    socketRef.current.emit('cean:orchestrator:prompt', { message: userMessage });
  };
  
  return (
    <div className="w-[350px] border-l bg-white flex flex-col h-screen">
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <ChatMessage key={i} message={msg} />
        ))}
      </div>
      
      <ChatInput onSend={handleSendPrompt} disabled={loading} />
    </div>
  );
};
```

**Features:** Real-time streaming, message history
**State:** localStorage persistence (draft)
**WebSocket:** Socket.IO namespaced events

---

### **11. ChatMessage.tsx**
*Single message bubble — user or bot*

```typescript
interface Props {
  message: {
    role: 'user' | 'bot';
    content: string;
    timestamp?: Date;
    metadata?: { taskId?: string; status?: string };
  };
}

export const ChatMessage = ({ message }: Props) => {
  const isBot = message.role === 'bot';
  
  return (
    <div className={`flex ${isBot ? 'justify-start' : 'justify-end'}`}>
      <div className={`max-w-xs px-4 py-2 rounded-lg ${
        isBot ? 'bg-blue-100 text-blue-900' : 'bg-gray-200 text-gray-900'
      }`}>
        {isBot && <p className="font-semibold text-xs mb-1">🤖 Orchestrator</p>}
        <ReactMarkdown>{message.content}</ReactMarkdown>
        {message.timestamp && (
          <p className="text-xs text-gray-500 mt-1">{formatTime(message.timestamp)}</p>
        )}
      </div>
    </div>
  );
};
```

**Markdown support:** Code blocks, bold, links
**Metadata display:** Task ID, status badge

---

### **12. ChatInput.tsx**
*Textarea + send button + task suggester*

```typescript
interface Props {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export const ChatInput = ({ onSend, disabled }: Props) => {
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  
  // Task template suggestions (hardcoded or from API)
  const taskTemplates = [
    "Kérlek futtass egy research-agent-et az AI grant-okra",
    "Mi a status az összes worker-nek?",
    "Mennyi task van várakozásban?",
  ];
  
  return (
    <div className="border-t p-4 space-y-2">
      <TaskTemplates templates={taskTemplates} onSelect={setInput} />
      
      <div className="flex gap-2">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSend(input);
              setInput('');
            }
          }}
          className="flex-1 border rounded p-2 text-sm resize-none"
          placeholder="Mondd meg, mit csineljen az Orchestrator..."
          rows={3}
          disabled={disabled}
        />
        <button
          onClick={() => { onSend(input); setInput(''); }}
          className="bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700"
          disabled={!input || disabled}
        >
          ➤
        </button>
      </div>
    </div>
  );
};
```

**UX:** Auto-expand textarea, send on Ctrl+Enter
**Templates:** Task suggestions dropdown

---

### **13. StreamingResponse.tsx** ✨
*Char-by-char animation for bot responses*

```typescript
interface Props {
  text: string;
  delay?: number; // ms per char
}

export const StreamingResponse = ({ text, delay = 20 }: Props) => {
  const [displayText, setDisplayText] = useState('');
  
  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      if (i < text.length) {
        setDisplayText(text.substring(0, i + 1));
        i++;
      } else {
        clearInterval(interval);
      }
    }, delay);
    
    return () => clearInterval(interval);
  }, [text, delay]);
  
  return <div>{displayText}</div>;
};
```

**Animation:** Smooth char-by-char stream
**Perf.:** useCallback to prevent re-renders

---

### **14. MetricsChart.tsx** 📈
*recharts line/bar for performance data*

```typescript
export const MetricsChart = () => {
  const data = [
    { time: '08:00', requests: 12, cost: 0.05 },
    { time: '09:00', requests: 15, cost: 0.07 },
    { time: '10:00', requests: 8, cost: 0.03 },
    // ...
  ];
  
  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="time" />
        <YAxis yAxisId="left" />
        <YAxis yAxisId="right" orientation="right" />
        <Tooltip />
        <Legend />
        <Bar yAxisId="left" dataKey="requests" fill="#3b82f6" />
        <Line yAxisId="right" type="monotone" dataKey="cost" stroke="#ef4444" />
      </ComposedChart>
    </ResponsiveContainer>
  );
};
```

**Library:** recharts v2.10+
**Data source:** useCEANMetrics hook (Socket.IO polling)
**Responsive:** Full width

---

### **15. ActivityTimeline.tsx** ⏱️
*6-hour activity view with event markers*

```typescript
export const ActivityTimeline = () => {
  const events = [
    { time: '14:32', title: 'research-agent completed', icon: '✅', color: 'green' },
    { time: '14:25', title: 'grant-monitor error', icon: '❌', color: 'red' },
    // ...
  ];
  
  return (
    <div className="leading-relaxed">
      {events.map((e, i) => (
        <div key={i} className="flex gap-4 mb-4">
          <div className="text-sm font-mono text-gray-500">{e.time}</div>
          <div className={`flex-1 text-${e.color}-600`}>
            <span className="mr-2">{e.icon}</span>
            {e.title}
          </div>
        </div>
      ))}
    </div>
  );
};
```

**Visualization:** Vertical timeline
**Data:** WebSocket real-time events

---

## 🔌 Custom Hooks

### **useCEANSocket.ts**
```typescript
export const useCEANSocket = () => {
  const [connected, setConnected] = useState(false);
  
  useEffect(() => {
    const socket = io(process.env.REACT_APP_API_URL);
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    
    return () => socket.disconnect();
  }, []);
  
  return { socket, connected };
};
```

### **useCEANWorkers.ts**
```typescript
export const useCEANWorkers = () => {
  const query = useQuery({
    queryKey: ['cean', 'workers'],
    queryFn: async () => {
      const res = await fetch('/api/cean/workers');
      return res.json();
    },
    refetchInterval: 5000, // 5s polling
  });
  
  return query;
};
```

Similar hooks: `useCEANTasks`, `useCEANMetrics`, `useCEAND1Tables`, etc.

---

## 📐 Type Definitions (types.ts)

```typescript
interface CEANWorker {
  id: string;
  name: string;
  status: 'RUNNING' | 'IDLE' | 'ERROR';
  cpu?: number;
  memory?: number;
  lastRun?: Date;
  nextRun?: Date;
  uptime?: number; // % uptime
  config?: Record<string, any>;
}

interface CEANTask {
  id: string;
  workerId: string;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  payload: Record<string, any>;
  result?: any;
  duration?: number; // ms
  cost?: number; // USD
  enqueued: Date;
  started?: Date;
  completed?: Date;
}

interface ChatMessage {
  role: 'user' | 'bot';
  content: string;
  timestamp: Date;
  metadata?: {
    taskId?: string;
    status?: 'pending' | 'running' | 'done' | 'error';
  };
}

interface CEANMetrics {
  requestsPerHour: number[];
  costAccumulated: number;
  workerUptime: Record<string, number>;
  errorRate: number;
  avgResponseTime: number; // ms
}
```

---

## 🧪 Testing Strategy

- **Unit tests:** Each component with React Testing Library
- **Integration:** Tabs, routing, data flow
- **E2E:** Playwright scenarios (create task, check D1)
- **Accessibility:** axe-core audits
- **Performance:** Vitest profiling

**Coverage target:** 85%+

---

## 📦 Dependencies (npm install)

```json
{
  "recharts": "^2.10.0",
  "socket.io-client": "^4.7.0",     // meglévő
  "react-markdown": "^8.0.0",
  "@tanstack/react-table": "^8.9.0",
  "@radix-ui/react-tabs": "^1.0.0",
  "@radix-ui/react-dialog": "^1.1.1",
  "lucide-react": "^0.263.0",
  "tailwindcss": "^4.0.0",           // meglévő
  "typescript": "^5.0.0"             // meglévő
}
```

---

**Status:** `pending_approval` → Ready for Phase 1 component scaffolding.

---
