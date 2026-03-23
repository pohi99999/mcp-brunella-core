# Specifikáció: Sandbox & Security Hardening
**Track ID:** `sandbox_security_hardening_20260323`
**Státusz:** active | **Prioritás:** LOW
**Függőség:** guardrails_evaluation_20260323

---

## 1. Jelenlegi Helyzet

| Komponens | Státusz |
|---|---|
| `src/core/e2bSandbox.ts` | ✅ Python kód futtatás E2B-ben |
| `src/core/securityManager.ts` | ✅ Safe Zone fájlrendszer |
| `src/core/rbac.ts` | ✅ Alapszintű role-based access |
| **WASM sandbox (Node.js)** | ❌ Nincs JS/TS izolálás |
| **Network isolation** | ❌ Sandbox-ból korlátlan hálózat |
| **Per-agent RBAC profil** | ❌ Legtöbb agent nincs korlátozva |
| **Resource quotas** | ❌ Nincs CPU/memory limit |

## 2. WASM Sandbox Architektúra

```
Agent.executeCode(code)
    │
    ├── Language detection (JS/TS/Python)
    │
    ├── JS/TS → WASM Sandbox (V8 Isolate vagy Extism)
    │   ├── Memory limit: 128MB default
    │   ├── CPU limit: 5s default
    │   ├── No network access
    │   └── No filesystem access (in-memory only)
    │
    └── Python → E2B Sandbox (meglévő)
        ├── Network: whitelist policy
        └── File: Safe Zone only
```

**Technológia választás:**

| Opció | Előny | Hátrány |
|---|---|---|
| **Extism (WASM)** | Könnyű integrálás, plugin rendszer | Limitált JS support |
| **V8 Isolate** | Natív JS, gyors, jó izolálás | Komplexebb setup |
| **isolated-vm** | npm csomag, egyszerű API | Csak V8, nincs WASM |

**Javasolt:** `isolated-vm` npm package — legegyszerűbb integráció, jó izolálás.

## 3. RBAC Permission Model

```typescript
// src/core/rbac/agentPermissions.ts
interface AgentPermissions {
  agentName: string;
  permissions: {
    file_read: string[];      // engedélyezett path-ok (glob)
    file_write: string[];     // engedélyezett írási path-ok
    network: string[];        // engedélyezett domain-ek
    code_exec: boolean;       // kód futtatás engedélyezve
    tools: string[];          // használható MCP tool-ok
    max_tokens_per_call: number;
    max_cost_per_day: number;
  };
  role: 'admin' | 'developer' | 'analyst' | 'readonly';
}

// registry.json bővítés:
{
  "name": "CodeGenerator",
  "permissions": {
    "file_read": ["src/**", "test/**"],
    "file_write": ["src/**"],
    "network": ["api.github.com"],
    "code_exec": true,
    "tools": ["*"],
    "max_tokens_per_call": 8192,
    "max_cost_per_day": 5.0
  }
}
```

## 4. Network Isolation

```yaml
# Sandbox network policy
default: deny
whitelist:
  - "api.github.com"
  - "registry.npmjs.org"
  - "pypi.org"
blacklist:
  - "*.internal"
  - "169.254.*"          # metadata endpoint
  - "localhost"
```

## 5. Sikerességi Kritériumok

- [ ] WASM/isolated-vm sandbox: JS/TS kód izolált futtatás
- [ ] Resource quotas: memory 128MB, CPU 5s default
- [ ] Network isolation: whitelist policy enforcement
- [ ] Per-agent RBAC: registry.json-ban definiált permissions
- [ ] Runtime permission check: tool hívás előtt
- [ ] Permission violation → log + alert (nem silent fail)
- [ ] Dashboard SecurityPanel + CLI `brunella security`
- [ ] `npm run build && npm test` → 0 hiba
