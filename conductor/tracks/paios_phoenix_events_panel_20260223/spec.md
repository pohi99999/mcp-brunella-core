# Specifikáció: PAIOS PhoenixEventsPanel UI
**Track ID:** `paios_phoenix_events_panel_20260223`
**Státusz:** proposed
**Prioritás:** MEDIUM

---

## 1. Jelenlegi Helyzet

| Komponens | Státusz | Megjegyzés |
|---|---|---|
| `src/core/phoenixEventBus.ts` | ✅ KÉSZ | EventEmitter, emit() már hív |
| `src/core/checkpoint.ts` | ✅ KÉSZ | Állapot mentés/visszaállítás |
| `src/core/retryStrategy.ts` | ✅ KÉSZ | Exponential backoff |
| `src/server/SocketService.ts` | ✅ KÉSZ | Socket.IO broadcast |
| **PhoenixEventsPanel.tsx** | ❌ HIÁNYZIK | Ez a track feladata |
| **Phoenix → Socket.IO bekötés** | ❌ HIÁNYZIK | 1 sor bővítés phoenixEventBus-ban |

---

## 2. Backend: Phoenix → Socket.IO

```typescript
// src/core/phoenixEventBus.ts bővítése
import { getSocketService } from '../server/SocketService.js';

// Minden emit() után:
export function emitPhoenixEvent(type: PhoenixEventType, payload: PhoenixEventPayload) {
  phoenixEventBus.emit(type, payload);
  // Broadcast a dashboardra:
  getSocketService()?.emit(`phoenix:${type}`, {
    type,
    timestamp: new Date().toISOString(),
    ...payload,
  });
}
```

### Esemény típusok

| Event | Mikor | Payload |
|-------|-------|---------|
| `phoenix:recovery` | Sikeres self-healing | `{ agent, taskId, from, to }` |
| `phoenix:restart` | Agent restart | `{ agent, reason }` |
| `phoenix:state_restored` | Checkpoint visszaállítás | `{ checkpointId, agent }` |
| `phoenix:checkpoint_saved` | Checkpoint mentés | `{ checkpointId, agent, state }` |
| `phoenix:error` | Nem kezelt hiba | `{ agent, error, taskId? }` |

---

## 3. Frontend: PhoenixEventsPanel

```tsx
// src/dashboard/components/dashboard/PhoenixEventsPanel.tsx
interface PhoenixEvent {
  id: string;          // nanoid
  type: string;
  timestamp: string;
  agent?: string;
  taskId?: string;
  details?: string;
}

export function PhoenixEventsPanel() {
  const [events, setEvents] = useState<PhoenixEvent[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const socket = useSocket();  // meglévő SocketContext

  useEffect(() => {
    const handler = (event: PhoenixEvent) => {
      setEvents(prev => [event, ...prev].slice(0, 100));  // max 100, legújabb elöl
    };
    socket?.on('phoenix:recovery', handler);
    socket?.on('phoenix:restart', handler);
    socket?.on('phoenix:state_restored', handler);
    socket?.on('phoenix:checkpoint_saved', handler);
    socket?.on('phoenix:error', handler);
    return () => {
      socket?.off('phoenix:recovery', handler);
      // ... többi off
    };
  }, [socket]);

  const filtered = filter === 'all' ? events : events.filter(e => e.type === filter);

  return (
    <div className="phoenix-events-panel">
      <FilterBar value={filter} onChange={setFilter} />
      <EventList events={filtered} />
    </div>
  );
}
```

### Vizuális Terv

```
┌─────────────────────────────────────────────────┐
│ 🔥 Phoenix Events          [all ▼] [Clear]      │
├─────────────────────────────────────────────────┤
│ 🟢 14:23:01 RECOVERY    DeveloperAgent → idle   │
│ 🔵 14:22:55 CHECKPOINT  task_abc123 saved       │
│ 🟡 14:22:40 RESTART     ResearcherAgent timeout │
│ 🔴 14:21:10 ERROR       VoiceAgent: conn failed │
└─────────────────────────────────────────────────┘
```

---

## 4. Függőségek

- `src/server/SocketService.ts` — már kész
- `src/dashboard/context/SocketContext.tsx` — Socket.IO client hook
- `src/core/phoenixEventBus.ts` — minimális bővítés (Socket.IO emit)
- Nincs blocker — önállóan implementálható
