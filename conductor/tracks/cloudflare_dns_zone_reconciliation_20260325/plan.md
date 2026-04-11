# Plan - Cloudflare DNS Zone Reconciliation for Custom Domains

## Phase 1 - Recovery

- [x] Mark the archived state as invalid and reopen the track.
- [x] Restore a concrete spec and plan so the remaining work is explicit.

## Phase 2 - Implementation Discovery

- [ ] Trace the exact Cloudflare DNS binding flow and current ownership.
- [ ] Identify the code or workflow surface that should enforce post-deploy domain-health checks.

## Phase 3 - Delivery

- [ ] Implement the missing reconciliation and verification work.
- [ ] Add tests or deployment checks that prove the scope is complete.
