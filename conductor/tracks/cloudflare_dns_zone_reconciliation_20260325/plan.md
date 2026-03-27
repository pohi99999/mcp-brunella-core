# Plan — Cloudflare DNS Zone Reconciliation for Custom Domains

## Phase 1 — Discovery

- [x] cloudflared tunnel auth és named tunnel állapot validálása.
- [x] Cloudflare zone lookup futtatása elérhető hitelesítésekkel.
- [ ] Kanonikus zone tulajdonosi forrás azonosítása.

## Phase 2 — DNS Repair

- [ ] `api.bas.<domain>` rekord létrehozása / javítása.
- [ ] `browser-use.bas.<domain>` rekord létrehozása / javítása.
- [ ] `n8n.bas.<domain>` rekord létrehozása / javítása.

## Phase 3 — Validation

- [ ] Domain health check PASS.
- [ ] Tunnel ingress + DNS mapping dokumentáció frissítve.