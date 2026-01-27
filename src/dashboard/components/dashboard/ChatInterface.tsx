import { useState, useRef, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChatMessage, User, AgentTool, OllamaStatus } from '@/lib/types'
import { useMcpStore } from '@/lib/mcpStore';
import { useMCP } from '@/hooks/useMCP';
import { PlanViewer } from '@/components/PlanViewer';
import { 
  PaperPlaneRight, 
  Robot, 
  User as UserIcon, 
  Warning, 
  Circle, 
  MagnifyingGlass,
  X,
  Download,
  FileText,
  FileJs,
  CalendarBlank,
  Info,
  WarningCircle,
  CheckCircle,
  XCircle,
  Wrench,
  ListChecks
} from '@phosphor-icons/react'
import { formatTimestamp } from '@/lib/mockData'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { hu } from 'date-fns/locale'

interface ChatInterfaceProps {
  user: User
  agentTools: AgentTool[]
  onToolExecution?: (toolName: string, params: any) => Promise<string>
}

export function ChatInterface({ user, agentTools, onToolExecution }: ChatInterfaceProps) {
  const { chatMessages, addChatMessage, currentPlan } = useMcpStore()
  const { sendMessage, isConnected } = useMCP()
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  })
  const [expandedToolMessages, setExpandedToolMessages] = useState<Record<string, boolean>>({})
  const [showPlanEvents, setShowPlanEvents] = useState(true)
  const [expandedPlanSteps, setExpandedPlanSteps] = useState<Record<string, boolean>>({})
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const currentMessages = chatMessages ?? []
  const enabledTools = agentTools.filter(t => t.enabled)

  const filteredMessages = useMemo(() => {
    let filtered = currentMessages
    // ... filtering logic stays same ...
    if (dateRange.from || dateRange.to) {
      filtered = filtered.filter(msg => {
        const msgDate = new Date(msg.timestamp)
        const fromDate = dateRange.from ? new Date(dateRange.from.setHours(0, 0, 0, 0)) : null
        const toDate = dateRange.to ? new Date(dateRange.to.setHours(23, 59, 59, 999)) : null
        
        if (fromDate && toDate) {
          return msgDate >= fromDate && msgDate <= toDate
        } else if (fromDate) {
          return msgDate >= fromDate
        } else if (toDate) {
          return msgDate <= toDate
        }
        return true
      })
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(msg => 
        msg.content.toLowerCase().includes(query) ||
        msg.role.toLowerCase().includes(query)
      )
    }
    
    return filtered
  }, [currentMessages, searchQuery, dateRange])

  const planMessages = useMemo(() => {
    return filteredMessages.filter(msg =>
      msg.role === 'system' &&
      (msg.content.startsWith('🧭') || /^[▶✔✖•]/.test(msg.content))
    )
  }, [filteredMessages])

  const displayMessages = useMemo(() => {
    return filteredMessages.filter(msg =>
      !(msg.role === 'system' && (msg.content.startsWith('🧭') || /^[▶✔✖•]/.test(msg.content)))
    )
  }, [filteredMessages])

  const planSteps = useMemo(() => {
    return currentPlan?.steps ?? []
  }, [currentPlan])

  const getSystemBadge = (content: string) => {
    if (content.startsWith('⚠️')) {
      return { variant: 'destructive' as const, icon: WarningCircle }
    }
    if (content.startsWith('🛠️')) {
      return { variant: 'secondary' as const, icon: Wrench }
    }
    if (content.startsWith('🧭') || /^[▶✔✖•]/.test(content)) {
      return { variant: 'outline' as const, icon: ListChecks }
    }
    return { variant: 'outline' as const, icon: Info }
  }

  const getStepStyles = (status?: string) => {
    switch (status) {
      case 'completed':
        return 'text-success border-success/40'
      case 'failed':
        return 'text-destructive border-destructive/40'
      case 'running':
        return 'text-warning border-warning/40 animate-pulse'
      default:
        return 'text-muted-foreground border-border'
    }
  }

  const getStepIcon = (status?: string) => {
    switch (status) {
      case 'completed':
        return CheckCircle
      case 'failed':
        return XCircle
      case 'running':
        return WarningCircle
      default:
        return Info
    }
  }

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [currentMessages])

  const handleSend = async () => {
    if (!input.trim()) return

    if (!isConnected) {
      toast.error('Kapcsolati hiba', {
        description: 'Nincs kapcsolat a szerverrel.',
      })
      return
    }

    const enabledToolNames = enabledTools.map(tool => tool.name)
    sendMessage(input.trim(), enabledToolNames)
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleClearChat = () => {
    useMcpStore.getState().setChatMessages([])
    setSearchQuery('')
    setDateRange({ from: undefined, to: undefined })
    toast.success('Chat törölve', { description: 'Összes üzenet törölve lett' })
  }

  const clearFilters = () => {
    setSearchQuery('')
    setDateRange({ from: undefined, to: undefined })
    toast.info('Szűrők törölve', { description: 'Minden üzenet látható' })
  }

  const hasActiveFilters = searchQuery || dateRange.from || dateRange.to

  const exportAsJSON = () => {
    const messagesToExport = hasActiveFilters ? filteredMessages : currentMessages
    const dataStr = JSON.stringify(messagesToExport, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `chat-history-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const exportAsText = () => {
    const messagesToExport = hasActiveFilters ? filteredMessages : currentMessages
    const textContent = messagesToExport
      .map(msg => {
        const time = new Date(msg.timestamp).toLocaleString('hu-HU')
        const role = msg.role === 'user' ? 'Felhasználó' : 'AI Asszisztens'
        return `[${time}] ${role}:\n${msg.content}\n`
      })
      .join('\n---\n\n')
    
    const dataBlob = new Blob([textContent], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `chat-history-${new Date().toISOString().split('T')[0]}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const downloadTextFile = (filename: string, content: string, mime: string) => {
    const dataBlob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const getToolPayload = (message: ChatMessage) => {
    const parts = message.content.split('\n')
    if (parts.length < 2) return null
    const payload = parts.slice(1).join('\n').trim()
    return payload.length > 0 ? payload : null
  }

  const downloadToolOutput = (message: ChatMessage, asJson: boolean) => {
    const header = message.content.split('\n')[0] || ''
    const match = header.match(/Tool (?:eredmény|hiba):\s*([^\n]+)/i)
    const toolName = match?.[1]?.trim().replace(/\s+/g, '_') || 'tool-output'
    const date = new Date().toISOString().split('T')[0]
    if (asJson) {
      const payload = getToolPayload(message)
      if (!payload) return
      try {
        const parsed = JSON.parse(payload)
        const filename = `tool-${toolName}-${date}.json`
        downloadTextFile(filename, JSON.stringify(parsed, null, 2), 'application/json')
        return
      } catch {
        // fall back to text
      }
    }
    const filename = `tool-${toolName}-${date}.txt`
    downloadTextFile(filename, message.content, 'text/plain;charset=utf-8')
  }

  const copyToClipboard = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content)
      toast.success('Másolva', { description: 'A tartalom a vágólapra került.' })
    } catch {
      toast.error('Másolási hiba', { description: 'Nem sikerült a vágólapra másolni.' })
    }
  }

  const toggleAllPlanSteps = (expanded: boolean) => {
    if (!currentPlan) return
    const next: Record<string, boolean> = {}
    currentPlan.steps.forEach(step => {
      next[step.id] = expanded
    })
    setExpandedPlanSteps(next)
  }

  const exportPlan = () => {
    if (!currentPlan) return
    const filename = `plan-${new Date().toISOString().split('T')[0]}.json`
    downloadTextFile(filename, JSON.stringify(currentPlan, null, 2), 'application/json')
  }

  return (
    <Card className="h-[calc(100vh-280px)] flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Robot size={24} weight="duotone" className="text-accent" />
              AI Asszisztens Chat
            </CardTitle>
            <CardDescription>
              Beszélgess az AI asszisztenssel a szerver kezeléséhez
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Circle
                size={12}
                weight="fill"
                className={isConnected ? 'text-success animate-pulse-glow' : 'text-destructive'}
              />
              <span className="text-sm text-muted-foreground">
                {isConnected ? `Szerver: Online` : 'Szerver: Offline'}
              </span>
            </div>
            {currentMessages.length > 0 && (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="flex items-center gap-2">
                      <Download size={16} />
                      Exportálás
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={exportAsJSON} className="flex items-center gap-2">
                      <FileJs size={16} />
                      JSON formátum
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={exportAsText} className="flex items-center gap-2">
                      <FileText size={16} />
                      Szöveg formátum
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="outline" size="sm" onClick={handleClearChat}>
                  Törlés
                </Button>
              </>
            )}
          </div>
        </div>
        {currentMessages.length > 0 && (
          <div className="space-y-3 mt-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <MagnifyingGlass 
                  size={18} 
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" 
                />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Keresés az üzenetekben..."
                  className="pl-10 pr-10"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={() => setSearchQuery('')}
                  >
                    <X size={16} />
                  </Button>
                )}
              </div>
              
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={dateRange.from || dateRange.to ? "default" : "outline"}
                    size="default"
                    className="flex items-center gap-2 whitespace-nowrap"
                  >
                    <CalendarBlank size={18} />
                    {dateRange.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, "MMM d", { locale: hu })} -{" "}
                          {format(dateRange.to, "MMM d", { locale: hu })}
                        </>
                      ) : (
                        format(dateRange.from, "MMM d", { locale: hu })
                      )
                    ) : (
                      "Dátum"
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <div className="p-3 space-y-3">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Kezdő dátum</label>
                      <Calendar
                        mode="single"
                        selected={dateRange.from}
                        onSelect={(date) => setDateRange(prev => ({ ...prev, from: date }))}
                        locale={hu}
                        disabled={(date) =>
                          date > new Date() || (dateRange.to ? date > dateRange.to : false)
                        }
                      />
                    </div>
                    {dateRange.from && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Záró dátum</label>
                        <Calendar
                          mode="single"
                          selected={dateRange.to}
                          onSelect={(date) => setDateRange(prev => ({ ...prev, to: date }))}
                          locale={hu}
                          disabled={(date) =>
                            date > new Date() || (dateRange.from ? date < dateRange.from : false)
                          }
                        />
                      </div>
                    )}
                    <div className="flex gap-2 pt-2 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDateRange({ from: undefined, to: undefined })}
                        className="flex-1"
                      >
                        Törlés
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {hasActiveFilters && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground">Aktív szűrők:</span>
                {searchQuery && (
                  <Badge variant="secondary" className="gap-1">
                    Keresés: {searchQuery}
                    <X
                      size={14}
                      className="cursor-pointer hover:text-foreground"
                      onClick={() => setSearchQuery('')}
                    />
                  </Badge>
                )}
                {dateRange.from && (
                  <Badge variant="secondary" className="gap-1">
                    {dateRange.to
                      ? `${format(dateRange.from, "MMM d", { locale: hu })} - ${format(dateRange.to, "MMM d", { locale: hu })}`
                      : `Ettől: ${format(dateRange.from, "MMM d", { locale: hu })}`}
                    <X
                      size={14}
                      className="cursor-pointer hover:text-foreground"
                      onClick={() => setDateRange({ from: undefined, to: undefined })}
                    />
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="h-6 px-2 text-xs"
                >
                  Összes törlése
                </Button>
              </div>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-4 overflow-hidden">
        {!isConnected && (
          <Alert variant="destructive">
            <Warning size={18} />
            <AlertDescription>
              Nincs kapcsolat a szerverrel. Ellenőrizd a futó folyamatokat.
            </AlertDescription>
          </Alert>
        )}

        <ScrollArea className="flex-1 pr-4" ref={scrollRef}>
          <div className="space-y-4">
            {currentPlan && <PlanViewer plan={currentPlan} />}

            {searchQuery && filteredMessages.length === 0 && currentMessages.length > 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                <MagnifyingGlass size={64} className="text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Nincs találat</h3>
                <p className="text-sm text-muted-foreground">
                  A keresési feltételeknek nem felel meg egyetlen üzenet sem
                </p>
              </div>
            ) : filteredMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                <Robot size={64} weight="duotone" className="text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Kezdj el beszélgetni</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  Kérdezz a szerverről, kérj státusz információkat, vagy indíts műveleteket az AI segítségével
                </p>
              </div>
            ) : (
              <>
                {hasActiveFilters && (
                  <div className="flex items-center gap-2 pb-2 border-b border-border">
                    <Badge variant="secondary">
                      {filteredMessages.length} / {currentMessages.length} üzenet
                    </Badge>
                  </div>
                )}
                {planMessages.length > 0 && (
                  <div className="border border-border rounded-lg p-3 bg-muted/30">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium">Plan lépések</div>
                      <div className="flex items-center gap-2">
                        {currentPlan && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleAllPlanSteps(true)}
                            >
                              Összes nyit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleAllPlanSteps(false)}
                            >
                              Összes zár
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={exportPlan}
                            >
                              <Download size={14} className="mr-1" />
                              Export
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowPlanEvents(prev => !prev)}
                        >
                          {showPlanEvents ? 'Elrejt' : 'Mutat'}
                        </Button>
                      </div>
                    </div>
                    {showPlanEvents && (
                      <div className="mt-3 space-y-3">
                        {currentPlan && planSteps.length > 0 ? (
                          <div className="space-y-3">
                            {planSteps.map((step, index) => {
                              const Icon = getStepIcon(step.status)
                              const isExpanded = Boolean(expandedPlanSteps[step.id])
                              return (
                                <div key={step.id} className="flex gap-3">
                                  <div className="flex flex-col items-center">
                                    <div className={`w-6 h-6 rounded-full border flex items-center justify-center ${getStepStyles(step.status)}`}>
                                      <Icon size={14} />
                                    </div>
                                    {index < planSteps.length - 1 && (
                                      <div className="w-px flex-1 bg-border/60 mt-1" />
                                    )}
                                  </div>
                                  <div className="flex-1 text-xs">
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="font-medium text-foreground">
                                        {step.agent} · {step.status}
                                      </div>
                                      {step.result && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() =>
                                            setExpandedPlanSteps(prev => ({
                                              ...prev,
                                              [step.id]: !prev[step.id]
                                            }))
                                          }
                                        >
                                          {isExpanded ? 'Elrejt' : 'Részletek'}
                                        </Button>
                                      )}
                                    </div>
                                    <div className="text-muted-foreground whitespace-pre-wrap">
                                      {step.description}
                                    </div>
                                    {step.status === 'running' && (
                                      <div className="mt-2 flex items-center gap-2 text-warning text-[11px]">
                                        <span className="inline-flex h-2 w-2 rounded-full bg-warning animate-pulse" />
                                        Folyamatban...
                                      </div>
                                    )}
                                    {step.result && (
                                      <div className="mt-1 text-muted-foreground whitespace-pre-wrap">
                                        {isExpanded
                                          ? step.result.toString()
                                          : `${step.result.toString().substring(0, 220)}${step.result.toString().length > 220 ? '…' : ''}`}
                                      </div>
                                    )}
                                    {step.result && (
                                      <div className="mt-2">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => copyToClipboard(step.result?.toString() || '')}
                                        >
                                          Másolás
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {planMessages.map(message => (
                              <div key={message.id} className="text-xs text-muted-foreground whitespace-pre-wrap">
                                {message.content}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {displayMessages.map(message => (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${
                      message.role === 'user' ? 'justify-end' : message.role === 'system' ? 'justify-center' : 'justify-start'
                    }`}
                  >
                    {message.role === 'assistant' && (
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
                          <Robot size={18} className="text-accent" />
                        </div>
                      </div>
                    )}
                    
                    <div
                      className={`flex flex-col gap-1 ${
                        message.role === 'system'
                          ? 'items-center max-w-[90%]'
                          : message.role === 'user'
                            ? 'items-end max-w-[80%]'
                            : 'items-start max-w-[80%]'
                      }`}
                    >
                      <div
                        className={`px-4 py-3 rounded-lg ${
                          message.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : message.role === 'system'
                              ? 'bg-muted/50 border border-dashed border-border text-muted-foreground'
                              : 'bg-card border border-border'
                        }`}
                      >
                        {message.role === 'system' && (
                          <div className="flex items-center gap-2 mb-2">
                            {(() => {
                              const badge = getSystemBadge(message.content)
                              const Icon = badge.icon
                              return (
                                <Badge variant={badge.variant} className="gap-1">
                                  <Icon size={12} />
                                  System
                                </Badge>
                              )
                            })()}
                          </div>
                        )}
                        {message.role === 'system' && (message.content.startsWith('🛠️ Tool eredmény:') || message.content.startsWith('⚠️ Tool hiba:')) ? (
                          <div className="space-y-2">
                            <p className="text-xs whitespace-pre-wrap break-words">
                              {expandedToolMessages[message.id]
                                ? message.content
                                : `${message.content.substring(0, 280)}${message.content.length > 280 ? '…' : ''}`}
                            </p>
                            <div className="flex items-center gap-2">
                              {message.content.length > 280 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    setExpandedToolMessages(prev => ({
                                      ...prev,
                                      [message.id]: !prev[message.id]
                                    }))
                                  }
                                >
                                  {expandedToolMessages[message.id] ? 'Elrejt' : 'Mutat'}
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => downloadToolOutput(message, false)}
                              >
                                <Download size={14} className="mr-1" />
                                TXT
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => downloadToolOutput(message, true)}
                                disabled={!getToolPayload(message)}
                              >
                                <Download size={14} className="mr-1" />
                                JSON
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => copyToClipboard(message.content)}
                              >
                                Másolás
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                        )}
                        {message.isStreaming && (
                          <span className="inline-block w-2 h-4 bg-current animate-pulse ml-1" />
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatTimestamp(message.timestamp)}
                      </span>
                    </div>

                    {message.role === 'user' && (
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                          <UserIcon size={18} className="text-primary" />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}

            {isLoading && currentMessages[currentMessages.length - 1]?.role !== 'assistant' && !hasActiveFilters && (
              <div className="flex gap-3">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
                    <Robot size={18} className="text-accent" />
                  </div>
                </div>
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Írj egy üzenetet... (Enter: küldés, Shift+Enter: új sor)"
            className="resize-none"
            rows={3}
            disabled={!isConnected}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || !isConnected}
            size="icon"
            className="h-auto"
          >
            <PaperPlaneRight size={20} weight="fill" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
