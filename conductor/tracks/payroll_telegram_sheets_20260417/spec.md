# Specification: Payroll Management System (Bérszemfejtő)

## Overview
A comprehensive payroll and employee management system leveraging Telegram for worker interaction, Google Sheets as the data engine, and n8n for workflow orchestration. A high-end React dashboard provides administrative oversight.

## Core Functional Requirements

### 1. Telegram Worker Interface (n8n + Telegram Bot API)
- **Check-in/Check-out**: Workers log arrival and departure via buttons. Location verification included.
- **Advance Requests (Előleg kérése)**: Dedicated command for requesting salary advances with amount and reason.
- **Vacation/Leave (Szabadság kérése)**: Requesting days off directly from the bot.
- **Document Ingestion**: Uploading photos/PDFs (overtime requests, expense receipts). Bot uses OCR/AI (Gemini/Ollama) to parse and log.

### 2. Business Logic (Google Sheets + n8n)
- **Calculation Engine**: Every 12th of the month, the system reads attendance logs and calculates:
  - Base salary (pro-rated).
  - Taxes and contributions (Hungarian payroll rules).
  - Mandatory deductions.
  - Advance subtractions.
- **Data Source**: Google Sheets for centralized, editable records.

### 3. Management Dashboard (React)
- **UI/UX Style**:
  - Theme: Premium Dark mode (Deep Charcoal/Black #0D0F14).
  - Accent color: Electric Neon Blue (#00D2FF).
  - Elements: Glassmorphism (`backdrop-filter: blur(12px)`), card-based layout, animated transitions.
- **Panels**:
  - **Employee Status**: Real-time view of who is checked in.
  - **Payroll Summary**: Total monthly payout projections.
  - **Advance Approvals**: Manager interface to approve/deny salary advances.
  - **Attendance Heatmap**: Visual activity history.

## Technical Stack
- **Backend / Orchestration**: n8n (hosted/local).
- **Communication**: Telegram Bot.
- **Database**: Google Sheets (Apps Script hooks for real-time updates).
- **Frontend**: React 19, Tailwind CSS, Framer Motion (for animations), Lucide icons.
- **AI**: Gemini 1.5 Pro (via n8n) for document parsing and intent detection.

## Quality Standards (Phoenix Protocol)
- **Security**: Strict validation of Telegram user IDs against the Employee Registry.
- **Reliability**: Checkpoint-based n8n workflows (Phoenix retry pattern).
- **Maintainability**: Clean ESM frontend architecture with distinct hooks for data fetching.
