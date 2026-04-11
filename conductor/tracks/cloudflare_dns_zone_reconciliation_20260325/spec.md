# Spec - Cloudflare DNS Zone Reconciliation for Custom Domains

## Problem

The Cloudflare full optimization rollout explicitly deferred custom-domain DNS zone binding and domain-health verification into this follow-up track. The track was later marked archived without implementation evidence, code-level verification, or track artifacts.

## Scope

1. Reconcile the custom-domain DNS zone binding required by the Cloudflare tunnel and canonical host setup.
2. Define where domain-health verification should run after deploy.
3. Identify the exact backend, worker, CLI, or CI surfaces that must change before the work can be marked complete.

## Acceptance

- The custom-domain DNS binding path is documented with the owning integration point.
- The repository contains the code, config, or workflow updates required to verify domain health.
- The track can only move to `completed` after build, tests, and evidence-bearing changes exist.
