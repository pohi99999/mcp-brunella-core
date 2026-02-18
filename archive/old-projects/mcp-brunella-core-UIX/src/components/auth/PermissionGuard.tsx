import { ReactNode } from 'react'
import { User, Permission } from '@/lib/types'
import { canPerformAction } from '@/lib/auth'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface PermissionGuardProps {
  user: User | null
  action: keyof Permission
  children: ReactNode
  fallback?: ReactNode
  showTooltip?: boolean
}

export function PermissionGuard({ 
  user, 
  action, 
  children, 
  fallback = null,
  showTooltip = true 
}: PermissionGuardProps) {
  const hasPermission = canPerformAction(user, action)

  if (hasPermission) {
    return <>{children}</>
  }

  if (!showTooltip) {
    return <>{fallback}</>
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-block">
            {fallback}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>Nincs jogosultságod ehhez a művelethez</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
