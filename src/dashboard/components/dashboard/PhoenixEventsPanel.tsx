/**
 * PAIOS Phoenix Events Panel - Real-time Phoenix Protocol Monitoring
 *
 * Features:
 * - Real-time Phoenix event stream (Socket.IO)
 * - Event filtering by type
 * - Color-coded event badges
 * - Auto-scroll to latest events
 * - Event history (max 100 events)
 *
 * @track paios_phoenix_events_panel_20260223
 */

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Flame,
    CheckCircle2,
    RotateCcw,
    Database,
    AlertTriangle,
    XCircle,
    Activity,
} from 'lucide-react';
import { useSocket } from '@/context/SocketContext';
import { nanoid } from 'nanoid';

export interface PhoenixEvent {
    id: string;
    type: PhoenixEventType;
    timestamp: string;
    agent?: string;
    taskId?: string;
    details?: string;
    serviceName?: string;
    success?: boolean;
    error?: string;
    stepIndex?: number;
    stepName?: string;
    level?: string;
}

export type PhoenixEventType =
    | 'phoenix:recovery'
    | 'phoenix:restart'
    | 'phoenix:state_restored'
    | 'phoenix:checkpoint_saved'
    | 'phoenix:agent_failed'
    | 'phoenix:failover_triggered'
    | 'phoenix:failover_result'
    | 'phoenix:degraded'
    | 'phoenix:edge_health'
    | 'phoenix:circuit_breaker';

const EVENT_CONFIGS: Record<
    PhoenixEventType,
    { label: string; icon: typeof Flame; color: string; bgColor: string }
> = {
    'phoenix:recovery': {
        label: 'Recovery',
        icon: CheckCircle2,
        color: 'text-green-500',
        bgColor: 'bg-green-500/10 border-green-500/30',
    },
    'phoenix:restart': {
        label: 'Restart',
        icon: RotateCcw,
        color: 'text-yellow-500',
        bgColor: 'bg-yellow-500/10 border-yellow-500/30',
    },
    'phoenix:state_restored': {
        label: 'State Restored',
        icon: Database,
        color: 'text-blue-500',
        bgColor: 'bg-blue-500/10 border-blue-500/30',
    },
    'phoenix:checkpoint_saved': {
        label: 'Checkpoint',
        icon: Database,
        color: 'text-cyan-500',
        bgColor: 'bg-cyan-500/10 border-cyan-500/30',
    },
    'phoenix:agent_failed': {
        label: 'Agent Failed',
        icon: XCircle,
        color: 'text-red-500',
        bgColor: 'bg-red-500/10 border-red-500/30',
    },
    'phoenix:failover_triggered': {
        label: 'Failover',
        icon: AlertTriangle,
        color: 'text-orange-500',
        bgColor: 'bg-orange-500/10 border-orange-500/30',
    },
    'phoenix:failover_result': {
        label: 'Failover Result',
        icon: Activity,
        color: 'text-purple-500',
        bgColor: 'bg-purple-500/10 border-purple-500/30',
    },
    'phoenix:degraded': {
        label: 'Degraded',
        icon: AlertTriangle,
        color: 'text-orange-500',
        bgColor: 'bg-orange-500/10 border-orange-500/30',
    },
    'phoenix:edge_health': {
        label: 'Edge Health',
        icon: Activity,
        color: 'text-teal-500',
        bgColor: 'bg-teal-500/10 border-teal-500/30',
    },
    'phoenix:circuit_breaker': {
        label: 'Circuit Breaker',
        icon: AlertTriangle,
        color: 'text-amber-500',
        bgColor: 'bg-amber-500/10 border-amber-500/30',
    },
};

export function PhoenixEventsPanel() {
    const [events, setEvents] = useState<PhoenixEvent[]>([]);
    const [filter, setFilter] = useState<string>('all');
    const { socket } = useSocket();
    const scrollRef = useRef<HTMLDivElement>(null);

    // Socket.IO listeners for all Phoenix events
    useEffect(() => {
        if (!socket) return;

        const eventTypes: PhoenixEventType[] = [
            'phoenix:recovery',
            'phoenix:restart',
            'phoenix:state_restored',
            'phoenix:checkpoint_saved',
            'phoenix:agent_failed',
            'phoenix:failover_triggered',
            'phoenix:failover_result',
            'phoenix:degraded',
            'phoenix:edge_health',
            'phoenix:circuit_breaker',
        ];

        const handleEvent = (type: PhoenixEventType) => (data: any) => {
            const event: PhoenixEvent = {
                id: nanoid(),
                type,
                timestamp: data.timestamp || new Date().toISOString(),
                agent: data.agent || data.agentName,
                taskId: data.taskId,
                details: data.details || data.message,
                serviceName: data.serviceName,
                success: data.success,
                error: data.error,
                stepIndex: data.stepIndex,
                stepName: data.stepName,
                level: data.level,
            };

            setEvents((prev) => [event, ...prev].slice(0, 100)); // Keep max 100 events
        };

        // Register all listeners
        eventTypes.forEach((type) => {
            socket.on(type, handleEvent(type));
        });

        // Cleanup
        return () => {
            eventTypes.forEach((type) => {
                socket.off(type);
            });
        };
    }, [socket]);

    // Auto-scroll to top when new events arrive
    useEffect(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, [events.length]);

    // Filter events
    const filteredEvents = filter === 'all' ? events : events.filter((e) => e.type === filter);

    // Clear all events
    const handleClear = () => {
        setEvents([]);
    };

    return (
        <Card className="h-full flex flex-col">
            <CardHeader className="border-b">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <Flame className="w-5 h-5 text-orange-500" />
                        Phoenix Events
                    </CardTitle>
                    <div className="flex gap-2">
                        <Select value={filter} onValueChange={setFilter}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Filter events" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Events</SelectItem>
                                {Object.entries(EVENT_CONFIGS).map(([type, config]) => (
                                    <SelectItem key={type} value={type}>
                                        {config.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button variant="outline" size="sm" onClick={handleClear}>
                            Clear
                        </Button>
                    </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                    Real-time Phoenix Protocol recovery events • {filteredEvents.length}/100 events
                </p>
            </CardHeader>

            <CardContent className="flex-1 p-4 overflow-hidden">
                <ScrollArea className="h-full">
                    <div className="space-y-2">
                        <div ref={scrollRef} />
                        {filteredEvents.length === 0 ? (
                            <div className="text-center text-muted-foreground py-12">
                                <Flame className="w-12 h-12 mx-auto mb-2 opacity-30" />
                                <p className="text-sm">No Phoenix events yet</p>
                                <p className="text-xs mt-1 opacity-70">Events will appear here in real-time</p>
                            </div>
                        ) : (
                            filteredEvents.map((event) => (
                                <EventCard key={event.id} event={event} />
                            ))
                        )}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
}

function EventCard({ event }: { event: PhoenixEvent }) {
    const config = EVENT_CONFIGS[event.type];
    const Icon = config.icon;

    const formatTime = (timestamp: string) => {
        try {
            return new Date(timestamp).toLocaleTimeString('hu-HU', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
            });
        } catch {
            return timestamp;
        }
    };

    return (
        <div className={`border rounded-lg p-3 ${config.bgColor}`}>
            <div className="flex items-start gap-3">
                <Icon className={`w-5 h-5 ${config.color} flex-shrink-0 mt-0.5`} />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">
                            {config.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{formatTime(event.timestamp)}</span>
                        {event.success !== undefined && (
                            <Badge variant={event.success ? 'default' : 'destructive'} className="text-xs">
                                {event.success ? '✓' : '✗'}
                            </Badge>
                        )}
                    </div>

                    {event.agent && (
                        <p className="text-sm font-medium">
                            Agent: <span className={config.color}>{event.agent}</span>
                        </p>
                    )}

                    {event.taskId && (
                        <p className="text-xs text-muted-foreground">Task: {event.taskId}</p>
                    )}

                    {event.serviceName && (
                        <p className="text-xs text-muted-foreground">Service: {event.serviceName}</p>
                    )}

                    {event.stepName && (
                        <p className="text-xs">
                            Step {event.stepIndex}: {event.stepName}
                        </p>
                    )}

                    {event.details && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{event.details}</p>
                    )}

                    {event.error && (
                        <p className="text-xs text-red-500 mt-1 font-mono line-clamp-2">Error: {event.error}</p>
                    )}

                    {event.level && (
                        <Badge variant="secondary" className="text-xs mt-1">
                            Level: {event.level}
                        </Badge>
                    )}
                </div>
            </div>
        </div>
    );
}
