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
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Folyamat Vezérlés</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <PermissionGuard
                    user={user}
                    action="startServer"
                    fallback={
                      <Button
                        disabled
                        className="flex items-center gap-2"
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
                      className="flex items-center gap-2 w-full"
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
                        className="flex items-center gap-2"
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
                      className="flex items-center gap-2 w-full"
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
                        className="flex items-center gap-2"
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
                      className="flex items-center gap-2 w-full"
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
