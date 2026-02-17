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
import { useTTS } from '@/hooks/useTTS'
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
  Image as ImageIcon,
  Microphone,
  SpeakerHigh,
  SpeakerSlash
} from '@phosphor-icons/react'
import { formatTimestamp } from '@/lib/mockData'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { hu } from 'date-fns/locale'
import { marked } from 'marked';
import { apiService } from '../../lib/apiService'; // Added apiService import

interface ChatInterfaceProps {
  user: User
  agentTools: AgentTool[]
  onToolExecution?: (toolName: string, params: any) => Promise<string>
}

export function ChatInterface({ user, agentTools, onToolExecution }: ChatInterfaceProps) {
  const { chatMessages, addChatMessage } = useMcpStore()
  const { sendMessage, isConnected } = useMCP()
  const { speak, stop, isSpeaking } = useTTS()
  const [newMessage, setNewMessage] = useState('') // Renamed 'input' to 'newMessage'
  const [isProcessing, setIsProcessing] = useState(false); // Replaced 'isLoading' with 'isProcessing'
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedImage, setSelectedImage] = useState<string | null>(null); // Added for image attachment
  const [isRecording, setIsRecording] = useState(false); // Added for voice recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null); // Added for voice recording
  const audioChunksRef = useRef<Blob[]>([]); // Added for voice recording
  const [selectedProvider, setSelectedProvider] = useState<'github' | 'gemini' | 'ollama' | 'cloudflare'>('github');
  const [selectedModel, setSelectedModel] = useState<string>('gpt-4o');
  
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
    if (!newMessage.trim() && !selectedImage) return // Updated to newMessage and selectedImage

    if (!isConnected) {
      toast.error('Kapcsolati hiba', {
        description: 'Nincs kapcsolat a szerverrel.',
      })
      return
    }

    // Assuming sendMessage can handle both text and image, or we need to adapt it.
    // For now, just sending text. Image handling would require more backend integration.
    sendMessage(newMessage.trim(), undefined, selectedModel, selectedProvider)
    setNewMessage('')
    setSelectedImage(null); // Clear selected image after sending
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
    link.download = `chat - history - ${ new Date().toISOString().split('T')[0] }.json`
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
        return `[${ time }] ${ role }: \n${ msg.content } \n`
      })
      .join('\n---\n\n')

    const dataBlob = new Blob([textContent], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `chat - history - ${ new Date().toISOString().split('T')[0] }.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Added for image attachment (placeholder, actual logic for sending image with message is not fully implemented here)
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' }); // Chrome uses webm
        await handleAudioUpload(audioBlob);
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast.info("Hangfelvétel elindult...");
    } catch (err) {
      console.error("Microphone access initialization failed", err);
      toast.error("Nem sikerült hozzáférni a mikrofonhoz.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      toast.info("Feldolgozás...");
    }
  };

  const handleAudioUpload = async (audioBlob: Blob) => {
    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'recording.webm');

      // We need to bypass the standard API service wrapper for file upload or extend it.
      // Assuming apiService can't handle raw fetch with FormData easily or we want direct control.
      // Since `apiService` is not fully visible, I'll use fetch directly to the Python endpoint
      // BUT we need to route via Node proxy to avoid CORS if ports differ?
      // Actually Python is on 8000, Dashboard on 5173 (client). CORS might be an issue if not set on FastAPI.
      // Let's assume FastAPI allows CORS (it usually does in dev).
      // Or better: use the Node server as proxy if possible.
      // For now, I'll try direct call to Python backend localhost:8000/voice/transcribe.
      // Note: In real prod, this should go through Nginx or similar.
      
      const response = await fetch('http://localhost:8000/voice/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Server error: ${ response.status } `);
      }

      const data = await response.json();
      if (data.status === 'success' && data.text) {
        setNewMessage((prev) => (prev ? prev + ' ' + data.text : data.text));
        toast.success("Hang átírva!");
      } else {
        toast.error("Nem sikerült az átírás.");
      }

    } catch (error) {
      console.error('Audio upload failed:', error);
      toast.error("Hiba a hang feldolgozása közben.");
    } finally {
      setIsProcessing(false);
    }
  };

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
                <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-8 w-8">
                    <Download size={16} />
                    <span className="sr-only">Exportálás</span>
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
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="flex items-center gap-2 min-w-[140px] justify-between h-8">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="h-5 px-1 bg-muted">
                      {selectedProvider === 'github' ? 'GH' : selectedProvider === 'gemini' ? 'G' : selectedProvider === 'cloudflare' ? 'CF' : 'O'}
                    </Badge>
                    <span className="truncate max-w-[100px]">{selectedModel}</span>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[200px]">
                <div className="p-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">GitHub Models</div>
                <DropdownMenuItem onClick={() => { setSelectedProvider('github'); setSelectedModel('gpt-4o'); }}>GPT-4o</DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setSelectedProvider('github'); setSelectedModel('o3-mini'); }}>o3-mini</DropdownMenuItem>
                
                <div className="p-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-t mt-1 pt-2">Gemini</div>
                <DropdownMenuItem onClick={() => { setSelectedProvider('gemini'); setSelectedModel('gemini-2.0-flash'); }}>Gemini 2.0 Flash</DropdownMenuItem>
                
                <div className="p-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-t mt-1 pt-2">Ollama</div>
                <DropdownMenuItem onClick={() => { setSelectedProvider('ollama'); setSelectedModel('llama3.1:8b'); }}>Llama 3.1 8B</DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setSelectedProvider('ollama'); setSelectedModel('qwen2.5-coder:7b'); }}>Qwen 2.5 Coder</DropdownMenuItem>

                <div className="p-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-t mt-1 pt-2">☁️ Cloudflare Edge</div>
                <DropdownMenuItem onClick={() => { setSelectedProvider('cloudflare'); setSelectedModel('@cf/meta/llama-3.1-8b-instruct'); }}>Llama 3.1 8B (Edge)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setSelectedProvider('cloudflare'); setSelectedModel('@cf/mistral/mistral-7b-instruct-v0.1'); }}>Mistral 7B (Edge)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setSelectedProvider('cloudflare'); setSelectedModel('@cf/qwen/qwen1.5-7b-chat-awq'); }}>Qwen 1.5 7B (Edge)</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {currentMessages.length > 0 && (
                <Button variant="outline" size="sm" onClick={handleClearChat} className="h-8">
                  Törlés
                </Button>
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
                      ? `${ format(dateRange.from, "MMM d", { locale: hu }) } - ${ format(dateRange.to, "MMM d", { locale: hu }) } `
                      : `Ettől: ${ format(dateRange.from, "MMM d", { locale: hu }) } `}
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
} `}
                    >
                      <div
                        className={`px-4 py-3 rounded-lg ${
  message.role === 'user'
    ? 'bg-primary text-primary-foreground'
    : 'bg-card border border-border'
} `}
                      >
                        {message.thoughts && (
                          <div className="mb-2 text-xs italic text-muted-foreground border-l-2 border-accent/30 pl-2">
                            {message.thoughts}
                          </div>
                        )}
                        <div 
                          className="text-sm prose dark:prose-invert max-w-none break-words [&>p]:mb-2 [&>ul]:list-disc [&>ul]:pl-4 [&>ol]:list-decimal [&>ol]:pl-4 [&>pre]:bg-muted/50 [&>pre]:p-2 [&>pre]:rounded-md [&>code]:bg-muted/30 [&>code]:rounded [&>code]:px-1"
                          dangerouslySetInnerHTML={{ 
                            __html: typeof marked.parse === 'function' 
                              ? marked.parse(((content) => {
                                  try {
                                    const json = JSON.parse(content);
                                    if (json.content && Array.isArray(json.content) && json.content[0]?.text) return json.content[0].text;
                                    if (json.message) return json.message;
                                    if (typeof json === 'string') return json;
                                    return content;
                                  } catch { return content; }
                                })(message.content)) as string
                              : ((content) => {
                                  try {
                                    const json = JSON.parse(content);
                                    if (json.content && Array.isArray(json.content) && json.content[0]?.text) return json.content[0].text;
                                    if (json.message) return json.message;
                                    return content;
                                  } catch { return content; }
                                })(message.content)
                          }} 
                        />

                        {message.image && (
                          <div className="mt-3 rounded-md overflow-hidden border border-border bg-black/5">
                            <img
                              src={message.image.startsWith('data:') ? message.image : `data:image/png;base64,${message.image}`}
                              alt="Böngésző nézet"
                              className="w-full h-auto max-h-[300px] object-contain cursor-zoom-in transition-transform hover:scale-[1.02]"
                              onClick={() => {
                                const win = window.open();
                                if (win) {
                                  win.document.write(`<img src="${message.image.startsWith('data:') ? message.image : `data:image/png;base64,${message.image}`}" style="max-width:100%">`);
                                }
                              }}
                            />
                          </div>
                        )}

                        {message.isStreaming && (
                          <span className="inline-block w-2 h-4 bg-current animate-pulse ml-1" />
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {formatTimestamp(message.timestamp)}
                        </span>
                        {message.role === 'assistant' && !message.isStreaming && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => speak(message.content)}
                            disabled={isSpeaking}
                          >
                            {isSpeaking ? (
                              <SpeakerSlash size={14} className="mr-1" />
                            ) : (
                              <SpeakerHigh size={14} className="mr-1" />
                            )}
                            Brunella beszél
                          </Button>
                        )}
                      </div>
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

            {isProcessing && currentMessages[currentMessages.length - 1]?.role !== 'assistant' && !hasActiveFilters && (
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

        {/* Recording Indicator */}
        {isRecording && (
            <div className="absolute bottom-[100px] left-0 right-0 flex justify-center items-center gap-2 animate-pulse text-red-500 font-bold bg-background/80 p-2 rounded-t-lg">
                <Circle weight="fill" size={16} />
                Felvétel folyamatban... (Kattints újra a leállításhoz)
            </div>
        )}

        <div className="flex items-end gap-2 bg-background p-2 rounded-lg border border-input focus-within:ring-1 focus-within:ring-ring">
          {/* Image attachment button */}
          <div className="relative">
            <input
              type="file"
              accept="image/*"
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
              onChange={handleImageUpload}
              disabled={isProcessing || isRecording}
            />
            <Button 
              type="button" 
              size="icon" 
              variant={selectedImage ? "default" : "ghost"}
              className="h-10 w-10 shrink-0"
              disabled={isProcessing || isRecording}
            >
              <ImageIcon size={20} weight={selectedImage ? "fill" : "regular"} />
            </Button>
          </div>

          {/* Microphone Button */}
          <Button
            type="button"
            size="icon"
            variant={isRecording ? "destructive" : "ghost"}
            className={`h-10 w-10 shrink-0 transition-all ${isRecording ? "animate-pulse" : ""}`}
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isProcessing}
            title={isRecording ? "Leállítás" : "Hangfelvétel indítása"}
          >
            <Microphone size={20} weight={isRecording ? "fill" : "regular"} />
          </Button>

          <Textarea
            ref={textareaRef}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isRecording ? "Hallgatlak..." : "Írj egy üzenetet vagy utasítást..."}
            className="min-h-[40px] max-h-[200px] border-0 focus-visible:ring-0 resize-none py-2 px-1"
            rows={1}
            disabled={isProcessing || isRecording}
          />
          
          <Button 
            type="submit" 
            size="icon" 
            disabled={(!newMessage.trim() && !selectedImage) || isProcessing || isRecording}
            className="h-10 w-10 shrink-0"
            onClick={handleSend}
          >
            <PaperPlaneRight size={20} weight="fill" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
