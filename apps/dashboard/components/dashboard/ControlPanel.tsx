import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ServerStatus, User } from '@/lib/types'
import { Play, Stop, ArrowClockwise } from '@phosphor-icons/react'
import { useState } from 'react'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface ControlPanelProps {
  status: ServerStatus
  user: User | null
  onStart: () => void
  onStop: () => void
  onRestart: () => void
}

export function ControlPanel({ status, user, onStart, onStop, onRestart }: ControlPanelProps) {
  const [showStopDialog, setShowStopDialog] = useState(false)
  const [showRestartDialog, setShowRestartDialog] = useState(false)

  const isLoading = status === 'starting' || status === 'stopping'
  const isRunning = status === 'running'
  const isStopped = status === 'stopped'

  const handleStop = () => {
    setShowStopDialog(false)
    onStop()
  }

  const handleRestart = () => {
    setShowRestartDialog(false)
    onRestart()
  }

  return (
    <>
      <Card className="glass-card border-white/10 overflow-hidden">
        <CardHeader className="pb-3 border-b border-white/[0.05] bg-white/[0.015]">
          <CardTitle className="text-[11px] font-mono font-semibold uppercase tracking-[0.28em] text-zinc-400">Folyamat Vezérlés</CardTitle>
        </CardHeader>
        <CardContent className="p-4 lg:p-5">
          <div className="mb-4 flex flex-wrap gap-2 text-xs">
            <span className={cn(
              'rounded-full border px-3 py-1 font-mono tracking-[0.18em] uppercase',
              isRunning ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200' : 'border-white/[0.08] bg-white/[0.03] text-zinc-400'
            )}>
              Running
            </span>
            <span className={cn(
              'rounded-full border px-3 py-1 font-mono tracking-[0.18em] uppercase',
              isStopped ? 'border-zinc-400/20 bg-white/[0.03] text-zinc-300' : 'border-white/[0.08] bg-white/[0.03] text-zinc-400'
            )}>
              Stopped
            </span>
            <span className={cn(
              'rounded-full border px-3 py-1 font-mono tracking-[0.18em] uppercase',
              isLoading ? 'border-amber-400/20 bg-amber-400/10 text-amber-200' : 'border-white/[0.08] bg-white/[0.03] text-zinc-400'
            )}>
              Transitioning
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                    <PermissionGuard
                      user={user}
                      action="startServer"
                      fallback={
                        <Button
                          disabled
                        className="flex items-center gap-2 w-full justify-center rounded-2xl border-white/10 bg-white/[0.03] text-zinc-400"
                          size="lg"
                        >
                          <Play size={20} weight="fill" />
                          Indítás
                      </Button>
                    }
                  >
                    <Button
                      onClick={onStart}
                      disabled={isRunning || isLoading}
                      className="flex items-center gap-2 w-full justify-center rounded-2xl border-white/10 bg-cyan-500/15 text-cyan-100 hover:bg-cyan-500/20"
                      size="lg"
                    >
                      <Play size={20} weight="fill" />
                      Indítás
                    </Button>
                  </PermissionGuard>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>Szerver elindítása</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <PermissionGuard
                    user={user}
                    action="stopServer"
                    fallback={
                      <Button
                        disabled
                        variant="destructive"
                        className="flex items-center gap-2 w-full justify-center rounded-2xl"
                        size="lg"
                      >
                        <Stop size={20} weight="fill" />
                        Leállítás
                      </Button>
                    }
                  >
                    <Button
                      onClick={() => setShowStopDialog(true)}
                      disabled={isStopped || isLoading}
                      variant="destructive"
                      className="flex items-center gap-2 w-full justify-center rounded-2xl"
                      size="lg"
                    >
                      <Stop size={20} weight="fill" />
                      Leállítás
                    </Button>
                  </PermissionGuard>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>Szerver leállítása és aktív kapcsolatok megszakítása</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <PermissionGuard
                    user={user}
                    action="restartServer"
                    fallback={
                      <Button
                        disabled
                        variant="secondary"
                        className="flex items-center gap-2 w-full justify-center rounded-2xl"
                        size="lg"
                      >
                        <ArrowClockwise size={20} />
                        Újraindítás
                      </Button>
                    }
                  >
                    <Button
                      onClick={() => setShowRestartDialog(true)}
                      disabled={isStopped || isLoading}
                      variant="secondary"
                      className="flex items-center gap-2 w-full justify-center rounded-2xl"
                      size="lg"
                    >
                      <ArrowClockwise size={20} />
                      Újraindítás
                    </Button>
                  </PermissionGuard>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>Szerver újraindítása (megszakítja a kapcsolatokat)</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showStopDialog} onOpenChange={setShowStopDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Szerver leállítása</AlertDialogTitle>
              <AlertDialogDescription>
                Biztosan le szeretné állítani a szervert? Ez megszakít minden aktív kapcsolatot.
              </AlertDialogDescription>
            </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Mégse</AlertDialogCancel>
            <AlertDialogAction onClick={handleStop} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Leállítás
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showRestartDialog} onOpenChange={setShowRestartDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Szerver újraindítása</AlertDialogTitle>
              <AlertDialogDescription>
                Biztosan újra szeretné indítani a szervert? Ez rövid ideig megszakít minden aktív kapcsolatot.
              </AlertDialogDescription>
            </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Mégse</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestart}>
              Újraindítás
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
