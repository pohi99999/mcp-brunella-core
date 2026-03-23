# Specifikáció: MCP Tool Discovery & Composability
**Track ID:** `mcp_tool_discovery_20260323`
**Státusz:** active | **Prioritás:** MEDIUM
**Függőség:** observability_opentelemetry_20260323

---

## 1. Jelenlegi Helyzet

| Komponens | Státusz |
|---|---|
| `src/mcp/tools/registerAllTools.ts` | ✅ ~30 agent tool + 12 CF tool, statikus |
| MCP Server (`src/mcp/mcpServer.ts`) | ✅ StdIO + SSE transport |
| Tool permissions | ✅ Alapszintű Safe Zone fájlrendszer |
| **Dynamic discovery** | ❌ Compile-time regisztráció |
| **Tool versioning** | ❌ Nincs semver |
| **Tool composition** | ❌ Nincs chain support |
| **Per-tool metrics** | ❌ Nincs tool-szintű telemetria |

## 2. ToolManifest Interfész

```typescript
// src/core/dynamicToolRegistry.ts
interface ToolManifest {
  id: string;                    // egyedi tool ID
  name: string;                  // MCP tool name
  version: string;               // semver: "1.0.0"
  description: string;
  inputSchema: ZodSchema;        // Zod input validáció
  outputSchema?: ZodSchema;      // Zod output validáció
  publishedBy: string;           // agent name
  tags: string[];                // keresés: ['code', 'git', 'analysis']
  deprecated?: boolean;
  deprecatedMessage?: string;
  timeout?: number;              // ms
  retryConfig?: { maxRetries: number; backoff: 'linear' | 'exponential' };
  composable?: {
    chainable: boolean;          // output használható következő tool inputjaként
    outputType: string;          // szemantikus típus: 'code', 'text', 'json'
  };
}
```

## 3. Dynamic Registry Flow

```
Agent startup:
  agent.registerTools() → DynamicToolRegistry.registerTool(manifest)
                        → MCP Server auto-update (tool lista frissül)
                        → Tool available for all clients

Agent shutdown:
  agent.cleanup() → DynamicToolRegistry.deregisterTool(toolId)
                  → MCP Server remove tool
```

## 4. Tool Composition

```typescript
// Példa: code-analysis chain
const codeReviewChain = composeTools([
  { toolId: 'read-file', version: '^1.0.0' },          // 1. fájl beolvasás
  { toolId: 'analyze-code', version: '^2.0.0' },       // 2. kód analízis
  { toolId: 'generate-review', version: '^1.0.0' },    // 3. review generálás
]);

// Schema kompatibilitás: tool1.output ⊇ tool2.input
```

## 5. Per-Tool Metrikák

```typescript
interface ToolMetrics {
  toolId: string;
  totalCalls: number;
  successCalls: number;
  errorCalls: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  lastUsed: Date;
  lastError?: string;
}
```

## 6. Sikerességi Kritériumok

- [ ] Dynamic tool regisztráció: agent startup → tool elérhető MCP-n
- [ ] Deregisztráció: agent shutdown → tool eltűnik
- [ ] Semver versioning: `tool@^1.0.0` → legújabb kompatibilis
- [ ] Deprecation: warning + fallback tool
- [ ] Tool composition: chain definíció + schema check
- [ ] Per-tool metrikák: call count, latency, error rate
- [ ] Dashboard ToolDiscoveryPanel + CLI `brunella tools`
- [ ] `npm run build && npm test` → 0 hiba
