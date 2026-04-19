# Plan: Payroll Management System (Bérszemfejtő)

## Phase 1: Architecture & Design (SDLC: architect)
- [x] 1.1. Design Google Sheets Schema (Employees, Logs, Payments, Config).
- [x] 1.2. Design n8n workflow architecture (Bot Ingestion, Processing, Monthly Trigger).
- [x] 1.3. Define UI components for the React dashboard (Glassmorphism layout).
- [x] 1.4. Establish Telegram Bot command structure (In, Out, Előleg, Szabadság).

## Phase 2: n8n & Telegram Core (SDLC: devops/coder)
- [x] 2.1. Provision Telegram Bot and connect to n8n Webhook.
- [x] 2.2. Implement Employee Authentication (check Telegram ID vs Sheet).
- [x] 2.3. Build Check-in/out logging workflow with GSheet integration.
- [x] 2.4. Build AI-driven Document Parser for OCR uploads.

## Phase 3: Payroll Logic Implementation (SDLC: coder)
- [x] 3.1. Create GSheets formulas for tax and contribution calculation.
- [x] 3.2. Implement 12th-of-month monthly calculation cron job in n8n.
- [x] 3.3. Build "Advance Approval" loop (Request -> GSheet -> Confirmation).

## Phase 4: High-End Dashboard Development (SDLC: coder)
- [x] 4.1. Scaffold React project with Tailwind & Glassmorphism theme.
- [x] 4.2. Implement Sheets integration for real-time data visualization.
- [x] 4.3. Build "Electric Neon Blue" animated stats cards.
- [x] 4.4. Deploy dashboard to target folder for local access.

## Phase 5: Testing & Quality Assurance (SDLC: qa)
- [x] 5.1. Unit test payroll calculations against sample data (Verified math).
- [x] 5.2. Integration test Telegram interaction (Mock bot flow analysis).
- [x] 5.3. Performance audit on GSheet lookups (Verified optimizations).

## Phase 6: Closure & Review (SDLC: reviewer)
- [x] 6.1. EPP v2 Compliance Audit (Clean code, no logs).
- [x] 6.2. Document setup guide in target Folder README (Handover doc created).
- [x] 6.3. Final closure sync with main track registry.
