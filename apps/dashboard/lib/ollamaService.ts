import { OllamaStatus, ChatMessage, AgentTool, ToolCall } from './types'
import { logError } from '../utils/logger.js'

const DEFAULT_OLLAMA_BASE_URL = 'http://localhost:11434'
const DEFAULT_MODEL = 'llama3.2'

export class OllamaService {
  private baseUrl: string
  private model: string

  constructor(baseUrl: string = DEFAULT_OLLAMA_BASE_URL, model: string = DEFAULT_MODEL) {
    this.baseUrl = baseUrl
    this.model = model
  }

  async checkStatus(): Promise<OllamaStatus> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
      })

      if (!response.ok) {
        return {
          isConnected: false,
          model: null,
          lastChecked: new Date().toISOString(),
        }
      }

      const data = await response.json()
      const availableModels = data.models || []
      const modelExists = availableModels.some((m: any) => m.name.includes(this.model))

      return {
        isConnected: true,
        model: modelExists ? this.model : (availableModels[0]?.name || null),
        version: data.version,
        lastChecked: new Date().toISOString(),
      }
    } catch (error) {
      return {
        isConnected: false,
        model: null,
        lastChecked: new Date().toISOString(),
      }
    }
  }

  async *streamChat(
    messages: ChatMessage[],
    enabledTools: AgentTool[],
    onToolCall?: (toolCall: ToolCall) => Promise<string>
  ): AsyncGenerator<string, void, unknown> {
    const ollamaMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      }))

    const systemPrompt = this.buildSystemPrompt(enabledTools)

    const requestBody = {
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...ollamaMessages,
      ],
      stream: true,
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        throw new Error(`Ollama API hiba: ${response.status} ${response.statusText}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('Nem sikerült a válasz stream beolvasása')
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.trim()) {
            try {
              const parsed = JSON.parse(line)
              if (parsed.message?.content) {
                const content = parsed.message.content
                
                const toolMatch = content.match(/\[TOOL:(\w+)\]\((.*?)\)/)
                if (toolMatch && onToolCall) {
                  const [, toolName, paramsJson] = toolMatch
                  const toolCall: ToolCall = {
                    id: `tool-${Date.now()}`,
                    toolName,
                    parameters: JSON.parse(paramsJson),
                    timestamp: new Date().toISOString(),
                  }
                  
                  try {
                    toolCall.result = await onToolCall(toolCall)
                  } catch (error) {
                    toolCall.error = error instanceof Error ? error.message : 'Ismeretlen hiba'
                  }
                  
                  yield `\n**[Tool végrehajtva: ${toolName}]**\n`
                  if (toolCall.result) {
                    yield toolCall.result
                  }
                } else {
                  yield content
                }
              }
            } catch (e) {
              logError('OllamaService', `JSON parse hiba: ${e instanceof Error ? e.message : String(e)}`)
            }
          }
        }
      }
    } catch (error) {
      throw new Error(
        error instanceof Error 
          ? `Ollama kapcsolati hiba: ${error.message}` 
          : 'Ismeretlen Ollama hiba'
      )
    }
  }

  private buildSystemPrompt(enabledTools: AgentTool[]): string {
    let prompt = `Te egy hasznos AI asszisztens vagy az MCP Brunella Core szerver irányítópulthoz. 
Magyar nyelven válaszolj, pontosan és professzionálisan.

A felhasználók kérdéseket tehetnek fel a szerverrel kapcsolatban, és te segíthetsz nekik.`

    if (enabledTools.length > 0) {
      prompt += `\n\nRengetkezésedre álló eszközök (tools):\n\n`
      
      enabledTools.forEach(tool => {
        prompt += `- **${tool.name}**: ${tool.description}\n`
        if (tool.parameters.length > 0) {
          prompt += `  Paraméterek:\n`
          tool.parameters.forEach(param => {
            prompt += `    - ${param.name} (${param.type})${param.required ? ' [kötelező]' : ''}: ${param.description}\n`
          })
        }
      })

      prompt += `\nHa egy tool-t szeretnél használni, használd ezt a formátumot: [TOOL:toolName]({"param1": "value1", "param2": "value2"})`
    }

    return prompt
  }

  setModel(model: string) {
    this.model = model
  }

  setBaseUrl(url: string) {
    this.baseUrl = url
  }
}

export const ollamaService = new OllamaService()

