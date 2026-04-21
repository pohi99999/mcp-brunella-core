import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { LogEntry, User } from '@/lib/types'
import { formatTimestamp } from '@/lib/mockData'
import { Terminal, Trash } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import { PermissionGuard } from '@/components/auth/PermissionGuard'

interface LogViewerProps
{
  logs?: LogEntry[]
  user?: User | null
  onClearLogs?: () => void
}

export function LogViewer ( { logs = [], user, onClearLogs = () => undefined }: LogViewerProps )
{
  const [filterLevel, setFilterLevel] = useState<string>( 'all' )

  const safeLogs = Array.isArray( logs ) ? logs : []
  const filteredLogs = filterLevel === 'all'
    ? safeLogs
    : safeLogs.filter( log => log.level === filterLevel )

  const getLevelColor = ( level: LogEntry['level'] ) =>
  {
    switch ( level )
    {
      case 'info':
        return 'bg-emerald-400/10 text-emerald-200 border-emerald-400/20'
      case 'warning':
        return 'bg-amber-400/10 text-amber-200 border-amber-400/20'
      case 'error':
        return 'bg-red-400/10 text-red-200 border-red-400/20'
      case 'debug':
        return 'bg-violet-400/10 text-violet-200 border-violet-400/20'
      default:
        return 'bg-white/[0.04] text-zinc-400 border-white/[0.08]'
    }
  }

  const getLevelText = ( level: LogEntry['level'] ) =>
  {
    switch ( level )
    {
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
    <Card className="glass-card border-white/10 overflow-hidden shadow-[0_16px_60px_-36px_rgba(0,0,0,0.85)]">
      <CardHeader className="pb-3 border-b border-white/[0.05] bg-white/[0.015]">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-[11px] font-mono font-semibold uppercase tracking-[0.28em] text-zinc-400">
            <Terminal size={20} className="text-cyan-300" />
            Naplók
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <Button
                variant={filterLevel === 'all' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setFilterLevel( 'all' )}
                className="h-8 rounded-full border border-white/10 bg-white/[0.03]"
              >
                Összes
              </Button>
              <Button
                variant={filterLevel === 'info' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setFilterLevel( 'info' )}
                className="h-8 rounded-full border border-white/10 bg-white/[0.03]"
              >
                Info
              </Button>
              <Button
                variant={filterLevel === 'warning' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setFilterLevel( 'warning' )}
                className="h-8 rounded-full border border-white/10 bg-white/[0.03]"
              >
                Figyelmeztetés
              </Button>
              <Button
                variant={filterLevel === 'error' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setFilterLevel( 'error' )}
                className="h-8 rounded-full border border-white/10 bg-white/[0.03]"
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
                  className="flex items-center gap-2 rounded-full border-white/10 bg-white/[0.03]"
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
                className="flex items-center gap-2 rounded-full border-white/10 bg-white/[0.03]"
              >
                <Trash size={16} />
                Törlés
              </Button>
            </PermissionGuard>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 lg:p-5">
        <ScrollArea className="h-[500px] w-full rounded-2xl border border-white/[0.05] bg-white/[0.015] p-4">
          {filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-zinc-500 py-12">
              <Terminal size={48} className="mb-4 opacity-50" />
              <p>Még nincsenek naplóbejegyzések</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredLogs.map( ( log ) => (
                <div
                  key={log.id}
                  className={cn(
                    "p-3 rounded-2xl border transition-colors hover:bg-white/[0.03]",
                    "border-white/[0.05] bg-white/[0.015] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Badge
                      variant="outline"
                      className={cn( "font-mono text-xs shrink-0 uppercase tracking-[0.18em]", getLevelColor( log.level ) )}
                    >
                      {getLevelText( log.level )}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm break-words text-zinc-100">{log.message}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500">
                        <span className="font-mono">{formatTimestamp( log.timestamp )}</span>
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
              ) )}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
