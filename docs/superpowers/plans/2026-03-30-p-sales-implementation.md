# P-Sales20260327 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phase 2–5 befejezése: JWT standalone auth, IntakeSurveyAgent, PropertyResearchAgent, StrategyPlannerAgent — dashboard panelek és tesztek minden fázishoz.

**Architecture:** Minden agent `IAgent` interfészt implementál mock adatokkal, production-ready komment jelöléssel. Backend route-ok factory pattern szerint (`createPSalesXxxRoutes()`), regisztrálva `index.ts`-ben. Dashboard panelek `navigation.tsx` Enterprise csoportba kerülnek.

**Tech Stack:** TypeScript ESM, `jose` v6 (JWT), Express 4, React 19 + Radix UI, Vitest + Supertest

---

## Fájl Térkép

**Létrehozandó:**
- `src/server/routes/psales-auth.ts` — JWT login/verify endpoint
- `src/p-sales-standalone/auth/useAuth.ts` — React hook
- `src/p-sales-standalone/auth/AuthProvider.tsx` — Context provider
- `src/p-sales-standalone/auth/LoginPage.tsx` — Login form
- `src/p-sales-standalone/auth/ProtectedRoute.tsx` — Route guard
- `src/p-sales-standalone/tenant.config.ts` — Tenant konfig helyfoglaló
- `src/agents/IntakeSurveyAgent.ts` — Felmérő ügynök
- `src/server/routes/psales-intake.ts` — Intake route
- `src/dashboard/components/dashboard/PSalesIntakePanel.tsx` — Intake panel
- `src/agents/PropertyResearchAgent.ts` — Kutató ügynök
- `src/server/routes/psales-research.ts` — Research route
- `src/dashboard/components/dashboard/PSalesResearchPanel.tsx` — Research panel
- `src/agents/StrategyPlannerAgent.ts` — Stratégia ügynök
- `src/server/routes/psales-strategy.ts` — Strategy route
- `src/dashboard/components/dashboard/PSalesStrategyPanel.tsx` — Strategy panel
- `test/psalesAuth.test.ts`
- `test/intakeSurveyAgent.test.ts`
- `test/propertyResearchAgent.test.ts`
- `test/strategyPlannerAgent.test.ts`

**Módosítandó:**
- `conductor/archive/P-Sales20260327/meta.json` → törölni (move)
- `conductor/tracks/P-Sales20260327/meta.json` → létrehozni (move + update)
- `conductor/tracks.md` — Active listába felvétel
- `src/server/routes/index.ts` — 3 új route regisztrálás
- `src/dashboard/lib/navigation.tsx` — 3 új panel regisztrálás
- `src/p-sales-standalone/App.tsx` — ProtectedRoute wrap

---

## Task 1: Track visszaállítás archívból

**Files:**
- Create: `conductor/tracks/P-Sales20260327/meta.json`
- Delete: `conductor/archive/P-Sales20260327/meta.json`
- Modify: `conductor/tracks.md`

- [ ] **Step 1: Track mappa létrehozása és meta.json átírása**

```bash
mkdir -p conductor/tracks/P-Sales20260327
```

Tartalom (`conductor/tracks/P-Sales20260327/meta.json`):
```json
{
  "trackName": "P-Sales20260327",
  "type": "Platform / Application Development",
  "priority": "HIGH",
  "status": "active",
  "progress": 40,
  "createdAt": "2026-03-27T23:51:21.608Z",
  "updatedAt": "2026-03-30T00:00:00.000Z",
  "goal": "Közös domain-core-ra épülő ingatlan- és iparterület-értékesítési platform létrehozása három szállítási modellel: BAS enterprise dashboard modul, külön telepíthető standalone alkalmazás, és Cloudflare edge/backend megoldások.",
  "phases": [
    { "name": "Phase 0: Architektúra és szállítási modell", "status": "completed" },
    { "name": "Phase 1: Enterprise dashboard integráció", "status": "completed" },
    { "name": "Phase 2: Standalone alkalmazás + auth", "status": "active" },
    { "name": "Phase 3: Intake és felmérő ügynök", "status": "pending" },
    { "name": "Phase 4: Kutató és értékelő ügynök", "status": "pending" },
    { "name": "Phase 5: Stratégia és akcióterv", "status": "pending" },
    { "name": "Phase 6: Értékesítési végrehajtás", "status": "completed" },
    { "name": "Phase 7: Cloudflare opció", "status": "completed" }
  ]
}
```

- [ ] **Step 2: Archive mappa törlése**

```bash
rm -rf conductor/archive/P-Sales20260327
```

- [ ] **Step 3: tracks.md frissítése**

Az `## Aktiv Szalak (Active)` szekcióba add hozzá:
```markdown
- [ ] **P-Sales20260327 — Ingatlan Értékesítési Platform** [HIGH]
  - **ID:** `P-Sales20260327`
  - **Progress:** 40%
  - **Assignee:** Claude + Pohánka Péter
  - Mappa: ./tracks/P-Sales20260327/
```

- [ ] **Step 4: Commit**

```bash
git add conductor/tracks/P-Sales20260327/meta.json conductor/tracks.md
git rm conductor/archive/P-Sales20260327/meta.json
git commit -m "feat(p-sales): restore track from archive, set active 40%"
```

---

## Task 2: JWT Auth Backend

**Files:**
- Create: `src/server/routes/psales-auth.ts`
- Create: `test/psalesAuth.test.ts`
- Modify: `src/server/routes/index.ts`

- [ ] **Step 1: Teszt megírása (TDD — először fail)**

`test/psalesAuth.test.ts`:
```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createPSalesAuthRoutes } from '../src/server/routes/psales-auth.js';

// Tesztfelhasználók beállítása
process.env.PSALES_JWT_SECRET = 'test-secret-32-chars-minimum-ok!!';
process.env.PSALES_TEST_USERS = JSON.stringify([
  { email: 'admin@psales.dev', password: 'admin123', role: 'admin' },
  { email: 'demo@psales.dev', password: 'demo123', role: 'viewer' }
]);

let app: express.Express;

beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use('/api/psales/auth', createPSalesAuthRoutes());
});

describe('PSales Auth — /api/psales/auth', () => {
  it('sikeres login visszaad JWT tokent', async () => {
    const res = await request(app)
      .post('/api/psales/auth/login')
      .send({ email: 'admin@psales.dev', password: 'admin123' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(typeof res.body.token).toBe('string');
    expect(res.body.role).toBe('admin');
  });

  it('hibás jelszó esetén 401-et ad vissza', async () => {
    const res = await request(app)
      .post('/api/psales/auth/login')
      .send({ email: 'admin@psales.dev', password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('ismeretlen email esetén 401-et ad vissza', async () => {
    const res = await request(app)
      .post('/api/psales/auth/login')
      .send({ email: 'noone@psales.dev', password: 'admin123' });

    expect(res.status).toBe(401);
  });

  it('érvényes token verify sikeres', async () => {
    const loginRes = await request(app)
      .post('/api/psales/auth/login')
      .send({ email: 'demo@psales.dev', password: 'demo123' });

    const token = loginRes.body.token;

    const verifyRes = await request(app)
      .post('/api/psales/auth/verify')
      .send({ token });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.valid).toBe(true);
    expect(verifyRes.body.email).toBe('demo@psales.dev');
  });

  it('érvénytelen token verify 401-et ad', async () => {
    const res = await request(app)
      .post('/api/psales/auth/verify')
      .send({ token: 'totally.invalid.token' });

    expect(res.status).toBe(401);
    expect(res.body.valid).toBe(false);
  });

  it('hiányzó body mezők 400-at adnak', async () => {
    const res = await request(app)
      .post('/api/psales/auth/login')
      .send({});

    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Teszt futtatása — ellenőrzés hogy FAIL**

```bash
npx vitest run test/psalesAuth.test.ts
```
Elvárt: FAIL — `Cannot find module '../src/server/routes/psales-auth.js'`

- [ ] **Step 3: Route implementálása**

`src/server/routes/psales-auth.ts`:
```typescript
import { Router } from 'express';
import { SignJWT, jwtVerify } from 'jose';
import { logInfo, logError } from '../../utils/logger.js';

interface TestUser {
  email: string;
  password: string;
  role: string;
}

function getTestUsers(): TestUser[] {
  try {
    return JSON.parse(process.env.PSALES_TEST_USERS ?? '[]') as TestUser[];
  } catch {
    return [];
  }
}

function getSecret(): Uint8Array {
  const secret = process.env.PSALES_JWT_SECRET ?? 'dev-secret-change-in-production';
  return new TextEncoder().encode(secret);
}

export function createPSalesAuthRoutes(): Router {
  const router = Router();

  // POST /login
  router.post('/login', async (req, res) => {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      return res.status(400).json({ error: 'email és password kötelező' });
    }

    const users = getTestUsers();
    const user = users.find(u => u.email === email && u.password === password);

    if (!user) {
      logInfo('PSalesAuth', `Sikertelen bejelentkezés: ${email}`);
      return res.status(401).json({ error: 'Érvénytelen email vagy jelszó' });
    }

    try {
      const token = await new SignJWT({ email: user.email, role: user.role })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('8h')
        .sign(getSecret());

      logInfo('PSalesAuth', `Sikeres bejelentkezés: ${email} (${user.role})`);
      return res.json({ token, email: user.email, role: user.role });
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError('PSalesAuth', `JWT hiba: ${error}`);
      return res.status(500).json({ error: 'Token generálás sikertelen' });
    }
  });

  // POST /verify
  router.post('/verify', async (req, res) => {
    const { token } = req.body as { token?: string };

    if (!token) {
      return res.status(400).json({ error: 'token kötelező', valid: false });
    }

    try {
      const { payload } = await jwtVerify(token, getSecret());
      return res.json({
        valid: true,
        email: payload['email'],
        role: payload['role']
      });
    } catch {
      return res.status(401).json({ valid: false, error: 'Érvénytelen vagy lejárt token' });
    }
  });

  return router;
}
```

- [ ] **Step 4: Teszt futtatása — ellenőrzés hogy PASS**

```bash
npx vitest run test/psalesAuth.test.ts
```
Elvárt: PASS (6 test)

- [ ] **Step 5: Regisztrálás index.ts-ben**

`src/server/routes/index.ts` — a `salesRouter` import mellé:
```typescript
import { createPSalesAuthRoutes } from "./psales-auth.js";
```

A `router.use("/sales", salesRouter);` sor mellé:
```typescript
router.use("/psales/auth", createPSalesAuthRoutes());
```

- [ ] **Step 6: Build ellenőrzés**

```bash
npm run build
```
Elvárt: hibamentes fordítás

- [ ] **Step 7: Commit**

```bash
git add src/server/routes/psales-auth.ts src/server/routes/index.ts test/psalesAuth.test.ts
git commit -m "feat(p-sales): JWT auth backend — login/verify endpoints"
```

---

## Task 3: Standalone Auth Frontend

**Files:**
- Create: `src/p-sales-standalone/tenant.config.ts`
- Create: `src/p-sales-standalone/auth/useAuth.ts`
- Create: `src/p-sales-standalone/auth/AuthProvider.tsx`
- Create: `src/p-sales-standalone/auth/LoginPage.tsx`
- Create: `src/p-sales-standalone/auth/ProtectedRoute.tsx`
- Modify: `src/p-sales-standalone/App.tsx`

- [ ] **Step 1: Tenant konfig helyfoglaló**

`src/p-sales-standalone/tenant.config.ts`:
```typescript
/**
 * P-Sales Tenant Konfiguráció
 * TODO: replace with real tenant configuration (multi-tenant support)
 * TODO: load from environment or remote config API
 */
export interface TenantConfig {
  tenantId: string;
  name: string;
  logoUrl?: string;
  primaryColor?: string;
  authProvider: 'local' | 'clerk' | 'auth0'; // TODO: implement external providers
}

export const defaultTenantConfig: TenantConfig = {
  tenantId: 'default',
  name: 'P-Sales',
  authProvider: 'local', // TODO: switch to 'clerk' or 'auth0' in production
};
```

- [ ] **Step 2: useAuth hook**

`src/p-sales-standalone/auth/useAuth.ts`:
```typescript
import { useContext } from 'react';
import { AuthContext, type AuthContextValue } from './AuthProvider.js';

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
```

- [ ] **Step 3: AuthProvider**

`src/p-sales-standalone/auth/AuthProvider.tsx`:
```typescript
import React, { createContext, useState, useCallback, useEffect } from 'react';

export interface AuthUser {
  email: string;
  role: string;
}

export interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = 'psales_token';
const API_BASE = '/api/psales/auth';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);

  // Token visszaállítás session storage-ból
  useEffect(() => {
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (!token) return;
    fetch(`${API_BASE}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(r => r.json())
      .then((data: { valid: boolean; email?: string; role?: string }) => {
        if (data.valid && data.email && data.role) {
          setUser({ email: data.email, role: data.role });
        } else {
          sessionStorage.removeItem(TOKEN_KEY);
        }
      })
      .catch(() => sessionStorage.removeItem(TOKEN_KEY));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json() as { token?: string; email?: string; role?: string; error?: string };
      if (!res.ok) return { ok: false, error: data.error ?? 'Bejelentkezés sikertelen' };
      sessionStorage.setItem(TOKEN_KEY, data.token!);
      setUser({ email: data.email!, role: data.role! });
      return { ok: true };
    } catch {
      return { ok: false, error: 'Hálózati hiba' };
    }
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: user !== null, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
```

- [ ] **Step 4: LoginPage**

`src/p-sales-standalone/auth/LoginPage.tsx`:
```typescript
import React, { useState } from 'react';
import { Building2 } from 'lucide-react';
import { Button } from '../../dashboard/components/ui/button.js';
import { Card, CardContent, CardHeader, CardTitle } from '../../dashboard/components/ui/card.js';
import { useAuth } from './useAuth.js';

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const result = await login(email, password);
    if (!result.ok) setError(result.error ?? 'Hiba');
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050816]">
      <Card className="w-full max-w-sm border-white/[0.06] bg-white/[0.03] backdrop-blur-xl">
        <CardHeader className="space-y-4 pb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-primary/10 p-2">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <CardTitle className="text-xl font-black text-white">P-Sales</CardTitle>
          </div>
          <p className="text-xs text-zinc-500">
            Tesztkörnyezet — bejelentkezési adatok: admin@psales.dev / admin123
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs text-zinc-400">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-primary/40"
                placeholder="admin@psales.dev"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-400">Jelszó</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-primary/40"
                required
              />
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Bejelentkezés...' : 'Belépés'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 5: ProtectedRoute**

`src/p-sales-standalone/auth/ProtectedRoute.tsx`:
```typescript
import React from 'react';
import { useAuth } from './useAuth.js';
import { LoginPage } from './LoginPage.js';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <LoginPage />;
  return <>{children}</>;
}
```

- [ ] **Step 6: App.tsx wrap ProtectedRoute-tal**

`src/p-sales-standalone/App.tsx` elején add hozzá az importokat:
```typescript
import { AuthProvider } from './auth/AuthProvider.js';
import { ProtectedRoute } from './auth/ProtectedRoute.js';
```

A `return` blokkban wrap a meglévő `<ThemeProvider>` fölé:
```typescript
return (
  <AuthProvider>
    <ProtectedRoute>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
        {/* ... meglévő tartalom változatlan ... */}
      </ThemeProvider>
    </ProtectedRoute>
  </AuthProvider>
);
```

- [ ] **Step 7: Build ellenőrzés**

```bash
npm run build
```
Elvárt: hibamentes fordítás

- [ ] **Step 8: Commit**

```bash
git add src/p-sales-standalone/
git commit -m "feat(p-sales): standalone auth UI — LoginPage, AuthProvider, ProtectedRoute"
```

---

## Task 4: IntakeSurveyAgent + Route + Teszt

**Files:**
- Create: `src/agents/IntakeSurveyAgent.ts`
- Create: `src/server/routes/psales-intake.ts`
- Create: `test/intakeSurveyAgent.test.ts`
- Modify: `src/server/routes/index.ts`

- [ ] **Step 1: Teszt megírása (TDD)**

`test/intakeSurveyAgent.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { IntakeSurveyAgent } from '../src/agents/IntakeSurveyAgent.js';

describe('IntakeSurveyAgent', () => {
  let agent: IntakeSurveyAgent;

  beforeEach(() => { agent = new IntakeSurveyAgent(); });

  it('helyes névvel és képességekkel rendelkezik', () => {
    expect(agent.name).toBe('IntakeSurvey');
    expect(agent.capabilities).toContain('intake_checklist');
    expect(agent.capabilities).toContain('document_survey');
  });

  describe('checklist — kötelező iratok típusonként', () => {
    it('apartment kötelező iratok helyes listát ad vissza', async () => {
      const result = await agent.execute('checklist', { propertyType: 'apartment' });
      expect(result.status).toBe('success');
      expect(result.data.required).toBeInstanceOf(Array);
      expect(result.data.required.length).toBeGreaterThan(0);
      expect(result.data.propertyType).toBe('apartment');
    });

    it('house kötelező iratok helyes listát ad vissza', async () => {
      const result = await agent.execute('checklist', { propertyType: 'house' });
      expect(result.status).toBe('success');
      expect(result.data.required.length).toBeGreaterThan(0);
    });

    it('industrial kötelező iratok helyes listát ad vissza', async () => {
      const result = await agent.execute('checklist', { propertyType: 'industrial' });
      expect(result.status).toBe('success');
      expect(result.data.required.length).toBeGreaterThan(0);
    });

    it('ismeretlen típus hibát ad vissza', async () => {
      const result = await agent.execute('checklist', { propertyType: 'spaceship' });
      expect(result.status).toBe('error');
    });
  });

  describe('survey — hiánylista és teljességjelző', () => {
    it('0% teljességet mutat ha nincs feltöltött dokumentum', async () => {
      const result = await agent.execute('survey', {
        propertyType: 'apartment',
        uploadedDocs: []
      });
      expect(result.status).toBe('success');
      expect(result.data.completeness).toBe(0);
      expect(result.data.missing.length).toBeGreaterThan(0);
    });

    it('100% teljességet mutat ha minden dokumentum feltöltve', async () => {
      // Először lekérjük a kötelező listát
      const checklistResult = await agent.execute('checklist', { propertyType: 'house' });
      const allDocs = checklistResult.data.required as string[];

      const result = await agent.execute('survey', {
        propertyType: 'house',
        uploadedDocs: allDocs
      });
      expect(result.status).toBe('success');
      expect(result.data.completeness).toBe(100);
      expect(result.data.missing.length).toBe(0);
    });

    it('részleges feltöltés korrekt százalékot számol', async () => {
      const result = await agent.execute('survey', {
        propertyType: 'apartment',
        uploadedDocs: ['tulajdoni lap']
      });
      expect(result.status).toBe('success');
      expect(result.data.completeness).toBeGreaterThan(0);
      expect(result.data.completeness).toBeLessThan(100);
      expect(result.data.missing).toBeInstanceOf(Array);
    });

    it('ismeretlen feladat hibát ad', async () => {
      const result = await agent.execute('ismeretlen_feladat');
      expect(result.status).toBe('error');
    });
  });
});
```

- [ ] **Step 2: Teszt futtatása — ellenőrzés hogy FAIL**

```bash
npx vitest run test/intakeSurveyAgent.test.ts
```
Elvárt: FAIL — `Cannot find module`

- [ ] **Step 3: Agent implementálása**

`src/agents/IntakeSurveyAgent.ts`:
```typescript
import { IAgent, AgentResponse } from './types.js';
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';

// Kötelező iratok ingatlantípusonként
// TODO: replace with dynamic document requirements from property database
const REQUIRED_DOCS: Record<string, string[]> = {
  apartment: [
    'tulajdoni lap',
    'alaprajz',
    'közös képviselői igazolás',
    'energetikai tanúsítvány',
  ],
  house: [
    'tulajdoni lap',
    'helyszínrajz',
    'használatbavételi engedély',
    'közműdokumentumok',
    'energetikai tanúsítvány',
  ],
  industrial: [
    'tulajdoni lap',
    'területrendezési igazolás',
    'környezeti nyilatkozat',
    'műszaki dokumentáció',
    'közlekedési elérhetőség',
    'közműkapcsolódási adatok',
  ],
};

export class IntakeSurveyAgent implements IAgent {
  name = 'IntakeSurvey';
  role = 'Ingatlan Felmérő Ügynök';
  description = 'Dokumentumfeltöltési folyam, hiánylista generálás, teljességjelző ingatlantípus szerint.';
  capabilities = ['intake_checklist', 'document_survey', 'completeness_check'];

  async execute(task: string, context?: unknown): Promise<AgentResponse> {
    setAgentStatus(this.name, 'working', task.slice(0, 50));
    try {
      const ctx = (context ?? {}) as Record<string, unknown>;

      if (task === 'checklist') {
        return this.getChecklist(ctx);
      }
      if (task === 'survey') {
        return this.runSurvey(ctx);
      }

      return { status: 'error', error: `Ismeretlen feladat: "${task}". Próbáld: "checklist" vagy "survey".` };
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError(this.name, error);
      return { status: 'error', error };
    } finally {
      setAgentStatus(this.name, 'idle');
    }
  }

  private getChecklist(ctx: Record<string, unknown>): AgentResponse {
    const propertyType = String(ctx['propertyType'] ?? '').toLowerCase();
    const required = REQUIRED_DOCS[propertyType];

    if (!required) {
      return { status: 'error', error: `Ismeretlen ingatlantípus: "${propertyType}". Érvényes: apartment, house, industrial.` };
    }

    logInfo(this.name, `Kötelező iratok: ${propertyType} (${required.length} db)`);
    return {
      status: 'success',
      data: { propertyType, required },
    };
  }

  private runSurvey(ctx: Record<string, unknown>): AgentResponse {
    const propertyType = String(ctx['propertyType'] ?? '').toLowerCase();
    const uploadedDocs = (ctx['uploadedDocs'] as string[] | undefined) ?? [];
    const required = REQUIRED_DOCS[propertyType];

    if (!required) {
      return { status: 'error', error: `Ismeretlen ingatlantípus: "${propertyType}".` };
    }

    const uploadedLower = uploadedDocs.map(d => d.toLowerCase());
    const missing = required.filter(r => !uploadedLower.includes(r.toLowerCase()));
    const completeness = Math.round(((required.length - missing.length) / required.length) * 100);

    logInfo(this.name, `Felmérés: ${propertyType}, ${completeness}% kész, ${missing.length} hiányzó`);

    return {
      status: 'success',
      data: {
        propertyType,
        required,
        uploadedDocs,
        missing,
        completeness,
        isComplete: missing.length === 0,
      },
    };
  }
}

export default IntakeSurveyAgent;
```

- [ ] **Step 4: Teszt futtatása — ellenőrzés hogy PASS**

```bash
npx vitest run test/intakeSurveyAgent.test.ts
```
Elvárt: PASS (8 test)

- [ ] **Step 5: Route implementálása**

`src/server/routes/psales-intake.ts`:
```typescript
import { Router } from 'express';
import { IntakeSurveyAgent } from '../../agents/IntakeSurveyAgent.js';
import { logError } from '../../utils/logger.js';

const agent = new IntakeSurveyAgent();

export function createPSalesIntakeRoutes(): Router {
  const router = Router();

  // GET /checklist/:type — kötelező iratok listája
  router.get('/checklist/:type', async (req, res) => {
    const result = await agent.execute('checklist', { propertyType: req.params['type'] });
    if (result.status === 'error') return res.status(400).json(result);
    return res.json(result.data);
  });

  // POST /survey — felmérés futtatása
  router.post('/survey', async (req, res) => {
    const { propertyType, uploadedDocs } = req.body as { propertyType?: string; uploadedDocs?: string[] };
    if (!propertyType) return res.status(400).json({ error: 'propertyType kötelező' });

    const result = await agent.execute('survey', { propertyType, uploadedDocs: uploadedDocs ?? [] });
    if (result.status === 'error') return res.status(400).json(result);
    return res.json(result.data);
  });

  return router;
}
```

- [ ] **Step 6: Regisztrálás index.ts-ben**

`src/server/routes/index.ts` importok közé:
```typescript
import { createPSalesIntakeRoutes } from "./psales-intake.js";
```

A psales-auth regisztrálás mellé:
```typescript
router.use("/psales/intake", createPSalesIntakeRoutes());
```

- [ ] **Step 7: Build + teljes teszt**

```bash
npm run build && npx vitest run test/intakeSurveyAgent.test.ts test/psalesAuth.test.ts
```
Elvárt: PASS mind

- [ ] **Step 8: Commit**

```bash
git add src/agents/IntakeSurveyAgent.ts src/server/routes/psales-intake.ts src/server/routes/index.ts test/intakeSurveyAgent.test.ts
git commit -m "feat(p-sales): IntakeSurveyAgent + intake route (Phase 3)"
```

---

## Task 5: PSalesIntakePanel Dashboard

**Files:**
- Create: `src/dashboard/components/dashboard/PSalesIntakePanel.tsx`
- Modify: `src/dashboard/lib/navigation.tsx`

- [ ] **Step 1: Panel implementálása**

`src/dashboard/components/dashboard/PSalesIntakePanel.tsx`:
```typescript
import React, { useState } from 'react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';
import { ClipboardList, CheckCircle2, AlertCircle, Building2 } from 'lucide-react';
import { toast } from 'sonner';

type PropertyType = 'apartment' | 'house' | 'industrial';

interface SurveyResult {
  propertyType: string;
  required: string[];
  uploadedDocs: string[];
  missing: string[];
  completeness: number;
  isComplete: boolean;
}

const TYPE_LABELS: Record<PropertyType, string> = {
  apartment: 'Lakás',
  house: 'Ház',
  industrial: 'Ipari / Üzleti',
};

export function PSalesIntakePanel() {
  const [propertyType, setPropertyType] = useState<PropertyType>('apartment');
  const [uploadedDocs, setUploadedDocs] = useState<string[]>([]);
  const [result, setResult] = useState<SurveyResult | null>(null);
  const [checklist, setChecklist] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const loadChecklist = async (type: PropertyType) => {
    try {
      const res = await fetch(`/api/psales/intake/checklist/${type}`);
      const data = await res.json() as { required: string[] };
      setChecklist(data.required ?? []);
      setUploadedDocs([]);
      setResult(null);
    } catch {
      toast.error('Nem sikerült betölteni a kötelező iratokat.');
    }
  };

  const handleTypeChange = async (type: PropertyType) => {
    setPropertyType(type);
    await loadChecklist(type);
  };

  const toggleDoc = (doc: string) => {
    setUploadedDocs(prev =>
      prev.includes(doc) ? prev.filter(d => d !== doc) : [...prev, doc]
    );
    setResult(null);
  };

  const runSurvey = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/psales/intake/survey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyType, uploadedDocs }),
      });
      const data = await res.json() as SurveyResult;
      setResult(data);
      if (data.isComplete) toast.success('Minden dokumentum feltöltve!');
      else toast.info(`${data.missing.length} dokumentum hiányzik.`);
    } catch {
      toast.error('Felmérés sikertelen.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-white/[0.04] bg-white/[0.03] backdrop-blur-xl">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm text-white">
            <ClipboardList className="h-4 w-4 text-primary" />
            Intake Felmérő — Dokumentumok
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Típus választó */}
          <div className="flex gap-2">
            {(Object.keys(TYPE_LABELS) as PropertyType[]).map(type => (
              <Button
                key={type}
                size="sm"
                variant={propertyType === type ? 'default' : 'outline'}
                className={propertyType === type
                  ? 'bg-primary/20 text-primary border-primary/20'
                  : 'border-white/[0.08] bg-white/[0.04] text-zinc-300'}
                onClick={() => handleTypeChange(type)}
              >
                {TYPE_LABELS[type]}
              </Button>
            ))}
          </div>

          {/* Kötelező iratok togglek */}
          {checklist.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Dokumentumok</p>
              {checklist.map(doc => {
                const uploaded = uploadedDocs.includes(doc);
                return (
                  <button
                    key={doc}
                    onClick={() => toggleDoc(doc)}
                    className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                      uploaded
                        ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                        : 'border-white/[0.06] bg-white/[0.02] text-zinc-400 hover:bg-white/[0.04]'
                    }`}
                  >
                    {uploaded
                      ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                      : <AlertCircle className="h-4 w-4 shrink-0 text-zinc-600" />
                    }
                    {doc}
                  </button>
                );
              })}
            </div>
          )}

          {checklist.length === 0 && (
            <Button
              size="sm"
              variant="outline"
              className="border-white/[0.08] bg-white/[0.04] text-zinc-300"
              onClick={() => loadChecklist(propertyType)}
            >
              <Building2 className="mr-2 h-4 w-4" />
              Iratok betöltése
            </Button>
          )}

          {checklist.length > 0 && (
            <Button
              className="w-full bg-primary/20 text-primary hover:bg-primary/30 border border-primary/20"
              onClick={runSurvey}
              disabled={loading}
            >
              {loading ? 'Felmérés fut...' : 'Felmérés indítása'}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Eredmény */}
      {result && (
        <Card className="border-white/[0.04] bg-white/[0.03] backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-white">Felmérés eredménye</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-zinc-400">
                <span>Teljességjelző</span>
                <span>{result.completeness}%</span>
              </div>
              <Progress value={result.completeness} className="h-2" />
            </div>
            {result.missing.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Hiányzó iratok</p>
                {result.missing.map(doc => (
                  <div key={doc} className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                    <AlertCircle className="h-3 w-3" />
                    {doc}
                  </div>
                ))}
              </div>
            )}
            {result.isComplete && (
              <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
                Minden dokumentum megvan ✓
              </Badge>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 2: navigation.tsx frissítése**

`src/dashboard/lib/navigation.tsx` importok közé:
```typescript
import { PSalesIntakePanel } from "@/components/dashboard/PSalesIntakePanel";
```

A `property-sales` item után:
```typescript
{ id: "psales-intake", label: "P-Sales Intake", icon: ClipboardList, component: <PSalesIntakePanel /> },
```

> Megjegyzés: A `ClipboardList` icon már be kell importálni — add hozzá a lucide-react importhoz ha még nincs.

Az `"Enterprise"` group item listájába add hozzá: `"psales-intake"`.

- [ ] **Step 3: Build ellenőrzés**

```bash
npm run build:ui
```
Elvárt: hibamentes dashboard build

- [ ] **Step 4: Commit**

```bash
git add src/dashboard/components/dashboard/PSalesIntakePanel.tsx src/dashboard/lib/navigation.tsx
git commit -m "feat(p-sales): PSalesIntakePanel dashboard — intake felmérő panel"
```

---

## Task 6: PropertyResearchAgent + Route + Teszt

**Files:**
- Create: `src/agents/PropertyResearchAgent.ts`
- Create: `src/server/routes/psales-research.ts`
- Create: `test/propertyResearchAgent.test.ts`
- Modify: `src/server/routes/index.ts`

- [ ] **Step 1: Teszt megírása (TDD)**

`test/propertyResearchAgent.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { PropertyResearchAgent } from '../src/agents/PropertyResearchAgent.js';

describe('PropertyResearchAgent', () => {
  let agent: PropertyResearchAgent;

  beforeEach(() => { agent = new PropertyResearchAgent(); });

  it('helyes névvel és képességekkel rendelkezik', () => {
    expect(agent.name).toBe('PropertyResearch');
    expect(agent.capabilities).toContain('market_research');
    expect(agent.capabilities).toContain('valuation_range');
  });

  describe('analyze — piacelemzés és értéktartomány', () => {
    it('visszaad értéktartományt apartment típusnál', async () => {
      const result = await agent.execute('analyze', {
        location: 'Budapest',
        propertyType: 'apartment',
        areaSqm: 75,
        askingPrice: 80000
      });

      expect(result.status).toBe('success');
      expect(result.data.valuationRange).toBeDefined();
      expect(result.data.valuationRange.conservative).toBeGreaterThan(0);
      expect(result.data.valuationRange.target).toBeGreaterThanOrEqual(result.data.valuationRange.conservative);
      expect(result.data.valuationRange.quick).toBeLessThan(result.data.valuationRange.conservative);
    });

    it('comparables minimum 3 ingatlant tartalmaz', async () => {
      const result = await agent.execute('analyze', {
        location: 'Debrecen',
        propertyType: 'house',
        areaSqm: 120,
        askingPrice: 150000
      });

      expect(result.status).toBe('success');
      expect(result.data.comparables).toBeInstanceOf(Array);
      expect(result.data.comparables.length).toBeGreaterThanOrEqual(3);
      // Minden comparable-nek van address és priceEur mezője
      for (const comp of result.data.comparables) {
        expect(comp).toHaveProperty('address');
        expect(comp).toHaveProperty('priceEur');
        expect(comp).toHaveProperty('areaSqm');
      }
    });

    it('kockázati jelzések nem üres tömb', async () => {
      const result = await agent.execute('analyze', {
        location: 'Pécs',
        propertyType: 'industrial',
        areaSqm: 500,
        askingPrice: 300000
      });

      expect(result.status).toBe('success');
      expect(result.data.riskFlags).toBeInstanceOf(Array);
      expect(result.data.riskFlags.length).toBeGreaterThan(0);
    });

    it('riport tartalmazza az összes kötelező szekciót', async () => {
      const result = await agent.execute('analyze', {
        location: 'Budapest',
        propertyType: 'apartment',
        areaSqm: 60,
        askingPrice: 70000
      });

      expect(result.status).toBe('success');
      const data = result.data;
      expect(data).toHaveProperty('location');
      expect(data).toHaveProperty('propertyType');
      expect(data).toHaveProperty('valuationRange');
      expect(data).toHaveProperty('comparables');
      expect(data).toHaveProperty('riskFlags');
      expect(data).toHaveProperty('recommendation');
      expect(data).toHaveProperty('generatedAt');
    });

    it('ismeretlen lokáció Budapest fallback-et használ', async () => {
      const result = await agent.execute('analyze', {
        location: '',
        propertyType: 'apartment',
        areaSqm: 50,
        askingPrice: 50000
      });

      expect(result.status).toBe('success');
      expect(result.data.location).toBe('Budapest');
    });

    it('ismeretlen feladat hibát ad', async () => {
      const result = await agent.execute('ismeretlen');
      expect(result.status).toBe('error');
    });
  });
});
```

- [ ] **Step 2: Teszt futtatása — ellenőrzés hogy FAIL**

```bash
npx vitest run test/propertyResearchAgent.test.ts
```
Elvárt: FAIL — `Cannot find module`

- [ ] **Step 3: Agent implementálása**

`src/agents/PropertyResearchAgent.ts`:
```typescript
import { IAgent, AgentResponse } from './types.js';
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';

// Alap EUR/m² értékek típusonként
// TODO: replace with real market data from ResearcherAgent web scraping
const BASE_EUR_SQM: Record<string, number> = {
  apartment: 2200,
  house: 1800,
  industrial: 800,
  other: 1200,
};

const RISK_FLAGS_POOL = [
  'Hiányos vagy ellentmondásos dokumentáció',
  'Jogilag tisztázatlan terhek / korlátozások',
  'Alacsony összehasonlítható tranzakciószám',
  'Piaci volatilitás és hosszú értékesítési ciklus',
  'Közlekedési elérhetőség korlátozott',
  'Energetikai osztályozás elavult',
];

interface Comparable {
  address: string;
  priceEur: number;
  areaSqm: number;
  pricePerSqm: number;
}

interface ValuationRange {
  conservative: number;
  target: number;
  quick: number;
}

interface ResearchReport {
  location: string;
  propertyType: string;
  areaSqm: number;
  askingPrice: number;
  valuationRange: ValuationRange;
  comparables: Comparable[];
  riskFlags: string[];
  recommendation: string;
  generatedAt: string;
}

export class PropertyResearchAgent implements IAgent {
  name = 'PropertyResearch';
  role = 'Ingatlan Kutató és Értékelő Ügynök';
  description = 'Piaci összehasonlítás, értéktartomány és kutatási riport. Mock adatokkal, production-ready interfésszel.';
  capabilities = ['market_research', 'valuation_range', 'comparable_analysis', 'risk_assessment'];

  async execute(task: string, context?: unknown): Promise<AgentResponse> {
    setAgentStatus(this.name, 'working', task.slice(0, 50));
    try {
      const ctx = (context ?? {}) as Record<string, unknown>;

      if (task === 'analyze') {
        return this.analyzeProperty(ctx);
      }

      return { status: 'error', error: `Ismeretlen feladat: "${task}". Próbáld: "analyze".` };
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError(this.name, error);
      return { status: 'error', error };
    } finally {
      setAgentStatus(this.name, 'idle');
    }
  }

  private analyzeProperty(ctx: Record<string, unknown>): AgentResponse {
    const location = String(ctx['location'] || 'Budapest').trim() || 'Budapest';
    const propertyType = String(ctx['propertyType'] || 'other').toLowerCase();
    const areaSqm = Number(ctx['areaSqm'] ?? 0);
    const askingPrice = Number(ctx['askingPrice'] ?? 0);

    const basePerSqm = BASE_EUR_SQM[propertyType] ?? BASE_EUR_SQM['other']!;
    const estimated = areaSqm > 0 ? Math.round(areaSqm * basePerSqm) : askingPrice;

    const valuationRange: ValuationRange = {
      conservative: Math.round(estimated * 0.85),
      target: estimated,
      quick: Math.round(estimated * 0.75),
    };

    // Mock comparables
    // TODO: replace with real comparable data from web scraping / property databases
    const comparables: Comparable[] = Array.from({ length: 5 }, (_, i) => {
      const variation = 0.85 + (i * 0.08);
      const compArea = Math.round(areaSqm * (0.9 + i * 0.05));
      const compPrice = Math.round(estimated * variation);
      return {
        address: `${location}, ${['Béla u.', 'Rózsa u.', 'Kossuth tér', 'Fő utca', 'Petőfi köz'][i]} ${i + 1}.`,
        priceEur: compPrice,
        areaSqm: compArea > 0 ? compArea : 60,
        pricePerSqm: compArea > 0 ? Math.round(compPrice / compArea) : basePerSqm,
      };
    });

    // Véletlenszerű 2-3 kockázati jelzés
    // TODO: replace with real risk assessment based on document analysis
    const shuffled = [...RISK_FLAGS_POOL].sort(() => Math.random() - 0.5);
    const riskFlags = shuffled.slice(0, 2 + Math.floor(Math.random() * 2));

    const discount = estimated > 0 ? (estimated - askingPrice) / estimated : 0;
    let recommendation = 'INVESTIGATE';
    if (discount > 0.2) recommendation = 'BUY';
    else if (discount > 0.05) recommendation = 'HOLD';
    else if (discount < -0.1) recommendation = 'PASS';

    const report: ResearchReport = {
      location,
      propertyType,
      areaSqm,
      askingPrice,
      valuationRange,
      comparables,
      riskFlags,
      recommendation,
      generatedAt: new Date().toISOString(),
    };

    logInfo(this.name, `Elemzés kész: ${location} ${propertyType}, ${recommendation}, ${valuationRange.target.toLocaleString('hu-HU')} EUR`);
    return { status: 'success', data: report };
  }
}

export default PropertyResearchAgent;
```

- [ ] **Step 4: Teszt futtatása — ellenőrzés hogy PASS**

```bash
npx vitest run test/propertyResearchAgent.test.ts
```
Elvárt: PASS (6 test)

- [ ] **Step 5: Route implementálása**

`src/server/routes/psales-research.ts`:
```typescript
import { Router } from 'express';
import { PropertyResearchAgent } from '../../agents/PropertyResearchAgent.js';

const agent = new PropertyResearchAgent();

export function createPSalesResearchRoutes(): Router {
  const router = Router();

  // POST /analyze — piacelemzés és értéktartomány
  router.post('/analyze', async (req, res) => {
    const { location, propertyType, areaSqm, askingPrice } = req.body as {
      location?: string;
      propertyType?: string;
      areaSqm?: number;
      askingPrice?: number;
    };

    if (!propertyType) return res.status(400).json({ error: 'propertyType kötelező' });

    const result = await agent.execute('analyze', { location, propertyType, areaSqm, askingPrice });
    if (result.status === 'error') return res.status(400).json(result);
    return res.json(result.data);
  });

  return router;
}
```

- [ ] **Step 6: Regisztrálás index.ts-ben**

```typescript
import { createPSalesResearchRoutes } from "./psales-research.js";
// ...
router.use("/psales/research", createPSalesResearchRoutes());
```

- [ ] **Step 7: Build + teszt**

```bash
npm run build && npx vitest run test/propertyResearchAgent.test.ts
```
Elvárt: PASS

- [ ] **Step 8: Commit**

```bash
git add src/agents/PropertyResearchAgent.ts src/server/routes/psales-research.ts src/server/routes/index.ts test/propertyResearchAgent.test.ts
git commit -m "feat(p-sales): PropertyResearchAgent + research route (Phase 4)"
```

---

## Task 7: PSalesResearchPanel Dashboard

**Files:**
- Create: `src/dashboard/components/dashboard/PSalesResearchPanel.tsx`
- Modify: `src/dashboard/lib/navigation.tsx`

- [ ] **Step 1: Panel implementálása**

`src/dashboard/components/dashboard/PSalesResearchPanel.tsx`:
```typescript
import React, { useState } from 'react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';
import { Search, TrendingUp, AlertTriangle, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';

type PropertyType = 'apartment' | 'house' | 'industrial' | 'other';

interface ValuationRange { conservative: number; target: number; quick: number; }
interface Comparable { address: string; priceEur: number; areaSqm: number; pricePerSqm: number; }
interface ResearchReport {
  location: string; propertyType: string; areaSqm: number; askingPrice: number;
  valuationRange: ValuationRange; comparables: Comparable[]; riskFlags: string[];
  recommendation: string; generatedAt: string;
}

const RECOMMENDATION_COLORS: Record<string, string> = {
  BUY: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
  HOLD: 'border-yellow-500/20 bg-yellow-500/10 text-yellow-300',
  INVESTIGATE: 'border-blue-500/20 bg-blue-500/10 text-blue-300',
  PASS: 'border-red-500/20 bg-red-500/10 text-red-300',
};

export function PSalesResearchPanel() {
  const [form, setForm] = useState({ location: 'Budapest', propertyType: 'apartment' as PropertyType, areaSqm: 75, askingPrice: 80000 });
  const [report, setReport] = useState<ResearchReport | null>(null);
  const [loading, setLoading] = useState(false);

  const runAnalysis = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/psales/research/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json() as ResearchReport;
      setReport(data);
      toast.success(`Elemzés kész: ${data.recommendation}`);
    } catch {
      toast.error('Elemzés sikertelen.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-white/[0.04] bg-white/[0.03] backdrop-blur-xl">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm text-white">
            <Search className="h-4 w-4 text-primary" />
            Piaci Kutatás és Értékelés
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs text-zinc-400">Lokáció</label>
              <input
                value={form.location}
                onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
                placeholder="Budapest"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-400">Típus</label>
              <select
                value={form.propertyType}
                onChange={e => setForm(f => ({ ...f, propertyType: e.target.value as PropertyType }))}
                className="w-full rounded-lg border border-white/[0.08] bg-[#050816] px-3 py-2 text-sm text-white"
              >
                <option value="apartment">Lakás</option>
                <option value="house">Ház</option>
                <option value="industrial">Ipari</option>
                <option value="other">Egyéb</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-400">Alapterület (m²)</label>
              <input
                type="number"
                value={form.areaSqm}
                onChange={e => setForm(f => ({ ...f, areaSqm: Number(e.target.value) }))}
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-400">Kért ár (EUR)</label>
              <input
                type="number"
                value={form.askingPrice}
                onChange={e => setForm(f => ({ ...f, askingPrice: Number(e.target.value) }))}
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
              />
            </div>
          </div>
          <Button
            className="w-full bg-primary/20 text-primary hover:bg-primary/30 border border-primary/20"
            onClick={runAnalysis}
            disabled={loading}
          >
            <TrendingUp className="mr-2 h-4 w-4" />
            {loading ? 'Elemzés fut...' : 'Elemzés indítása'}
          </Button>
        </CardContent>
      </Card>

      {report && (
        <>
          <Card className="border-white/[0.04] bg-white/[0.03] backdrop-blur-xl">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-sm text-white">
                <span className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" />Értéktartomány</span>
                <Badge className={RECOMMENDATION_COLORS[report.recommendation] ?? ''}>{report.recommendation}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { label: 'Gyorseladási ár', value: report.valuationRange.quick, pct: 75 },
                { label: 'Konzervatív ár', value: report.valuationRange.conservative, pct: 85 },
                { label: 'Célár (piaci)', value: report.valuationRange.target, pct: 100 },
              ].map(({ label, value, pct }) => (
                <div key={label} className="space-y-1">
                  <div className="flex justify-between text-xs text-zinc-400">
                    <span>{label}</span>
                    <span>{value.toLocaleString('hu-HU')} EUR</span>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                </div>
              ))}
            </CardContent>
          </Card>

          {report.riskFlags.length > 0 && (
            <Card className="border-white/[0.04] bg-white/[0.03] backdrop-blur-xl">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm text-white">
                  <AlertTriangle className="h-4 w-4 text-yellow-400" />
                  Kockázati jelzések
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {report.riskFlags.map(flag => (
                  <div key={flag} className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-300">
                    {flag}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: navigation.tsx frissítése**

Import:
```typescript
import { PSalesResearchPanel } from "@/components/dashboard/PSalesResearchPanel";
```

Item (a `psales-intake` után):
```typescript
{ id: "psales-research", label: "P-Sales Kutatás", icon: Search, component: <PSalesResearchPanel /> },
```

`"Enterprise"` group-ba add hozzá: `"psales-research"`.

- [ ] **Step 3: Build ellenőrzés**

```bash
npm run build:ui
```

- [ ] **Step 4: Commit**

```bash
git add src/dashboard/components/dashboard/PSalesResearchPanel.tsx src/dashboard/lib/navigation.tsx
git commit -m "feat(p-sales): PSalesResearchPanel dashboard — piaci kutatás panel"
```

---

## Task 8: StrategyPlannerAgent + Route + Teszt

**Files:**
- Create: `src/agents/StrategyPlannerAgent.ts`
- Create: `src/server/routes/psales-strategy.ts`
- Create: `test/strategyPlannerAgent.test.ts`
- Modify: `src/server/routes/index.ts`

- [ ] **Step 1: Teszt megírása (TDD)**

`test/strategyPlannerAgent.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { StrategyPlannerAgent } from '../src/agents/StrategyPlannerAgent.js';

describe('StrategyPlannerAgent', () => {
  let agent: StrategyPlannerAgent;

  beforeEach(() => { agent = new StrategyPlannerAgent(); });

  it('helyes névvel és képességekkel rendelkezik', () => {
    expect(agent.name).toBe('StrategyPlanner');
    expect(agent.capabilities).toContain('channel_recommendation');
    expect(agent.capabilities).toContain('approval_gate');
  });

  describe('plan — stratégiai terv generálása', () => {
    it('terv generálva pending approval state-tel', async () => {
      const result = await agent.execute('plan', {
        propertyType: 'apartment',
        location: 'Budapest',
        estimatedValue: 100000
      });

      expect(result.status).toBe('success');
      expect(result.data.planId).toBeDefined();
      expect(result.data.approvalState).toBe('pending');
      expect(result.data.channels).toBeInstanceOf(Array);
      expect(result.data.channels.length).toBeGreaterThan(0);
      expect(result.data.targetSegments).toBeInstanceOf(Array);
    });

    it('terv tartalmaz csatornákat prioritással', async () => {
      const result = await agent.execute('plan', {
        propertyType: 'industrial',
        location: 'Győr',
        estimatedValue: 500000
      });

      expect(result.status).toBe('success');
      for (const ch of result.data.channels) {
        expect(ch).toHaveProperty('name');
        expect(ch).toHaveProperty('priority');
        expect(ch).toHaveProperty('description');
      }
    });

    it('riport tartalmazza az összes kötelező szekciót', async () => {
      const result = await agent.execute('plan', {
        propertyType: 'house',
        location: 'Debrecen',
        estimatedValue: 200000
      });

      const data = result.data;
      expect(data).toHaveProperty('planId');
      expect(data).toHaveProperty('approvalState');
      expect(data).toHaveProperty('channels');
      expect(data).toHaveProperty('targetSegments');
      expect(data).toHaveProperty('approvalSteps');
      expect(data).toHaveProperty('summary');
      expect(data).toHaveProperty('generatedAt');
    });
  });

  describe('approve — jóváhagyási kapu', () => {
    it('approve döntés approved state-et ad', async () => {
      const planResult = await agent.execute('plan', {
        propertyType: 'apartment',
        location: 'Budapest',
        estimatedValue: 100000
      });
      const planId = planResult.data.planId as string;

      const approveResult = await agent.execute('approve', {
        planId,
        decision: 'approved'
      });

      expect(approveResult.status).toBe('success');
      expect(approveResult.data.approvalState).toBe('approved');
    });

    it('reject döntés rejected state-et ad', async () => {
      const planResult = await agent.execute('plan', {
        propertyType: 'house',
        location: 'Pécs',
        estimatedValue: 150000
      });
      const planId = planResult.data.planId as string;

      const rejectResult = await agent.execute('approve', {
        planId,
        decision: 'rejected'
      });

      expect(rejectResult.status).toBe('success');
      expect(rejectResult.data.approvalState).toBe('rejected');
    });

    it('ismeretlen planId hibát ad', async () => {
      const result = await agent.execute('approve', {
        planId: 'nonexistent-plan-id',
        decision: 'approved'
      });
      expect(result.status).toBe('error');
    });

    it('ismeretlen feladat hibát ad', async () => {
      const result = await agent.execute('ismeretlen_feladat');
      expect(result.status).toBe('error');
    });
  });
});
```

- [ ] **Step 2: Teszt futtatása — ellenőrzés hogy FAIL**

```bash
npx vitest run test/strategyPlannerAgent.test.ts
```
Elvárt: FAIL — `Cannot find module`

- [ ] **Step 3: Agent implementálása**

`src/agents/StrategyPlannerAgent.ts`:
```typescript
import { IAgent, AgentResponse } from './types.js';
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';
import { randomUUID } from 'crypto';

// TODO: replace with persistent storage (D1/SQLite) when production-ready
const planStore = new Map<string, StrategyPlan>();

interface Channel {
  name: string;
  priority: 'high' | 'medium' | 'low';
  description: string;
}

interface StrategyPlan {
  planId: string;
  propertyType: string;
  location: string;
  estimatedValue: number;
  approvalState: 'pending' | 'approved' | 'rejected';
  channels: Channel[];
  targetSegments: string[];
  approvalSteps: string[];
  summary: string;
  generatedAt: string;
}

// Csatorna mix ingatlantípusonként
// TODO: replace with AI-driven channel recommendation
const CHANNEL_CONFIGS: Record<string, Channel[]> = {
  apartment: [
    { name: 'Ingatlan portál hirdetés', priority: 'high', description: 'ingatlan.com, ingatlanbazar.hu feltöltés' },
    { name: 'Közösségi média kampány', priority: 'medium', description: 'Facebook/Instagram célzott hirdetés' },
    { name: 'Ingatlanközvetítő', priority: 'medium', description: 'Helyi közvetítők bevonása' },
  ],
  house: [
    { name: 'Ingatlan portál hirdetés', priority: 'high', description: 'ingatlan.com, ingatlanbazar.hu feltöltés' },
    { name: 'Teaser kampány befektetőknek', priority: 'high', description: 'Céges befektetői kör megkeresése' },
    { name: 'Ingatlanközvetítő', priority: 'medium', description: 'Helyi közvetítők bevonása' },
  ],
  industrial: [
    { name: 'Direkt outreach döntéshozóknak', priority: 'high', description: 'Ipari / logisztikai vevők megkeresése' },
    { name: 'Teaser kampány befektetőknek', priority: 'high', description: 'Befektetői és fejlesztői kör' },
    { name: 'Szakmai portál hirdetés', priority: 'medium', description: 'Ipari ingatlan portálok' },
  ],
};

const DEFAULT_CHANNELS: Channel[] = [
  { name: 'Ingatlan portál hirdetés', priority: 'high', description: 'Általános portál feltöltés' },
  { name: 'Teaser kampány', priority: 'medium', description: 'Érdeklődői előszűrés' },
];

export class StrategyPlannerAgent implements IAgent {
  name = 'StrategyPlanner';
  role = 'Értékesítési Stratégia Tervező Ügynök';
  description = 'Csatorna mix ajánlás, approval gate, döntéshozói célcsoport lista. Mock adatokkal, production-ready interfésszel.';
  capabilities = ['channel_recommendation', 'approval_gate', 'target_list', 'strategy_report'];

  async execute(task: string, context?: unknown): Promise<AgentResponse> {
    setAgentStatus(this.name, 'working', task.slice(0, 50));
    try {
      const ctx = (context ?? {}) as Record<string, unknown>;

      if (task === 'plan') return this.createPlan(ctx);
      if (task === 'approve') return this.approvePlan(ctx);

      return { status: 'error', error: `Ismeretlen feladat: "${task}". Próbáld: "plan" vagy "approve".` };
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError(this.name, error);
      return { status: 'error', error };
    } finally {
      setAgentStatus(this.name, 'idle');
    }
  }

  private createPlan(ctx: Record<string, unknown>): AgentResponse {
    const propertyType = String(ctx['propertyType'] || 'other').toLowerCase();
    const location = String(ctx['location'] || 'Budapest');
    const estimatedValue = Number(ctx['estimatedValue'] ?? 0);

    const channels = CHANNEL_CONFIGS[propertyType] ?? DEFAULT_CHANNELS;

    const targetSegments = propertyType === 'industrial'
      ? ['Ipari és logisztikai vevők', 'Fejlesztők', 'Befektetők', 'Önkormányzati szereplők']
      : ['Magánszemély vevők', 'Befektetők', 'Portálon aktív keresők', 'Helyi közvetítők'];

    const plan: StrategyPlan = {
      planId: randomUUID(),
      propertyType,
      location,
      estimatedValue,
      approvalState: 'pending',
      channels,
      targetSegments,
      approvalSteps: [
        'Stratégiai ajánlás áttekintése',
        'Csatorna mix jóváhagyása',
        'Első végrehajtási lépés engedélyezése',
      ],
      summary: `${location}-i ${propertyType} ingatlan értékesítési stratégiája. ` +
        `Becsült érték: ${estimatedValue.toLocaleString('hu-HU')} EUR. ` +
        `Javasolt csatornák: ${channels.map(c => c.name).join(', ')}.`,
      generatedAt: new Date().toISOString(),
    };

    planStore.set(plan.planId, plan);
    logInfo(this.name, `Terv kész: ${plan.planId} (${propertyType}, ${location})`);

    return { status: 'success', data: plan };
  }

  private approvePlan(ctx: Record<string, unknown>): AgentResponse {
    const planId = String(ctx['planId'] ?? '');
    const decision = String(ctx['decision'] ?? '');

    const plan = planStore.get(planId);
    if (!plan) {
      return { status: 'error', error: `Terv nem található: "${planId}"` };
    }

    if (decision === 'approved') {
      plan.approvalState = 'approved';
    } else if (decision === 'rejected') {
      plan.approvalState = 'rejected';
    } else {
      return { status: 'error', error: `Érvénytelen döntés: "${decision}". Érvényes: approved, rejected.` };
    }

    logInfo(this.name, `Terv ${decision}: ${planId}`);
    return { status: 'success', data: { ...plan } };
  }
}

export default StrategyPlannerAgent;
```

- [ ] **Step 4: Teszt futtatása — ellenőrzés hogy PASS**

```bash
npx vitest run test/strategyPlannerAgent.test.ts
```
Elvárt: PASS (8 test)

- [ ] **Step 5: Route implementálása**

`src/server/routes/psales-strategy.ts`:
```typescript
import { Router } from 'express';
import { StrategyPlannerAgent } from '../../agents/StrategyPlannerAgent.js';

const agent = new StrategyPlannerAgent();

export function createPSalesStrategyRoutes(): Router {
  const router = Router();

  // POST /plan — stratégia generálás
  router.post('/plan', async (req, res) => {
    const { propertyType, location, estimatedValue } = req.body as {
      propertyType?: string;
      location?: string;
      estimatedValue?: number;
    };
    if (!propertyType) return res.status(400).json({ error: 'propertyType kötelező' });

    const result = await agent.execute('plan', { propertyType, location, estimatedValue });
    if (result.status === 'error') return res.status(400).json(result);
    return res.json(result.data);
  });

  // POST /approve — jóváhagyás / elutasítás
  router.post('/approve', async (req, res) => {
    const { planId, decision } = req.body as { planId?: string; decision?: string };
    if (!planId || !decision) return res.status(400).json({ error: 'planId és decision kötelező' });

    const result = await agent.execute('approve', { planId, decision });
    if (result.status === 'error') return res.status(400).json(result);
    return res.json(result.data);
  });

  return router;
}
```

- [ ] **Step 6: Regisztrálás index.ts-ben**

```typescript
import { createPSalesStrategyRoutes } from "./psales-strategy.js";
// ...
router.use("/psales/strategy", createPSalesStrategyRoutes());
```

- [ ] **Step 7: Build + teszt**

```bash
npm run build && npx vitest run test/strategyPlannerAgent.test.ts
```
Elvárt: PASS

- [ ] **Step 8: Commit**

```bash
git add src/agents/StrategyPlannerAgent.ts src/server/routes/psales-strategy.ts src/server/routes/index.ts test/strategyPlannerAgent.test.ts
git commit -m "feat(p-sales): StrategyPlannerAgent + strategy route + approval gate (Phase 5)"
```

---

## Task 9: PSalesStrategyPanel Dashboard

**Files:**
- Create: `src/dashboard/components/dashboard/PSalesStrategyPanel.tsx`
- Modify: `src/dashboard/lib/navigation.tsx`

- [ ] **Step 1: Panel implementálása**

`src/dashboard/components/dashboard/PSalesStrategyPanel.tsx`:
```typescript
import React, { useState } from 'react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Target, CheckCircle2, XCircle, Clock, Users } from 'lucide-react';
import { toast } from 'sonner';

interface Channel { name: string; priority: 'high' | 'medium' | 'low'; description: string; }
interface StrategyPlan {
  planId: string; propertyType: string; location: string; estimatedValue: number;
  approvalState: 'pending' | 'approved' | 'rejected';
  channels: Channel[]; targetSegments: string[]; approvalSteps: string[];
  summary: string; generatedAt: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  high: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
  medium: 'border-yellow-500/20 bg-yellow-500/10 text-yellow-300',
  low: 'border-zinc-500/20 bg-zinc-500/10 text-zinc-400',
};

const APPROVAL_COLORS: Record<string, string> = {
  pending: 'border-yellow-500/20 bg-yellow-500/10 text-yellow-300',
  approved: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
  rejected: 'border-red-500/20 bg-red-500/10 text-red-300',
};

export function PSalesStrategyPanel() {
  const [form, setForm] = useState({ propertyType: 'apartment', location: 'Budapest', estimatedValue: 100000 });
  const [plan, setPlan] = useState<StrategyPlan | null>(null);
  const [loading, setLoading] = useState(false);

  const generatePlan = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/psales/strategy/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json() as StrategyPlan;
      setPlan(data);
      toast.success('Stratégiai terv elkészült — jóváhagyás szükséges');
    } catch {
      toast.error('Terv generálás sikertelen.');
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (decision: 'approved' | 'rejected') => {
    if (!plan) return;
    try {
      const res = await fetch('/api/psales/strategy/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: plan.planId, decision }),
      });
      const data = await res.json() as StrategyPlan;
      setPlan(data);
      if (decision === 'approved') toast.success('Terv jóváhagyva — végrehajtás engedélyezett!');
      else toast.info('Terv elutasítva — újratervezés szükséges.');
    } catch {
      toast.error('Döntés rögzítése sikertelen.');
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-white/[0.04] bg-white/[0.03] backdrop-blur-xl">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm text-white">
            <Target className="h-4 w-4 text-primary" />
            Értékesítési Stratégia Tervező
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <label className="text-xs text-zinc-400">Típus</label>
              <select
                value={form.propertyType}
                onChange={e => setForm(f => ({ ...f, propertyType: e.target.value }))}
                className="w-full rounded-lg border border-white/[0.08] bg-[#050816] px-3 py-2 text-sm text-white"
              >
                <option value="apartment">Lakás</option>
                <option value="house">Ház</option>
                <option value="industrial">Ipari</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-400">Lokáció</label>
              <input
                value={form.location}
                onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-400">Becsült érték (EUR)</label>
              <input
                type="number"
                value={form.estimatedValue}
                onChange={e => setForm(f => ({ ...f, estimatedValue: Number(e.target.value) }))}
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
              />
            </div>
          </div>
          <Button
            className="w-full bg-primary/20 text-primary hover:bg-primary/30 border border-primary/20"
            onClick={generatePlan}
            disabled={loading}
          >
            {loading ? 'Terv generálás...' : 'Stratégia generálása'}
          </Button>
        </CardContent>
      </Card>

      {plan && (
        <>
          <Card className="border-white/[0.04] bg-white/[0.03] backdrop-blur-xl">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm text-white">Csatorna Mix</CardTitle>
                <Badge className={APPROVAL_COLORS[plan.approvalState] ?? ''}>
                  {plan.approvalState === 'pending' && <Clock className="mr-1 h-3 w-3" />}
                  {plan.approvalState === 'approved' && <CheckCircle2 className="mr-1 h-3 w-3" />}
                  {plan.approvalState === 'rejected' && <XCircle className="mr-1 h-3 w-3" />}
                  {plan.approvalState.toUpperCase()}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {plan.channels.map(ch => (
                <div key={ch.name} className="flex items-start gap-3 rounded-lg border border-white/[0.04] bg-white/[0.02] p-3">
                  <Badge className={`shrink-0 text-[10px] ${PRIORITY_COLORS[ch.priority] ?? ''}`}>{ch.priority}</Badge>
                  <div>
                    <p className="text-sm font-medium text-white">{ch.name}</p>
                    <p className="text-xs text-zinc-500">{ch.description}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-white/[0.04] bg-white/[0.03] backdrop-blur-xl">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm text-white">
                <Users className="h-4 w-4 text-primary" />
                Célcsoportok
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {plan.targetSegments.map(seg => (
                <Badge key={seg} variant="outline" className="border-white/[0.08] bg-white/[0.04] text-zinc-300">
                  {seg}
                </Badge>
              ))}
            </CardContent>
          </Card>

          {plan.approvalState === 'pending' && (
            <div className="flex gap-3">
              <Button
                className="flex-1 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/20"
                onClick={() => handleApproval('approved')}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Jóváhagyás
              </Button>
              <Button
                className="flex-1 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20"
                onClick={() => handleApproval('rejected')}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Elutasítás
              </Button>
            </div>
          )}

          {plan.approvalState === 'approved' && (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-300">
              ✓ Terv jóváhagyva — végrehajtás elindítható.
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: navigation.tsx frissítése**

Import:
```typescript
import { PSalesStrategyPanel } from "@/components/dashboard/PSalesStrategyPanel";
```

Item (a `psales-research` után):
```typescript
{ id: "psales-strategy", label: "P-Sales Stratégia", icon: Target, component: <PSalesStrategyPanel /> },
```

`"Enterprise"` group-ba add hozzá: `"psales-strategy"`.

- [ ] **Step 3: Build ellenőrzés**

```bash
npm run build:ui
```

- [ ] **Step 4: Commit**

```bash
git add src/dashboard/components/dashboard/PSalesStrategyPanel.tsx src/dashboard/lib/navigation.tsx
git commit -m "feat(p-sales): PSalesStrategyPanel dashboard — stratégia és approval panel"
```

---

## Task 10: Track lezárás + Teljes Teszt

**Files:**
- Modify: `conductor/tracks/P-Sales20260327/meta.json`
- Modify: `conductor/tracks.md`

- [ ] **Step 1: Teljes test suite futtatása**

```bash
npm run test:fast
```
Elvárt: PASS — beleértve az összes új P-Sales tesztet

- [ ] **Step 2: Full build ellenőrzés**

```bash
npm run build && npm run build:ui
```
Elvárt: mindkettő hibamentes

- [ ] **Step 3: meta.json frissítése 100%-ra**

`conductor/tracks/P-Sales20260327/meta.json` — frissítsd:
```json
{
  "status": "completed",
  "progress": 100,
  "completedAt": "<aktuális ISO dátum>",
  "phases": [
    { "name": "Phase 0: Architektúra és szállítási modell", "status": "completed" },
    { "name": "Phase 1: Enterprise dashboard integráció", "status": "completed" },
    { "name": "Phase 2: Standalone alkalmazás + auth", "status": "completed" },
    { "name": "Phase 3: Intake és felmérő ügynök", "status": "completed" },
    { "name": "Phase 4: Kutató és értékelő ügynök", "status": "completed" },
    { "name": "Phase 5: Stratégia és akcióterv", "status": "completed" },
    { "name": "Phase 6: Értékesítési végrehajtás", "status": "completed" },
    { "name": "Phase 7: Cloudflare opció", "status": "completed" }
  ]
}
```

- [ ] **Step 4: tracks.md frissítése**

A P-Sales20260327 sort módosítsd: `progress: 100%`, és jelöld `[x]`-szel.

- [ ] **Step 5: Záró commit**

```bash
git add conductor/tracks/P-Sales20260327/meta.json conductor/tracks.md
git commit -m "feat(p-sales): complete Phase 2-5 — IntakeSurvey, Research, Strategy, Auth"
```

---

## Összefoglalás

| Task | Fájlok | Teszt |
|------|--------|-------|
| 1. Track visszaállítás | meta.json move, tracks.md | — |
| 2. JWT Auth Backend | psales-auth.ts, index.ts | psalesAuth.test.ts (6) |
| 3. Standalone Auth Frontend | auth/*.tsx, App.tsx | — |
| 4. IntakeSurveyAgent | IntakeSurveyAgent.ts, psales-intake.ts | intakeSurveyAgent.test.ts (8) |
| 5. PSalesIntakePanel | PSalesIntakePanel.tsx, navigation.tsx | — |
| 6. PropertyResearchAgent | PropertyResearchAgent.ts, psales-research.ts | propertyResearchAgent.test.ts (6) |
| 7. PSalesResearchPanel | PSalesResearchPanel.tsx, navigation.tsx | — |
| 8. StrategyPlannerAgent | StrategyPlannerAgent.ts, psales-strategy.ts | strategyPlannerAgent.test.ts (8) |
| 9. PSalesStrategyPanel | PSalesStrategyPanel.tsx, navigation.tsx | — |
| 10. Track lezárás | meta.json, tracks.md | `npm run test:fast` teljes suite |
