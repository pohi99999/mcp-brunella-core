import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AgentTool, User, AgentToolParameter, ExternalApiConfig } from '@/lib/types'
import { canPerformAction } from '@/lib/auth'
import { externalApiService } from '@/lib/externalApiService'
import { useMcpStore } from '@/lib/mcpStore'
import { generateMockAgentTools } from '@/lib/mockData'
import { Toolbox, Plus, Trash, Info, Lock, Globe, Code, Key, Clock } from '@phosphor-icons/react'
import { toast } from 'sonner'

interface AgentToolsManagerProps {
  tools?: AgentTool[]
  user?: User | null
  onUpdateTools?: (tools: AgentTool[]) => void
}

export function AgentToolsManager({
  tools,
  user,
  onUpdateTools,
}: AgentToolsManagerProps) {
  const storeTools = useMcpStore((state) => state.agentTools)
  const setStoreTools = useMcpStore((state) => state.setAgentTools)
  const fallbackTools = useMemo(() => generateMockAgentTools(), [])
  const effectiveTools = tools ?? (storeTools.length > 0 ? storeTools : fallbackTools)
  const effectiveUser = user ?? {
    id: 'dashboard-admin',
    username: 'admin',
    role: 'admin' as const,
    displayName: 'Dashboard Admin',
    email: 'admin@brunella.local',
    createdAt: new Date(0).toISOString(),
  }
  const updateTools = onUpdateTools ?? setStoreTools
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingTool, setEditingTool] = useState<AgentTool | null>(null)
  const [newTool, setNewTool] = useState<Partial<AgentTool>>({
    name: '',
    description: '',
    enabled: true,
    category: 'custom',
    parameters: [],
  })
  const [apiConfig, setApiConfig] = useState<Partial<ExternalApiConfig>>({
    url: '',
    method: 'GET',
    authType: 'none',
    timeout: 30000,
  })
  const [isTestingApi, setIsTestingApi] = useState(false)

  const canConfigure = canPerformAction(effectiveUser, 'configureAgents')

  const handleToggleTool = (toolId: string) => {
    if (!canConfigure) {
      toast.error('Nincs jogosultság', { description: 'Agent tool-ok konfigurálása csak adminisztrátorok számára elérhető' })
      return
    }

    const updatedTools = effectiveTools.map(tool =>
      tool.id === toolId ? { ...tool, enabled: !tool.enabled } : tool
    )
    updateTools(updatedTools)

    const tool = effectiveTools.find(t => t.id === toolId)
    toast.success(
      `Tool ${tool?.enabled ? 'letiltva' : 'engedélyezve'}`,
      { description: tool?.name }
    )
  }

  const handleAddTool = async () => {
    if (!canConfigure) return

    if (!newTool.name || !newTool.description) {
      toast.error('Hiányos adatok', { description: 'A név és leírás kötelező mezők' })
      return
    }

    if (apiConfig.url) {
      const validation = await externalApiService.validateApiConfig(apiConfig as ExternalApiConfig)
      if (!validation.valid) {
        toast.error('Érvénytelen API konfiguráció', { description: validation.error })
        return
      }
    }

    const tool: AgentTool = {
      id: `tool-${Date.now()}`,
      name: newTool.name,
      description: newTool.description,
      enabled: newTool.enabled ?? true,
      category: newTool.category ?? 'custom',
      parameters: newTool.parameters ?? [],
      createdAt: new Date().toISOString(),
      externalApi: apiConfig.url ? (apiConfig as ExternalApiConfig) : undefined,
    }

    updateTools([...effectiveTools, tool])
    setNewTool({
      name: '',
      description: '',
      enabled: true,
      category: 'custom',
      parameters: [],
    })
    setApiConfig({
      url: '',
      method: 'GET',
      authType: 'none',
      timeout: 30000,
    })
    setIsAddDialogOpen(false)
    toast.success('Tool hozzáadva', { description: tool.name })
  }

  const handleTestApi = async () => {
    if (!apiConfig.url) {
      toast.error('Hiányzó URL', { description: 'Add meg az API endpoint URL-t' })
      return
    }

    const validation = await externalApiService.validateApiConfig(apiConfig as ExternalApiConfig)
    if (!validation.valid) {
      toast.error('Érvénytelen konfiguráció', { description: validation.error })
      return
    }

    setIsTestingApi(true)
    try {
      const testParams: Record<string, any> = {}
      newTool.parameters?.forEach(param => {
        if (param.defaultValue !== undefined) {
          testParams[param.name] = param.defaultValue
        } else if (param.type === 'string') {
          testParams[param.name] = 'test'
        } else if (param.type === 'number') {
          testParams[param.name] = 0
        } else if (param.type === 'boolean') {
          testParams[param.name] = false
        }
      })

      const result = await externalApiService.executeApiCall(
        apiConfig as ExternalApiConfig,
        testParams
      )

      if (result.success) {
        toast.success('API teszt sikeres', {
          description: `Státusz: ${result.statusCode}. Válasz fogadva.`
        })
      } else {
        toast.error('API teszt sikertelen', {
          description: result.error || 'Ismeretlen hiba'
        })
      }
    } catch (error) {
      toast.error('API teszt hiba', {
        description: error instanceof Error ? error.message : 'Ismeretlen hiba'
      })
    } finally {
      setIsTestingApi(false)
    }
  }

  const handleDeleteTool = (toolId: string) => {
    if (!canConfigure) return

    const tool = effectiveTools.find(t => t.id === toolId)
    const updatedTools = effectiveTools.filter(tool => tool.id !== toolId)
    updateTools(updatedTools)
    toast.success('Tool törölve', { description: tool?.name })
  }

  const getCategoryBadgeColor = (category: AgentTool['category']) => {
    const colors = {
      server: 'bg-destructive/20 text-destructive',
      monitoring: 'bg-accent/20 text-accent',
      configuration: 'bg-warning/20 text-warning',
      custom: 'bg-muted text-zinc-500',
    }
    return colors[category]
  }

  const getCategoryLabel = (category: AgentTool['category']) => {
    const labels = {
      server: 'Szerver',
      monitoring: 'Monitoring',
      configuration: 'Konfiguráció',
      custom: 'Egyéni',
    }
    return labels[category]
  }

  return (
    <Card title="Agypiac – Ügynök lista és tool kezelő (Fehér Könyv).">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2" title="Agypiac – Ügynök lista és tool kezelő">
              <Toolbox size={24} weight="duotone" className="text-accent" />
              Agypiac – Agent Tool Kezelő
            </CardTitle>
            <CardDescription>
              AI agent eszközök konfigurálása és kezelése
            </CardDescription>
          </div>
          {canConfigure && (
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus size={18} weight="bold" />
                  Új Tool
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Új Agent Tool Hozzáadása</DialogTitle>
                  <DialogDescription>
                    Adj hozzá egy új eszközt az AI asszisztens számára külső API integrációval
                  </DialogDescription>
                </DialogHeader>
                <Tabs defaultValue="basic" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="basic">Alapbeállítások</TabsTrigger>
                    <TabsTrigger value="api">API Integráció</TabsTrigger>
                  </TabsList>

                  <TabsContent value="basic" className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="tool-name">Tool Név *</Label>
                      <Input
                        id="tool-name"
                        value={newTool.name}
                        onChange={(e) => setNewTool({ ...newTool, name: e.target.value })}
                        placeholder="pl. get_weather"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tool-desc">Leírás *</Label>
                      <Textarea
                        id="tool-desc"
                        value={newTool.description}
                        onChange={(e) => setNewTool({ ...newTool, description: e.target.value })}
                        placeholder="Rövid leírás arról, hogy mit csinál ez a tool"
                        rows={3}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tool-category">Kategória</Label>
                      <Select
                        value={newTool.category}
                        onValueChange={(value) => setNewTool({ ...newTool, category: value as AgentTool['category'] })}
                      >
                        <SelectTrigger id="tool-category">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="server">Szerver</SelectItem>
                          <SelectItem value="monitoring">Monitoring</SelectItem>
                          <SelectItem value="configuration">Konfiguráció</SelectItem>
                          <SelectItem value="custom">Egyéni</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        id="tool-enabled"
                        checked={newTool.enabled}
                        onCheckedChange={(checked) => setNewTool({ ...newTool, enabled: checked })}
                      />
                      <Label htmlFor="tool-enabled">Azonnal engedélyezés</Label>
                    </div>
                  </TabsContent>

                  <TabsContent value="api" className="space-y-4 mt-4">
                    <Alert>
                      <Globe size={18} />
                      <AlertDescription>
                        Külső API-t konfiguráls? Add meg az endpoint részleteit és hitelesítési információkat.
                      </AlertDescription>
                    </Alert>

                    <div className="space-y-2">
                      <Label htmlFor="api-url">API Endpoint URL</Label>
                      <Input
                        id="api-url"
                        value={apiConfig.url}
                        onChange={(e) => setApiConfig({ ...apiConfig, url: e.target.value })}
                        placeholder="https://api.example.com/endpoint"
                      />
                      <p className="text-xs text-zinc-500">
                        Használd a {`{{parameterName}}`} szintaxist paraméterek behelyettesítéséhez
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="api-method">HTTP Metódus</Label>
                        <Select
                          value={apiConfig.method}
                          onValueChange={(value) => setApiConfig({ ...apiConfig, method: value as ExternalApiConfig['method'] })}
                        >
                          <SelectTrigger id="api-method">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="GET">GET</SelectItem>
                            <SelectItem value="POST">POST</SelectItem>
                            <SelectItem value="PUT">PUT</SelectItem>
                            <SelectItem value="DELETE">DELETE</SelectItem>
                            <SelectItem value="PATCH">PATCH</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="api-timeout" className="flex items-center gap-2">
                          <Clock size={16} />
                          Timeout (ms)
                        </Label>
                        <Input
                          id="api-timeout"
                          type="number"
                          value={apiConfig.timeout}
                          onChange={(e) => setApiConfig({ ...apiConfig, timeout: parseInt(e.target.value) })}
                          placeholder="30000"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="api-auth-type" className="flex items-center gap-2">
                        <Key size={16} />
                        Hitelesítés típusa
                      </Label>
                      <Select
                        value={apiConfig.authType}
                        onValueChange={(value) => setApiConfig({ ...apiConfig, authType: value as ExternalApiConfig['authType'] })}
                      >
                        <SelectTrigger id="api-auth-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nincs</SelectItem>
                          <SelectItem value="bearer">Bearer Token</SelectItem>
                          <SelectItem value="apikey">API Key</SelectItem>
                          <SelectItem value="basic">Basic Auth</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {apiConfig.authType !== 'none' && (
                      <div className="space-y-2">
                        <Label htmlFor="api-auth-value">
                          {apiConfig.authType === 'bearer' && 'Bearer Token'}
                          {apiConfig.authType === 'apikey' && 'API Key'}
                          {apiConfig.authType === 'basic' && 'Basic Auth (base64)'}
                        </Label>
                        <Input
                          id="api-auth-value"
                          type="password"
                          value={apiConfig.authValue}
                          onChange={(e) => setApiConfig({ ...apiConfig, authValue: e.target.value })}
                          placeholder="Hitelesítési érték"
                        />
                      </div>
                    )}

                    {apiConfig.method !== 'GET' && (
                      <div className="space-y-2">
                        <Label htmlFor="api-body" className="flex items-center gap-2">
                          <Code size={16} />
                          Request Body Template (JSON)
                        </Label>
                        <Textarea
                          id="api-body"
                          value={apiConfig.bodyTemplate}
                          onChange={(e) => setApiConfig({ ...apiConfig, bodyTemplate: e.target.value })}
                          placeholder='{"key": "{{paramValue}}"}'
                          rows={4}
                          className="font-mono text-sm"
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="api-response-mapping">Response Mapping (opcionális)</Label>
                      <Input
                        id="api-response-mapping"
                        value={apiConfig.responseMapping}
                        onChange={(e) => setApiConfig({ ...apiConfig, responseMapping: e.target.value })}
                        placeholder="data.result"
                      />
                      <p className="text-xs text-zinc-500">
                        Pont-notációval válaszd ki a kívánt mezőt a válaszból
                      </p>
                    </div>

                    <Button
                      onClick={handleTestApi}
                      disabled={!apiConfig.url || isTestingApi}
                      variant="outline"
                      className="w-full"
                    >
                      {isTestingApi ? 'API tesztelése...' : 'API Teszt'}
                    </Button>
                  </TabsContent>
                </Tabs>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Mégse
                  </Button>
                  <Button onClick={handleAddTool}>Hozzáadás</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {!canConfigure && (
          <Alert className="mb-4">
            <Lock size={18} />
            <AlertDescription>
              Agent tool-ok konfigurálása csak adminisztrátorok számára elérhető. Te csak megtekintheted őket.
            </AlertDescription>
          </Alert>
        )}

        <ScrollArea className="h-[500px] pr-4">
          <div className="space-y-3">
            {effectiveTools.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Toolbox size={64} weight="duotone" className="text-zinc-500 mb-4" />
                <h3 className="text-lg font-medium mb-2">Még nincsenek tool-ok</h3>
                <p className="text-sm text-zinc-500">
                  {canConfigure
                    ? 'Adj hozzá új agent tool-okat az AI képességeinek bővítéséhez'
                    : 'Az adminisztrátor még nem adott hozzá agent tool-okat'}
                </p>
              </div>
            ) : (
              effectiveTools.map((tool) => (
                <Card key={tool.id} className="border-border/50">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <h4 className="font-mono font-medium">{tool.name}</h4>
                          <Badge className={getCategoryBadgeColor(tool.category)}>
                            {getCategoryLabel(tool.category)}
                          </Badge>
                          {tool.externalApi && (
                            <Badge variant="outline" className="text-xs">
                              <Globe size={12} className="mr-1" />
                              Külső API
                            </Badge>
                          )}
                          {tool.requiresPermission && (
                            <Badge variant="outline" className="text-xs">
                              <Lock size={12} className="mr-1" />
                              Jogosultság szükséges
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-zinc-500">{tool.description}</p>

                        {tool.externalApi && (
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-zinc-500">API Konfiguráció:</p>
                            <div className="text-xs space-y-0.5">
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="text-xs">
                                  {tool.externalApi.method}
                                </Badge>
                                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                  {tool.externalApi.url.length > 50
                                    ? `${tool.externalApi.url.substring(0, 50)}...`
                                    : tool.externalApi.url}
                                </code>
                              </div>
                              {tool.externalApi.authType && tool.externalApi.authType !== 'none' && (
                                <div className="flex items-center gap-1 text-zinc-500">
                                  <Key size={12} />
                                  <span>
                                    {tool.externalApi.authType === 'bearer' && 'Bearer Token'}
                                    {tool.externalApi.authType === 'apikey' && 'API Key'}
                                    {tool.externalApi.authType === 'basic' && 'Basic Auth'}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {tool.parameters.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-zinc-500">Paraméterek:</p>
                            <div className="space-y-1">
                              {tool.parameters.map((param, idx) => (
                                <div key={idx} className="flex items-start gap-2 text-xs">
                                  <code className="font-mono bg-muted px-1.5 py-0.5 rounded">
                                    {param.name}
                                  </code>
                                  <span className="text-zinc-500">
                                    ({param.type})
                                    {param.required && <span className="text-destructive"> *</span>}
                                    {param.defaultValue !== undefined && (
                                      <span> = {JSON.stringify(param.defaultValue)}</span>
                                    )}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <Switch
                          checked={tool.enabled}
                          onCheckedChange={() => handleToggleTool(tool.id)}
                          disabled={!canConfigure}
                        />
                        {canConfigure && tool.category === 'custom' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteTool(tool.id)}
                          >
                            <Trash size={18} className="text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>

        <Separator className="my-4" />

        <div className="flex items-start gap-2 text-sm text-zinc-500">
          <Info size={18} className="flex-shrink-0 mt-0.5" />
          <div>
            <p>
              Az engedélyezett tool-okat az AI asszisztens használhatja a chat során.
              {canConfigure && ' Külső API integrációval rendelkező tool-ok automatikusan hívják az API endpoint-ot a megadott paraméterekkel.'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
