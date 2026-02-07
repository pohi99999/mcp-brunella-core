# Agent Permission System - Implementation Guide

**Implementálva:** 2026-02-07
**Verzió:** 1.0
**Státusz:** ✅ PRODUCTION READY

---

## 🎯 Mi ez?

Az Agent Permission System egy role-based access control (RBAC) rendszer, amely megakadályozza, hogy az AI ügynökök unauthorized műveleteket hajtsanak végre.

### Probléma (RÉGI):
- ❌ Bármelyik agent bármit csinálhatott
- ❌ DeveloperAgent törölhette az `.env` fájlt
- ❌ Researcher agent írhatott kódot
- ❌ Nincs audit trail

### Megoldás (ÚJ):
- ✅ Role-based permissions (DEVELOPER, RESEARCHER, PROJECT_CONDUCTOR, stb.)
- ✅ Path restrictions (allowed/denied glob patterns)
- ✅ Permission checks minden fájl művelet előtt
- ✅ Spec Freeze Protocol - nincs kód spec nélkül
- ✅ Audit logging minden denied műveletről

---

## 📋 Permission Profiles

### 1. DEVELOPER (DeveloperAgent)
```typescript
Permissions:
- READ_FILE ✅
- WRITE_FILE ✅ (csak engedélyezett mappákban)
- RUN_TESTS ✅
- GIT_OPERATIONS ✅

Allowed Paths:
- src/**
- test/**
- build/**

Denied Paths:
- .env (titkos adatok)
- package.json (függőségek)
- conductor/** (projekt menedzsment)

Spec Freeze: ✅ AKTÍV
- NEM írhat kódot amíg nincs jóváhagyott spec
- Check: conductor/tracks/*/spec.md vagy plan.md
```

### 2. RESEARCHER (ResearcherAgent)
```typescript
Permissions:
- READ_FILE ✅
- READ_DIR ✅
- HTTP_REQUEST ✅

Allowed Paths: **/* (mindent olvashat)
Denied Paths: (nincs)

Spec Freeze: ❌ NEM AKTÍV (read-only)
```

### 3. PROJECT_CONDUCTOR (ProjectConductorAgent)
```typescript
Permissions:
- READ_FILE ✅
- WRITE_FILE ✅ (csak dokumentáció)
- READ_DIR ✅
- WRITE_DIR ✅

Allowed Paths:
- conductor/**
- README.md
- CHANGELOG.md
- .ai/**

Denied Paths:
- src/**
- test/**

Spec Freeze: ❌ NEM AKTÍV (nem kódol)
```

### 4. ROBOTKEZ (RobotkezAgent)
```typescript
Permissions:
- BROWSER_CONTROL ✅
- HTTP_REQUEST ✅
- READ_FILE ✅
- WRITE_FILE ✅ (csak data/ mappában)

Allowed Paths:
- data/screenshots/**
- data/scraped/**

Denied Paths:
- src/**
- conductor/**

Spec Freeze: ❌ NEM AKTÍV (automatizálás)
```

### 5. EVALUATOR (EvaluatorAgent)
```typescript
Permissions:
- READ_FILE ✅ (mindent olvashat)
- READ_DIR ✅
- RUN_TESTS ✅
- RUN_COMMAND ✅ (audit célból)

Allowed Paths: **/*
Denied Paths: (nincs)

Spec Freeze: ❌ NEM AKTÍV (audit)
```

---

## 🔒 Spec Freeze Protocol

**Mi ez?**
A Spec Freeze Protocol megakadályozza, hogy az AI ügynökök "hallucinálva kódoljanak" spec vagy terv nélkül.

### Hogyan működik?

```
1. Felhasználó kér egy feature-t
   ↓
2. ProjectConductor létrehoz egy Track-et
   conductor/tracks/my_feature_20260207/
   ↓
3. SpecWriterAgent (tervezett) generál egy spec.md-t
   conductor/tracks/my_feature_20260207/spec.md
   ↓
4. Felhasználó átnézi és jóváhagyja
   meta.json: { "status": "ACTIVE" }
   ↓
5. DeveloperAgent CSAK MOST írhat kódot
   ✅ Spec megvan → Kódolás engedélyezve
```

### Bypass (vészhelyzet esetén)

```bash
# Környezeti változó (globális bypass)
export SKIP_SPEC_CHECK=true

# Vagy .env fájlban
SKIP_SPEC_CHECK=true
```

**FIGYELEM:** Csak sürgősségi bugfixekhez használd!

---

## 🛠️ Használat

### 1. Agent létrehozáskor automatikus

A `globalPermissionManager` automatikusan inicializálódik az agent registry alapján:

```typescript
// src/agents/permissions.ts
const agentProfiles = {
    'Developer': 'DEVELOPER',
    'Researcher': 'RESEARCHER',
    // ...
};
```

### 2. Egyedi permission check

```typescript
import { globalPermissionManager, Permission } from './permissions.js';

// Ellenőrizd van-e joga
if (!globalPermissionManager.hasPermission(agentName, Permission.WRITE_FILE)) {
    throw new Error('Permission denied: Cannot write files');
}

// Ellenőrizd path hozzáférést
if (!globalPermissionManager.canAccessPath(agentName, filePath, 'write')) {
    throw new Error(`Permission denied: Cannot write to ${filePath}`);
}
```

### 3. BaseAgent helper-ek

```typescript
export class MyAgent extends BaseAgent {
    async executeTask(context: AgentContext): Promise<AgentResult> {
        // Permission check
        if (!this.checkPermission(Permission.RUN_COMMAND)) {
            return this.denyOperation('run_command', 'No RUN_COMMAND permission');
        }

        // Path check
        if (!this.canAccessPath('src/critical.ts', 'write')) {
            return this.denyOperation('write file', 'Path denied: src/critical.ts');
        }

        // ... végrehajtás
    }
}
```

---

## 🧪 Tesztelés

### Tesztekben a permission bypass

```typescript
// test/MyAgent.test.ts
import { vi } from 'vitest';

// Mock permission system
vi.mock('../src/agents/permissions.js', () => ({
    globalPermissionManager: {
        canAccessPath: vi.fn(() => true),  // Allow all in tests
        hasPermission: vi.fn(() => true),
        getAgentConfig: vi.fn(() => ({ requiresSpecApproval: false })),
    }
}));

// Bypass spec freeze
beforeEach(() => {
    process.env.SKIP_SPEC_CHECK = 'true';
});
```

### Production tesztek (permission ellenőrzéssel)

```bash
# Teszteld permission denial
npm test test/permissions.test.ts

# Teszteld spec freeze
unset SKIP_SPEC_CHECK
npm test test/spec_freeze.test.ts
```

---

## 📊 Audit Trail

Minden denied művelet logolódik:

```
[ERROR] [PermissionManager] DENIED: Developer attempted write_file - Path denied: .env
[WARN] [Developer] Operation denied: write_file - Path denied: .env
[ERROR] [PermissionManager] DENIED: Researcher attempted delete_file - No DELETE_FILE permission
```

**Jövőbeli integráció:**
- LangSmith tracing
- Dashboard alert
- Slack notification

---

## 🚀 Következő Lépések

### ✅ KÉSZ (Fázis 1 - 2026-02-07)
- [x] Permission rendszer alapjai
- [x] Role profiles (DEVELOPER, RESEARCHER, stb.)
- [x] Path restrictions (glob patterns)
- [x] Spec Freeze Protocol
- [x] BaseAgent integration
- [x] DeveloperAgent permission checks
- [x] Tesztek (68/68 PASS)

### 🔜 TODO (Fázis 2)
- [ ] SpecWriterAgent implementálás
- [ ] Automatikus spec generálás chat-ből
- [ ] Dashboard permission UI
- [ ] LangSmith audit integration
- [ ] Permission violation alerting
- [ ] Custom permission profiles API

### 🎯 TODO (Fázis 3)
- [ ] MCP Tool permission checking
- [ ] Network request rate limiting
- [ ] Database operation quotas
- [ ] Cost tracking (LLM API costs)

---

## 📚 Fájlok

| Fájl | Leírás |
|------|--------|
| `src/agents/permissions.ts` | Permission rendszer core |
| `src/agents/BaseAgent.ts` | Permission helper metódusok |
| `src/agents/DeveloperAgent.ts` | Spec Freeze + Path check implementáció |
| `src/agents/registry.json` | Agent metadata (capabilities, tools) |
| `test/DeveloperAgent.test.ts` | Permission bypass tesztek |

---

## 💡 Best Practices

1. **Ne használj ADMIN profilt** - Csak Orchestrator-nak adj teljes jogot
2. **Ellenőrizd a path-okat** - Használj glob pattern-eket (src/**, test/**)
3. **Spec Freeze kötelező** - Csak emergency fix-ekhez bypass-olj
4. **Audit trail** - Nézd a log-okat rendszeresen
5. **Test coverage** - Írj tesztet minden permission denial-ra

---

**Implementátor:** Claude Code
**Dátum:** 2026-02-07
**Status:** ✅ PRODUCTION

**Használat:**
```bash
# Normal munka (spec freeze aktív)
brunella agent Developer "generate function"

# Emergency fix (bypass spec freeze)
SKIP_SPEC_CHECK=true brunella agent Developer "hotfix bug"

# Permission tesztelés
npm run test test/DeveloperAgent.test.ts
```
