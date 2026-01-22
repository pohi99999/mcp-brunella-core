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
import { useMcpStore } from '@/lib/mcpStore'
import { useMCP } from '@/hooks/useMCP'
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
  CalendarBlank
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
  const { chatMessages, addChatMessage } = useMcpStore()
  const { sendMessage, isConnected } = useMCP()
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  })
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

    sendMessage(input.trim())
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
                {filteredMessages.map(message => (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {message.role === 'assistant' && (
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
                          <Robot size={18} className="text-accent" />
                        </div>
                      </div>
                    )}
                    
                    <div
                      className={`flex flex-col gap-1 max-w-[80%] ${
                        message.role === 'user' ? 'items-end' : 'items-start'
                      }`}
                    >
                      <div
                        className={`px-4 py-3 rounded-lg ${
                          message.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-card border border-border'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
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
