/**
 * EmbeddedWorkflow - iframe beágyazás n8n vagy Langflow számára
 *
 * SECURITY NOTE:
 * - sandbox="allow-scripts allow-forms" is the minimum for functionality
 * - allow-same-origin is intentionally OMITTED to prevent XSS attacks
 * - If the embedded app requires cookies/storage, use the external link instead
 * - For trusted internal tools only (localhost URLs)
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ExternalLink, ShieldAlert } from 'lucide-react'

interface EmbeddedWorkflowProps {
  title: string
  url: string
  icon?: React.ReactNode
  /** Allow same-origin access (security risk - only for trusted localhost tools) */
  allowSameOrigin?: boolean
}

export function EmbeddedWorkflow({ title, url, icon, allowSameOrigin = false }: EmbeddedWorkflowProps) {
  const fullUrl = url.startsWith('http') ? url : `http://localhost:${url}`

  // Only allow same-origin for localhost URLs as a safety measure
  const isLocalhost = fullUrl.includes('localhost') || fullUrl.includes('127.0.0.1')
  const shouldAllowSameOrigin = allowSameOrigin && isLocalhost

  // Build sandbox attribute - restrictive by default
  const sandboxPermissions = [
    'allow-scripts',
    'allow-forms',
    ...(shouldAllowSameOrigin ? ['allow-same-origin'] : []),
  ].join(' ')

  return (
    <Card className="bg-transparent border-none shadow-none flex flex-col h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-medium text-zinc-200">
          {icon}
          {title}
          {!shouldAllowSameOrigin && (
            <ShieldAlert size={14} className="text-emerald-500" title="Sandboxed for security" />
          )}
        </CardTitle>
        <a
          href={fullUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-sm text-zinc-500 hover:text-emerald-400 transition-colors"
        >
          <ExternalLink size={14} />
          Megnyitás új lapban
        </a>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 p-0">
        <iframe
          src={fullUrl}
          title={title}
          className="w-full h-full min-h-[400px] rounded-b-lg border-0 bg-zinc-900"
          sandbox={sandboxPermissions}
          referrerPolicy="no-referrer"
        />
      </CardContent>
    </Card>
  )
}
