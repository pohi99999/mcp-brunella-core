import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { LogEntry, User } from '@/lib/types'
import { formatTimestamp } from '@/lib/mockData'
import { Terminal, Trash, Server, Monitor } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { useState, useEffect } from 'react'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { monitorService } from '@/lib/monitorService'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface LogViewerProps {
  logs: LogEntry[]
  user: User | null
  onClearLogs: () => void
}

export function LogViewer({ logs, user, onClearLogs }: LogViewerProps) {
  const [filterLevel, setFilterLevel] = useState<string>('all')
  const [serverLog, setServerLog] = useState<string>('')
  const [activeTab, setActiveTab] = useState('client')

  useEffect(() => {
    if (activeTab === 'server') {
        const fetchLogs = async () => {
            const content = await monitorService.getLogs('web_ui.log', 100);
            setServerLog(content);
        };
        fetchLogs();
        const interval = setInterval(fetchLogs, 5000);
        return () => clearInterval(interval);
    }
  }, [activeTab]);

  const filteredLogs = filterLevel === 'all'
    ? logs
    : logs.filter(log => log.level === filterLevel)

  const getLevelColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'info':
        return 'bg-[var(--success)]/20 text-[var(--success)] border-[var(--success)]/30'
      case 'warning':
        return 'bg-[var(--warning)]/20 text-[var(--warning)] border-[var(--warning)]/30'
      case 'error':
        return 'bg-destructive/20 text-destructive border-destructive/30'
      case 'debug':
        return 'bg-accent/20 text-accent border-accent/30'
      default:
        return 'bg-muted text-muted-foreground'
    }
  }

  const getLevelText = (level: LogEntry['level']) => {
    switch (level) {
      case 'info':
        return 'INFO'
      case 'warning':
        return 'FIGY'
      case 'error':
        return 'HIBA'
      case 'debug':
        return 'DEBUG'
    }
  }

  return (
    <Card className="border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Terminal size={24} />
            Naplók
          </CardTitle>
          
          {activeTab === 'client' && (
            <div className="flex items-center gap-2">
                <div className="flex gap-1">
                <Button
                    variant={filterLevel === 'all' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setFilterLevel('all')}
                >
                    Összes
                </Button>
                <Button
                    variant={filterLevel === 'info' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setFilterLevel('info')}
                >
                    Info
                </Button>
                <Button
                    variant={filterLevel === 'warning' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setFilterLevel('warning')}
                >
                    Figyelmeztetés
                </Button>
                <Button
                    variant={filterLevel === 'error' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setFilterLevel('error')}
                >
                    Hiba
                </Button>
                </div>
                <PermissionGuard
                user={user}
                action="clearLogs"
                fallback={
                    <Button
                    variant="outline"
                    size="sm"
                    disabled
                    className="flex items-center gap-2"
                    >
                    <Trash size={16} />
                    Törlés
                    </Button>
                }
                >
                <Button
                    variant="outline"
                    size="sm"
                    onClick={onClearLogs}
                    className="flex items-center gap-2"
                >
                    <Trash size={16} />
                    Törlés
                </Button>
                </PermissionGuard>
            </div>
          )}
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mt-4">
            <TabsList>
                <TabsTrigger value="client" className="flex items-center gap-2">
                    <Monitor size={16} /> Client Logs
                </TabsTrigger>
                <TabsTrigger value="server" className="flex items-center gap-2">
                    <Server size={16} /> Server Logs
                </TabsTrigger>
            </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        {activeTab === 'client' ? (
            <ScrollArea className="h-[500px] w-full rounded-md border border-border/50 p-4">
            {filteredLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-12">
                <Terminal size={48} className="mb-4 opacity-50" />
                <p>Még nincsenek naplóbejegyzések</p>
                </div>
            ) : (
                <div className="space-y-2">
                {filteredLogs.map((log) => (
                    <div
                    key={log.id}
                    className={cn(
                        "p-3 rounded-md border transition-colors hover:bg-muted/30",
                        "border-border/30"
                    )}
                    >
                    <div className="flex items-start gap-3">
                        <Badge
                        variant="outline"
                        className={cn("font-mono text-xs shrink-0", getLevelColor(log.level))}
                        >
                        {getLevelText(log.level)}
                        </Badge>
                        <div className="flex-1 min-w-0">
                        <p className="text-sm break-words">{log.message}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <span className="font-mono">{formatTimestamp(log.timestamp)}</span>
                            {log.source && (
                            <>
                                <span>•</span>
                                <span>{log.source}</span>
                            </>
                            )}
                        </div>
                        </div>
                    </div>
                    </div>
                ))}
                </div>
            )}
            </ScrollArea>
        ) : (
            <ScrollArea className="h-[500px] w-full rounded-md border border-border/50 p-4 bg-black/90 text-white font-mono text-xs">
                <pre className="whitespace-pre-wrap">{serverLog || "No server logs available."}</pre>
            </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}