# Implementációs Terv: Sandbox & Security Hardening
**Track ID:** `sandbox_security_hardening_20260323`

---

## Phase 1: WASM Sandbox

* [ ] **Task 1.1** — `src/core/sandbox/wasmSandbox.ts`
  - `isolated-vm` vagy `vm2` npm package integráció
  - `WASMSandbox` class: create, execute, destroy
  - `executeInSandbox(code, options)`: izolált JS/TS futtatás

* [ ] **Task 1.2** — Resource limits
  - `maxMemoryMB`: memory limit (default: 128MB)
  - `maxCpuMs`: CPU time limit (default: 5000ms)
  - `maxOutputSize`: output méret limit (default: 1MB)
  - Limit exceeded → SandboxTimeoutError / SandboxOOMError

* [ ] **Task 1.3** — Sandbox pool
  - Pre-warmed sandbox instance-ok (pool size: 3)
  - Reuse: execute → reset → return to pool
  - Pool exhaustion: queue + timeout

* [ ] **Task 1.4** — Tesztek: `test/sandbox/wasmSandbox.test.ts`
  - Basic execution: 1+1 = 2
  - Memory limit: túllépés → error
  - CPU limit: infinite loop → timeout
  - Isolation: no access to host `process`, `fs`, `require`

## Phase 2: Network Isolation

* [ ] **Task 2.1** — `src/core/sandbox/networkPolicy.ts`
  - Whitelist/blacklist policy definition
  - `checkNetworkAccess(url)`: URL → allow/deny
  - Config: `config/security/network-policy.yaml`

* [ ] **Task 2.2** — E2B sandbox bővítés
  - `e2bSandbox.ts`: network policy paraméter
  - Egress monitoring: outbound request logging

* [ ] **Task 2.3** — DNS filtering
  - Sandbox DNS resolver: only whitelisted domains
  - Metadata endpoint blocking (169.254.*)

## Phase 3: RBAC Hardening

* [ ] **Task 3.1** — `src/core/rbac/agentPermissions.ts`
  - Per-agent permission profil betöltés
  - `getPermissions(agentName)`: permission lookup
  - `checkPermission(agentName, action, resource)`: allow/deny

* [ ] **Task 3.2** — registry.json bővítés
  - `permissions` mező: file_read, file_write, network, code_exec, tools
  - Default role: 'readonly' (principle of least privilege)
  - Migration script: meglévő agent-ek → default permissions

* [ ] **Task 3.3** — Runtime enforcement
  - MCP tool hívás előtt permission check
  - File műveletek előtt Safe Zone + RBAC check
  - Permission denied → structured error + audit log

## Phase 4: Monitoring + Dashboard + CLI

* [ ] **Task 4.1** — Sandbox metrikák
  - Prometheus: `bas_sandbox_executions_total`, `bas_sandbox_timeouts_total`
  - Memory peak tracking per execution
  - Audit trail: ki futtatott mit, mikor

* [ ] **Task 4.2** — Permission violation alerting
  - Violation log: SQLite `security_violations` tábla
  - Alert threshold: 5+ violation / agent / óra → warning

* [ ] **Task 4.3** — Dashboard: `SecurityPanel.tsx`
  - Sandbox stats: executions, timeouts, memory usage
  - RBAC map: agent → permissions vizualizáció
  - Violation log: utolsó 50 violation timeline

* [ ] **Task 4.4** — CLI: `src/cli/commands/security-hu.ts`
  - `brunella security audit`: teljes RBAC audit
  - `brunella security permissions <agent>`: agent jogosultságok
  - `brunella security sandbox-stats`: sandbox statisztikák

---

## 🎯 Sikerességi Kritériumok

1. WASM sandbox: JS/TS izolált futtatás, host access blocked
2. Resource limits: memory/CPU túllépés → structured error
3. Network isolation: whitelist → only allowed domains
4. Per-agent RBAC: registry.json permissions
5. Permission denied → audit log + structured error
6. Dashboard SecurityPanel + CLI `brunella security`
7. Összes teszt PASS
