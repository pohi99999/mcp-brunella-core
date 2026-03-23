import { Ollama } from 'ollama';
import { GoogleGenerativeAI, type FunctionDeclarationsTool } from '@google/generative-ai';
import { Anthropic } from '@anthropic-ai/sdk';
import { logInfo, logError, logWarn } from '../utils/logger.js';
import { aiGateway, type ChatMessage as AIChatMessage } from '../utils/aiGateway.js';
import { type UniversalToolDefinition } from './toolRegistry.js';
import { phoenixEventBus } from './phoenixEventBus.js';
import { wrapWithSpan } from '../utils/otelTracing.js';

/**
 * Bifrost Gateway - Multi-Provider LLM Routing
 *
 * Purpose:
 * - Unified interface for 4 LLM providers (Ollama, Gemini, GitHub Models, Anthropic)
 * - Auto-select best provider based on task type
 * - Fallback mechanism (cloud → Ollama)
 * - Health monitoring & provider availability tracking
 *
 * Usage:
 * ```typescript
 * const gateway = new BifrostGateway();
 * const response = await gateway.generate({
 *   prompt: "Explain quantum computing",
 *   taskType: "general"
 * });
 * ```
 */

export type ProviderType = 'ollama' | 'gemini' | 'github' | 'anthropic' | 'cloudflare';
export type TaskType = 'code' | 'general' | 'reasoning' | 'creative' | 'fast';
export type FallbackReason = 'api_error' | 'timeout' | 'rate_limit' | 'invalid_tool_response' | 'phoenix_recovery';

/** OpenAI-style tool definition (used by DeveloperAgent, EvaluatorAgent, OrchestratorAgent) */
export interface OpenAIToolDefinition {
  type: string;  // 'function' in practice, kept as string for caller compatibility
  function: {
    name: string;
    description: string;
    parameters: {
      type: string;
      properties: Record<string, { type: string; description?: string } | undefined>;
      required?: string[];
    };
  };
}

export interface GenerateOptions {
  prompt: string;
  taskType?: TaskType;
  provider?: ProviderType;  // Force specific provider
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  model?: string;  // Override default model
  tools?: Array<UniversalToolDefinition | OpenAIToolDefinition>;   // Added support for tools
  messages?: any[]; // Added support for message history
  phoenixRecoveryTrigger?: boolean;
}

export interface GenerateResponse {
  success: boolean;
  content?: string;
  toolCalls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>; // Added support for returning tool calls
  provider: ProviderType;
  model: string;
  duration_ms: number;
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
  error?: string;
  fallback_used?: boolean;
  fallback_reason?: FallbackReason;
  fallback_from?: ProviderType;
  phoenix_triggered?: boolean;
}

export interface ProviderHealth {
  provider: ProviderType;
  available: boolean;
  last_check: string;
  response_time_ms?: number;
  error?: string;
}

interface ProviderConfig {
  type: ProviderType;
  enabled: boolean;
  apiKey?: string;
  baseUrl?: string;
  defaultModel: string;
  priority: number;  // 1 = highest
  maxRetries: number;
}

/**
 * Bifrost Gateway - Unified multi-provider LLM interface
 */
export type GatewayMode = 'local-preferred' | 'edge-only' | 'balanced';

export class BifrostGateway {
  private providers: Map<ProviderType, ProviderConfig>;
  private healthStatus: Map<ProviderType, ProviderHealth>;
  private requestCount: Map<ProviderType, number>;
  private lastHealthCheck: number;
  private healthCheckInterval: number;
  private mode: GatewayMode = 'local-preferred';

  // Provider clients
  private ollamaClient?: Ollama;
  private geminiClient?: GoogleGenerativeAI;
  private anthropicClient?: Anthropic;
  // GitHub Models uses Ollama client with custom baseUrl

  constructor() {
    this.providers = new Map();
    this.healthStatus = new Map();
    this.requestCount = new Map();
    this.lastHealthCheck = 0;
    this.healthCheckInterval = 5 * 60 * 1000; // 5 minutes

    this.initializeProviders();
    logInfo('BifrostGateway', 'Initialized with 5 provider adapters (Ollama, Gemini, GitHub, Anthropic, Cloudflare)');
  }

  /**
   * Initialize provider configurations from environment
   */
  private initializeProviders(): void {
    // 1. Ollama (local, always highest priority)
    this.providers.set('ollama', {
      type: 'ollama',
      enabled: true,
      baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
      defaultModel: process.env.OLLAMA_DEFAULT_MODEL || 'mistral:latest',
      priority: 1,
      maxRetries: 2
    });

    // 2. Gemini (Google, fast & reliable)
    const geminiKey = process.env.GEMINI_API_KEY;
    const geminiModel = process.env.GEMINI_MODEL || 'gemini-1.5-pro';
    this.providers.set('gemini', {
      type: 'gemini',
      enabled: !!(geminiKey && geminiKey !== ''),
      apiKey: geminiKey,
      defaultModel: geminiModel,  // Use GEMINI_MODEL from .env
      priority: 2,
      maxRetries: 3
    });

    // 3. GitHub Models (Microsoft-hosted, GPT-4o)
    const githubToken = process.env.GITHUB_PAT || process.env.GITHUB_TOKEN;
    this.providers.set('github', {
      type: 'github',
      enabled: !!(githubToken && githubToken !== ''),
      apiKey: githubToken,
      baseUrl: 'https://models.github.ai/inference',
      defaultModel: process.env.GITHUB_MODELS_DEFAULT_MODEL || process.env.GITHUB_MODEL || 'gpt-4.1',
      priority: 3,
      maxRetries: 3
    });

    // 4. Anthropic (Claude, most capable)
    const anthropicKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
    this.providers.set('anthropic', {
      type: 'anthropic',
      enabled: !!(anthropicKey && anthropicKey !== ''),
      apiKey: anthropicKey,
      defaultModel: process.env.ANTHROPIC_MODEL || process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
      priority: 4,
      maxRetries: 3
    });

    // 5. Cloudflare Workers AI (free inference, no local GPU)
    const cfToken = process.env.CF_API_TOKEN || process.env.CF_TOKEN;
    const cfEnabled = !!(cfToken && process.env.AI_GATEWAY_ENABLED === 'true');
    this.providers.set('cloudflare', {
      type: 'cloudflare',
      enabled: cfEnabled,
      apiKey: cfToken,
      defaultModel: process.env.CF_AI_SMART_MODEL || '@cf/meta/llama-3.3-70b-instruct',
      priority: 2,
      maxRetries: 2
    });

    // Initialize clients for enabled providers
    this.initializeClients();

    // Log enabled providers
    const enabled = Array.from(this.providers.values())
      .filter(p => p.enabled)
      .map(p => p.type);
    logInfo('BifrostGateway', `Enabled providers: ${enabled.join(', ')}`);
  }

  /**
   * Initialize API clients for enabled providers
   */
  private initializeClients(): void {
    const ollamaConfig = this.providers.get('ollama');
    if (ollamaConfig?.enabled) {
      this.ollamaClient = new Ollama({ host: ollamaConfig.baseUrl });
    }

    const geminiConfig = this.providers.get('gemini');
    if (geminiConfig?.enabled && geminiConfig.apiKey) {
      this.geminiClient = new GoogleGenerativeAI(geminiConfig.apiKey);
    }

    const anthropicConfig = this.providers.get('anthropic');
    if (anthropicConfig?.enabled && anthropicConfig.apiKey) {
      this.anthropicClient = new Anthropic({ apiKey: anthropicConfig.apiKey });
    }

    // GitHub Models uses Ollama-compatible API
    // No separate client needed - will use custom Ollama instance
  }

  /**
   * Generate LLM response with auto-provider selection
   */
  async generate(options: GenerateOptions): Promise<GenerateResponse> {
    const startTime = Date.now();

    try {
      // 1. Select provider (manual override or auto-select)
      const selectedProvider = options.provider
        ? options.provider
        : this.autoSelectProvider(options.taskType || 'general');

      logInfo('BifrostGateway', `Selected provider: ${selectedProvider} (task: ${options.taskType || 'general'})`);

      // 2. Attempt generation with selected provider
      const result = await this.generateWithProvider(selectedProvider, options);

      if (result.success) {
        this.recordRequest(selectedProvider);
        return result;
      }

      // 3. Deterministic fallback only for explicit failure categories
      const fallbackReason: FallbackReason | null = options.phoenixRecoveryTrigger
        ? 'phoenix_recovery'
        : this.classifyFallbackReason(result.error);

      if (!fallbackReason) {
        logWarn('BifrostGateway', `${selectedProvider} failed without fallback-eligible reason: ${result.error ?? 'unknown error'}`);
        return {
          ...result,
          success: false,
          fallback_used: false,
          duration_ms: Date.now() - startTime,
        };
      }

      const fallbackCandidates = this.getFallbackCandidates(selectedProvider);
      for (let i = 0; i < fallbackCandidates.length; i += 1) {
        const fallbackProvider = fallbackCandidates[i];
        const fallbackCfg = this.providers.get(fallbackProvider);
        if (!fallbackCfg?.enabled) {
          continue;
        }

        phoenixEventBus.publish('phoenix:failover_triggered', {
          originalAgent: selectedProvider,
          fallbackAgent: fallbackProvider,
          taskInstruction: options.prompt.slice(0, 200),
          attempt: i + 1,
          timestamp: new Date().toISOString(),
        });

        logWarn('BifrostGateway', `${selectedProvider} failed (${fallbackReason}), fallback -> ${fallbackProvider}`);

        const fallbackOptions: GenerateOptions = { ...options };
        if (!options.model || fallbackProvider !== selectedProvider) {
          delete fallbackOptions.model;
        }

        const fallbackStart = Date.now();
        const fallbackResult = await this.generateWithProvider(fallbackProvider, fallbackOptions);
        const executionTimeMs = Date.now() - fallbackStart;

        phoenixEventBus.publish('phoenix:failover_result', {
          originalAgent: selectedProvider,
          fallbackAgent: fallbackProvider,
          taskInstruction: options.prompt.slice(0, 200),
          success: fallbackResult.success,
          error: fallbackResult.error,
          executionTimeMs,
          timestamp: new Date().toISOString(),
        });

        if (fallbackResult.success) {
          phoenixEventBus.publish('phoenix:recovery', {
            type: 'failover',
            agent: fallbackProvider,
            details: `reason=${fallbackReason}; from=${selectedProvider}; to=${fallbackProvider}`,
            timestamp: new Date().toISOString(),
          });

          fallbackResult.fallback_used = true;
          fallbackResult.fallback_reason = fallbackReason;
          fallbackResult.fallback_from = selectedProvider;
          fallbackResult.phoenix_triggered = true;
          this.recordRequest(fallbackProvider);
          return fallbackResult;
        }
      }

      // 4. All providers failed
      return {
        success: false,
        provider: selectedProvider,
        model: 'unknown',
        duration_ms: Date.now() - startTime,
        error: result.error || 'All providers failed',
        fallback_used: false,
        fallback_reason: fallbackReason,
        fallback_from: selectedProvider,
        phoenix_triggered: fallbackReason === 'phoenix_recovery',
      };
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError('BifrostGateway', `Generation failed: ${error}`);
      return {
        success: false,
        provider: 'ollama',
        model: 'unknown',
        duration_ms: Date.now() - startTime,
        error
      };
    }
  }

  /**
   * Auto-select best provider based on task type
   */
  private autoSelectProvider(taskType: TaskType): ProviderType {
    // Deterministic System Brain policy: GitHub GPT-4.1 -> Gemini -> Ollama
    const candidates: ProviderType[] = ['github', 'gemini', 'ollama'];

    // Select first available provider from candidates
    for (const providerType of candidates) {
      const config = this.providers.get(providerType);
      if (config?.enabled) {
        return providerType;
      }
    }

    // Fallback to Ollama (always available)
    return 'ollama';
  }

  private classifyFallbackReason(error?: string): FallbackReason | null {
    const normalized = (error || '').toLowerCase();
    if (!normalized) {
      return null;
    }

    if (/(timeout|timed out|etimedout|aborterror|aborted)/i.test(normalized)) {
      return 'timeout';
    }
    if (/(rate limit|429|quota exceeded|too many requests)/i.test(normalized)) {
      return 'rate_limit';
    }
    if (/(invalid tool|tool.*invalid|tool.*malformed|tool.*schema|tool.*parse)/i.test(normalized)) {
      return 'invalid_tool_response';
    }
    if (/(api error|http|network|fetch failed|socket|service unavailable|bad gateway|provider .* not enabled)/i.test(normalized)) {
      return 'api_error';
    }

    return null;
  }

  private getFallbackCandidates(selectedProvider: ProviderType): ProviderType[] {
    const deterministicChain: ProviderType[] = ['github', 'gemini', 'ollama'];

    const inChainIndex = deterministicChain.indexOf(selectedProvider);
    if (inChainIndex >= 0) {
      return deterministicChain.slice(inChainIndex + 1);
    }

    // Non-core providers (anthropic/cloudflare) always fall back to System Brain chain
    return deterministicChain;
  }

  /**
   * Generate with specific provider
   */
  private async generateWithProvider(
    provider: ProviderType,
    options: GenerateOptions
  ): Promise<GenerateResponse> {
    const model = options.model || this.providers.get(provider)?.defaultModel || 'unknown';

    return wrapWithSpan(
      'bas-bifrost-gateway',
      `bifrost::${provider}`,
      {
        'bas.llm.provider': provider,
        'bas.llm.model': model,
        'bas.llm.task_type': options.taskType || 'general',
      },
      async () => {
        return this._generateWithProviderInner(provider, options);
      },
    );
  }

  private async _generateWithProviderInner(
    provider: ProviderType,
    options: GenerateOptions
  ): Promise<GenerateResponse> {
    const startTime = Date.now();
    const config = this.providers.get(provider);

    if (!config?.enabled) {
      return {
        success: false,
        provider,
        model: 'unknown',
        duration_ms: Date.now() - startTime,
        error: `Provider ${provider} not enabled`
      };
    }

    const model = options.model || config.defaultModel;

    try {
      switch (provider) {
        case 'ollama':
          return await this.generateOllama(model, options, startTime);

        case 'gemini':
          return await this.generateGemini(model, options, startTime);

        case 'github':
          return await this.generateGitHub(model, options, startTime);

        case 'anthropic':
          return await this.generateAnthropic(model, options, startTime);

        case 'cloudflare':
          return await this.generateCloudflare(model, options, startTime);

        default:
          throw new Error(`Unknown provider: ${provider}`);
      }
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError('BifrostGateway', `${provider} generation failed: ${error}`);
      return {
        success: false,
        provider,
        model,
        duration_ms: Date.now() - startTime,
        error
      };
    }
  }

  /**
   * Generate with Ollama (local)
   */
  private async generateOllama(
    model: string,
    options: GenerateOptions,
    startTime: number
  ): Promise<GenerateResponse> {
    if (!this.ollamaClient) {
      throw new Error('Ollama client not initialized');
    }

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
    if (options.messages && options.messages.length > 0) {
      for (const m of options.messages) {
        messages.push({ role: m.role as 'system' | 'user' | 'assistant', content: m.content });
      }
    } else {
      if (options.systemPrompt) {
        messages.push({ role: 'system', content: options.systemPrompt });
      }
      messages.push({ role: 'user', content: options.prompt });
    }

    const response = await this.ollamaClient.chat({
      model,
      messages,
      stream: false,
      options: {
        temperature: options.temperature ?? 0.7,
        num_predict: options.maxTokens ?? 2048
      }
    });

    return {
      success: true,
      content: response.message.content,
      provider: 'ollama',
      model,
      duration_ms: Date.now() - startTime,
      tokens: {
        prompt: response.prompt_eval_count || 0,
        completion: response.eval_count || 0,
        total: (response.prompt_eval_count || 0) + (response.eval_count || 0)
      }
    };
  }

  /**
   * Generate with Gemini (Google)
   */
  private async generateGemini(
    model: string,
    options: GenerateOptions,
    startTime: number
  ): Promise<GenerateResponse> {
    if (!this.geminiClient) {
      throw new Error('Gemini client not initialized');
    }

    const geminiModel = this.geminiClient.getGenerativeModel({ model });

    const geminiTools: FunctionDeclarationsTool[] | undefined = options.tools && options.tools.length > 0
      ? [{ functionDeclarations: options.tools.map((t: UniversalToolDefinition | OpenAIToolDefinition) => {
          // Support both UniversalToolDefinition {name, description, parameters}
          // and OpenAI-style {type:'function', function:{name, description, parameters}}
          const isOpenAI = 'function' in t;
          return {
            name: isOpenAI ? (t as OpenAIToolDefinition).function.name : (t as UniversalToolDefinition).name,
            description: isOpenAI ? (t as OpenAIToolDefinition).function.description : (t as UniversalToolDefinition).description,
            parameters: (isOpenAI ? (t as OpenAIToolDefinition).function.parameters : (t as UniversalToolDefinition).parameters) as unknown as import('@google/generative-ai').FunctionDeclarationSchema
          };
        }) }]
      : undefined;

    const result = await geminiModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: options.prompt }] }],
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens ?? 2048
      },
      systemInstruction: options.systemPrompt,
      ...(geminiTools && { tools: geminiTools })
    });

    const candidate = result.response.candidates?.[0];
    const functionCallPart = candidate?.content?.parts?.find(
      (p: unknown) => (p as { functionCall?: unknown }).functionCall
    ) as { functionCall?: { name: string; args?: Record<string, unknown> } } | undefined;
    const toolCalls = functionCallPart?.functionCall
      ? [{
          id: `gemini_${Date.now()}`,
          type: 'function' as const,
          function: {
            name: functionCallPart.functionCall.name,
            arguments: JSON.stringify(functionCallPart.functionCall.args || {})
          }
        }]
      : undefined;

    let content = '';
    try { content = result.response.text(); } catch { /* tool call only response, no text part */ }

    return {
      success: true,
      content,
      toolCalls,
      provider: 'gemini',
      model,
      duration_ms: Date.now() - startTime,
      tokens: {
        prompt: result.response.usageMetadata?.promptTokenCount || 0,
        completion: result.response.usageMetadata?.candidatesTokenCount || 0,
        total: result.response.usageMetadata?.totalTokenCount || 0
      }
    };
  }

  /**
   * Generate with GitHub Models (Azure OpenAI)
   */
  private async generateGitHub(
    model: string,
    options: GenerateOptions,
    startTime: number
  ): Promise<GenerateResponse> {
    const config = this.providers.get('github');
    if (!config?.apiKey || !config.baseUrl) {
      throw new Error('GitHub Models not configured');
    }

    let messages = options.messages || [];
    if (messages.length === 0) {
      if (options.systemPrompt) {
        messages.push({ role: 'system', content: options.systemPrompt });
      }
      messages.push({ role: 'user', content: options.prompt });
    }

    // GitHub Models API requires openai/ prefix for model names
    const resolvedModel = model.includes('/') ? model : `openai/${model}`;

    const payload: any = {
      model: resolvedModel,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048,
    };

    if (options.tools && options.tools.length > 0) {
      // Transform UniversalToolDefinition → OpenAI function tool format
      payload.tools = options.tools.map((t: UniversalToolDefinition | OpenAIToolDefinition) => {
        if ('function' in t) return t; // already OpenAI format
        const u = t as UniversalToolDefinition;
        return { type: 'function', function: { name: u.name, description: u.description, parameters: u.parameters } };
      });
      payload.tool_choice = 'auto';
    }

    // GitHub Models API is OpenAI-compatible
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GitHub API error (${response.status}): ${errorText}`);
    }

    const data = await response.json() as any;
    const choice = data.choices?.[0];
    const content = choice?.message?.content || "";
    const toolCalls = choice?.message?.tool_calls || undefined;

    return {
      success: true,
      content,
      toolCalls,
      provider: 'github',
      model,
      duration_ms: Date.now() - startTime,
      tokens: {
        prompt: data.usage?.prompt_tokens || 0,
        completion: data.usage?.completion_tokens || 0,
        total: data.usage?.total_tokens || 0
      }
    };
  }

  /**
   * Generate with Anthropic (Claude)
   */
  private async generateAnthropic(
    model: string,
    options: GenerateOptions,
    startTime: number
  ): Promise<GenerateResponse> {
    if (!this.anthropicClient) {
      throw new Error('Anthropic client not initialized');
    }

    // Build Anthropic tool definitions if provided
    const anthropicTools = options.tools && options.tools.length > 0
      ? options.tools.map((t: UniversalToolDefinition | OpenAIToolDefinition) => {
          const isOpenAI = 'function' in t;
          const name = isOpenAI ? (t as OpenAIToolDefinition).function.name : (t as UniversalToolDefinition).name;
          const description = isOpenAI ? (t as OpenAIToolDefinition).function.description : (t as UniversalToolDefinition).description;
          const inputSchema = isOpenAI ? (t as OpenAIToolDefinition).function.parameters : (t as UniversalToolDefinition).parameters;
          return { name, description, input_schema: inputSchema as Record<string, unknown> };
        })
      : undefined;

    const response = await this.anthropicClient.messages.create({
      model,
      max_tokens: options.maxTokens ?? 2048,
      temperature: options.temperature ?? 0.7,
      system: options.systemPrompt,
      messages: [
        { role: 'user', content: options.prompt }
      ],
      ...(anthropicTools && { tools: anthropicTools as Parameters<typeof this.anthropicClient.messages.create>[0]['tools'] })
    });

    const textContent = response.content
      .filter((block: { type: string }) => block.type === 'text')
      .map((block: { type: string; text?: string }) => block.text || '')
      .join('\n');

    // Extract tool_use blocks
    const toolCalls = response.content
      .filter((block: { type: string }) => block.type === 'tool_use')
      .map((block: { type: string; id?: string; name?: string; input?: unknown }) => ({
        id: block.id ?? `anthropic_${Date.now()}`,
        type: 'function' as const,
        function: {
          name: block.name ?? '',
          arguments: JSON.stringify(block.input ?? {})
        }
      }));

    return {
      success: true,
      content: textContent,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      provider: 'anthropic',
      model,
      duration_ms: Date.now() - startTime,
      tokens: {
        prompt: response.usage.input_tokens,
        completion: response.usage.output_tokens,
        total: response.usage.input_tokens + response.usage.output_tokens
      }
    };
  }

  /**
   * Generate with Cloudflare Workers AI (via aiGateway singleton)
   */
  private async generateCloudflare(
    model: string,
    options: GenerateOptions,
    startTime: number
  ): Promise<GenerateResponse> {
    const messages: AIChatMessage[] = [];
    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: options.prompt });

    const content = await aiGateway.callCFWorkerModel(model, messages, {
      temperature: options.temperature,
      maxTokens: options.maxTokens
    });

    return {
      success: true,
      content,
      provider: 'cloudflare',
      model,
      duration_ms: Date.now() - startTime
    };
  }

  /**
   * Check health of all providers
   */
  async checkHealth(): Promise<ProviderHealth[]> {
    const now = Date.now();

    // Skip if recently checked
    if (now - this.lastHealthCheck < this.healthCheckInterval) {
      return Array.from(this.healthStatus.values());
    }

    this.lastHealthCheck = now;
    const healthChecks: Promise<ProviderHealth>[] = [];

    // Check each enabled provider
    for (const [type, config] of this.providers.entries()) {
      if (!config.enabled) continue;

      healthChecks.push(this.checkProviderHealth(type));
    }

    const results = await Promise.allSettled(healthChecks);

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        this.healthStatus.set(result.value.provider, result.value);
      }
    });

    return Array.from(this.healthStatus.values());
  }

  /**
   * Check health of single provider
   */
  private async checkProviderHealth(provider: ProviderType): Promise<ProviderHealth> {
    const startTime = Date.now();

    try {
      const result = await this.generateWithProvider(provider, {
        prompt: 'ping',
        maxTokens: 10
      });

      return {
        provider,
        available: result.success,
        last_check: new Date().toISOString(),
        response_time_ms: Date.now() - startTime,
        error: result.error
      };
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      return {
        provider,
        available: false,
        last_check: new Date().toISOString(),
        error
      };
    }
  }

  /**
   * Record request for usage tracking
   */
  private recordRequest(provider: ProviderType): void {
    const current = this.requestCount.get(provider) || 0;
    this.requestCount.set(provider, current + 1);
  }

  /**
   * Get usage statistics
   */
  getStats(): {
    total_requests: number;
    by_provider: Record<ProviderType, number>;
    enabled_providers: ProviderType[];
  } {
    const enabled = Array.from(this.providers.values())
      .filter(p => p.enabled)
      .map(p => p.type);

    const byProvider: Record<string, number> = {};
    let total = 0;

    for (const [provider, count] of this.requestCount.entries()) {
      byProvider[provider] = count;
      total += count;
    }

    return {
      total_requests: total,
      by_provider: byProvider as Record<ProviderType, number>,
      enabled_providers: enabled
    };
  }

  /**
   * Set the gateway routing mode.
   * - 'local-preferred': Use Ollama first, fall back to cloud providers
   * - 'edge-only': Route all requests to cloud/edge providers (Gemini, GitHub, Cloudflare)
   * - 'balanced': Distribute load across all enabled providers
   */
  setMode(mode: GatewayMode): void {
    this.mode = mode;
    logInfo('BifrostGateway', `Mode changed to: ${mode}`);
  }

  /**
   * Get the current gateway routing mode.
   */
  getMode(): GatewayMode {
    return this.mode;
  }

  /**
   * Get list of enabled providers
   */
  getEnabledProviders(): ProviderType[] {
    return Array.from(this.providers.values())
      .filter(p => p.enabled)
      .map(p => p.type);
  }
}

// Singleton instance
let gatewayInstance: BifrostGateway | null = null;

/**
 * Get singleton BifrostGateway instance
 */
export function getBifrostGateway(): BifrostGateway {
  if (!gatewayInstance) {
    gatewayInstance = new BifrostGateway();
  }
  return gatewayInstance;
}

/**
 * Named singleton export for direct import convenience.
 * Usage: import { bifrostGateway } from './bifrost_gateway.js'
 */
export const bifrostGateway: BifrostGateway = getBifrostGateway();
